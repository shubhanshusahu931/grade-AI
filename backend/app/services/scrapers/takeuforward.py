"""app/services/scrapers/takeuforward.py - TakeUForward (Striver's DSA Sheet) scraper."""
import re

from app.core.constants import DEFAULT_REQUEST_HEADERS, TAKEUFORWARD_PROFILE_BASE
from app.schemas.sync import PlatformResult
from app.services.scrapers.base import BaseScraper


class TakeUForwardScraper(BaseScraper):
    platform_name = "takeuforward"

    async def fetch(self, handle: str | None = None, **kwargs) -> PlatformResult:
        if not handle:
            return self.missing_handle_result()

        clean_handle = handle.strip()
        url = f"{TAKEUFORWARD_PROFILE_BASE}/{clean_handle}"

        try:
            resp = await self.client.get(url, headers=DEFAULT_REQUEST_HEADERS)
            if resp.status_code == 404:
                return PlatformResult(
                    platform=self.platform_name,
                    success=False,
                    error=f"TUF profile '{clean_handle}' not found",
                )
            resp.raise_for_status()
            html = resp.text

            # Match completed / solved problem count
            solved = 0
            # Common patterns on TUF profile page: "Problems Solved", "Completed: X/450"
            solved_match = re.search(r'(\d+)\s*(?:/\s*\d+)?\s*(?:problems?|solved|completed)', html, re.IGNORECASE)
            if not solved_match:
                solved_match = re.search(r'"solved":\s*(\d+)', html)
            if solved_match:
                solved = int(solved_match.group(1))

            return PlatformResult(
                platform=self.platform_name,
                success=True,
                solved=solved,
                rating=None,
                raw={"handle": clean_handle, "solved": solved},
            )
        except Exception as e:
            return PlatformResult(
                platform=self.platform_name,
                success=False,
                error=str(e),
                raw={"handle": clean_handle},
            )

