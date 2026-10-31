"""
app/services/scrapers/codetantra.py - dynamic college-hosted CodeTantra
instance. Unlike the other 5 platforms, CodeTantra is self-hosted per
college, so this scraper needs an explicit college URL, not just a handle.
"""
from bs4 import BeautifulSoup

from app.core.constants import DEFAULT_REQUEST_HEADERS
from app.schemas.sync import PlatformResult
from app.services.scrapers.base import BaseScraper


class CodeTantraScraper(BaseScraper):
    platform_name = "codetantra"

    async def fetch(
        self, college_url: str | None = None, student_id: str | None = None, **kwargs
    ) -> PlatformResult:
        if not college_url or not student_id:
            return PlatformResult(
                platform=self.platform_name,
                success=False,
                error="college URL / student ID not configured",
            )

        url = college_url.rstrip("/") + f"/students/{student_id}/report"
        resp = await self.client.get(url, headers=DEFAULT_REQUEST_HEADERS)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "lxml")

        solved = 0
        solved_tag = soup.select_one(".completed-count, .solved-count, [data-solved]")
        if solved_tag:
            digits = "".join(ch for ch in solved_tag.get_text() if ch.isdigit())
            solved = int(digits) if digits else 0

        return PlatformResult(
            platform=self.platform_name,
            success=True,
            solved=solved,
            rating=None,
            raw={"student_id": student_id, "solved": solved},
        )
