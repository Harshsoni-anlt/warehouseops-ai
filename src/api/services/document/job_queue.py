# SPDX-FileCopyrightText: Copyright (c) 2025 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: Apache-2.0
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""
Document Processing Job Queue

Simple Redis-based job queue for document processing tasks.
Provides job status tracking, retry mechanisms, and priority support.
"""

import logging
import json
import uuid
from typing import Dict, Any, Optional, Callable
from datetime import datetime, timedelta
from enum import Enum
import os

logger = logging.getLogger(__name__)

# Try to import redis
try:
    import redis.asyncio as redis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False
    logger.warning("Redis not available, job queue will use in-memory fallback")


class JobStatus(str, Enum):
    """Job status enumeration."""
    PENDING = "pending"
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    RETRYING = "retrying"
    CANCELLED = "cancelled"


class JobQueue:
    """Redis-based job queue for document processing."""

    def __init__(self):
        self.redis_client: Optional[redis.Redis] = None
        self.redis_available = False
        self.queue_name = "document_processing_queue"
        self.job_prefix = "doc_job:"
        self.fallback_queue: Dict[str, Dict[str, Any]] = {}

    async def initialize(self) -> None:
        """Initialize Redis connection (lazy initialization - only reads env when called)."""
        if not REDIS_AVAILABLE:
            logger.warning("Redis not available, using in-memory fallback")
            return

        try:
            # Read environment variables only when initialize() is called, not at import time
            redis_host = os.getenv("REDIS_HOST", "localhost")
            redis_port = int(os.getenv("REDIS_PORT", "6379"))
            redis_password = os.getenv("REDIS_PASSWORD")
            redis_db = int(os.getenv("REDIS_DB", "0"))

            if redis_password:
                redis_url = f"redis://:{redis_password}@{redis_host}:{redis_port}/{redis_db}"
            else:
                redis_url = f"redis://{redis_host}:{redis_port}/{redis_db}"

            self.redis_client = redis.from_url(
                redis_url,
                encoding="utf-8",
                decode_responses=True,
            )
            await self.redis_client.ping()
            self.redis_available = True
            logger.info("✅ Job queue initialized with Redis")
        except Exception as e:
            logger.warning(f"Redis not available for job queue, using in-memory fallback: {e}")
            self.redis_available = False
            self.redis_client = None

    async def enqueue_job(
        self,
        job_type: str,
        job_data: Dict[str, Any],
        priority: int = 0,
        max_retries: int = 3,
    ) -> str:
        """
        Enqueue a job for processing.

        Args:
            job_type: Type of job (e.g., 'process_document')
            job_data: Job data dictionary
            priority: Job priority (higher = more important, default: 0)
            max_retries: Maximum number of retries on failure

        Returns:
            Job ID
        """
        job_id = str(uuid.uuid4())
        job = {
            "id": job_id,
            "type": job_type,
            "data": job_data,
            "status": JobStatus.PENDING.value,
            "priority": priority,
            "max_retries": max_retries,
            "retry_count": 0,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
        }

        if self.redis_available and self.redis_client:
            try:
                # Store job data
                await self.redis_client.setex(
                    f"{self.job_prefix}{job_id}",
                    86400 * 7,  # 7 days TTL
                    json.dumps(job),
                )
                # Add to queue with priority
                await self.redis_client.zadd(
                    self.queue_name,
                    {job_id: priority},
                )
                logger.info(f"Enqueued job {job_id} with priority {priority}")
            except Exception as e:
                logger.error(f"Failed to enqueue job in Redis: {e}")
                # Fallback to in-memory
                self.fallback_queue[job_id] = job
        else:
            # In-memory fallback
            self.fallback_queue[job_id] = job

        return job_id

    async def get_job(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Get job by ID."""
        if self.redis_available and self.redis_client:
            try:
                job_data = await self.redis_client.get(f"{self.job_prefix}{job_id}")
                if job_data:
                    return json.loads(job_data)
            except Exception as e:
                logger.error(f"Failed to get job from Redis: {e}")

        # Fallback to in-memory
        return self.fallback_queue.get(job_id)

    async def update_job_status(
        self,
        job_id: str,
        status: JobStatus,
        error_message: Optional[str] = None,
        result: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """Update job status."""
        job = await self.get_job(job_id)
        if not job:
            return False

        job["status"] = status.value
        job["updated_at"] = datetime.now().isoformat()
        if error_message:
            job["error_message"] = error_message
        if result:
            job["result"] = result

        if self.redis_available and self.redis_client:
            try:
                await self.redis_client.setex(
                    f"{self.job_prefix}{job_id}",
                    86400 * 7,
                    json.dumps(job),
                )
                return True
            except Exception as e:
                logger.error(f"Failed to update job in Redis: {e}")

        # Fallback to in-memory
        self.fallback_queue[job_id] = job
        return True

    async def dequeue_job(self) -> Optional[Dict[str, Any]]:
        """Dequeue the highest priority job."""
        if self.redis_available and self.redis_client:
            try:
                # Get highest priority job (highest score = highest priority)
                job_ids = await self.redis_client.zrevrange(
                    self.queue_name, 0, 0, withscores=True
                )
                if not job_ids:
                    return None

                job_id = job_ids[0][0]
                job = await self.get_job(job_id)
                if job and job["status"] == JobStatus.PENDING.value:
                    # Remove from queue
                    await self.redis_client.zrem(self.queue_name, job_id)
                    await self.update_job_status(job_id, JobStatus.PROCESSING)
                    return job
            except Exception as e:
                logger.error(f"Failed to dequeue job from Redis: {e}")

        # Fallback to in-memory
        for job_id, job in sorted(
            self.fallback_queue.items(),
            key=lambda x: x[1].get("priority", 0),
            reverse=True,
        ):
            if job.get("status") == JobStatus.PENDING.value:
                job["status"] = JobStatus.PROCESSING.value
                job["updated_at"] = datetime.now().isoformat()
                self.fallback_queue[job_id] = job
                return job

        return None

    async def retry_job(self, job_id: str) -> bool:
        """Retry a failed job."""
        job = await self.get_job(job_id)
        if not job:
            return False

        retry_count = job.get("retry_count", 0)
        max_retries = job.get("max_retries", 3)

        if retry_count >= max_retries:
            await self.update_job_status(job_id, JobStatus.FAILED)
            return False

        job["retry_count"] = retry_count + 1
        job["status"] = JobStatus.RETRYING.value
        job["updated_at"] = datetime.now().isoformat()

        if self.redis_available and self.redis_client:
            try:
                await self.redis_client.setex(
                    f"{self.job_prefix}{job_id}",
                    86400 * 7,
                    json.dumps(job),
                )
                # Re-add to queue with lower priority
                await self.redis_client.zadd(
                    self.queue_name,
                    {job_id: job.get("priority", 0) - 1},
                )
                return True
            except Exception as e:
                logger.error(f"Failed to retry job in Redis: {e}")

        # Fallback to in-memory
        self.fallback_queue[job_id] = job
        return True

    async def close(self) -> None:
        """Close Redis connection."""
        if self.redis_client:
            await self.redis_client.close()


# Global job queue instance
_job_queue: Optional[JobQueue] = None


async def get_job_queue() -> JobQueue:
    """Get or create job queue instance."""
    global _job_queue
    if _job_queue is None:
        _job_queue = JobQueue()
        await _job_queue.initialize()
    return _job_queue

