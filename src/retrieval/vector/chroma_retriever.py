# SPDX-License-Identifier: Apache-2.0
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0

"""
Vector retriever for warehouse operations (ChromaDB backend).

Backed by a local, persistent ChromaDB collection so the assistant
runs on a laptop with no vector-database server. The public surface — the class
name `ChromaRetriever`, `ChromaConfig`, `SearchResult`, and the
`get_chroma_retriever` / `close_chroma_retriever` factories — is intentionally
preserved so existing call sites keep working unchanged. (File/name rename is a
later cosmetic step.)
"""

import os
import re
import logging
from dataclasses import dataclass
from typing import Dict, List, Optional, Any

import chromadb
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

_REPO_ROOT_DIR = os.path.dirname(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)
_DEFAULT_CHROMA_DIR = os.path.join(_REPO_ROOT_DIR, "data", "chroma")


@dataclass
class ChromaConfig:
    """Vector store configuration (ChromaDB)."""

    persist_directory: str = os.getenv("CHROMA_DIR", _DEFAULT_CHROMA_DIR)
    collection_name: str = os.getenv("CHROMA_COLLECTION", "warehouse_docs")
    dimension: int = int(os.getenv("EMBEDDING_DIMENSION", "384"))
    # Retained for backward compatibility with any code that reads these:
    metric_type: str = "cosine"


@dataclass
class SearchResult:
    """Search result from the vector database."""

    id: str
    content: str
    metadata: Dict[str, Any]
    score: float
    distance: float


_EQ_EXPR_RE = re.compile(r'(\w+)\s*==\s*"([^"]*)"')


def _expr_to_where(filter_expr: Optional[str]) -> Optional[dict]:
    """Translate a simple `field == "value"` filter expression to a
    ChromaDB `where` dict. Returns None if nothing usable is found."""
    if not filter_expr:
        return None
    matches = _EQ_EXPR_RE.findall(filter_expr)
    if not matches:
        return None
    conditions = {k: v for k, v in matches}
    if len(conditions) == 1:
        k, v = next(iter(conditions.items()))
        return {k: v}
    return {"$and": [{k: v} for k, v in conditions.items()]}


class ChromaRetriever:
    """ChromaDB-backed vector retriever for warehouse operations."""

    def __init__(self, config: Optional[ChromaConfig] = None):
        self.config = config or ChromaConfig()
        self._client = None
        self.collection = None
        self._connected = False

    async def connect(self) -> None:
        """Open (or create) the persistent Chroma client and collection."""
        if self._connected and self.collection is not None:
            return
        os.makedirs(self.config.persist_directory, exist_ok=True)
        self._client = chromadb.PersistentClient(path=self.config.persist_directory)
        self.collection = self._client.get_or_create_collection(
            name=self.config.collection_name,
            metadata={"hnsw:space": self.config.metric_type},
        )
        self._connected = True
        logger.info(
            "Chroma collection '%s' ready at %s",
            self.config.collection_name,
            self.config.persist_directory,
        )

    async def disconnect(self) -> None:
        self.collection = None
        self._client = None
        self._connected = False

    async def create_collection(self) -> None:
        await self.connect()

    async def load_collection(self) -> None:
        await self.connect()

    async def insert_documents(self, documents: List[Dict[str, Any]]) -> bool:
        """Insert documents (each: id, content, embedding, doc_type?, category?,
        created_at?) into the collection."""
        try:
            if not self.collection:
                await self.connect()
            if not documents:
                return True
            self.collection.upsert(
                ids=[str(doc["id"]) for doc in documents],
                embeddings=[doc["embedding"] for doc in documents],
                documents=[doc.get("content", "") for doc in documents],
                metadatas=[
                    {
                        "doc_type": doc.get("doc_type", "general"),
                        "category": doc.get("category", "warehouse"),
                        "created_at": doc.get("created_at", "2024-01-01"),
                    }
                    for doc in documents
                ],
            )
            logger.info(f"Inserted {len(documents)} documents into collection")
            return True
        except Exception as e:
            logger.error(f"Failed to insert documents: {e}")
            return False

    async def search_similar(
        self,
        query_embedding: List[float],
        top_k: int = 10,
        filter_expr: Optional[str] = None,
        score_threshold: float = 0.0,
    ) -> List[SearchResult]:
        """Search for similar documents by vector similarity (cosine)."""
        try:
            if not self.collection:
                await self.connect()

            where = _expr_to_where(filter_expr)
            query_kwargs = dict(
                query_embeddings=[query_embedding],
                n_results=top_k,
                include=["documents", "metadatas", "distances"],
            )
            if where:
                query_kwargs["where"] = where

            res = self.collection.query(**query_kwargs)

            ids = (res.get("ids") or [[]])[0]
            docs = (res.get("documents") or [[]])[0]
            metas = (res.get("metadatas") or [[]])[0]
            dists = (res.get("distances") or [[]])[0]

            search_results: List[SearchResult] = []
            for i, _id in enumerate(ids):
                distance = dists[i] if i < len(dists) else 0.0
                # Cosine distance -> similarity score.
                score = 1.0 - float(distance)
                if score >= score_threshold:
                    meta = metas[i] if i < len(metas) else {}
                    search_results.append(
                        SearchResult(
                            id=_id,
                            content=docs[i] if i < len(docs) else "",
                            metadata=meta or {},
                            score=score,
                            distance=float(distance),
                        )
                    )
            logger.info(f"Found {len(search_results)} similar documents")
            return search_results
        except Exception as e:
            logger.error(f"Search failed: {e}")
            return []

    async def search_by_category(
        self, category: str, query_embedding: List[float], top_k: int = 10
    ) -> List[SearchResult]:
        return await self.search_similar(
            query_embedding=query_embedding,
            top_k=top_k,
            filter_expr=f'category == "{category}"',
        )

    async def get_collection_stats(self) -> Dict[str, Any]:
        try:
            if not self.collection:
                await self.connect()
            count = self.collection.count()
            return {
                "collection_name": self.config.collection_name,
                "num_entities": count,
                "is_empty": count == 0,
                "description": "ChromaDB persistent collection",
            }
        except Exception as e:
            logger.error(f"Failed to get collection stats: {e}")
            return {}

    async def health_check(self) -> bool:
        try:
            if not self.collection:
                await self.connect()
            self.collection.count()
            return True
        except Exception as e:
            logger.error(f"Vector store health check failed: {e}")
            return False


# Global retriever instance
_chroma_retriever: Optional[ChromaRetriever] = None


async def get_chroma_retriever() -> ChromaRetriever:
    """Get or create the global vector retriever instance."""
    global _chroma_retriever
    if _chroma_retriever is None:
        _chroma_retriever = ChromaRetriever()
        await _chroma_retriever.connect()
    return _chroma_retriever


async def close_chroma_retriever() -> None:
    """Close the global vector retriever instance."""
    global _chroma_retriever
    if _chroma_retriever:
        await _chroma_retriever.disconnect()
        _chroma_retriever = None
