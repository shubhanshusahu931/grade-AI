"""app/services/scrapers/codeforces.py - Codeforces official REST API."""
from app.core.constants import CODEFORCES_API_BASE
from app.schemas.sync import PlatformResult
from app.services.scrapers.base import BaseScraper


class CodeforcesScraper(BaseScraper):
    platform_name = "codeforces"

    async def fetch(self, handle: str | None = None, **kwargs) -> PlatformResult:
        if not handle:
            return self.missing_handle_result()

        info_resp = await self.client.get(
            f"{CODEFORCES_API_BASE}/user.info", params={"handles": handle}
        )
        info_resp.raise_for_status()
        info_data = info_resp.json()
        if info_data.get("status") != "OK":
            return PlatformResult(
                platform=self.platform_name,
                success=False,
                error=info_data.get("comment", "api error"),
            )

        user_info = info_data["result"][0]
        rating = user_info.get("rating", 0)

        status_resp = await self.client.get(
            f"{CODEFORCES_API_BASE}/user.status", params={"handle": handle}
        )
        solved_count = 0
        if status_resp.status_code == 200:
            status_data = status_resp.json()
            if status_data.get("status") == "OK":
                solved_ids = {
                    f"{s['problem'].get('contestId')}-{s['problem'].get('index')}"
                    for s in status_data["result"]
                    if s.get("verdict") == "OK"
                }
                solved_count = len(solved_ids)

        return PlatformResult(
            platform=self.platform_name,
            success=True,
            solved=solved_count,
            rating=rating,
            raw={
                "handle": handle,
                "rating": rating,
                "solved": solved_count,
                "rank": user_info.get("rank"),
            },
        )
