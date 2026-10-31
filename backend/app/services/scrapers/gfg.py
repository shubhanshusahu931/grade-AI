"""
app/services/scrapers/gfg.py - GeeksforGeeks BeautifulSoup4 scraper.

NOTE: like CodeChef, GFG has no stable public JSON API for practice
stats. Selectors here target common page structures and may need
maintenance as the site evolves.
"""
from bs4 import BeautifulSoup

from app.core.constants import DEFAULT_REQUEST_HEADERS, GFG_PROFILE_BASE
from app.schemas.sync import PlatformResult
from app.services.scrapers.base import BaseScraper


class GfgScraper(BaseScraper):
    platform_name = "gfg"

    async def fetch(self, handle: str | None = None, **kwargs) -> PlatformResult:
        if not handle:
            return self.missing_handle_result()

        resp = await self.client.get(
            f"{GFG_PROFILE_BASE}/{handle}/", headers=DEFAULT_REQUEST_HEADERS
        )
        if resp.status_code != 200:
            return PlatformResult(platform=self.platform_name, success=False, error="profile not found")

        soup = BeautifulSoup(resp.text, "lxml")

        solved = 0
        candidates = soup.find_all(string=lambda t: t and "Problem" in t and "Solved" in t)
        if candidates:
            for c in candidates:
                digits = "".join(ch for ch in c if ch.isdigit())
                if digits:
                    solved = int(digits)
                    break
        else:
            score_tag = soup.select_one(".scoreCard_head__nxXR8, .score_card_value")
            if score_tag:
                digits = "".join(ch for ch in score_tag.get_text() if ch.isdigit())
                solved = int(digits) if digits else 0

        return PlatformResult(
            platform=self.platform_name,
            success=True,
            solved=solved,
            rating=None,
            raw={"handle": handle, "solved": solved},
        )
