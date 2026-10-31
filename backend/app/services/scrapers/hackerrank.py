"""app/services/scrapers/hackerrank.py - HackerRank badges endpoint."""
from app.core.constants import DEFAULT_REQUEST_HEADERS, HACKERRANK_BADGES_BASE
from app.schemas.sync import PlatformResult
from app.services.scrapers.base import BaseScraper


class HackerRankScraper(BaseScraper):
    platform_name = "hackerrank"

    async def fetch(self, handle: str | None = None, **kwargs) -> PlatformResult:
        if not handle:
            return self.missing_handle_result()

        resp = await self.client.get(
            f"{HACKERRANK_BADGES_BASE}/{handle}/badges", headers=DEFAULT_REQUEST_HEADERS
        )
        resp.raise_for_status()
        data = resp.json()
        badges = data.get("models", [])
        solved = sum(b.get("solved", 0) for b in badges)

        return PlatformResult(
            platform=self.platform_name,
            success=True,
            solved=solved,
            rating=None,
            raw={"handle": handle, "solved": solved, "badge_count": len(badges)},
        )
