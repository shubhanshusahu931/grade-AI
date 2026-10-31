"""
app/services/fetcher.py

Async orchestrator that runs all 6 platform scrapers concurrently via
asyncio.gather(..., return_exceptions=True), each bounded by a
per-platform timeout. A failure on any single platform NEVER breaks the
overall sync -- it is reported back as a failed PlatformResult instead
of raising (fault isolation).
"""
import asyncio
import logging
from typing import Any

import httpx

from app.core.config import settings
from app.core.constants import PLATFORM_NAMES
from app.schemas.sync import PlatformResult
from app.services.scrapers.codechef import CodeChefScraper
from app.services.scrapers.codeforces import CodeforcesScraper
from app.services.scrapers.codetantra import CodeTantraScraper
from app.services.scrapers.gfg import GfgScraper
from app.services.scrapers.hackerrank import HackerRankScraper
from app.services.scrapers.leetcode import LeetCodeScraper

logger = logging.getLogger("industry_grade_ai.fetcher")

TIMEOUT = settings.PLATFORM_FETCH_TIMEOUT_SECONDS


async def _safe_call(coro, platform: str) -> PlatformResult:
    """Wrap a single-platform fetch with timeout + exception isolation."""
    try:
        return await asyncio.wait_for(coro, timeout=TIMEOUT)
    except asyncio.TimeoutError:
        logger.warning("Timeout fetching %s", platform)
        return PlatformResult(platform=platform, success=False, error="timeout")
    except Exception as exc:  # noqa: BLE001 - fault isolation is intentional
        logger.warning("Error fetching %s: %s", platform, exc)
        return PlatformResult(platform=platform, success=False, error=str(exc))


async def fetch_all_platforms(
    handles: dict[str, Any], fallback_prefix: str | None = None
) -> list[PlatformResult]:
    """
    Fetch stats from all 6 platforms concurrently.

    `handles` should contain (possibly None) values for: codeforces,
    leetcode, codechef, gfg, hackerrank, codetantra_url, codetantra_id.
    Any handle left blank falls back to `fallback_prefix` (the email
    local-part discovered at login), EXCEPT CodeTantra which requires an
    explicit college URL.
    """

    def resolved(key: str) -> str | None:
        return handles.get(key) or fallback_prefix

    async with httpx.AsyncClient(timeout=TIMEOUT, follow_redirects=True) as client:
        cf = CodeforcesScraper(client)
        lc = LeetCodeScraper(client)
        cc = CodeChefScraper(client)
        gfg = GfgScraper(client)
        hr = HackerRankScraper(client)
        ct = CodeTantraScraper(client)

        tasks = [
            _safe_call(cf.fetch(handle=resolved("codeforces")), "codeforces"),
            _safe_call(lc.fetch(handle=resolved("leetcode")), "leetcode"),
            _safe_call(cc.fetch(handle=resolved("codechef")), "codechef"),
            _safe_call(gfg.fetch(handle=resolved("gfg")), "gfg"),
            _safe_call(hr.fetch(handle=resolved("hackerrank")), "hackerrank"),
            _safe_call(
                ct.fetch(
                    college_url=handles.get("codetantra_url"),
                    student_id=handles.get("codetantra_id") or fallback_prefix,
                ),
                "codetantra",
            ),
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)

    # _safe_call already isolates per-task exceptions; guard again defensively.
    final: list[PlatformResult] = []
    for name, res in zip(PLATFORM_NAMES, results):
        if isinstance(res, Exception):
            final.append(PlatformResult(platform=name, success=False, error=str(res)))
        else:
            final.append(res)
    return final
