"""app/services/scrapers/codingninjas.py - Coding Ninjas / CodeStudio scraper."""
import re

from app.core.constants import DEFAULT_REQUEST_HEADERS, CODINGNINJAS_PROFILE_BASE
from app.schemas.sync import PlatformResult
from app.services.scrapers.base import BaseScraper


class CodingNinjasScraper(BaseScraper):
    platform_name = "codingninjas"

    async def fetch(self, handle: str | None = None, **kwargs) -> PlatformResult:
        if not handle:
            return self.missing_handle_result()

        clean_handle = handle.strip()
        url = f"{CODINGNINJAS_PROFILE_BASE}/{clean_handle}"

        try:
            resp = await self.client.get(url, headers=DEFAULT_REQUEST_HEADERS)
            if resp.status_code == 404:
                return PlatformResult(
                    platform=self.platform_name,
                    success=False,
                    error=f"Coding Ninjas profile '{clean_handle}' not found",
                )
            resp.raise_for_status()
            html = resp.text

            solved = 0
            # Common patterns: "Problems Solved", "Total Solved"
            solved_match = re.search(r'(\d+)\s*(?:Problems?\s*Solved|problems?\s*solved|Questions?\s*solved)', html, re.IGNORECASE)
            if not solved_match:
                solved_match = re.search(r'"problemCount":\s*(\d+)', html)
            if not solved_match:
                solved_match = re.search(r'"total_problems_solved":\s*(\d+)', html)
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

