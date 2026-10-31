"""
app/services/scrapers/codechef.py - CodeChef BeautifulSoup4 scraper.

NOTE: CodeChef has no stable public JSON API, so this parses the public
profile page. Page markup can change over time; treat selectors as a
starting point that needs periodic maintenance.
"""
from bs4 import BeautifulSoup

from app.core.constants import CODECHEF_PROFILE_BASE, DEFAULT_REQUEST_HEADERS
from app.schemas.sync import PlatformResult
from app.services.scrapers.base import BaseScraper


class CodeChefScraper(BaseScraper):
    platform_name = "codechef"

    async def fetch(self, handle: str | None = None, **kwargs) -> PlatformResult:
        if not handle:
            return self.missing_handle_result()

        resp = await self.client.get(
            f"{CODECHEF_PROFILE_BASE}/{handle}", headers=DEFAULT_REQUEST_HEADERS
        )
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "lxml")

        rating = 0.0
        rating_tag = soup.select_one(".rating-number")
        if rating_tag:
            try:
                rating = float(rating_tag.get_text(strip=True))
            except ValueError:
                rating = 0.0

        solved = 0
        solved_heading = soup.find(string=lambda t: t and "Total Problems Solved" in t)
        if solved_heading:
            digits = "".join(ch for ch in solved_heading if ch.isdigit())
            solved = int(digits) if digits else 0

        if rating_tag is None and solved == 0:
            return PlatformResult(
                platform=self.platform_name,
                success=False,
                error="profile not found / page structure changed",
            )

        return PlatformResult(
            platform=self.platform_name,
            success=True,
            solved=solved,
            rating=rating,
            raw={"handle": handle, "rating": rating, "solved": solved},
        )
