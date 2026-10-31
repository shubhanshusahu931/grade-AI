"""
app/services/scrapers/base.py

Abstract interface every platform scraper implements. This is what makes
adding a 7th platform later a matter of dropping in one new file: define
`platform_name` and implement `fetch()`, nothing else needs to change.
"""
from abc import ABC, abstractmethod

import httpx

from app.schemas.sync import PlatformResult


class BaseScraper(ABC):
    """Common contract for all platform scrapers/API clients."""

    platform_name: str

    def __init__(self, client: httpx.AsyncClient):
        self.client = client

    @abstractmethod
    async def fetch(self, **kwargs) -> PlatformResult:
        """
        Fetch this platform's stats and return a PlatformResult.
        Implementations should raise on unexpected errors -- the caller
        (services/fetcher.py) wraps every scraper in a timeout + exception
        boundary, so raising here is safe and preferred over swallowing
        errors silently.
        """
        raise NotImplementedError

    def missing_handle_result(self) -> PlatformResult:
        return PlatformResult(platform=self.platform_name, success=False, error="no handle")
