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
Retry Handler with Exponential Backoff

Provides retry logic with exponential backoff for API calls and operations
that may fail due to transient errors.
"""

import asyncio
import logging
from typing import Callable, TypeVar, Optional, List, Any
from functools import wraps
import httpx

logger = logging.getLogger(__name__)

T = TypeVar('T')


class RetryConfig:
    """Configuration for retry behavior."""

    def __init__(
        self,
        max_retries: int = 3,
        initial_delay: float = 1.0,
        max_delay: float = 60.0,
        exponential_base: float = 2.0,
        retryable_exceptions: Optional[List[type]] = None,
    ):
        self.max_retries = max_retries
        self.initial_delay = initial_delay
        self.max_delay = max_delay
        self.exponential_base = exponential_base
        self.retryable_exceptions = retryable_exceptions or [
            httpx.TimeoutException,
            httpx.NetworkError,
            httpx.ConnectError,
            httpx.ReadTimeout,
            ConnectionError,
            TimeoutError,
        ]


async def retry_with_backoff(
    func: Callable[..., T],
    *args,
    config: Optional[RetryConfig] = None,
    **kwargs,
) -> T:
    """
    Execute a function with retry logic and exponential backoff.

    Args:
        func: Async function to execute
        *args: Positional arguments for the function
        config: Retry configuration (optional)
        **kwargs: Keyword arguments for the function

    Returns:
        Result from the function

    Raises:
        Last exception if all retries fail
    """
    if config is None:
        config = RetryConfig()

    last_exception = None
    delay = config.initial_delay

    for attempt in range(config.max_retries + 1):
        try:
            if asyncio.iscoroutinefunction(func):
                return await func(*args, **kwargs)
            else:
                return func(*args, **kwargs)
        except Exception as e:
            last_exception = e

            # Check if exception is retryable
            is_retryable = any(
                isinstance(e, exc_type) for exc_type in config.retryable_exceptions
            )

            if not is_retryable:
                logger.error(f"Non-retryable exception: {type(e).__name__}: {e}")
                raise

            if attempt < config.max_retries:
                logger.warning(
                    f"Attempt {attempt + 1}/{config.max_retries + 1} failed: {type(e).__name__}: {e}. "
                    f"Retrying in {delay:.2f}s..."
                )
                await asyncio.sleep(delay)
                delay = min(delay * config.exponential_base, config.max_delay)
            else:
                logger.error(
                    f"All {config.max_retries + 1} attempts failed. Last error: {type(e).__name__}: {e}"
                )

    # If we get here, all retries failed
    raise last_exception


def retryable(
    max_retries: int = 3,
    initial_delay: float = 1.0,
    max_delay: float = 60.0,
    exponential_base: float = 2.0,
    retryable_exceptions: Optional[List[type]] = None,
):
    """
    Decorator for adding retry logic with exponential backoff to async functions.

    Usage:
        @retryable(max_retries=3, initial_delay=1.0)
        async def my_api_call():
            ...
    """

    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @wraps(func)
        async def wrapper(*args, **kwargs) -> T:
            config = RetryConfig(
                max_retries=max_retries,
                initial_delay=initial_delay,
                max_delay=max_delay,
                exponential_base=exponential_base,
                retryable_exceptions=retryable_exceptions,
            )
            return await retry_with_backoff(func, *args, config=config, **kwargs)

        return wrapper

    return decorator


class CircuitBreaker:
    """Simple circuit breaker pattern for API calls."""

    def __init__(
        self,
        failure_threshold: int = 5,
        recovery_timeout: float = 60.0,
        half_open_max_calls: int = 3,
    ):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.half_open_max_calls = half_open_max_calls
        self.failure_count = 0
        self.last_failure_time: Optional[float] = None
        self.state = "closed"  # closed, open, half_open
        self.half_open_calls = 0

    async def call(self, func: Callable[..., T], *args, **kwargs) -> T:
        """Execute function with circuit breaker protection."""
        import time

        # Check circuit state
        if self.state == "open":
            if self.last_failure_time:
                elapsed = time.time() - self.last_failure_time
                if elapsed >= self.recovery_timeout:
                    logger.info("Circuit breaker entering half-open state")
                    self.state = "half_open"
                    self.half_open_calls = 0
                else:
                    raise Exception(
                        f"Circuit breaker is OPEN. Retry after {self.recovery_timeout - elapsed:.1f}s"
                    )
            else:
                raise Exception("Circuit breaker is OPEN")

        try:
            if asyncio.iscoroutinefunction(func):
                result = await func(*args, **kwargs)
            else:
                result = func(*args, **kwargs)

            # Success - reset circuit breaker
            if self.state == "half_open":
                self.half_open_calls += 1
                if self.half_open_calls >= self.half_open_max_calls:
                    logger.info("Circuit breaker closed - service recovered")
                    self.state = "closed"
                    self.failure_count = 0
                    self.half_open_calls = 0
            elif self.state == "closed":
                self.failure_count = 0

            return result

        except Exception as e:
            self.failure_count += 1
            self.last_failure_time = time.time()

            if self.failure_count >= self.failure_threshold:
                logger.error(
                    f"Circuit breaker OPENED after {self.failure_count} failures"
                )
                self.state = "open"

            raise

