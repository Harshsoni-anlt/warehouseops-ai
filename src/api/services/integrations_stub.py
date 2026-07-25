"""Local-mode stubs for enterprise integration services.

The original blueprint shipped connectors to external enterprise systems
(WMS, ERP/CMMS, IoT gateways, barcode/RFID scanners, time & attendance).
Those require licensed on-prem systems and are out of scope for the free,
laptop-runnable build.

Rather than delete every call site, we provide lightweight stubs so the agents
import and run cleanly. Any method call returns a structured "unavailable in
local deployment" response instead of raising, so the core assistant
(inventory Q&A, forecasting, equipment/safety retrieval over the local DB)
keeps working while write-backs to external systems are cleanly no-oped.
"""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)

_UNAVAILABLE = {
    "success": False,
    "available": False,
    "reason": "external integration not available in local deployment",
}


class _UnavailableService:
    """Any awaited attribute call returns a standard unavailable response."""

    def __init__(self, name: str) -> None:
        self._name = name

    def __getattr__(self, attr: str) -> Any:
        async def _noop(*args: Any, **kwargs: Any) -> dict:
            logger.debug(
                "Integration '%s.%s' called in local mode; returning unavailable.",
                self._name,
                attr,
            )
            return dict(_UNAVAILABLE)

        return _noop


async def get_wms_service() -> _UnavailableService:
    return _UnavailableService("wms")


async def get_erp_service() -> _UnavailableService:
    return _UnavailableService("erp")


async def get_iot_service() -> _UnavailableService:
    return _UnavailableService("iot")


async def get_scanning_service() -> _UnavailableService:
    return _UnavailableService("scanning")


async def get_attendance_service() -> _UnavailableService:
    return _UnavailableService("attendance")
