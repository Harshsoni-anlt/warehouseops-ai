# SPDX-License-Identifier: Apache-2.0
"""Tests for the ChromaDB-backed vector retriever.

Run: pytest tests/test_vector_retriever.py
"""

import asyncio
import random
import tempfile

from src.retrieval.vector.milvus_retriever import (
    MilvusRetriever,
    MilvusConfig,
    _expr_to_where,
)


def _vec(seed):
    rnd = random.Random(seed)
    return [rnd.random() for _ in range(384)]


def test_expr_to_where():
    assert _expr_to_where('category == "safety"') == {"category": "safety"}
    assert _expr_to_where(None) is None


def _fresh_retriever():
    tmp = tempfile.mkdtemp()
    return MilvusRetriever(MilvusConfig(persist_directory=tmp))


def test_insert_search_and_filter():
    async def run():
        r = _fresh_retriever()
        await r.connect()
        docs = [
            {"id": "d1", "content": "forklift safety procedure", "embedding": _vec(1), "category": "safety"},
            {"id": "d2", "content": "inventory reorder policy", "embedding": _vec(2), "category": "inventory"},
            {"id": "d3", "content": "AMR charging guide", "embedding": _vec(3), "category": "equipment"},
        ]
        assert await r.insert_documents(docs) is True

        # exact-vector query returns the same doc first with a high score
        top = await r.search_similar(docs[0]["embedding"], top_k=2)
        assert top and top[0].id == "d1"
        assert top[0].score > 0.99

        # category filter isolates one document
        only = await r.search_by_category("inventory", _vec(9), top_k=5)
        assert [x.id for x in only] == ["d2"]

        # upsert is idempotent
        await r.insert_documents(docs)
        stats = await r.get_collection_stats()
        await r.disconnect()
        return stats

    stats = asyncio.run(run())
    assert stats["num_entities"] == 3
