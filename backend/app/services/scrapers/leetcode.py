"""app/services/scrapers/leetcode.py - LeetCode internal GraphQL endpoint."""
from app.core.constants import DEFAULT_REQUEST_HEADERS, LEETCODE_GRAPHQL_URL
from app.schemas.sync import PlatformResult
from app.services.scrapers.base import BaseScraper

_QUERY = """
query userProblemsSolved($username: String!) {
  matchedUser(username: $username) {
    username
    submitStatsGlobal {
      acSubmissionNum { difficulty count }
    }
    profile { ranking }
  }
}
"""


class LeetCodeScraper(BaseScraper):
    platform_name = "leetcode"

    async def fetch(self, handle: str | None = None, **kwargs) -> PlatformResult:
        if not handle:
            return self.missing_handle_result()

        resp = await self.client.post(
            LEETCODE_GRAPHQL_URL,
            json={"query": _QUERY, "variables": {"username": handle}},
            headers={
                **DEFAULT_REQUEST_HEADERS,
                "Content-Type": "application/json",
                "Referer": "https://leetcode.com",
            },
        )
        resp.raise_for_status()
        data = resp.json()
        matched_user = data.get("data", {}).get("matchedUser")
        if not matched_user:
            return PlatformResult(platform=self.platform_name, success=False, error="user not found")

        solved_total = 0
        for entry in matched_user["submitStatsGlobal"]["acSubmissionNum"]:
            if entry["difficulty"] == "All":
                solved_total = entry["count"]
                break

        return PlatformResult(
            platform=self.platform_name,
            success=True,
            solved=solved_total,
            rating=None,
            raw={
                "handle": handle,
                "solved": solved_total,
                "ranking": matched_user["profile"].get("ranking"),
            },
        )
