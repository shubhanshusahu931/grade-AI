"""app/services/scrapers/hackerearth.py - HackerEarth profile scraper."""
import re

from app.core.constants import DEFAULT_REQUEST_HEADERS, HACKEREARTH_PROFILE_BASE
from app.schemas.sync import PlatformResult
from app.services.scrapers.base import BaseScraper


class HackerEarthScraper(BaseScraper):
    platform_name = "hackerearth"

    async def fetch(self, handle: str | None = None, **kwargs) -> PlatformResult:
        if not handle:
            return self.missing_handle_result()

        clean_handle = handle.lstrip("@").strip()
        url = f"{HACKEREARTH_PROFILE_BASE}/@{clean_handle}/"

        try:
            resp = await self.client.get(url, headers=DEFAULT_REQUEST_HEADERS)
            if resp.status_code == 404:
                return PlatformResult(
                    platform=self.platform_name,
                    success=False,
                    error=f"User @{clean_handle} not found",
                )
            resp.raise_for_status()
            html = resp.text

            # Match solved count from HackerEarth profile markup
            # e.g. "Problems Solved" or "track-metric"
            solved = 0
            rating = None

            solved_match = re.search(r'(\d+)\s*(?:Problems?\s*Solved|problems?\s*solved)', html, re.IGNORECASE)
            if not solved_match:
                solved_match = re.search(r'"problems_solved":\s*(\d+)', html)
            if solved_match:
                solved = int(solved_match.group(1))

            rating_match = re.search(r'Rating\s*[:\n\r\t]*\s*(\d+)', html, re.IGNORECASE)
            if rating_match:
                rating = float(rating_match.group(1))

            return PlatformResult(
                platform=self.platform_name,
                success=True,
                solved=solved,
                rating=rating,
                raw={"handle": clean_handle, "solved": solved, "rating": rating},
            )
        except Exception as e:
            return PlatformResult(
                platform=self.platform_name,
                success=False,
                error=str(e),
                raw={"handle": clean_handle},
            )

