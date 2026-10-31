"""
app/services/scoring.py

Composite Score =
      (CF_Solved * 3) + (LC_Solved * 2) + (CC_Solved * 2) + (GFG_Solved * 1.5)
    + (HR_Solved * 1) + (CT_Solved * 1) + (CF_Rating * 1.2) + (CC_Rating * 1.0)

Weights live in app.core.constants.SCORE_WEIGHTS -- the single source of
truth, so this module is pure calculation logic.
"""
from app.core.constants import SCORE_WEIGHTS
from app.schemas.sync import PlatformResult


def _find(results: list[PlatformResult], platform: str) -> PlatformResult | None:
    return next((r for r in results if r.platform == platform), None)


def calculate_composite_score(results: list[PlatformResult]) -> tuple[float, int]:
    """
    Returns (composite_score, total_solved).
    Failed platforms contribute 0 -- fault isolation extends into scoring so
    a single dead scraper never zeroes out the whole score.
    """
    cf = _find(results, "codeforces")
    lc = _find(results, "leetcode")
    cc = _find(results, "codechef")
    gfg = _find(results, "gfg")
    hr = _find(results, "hackerrank")
    ct = _find(results, "codetantra")

    cf_solved = cf.solved if cf and cf.success else 0
    lc_solved = lc.solved if lc and lc.success else 0
    cc_solved = cc.solved if cc and cc.success else 0
    gfg_solved = gfg.solved if gfg and gfg.success else 0
    hr_solved = hr.solved if hr and hr.success else 0
    ct_solved = ct.solved if ct and ct.success else 0

    cf_rating = (cf.rating or 0) if cf and cf.success else 0
    cc_rating = (cc.rating or 0) if cc and cc.success else 0

    total_solved = cf_solved + lc_solved + cc_solved + gfg_solved + hr_solved + ct_solved

    score = (
        cf_solved * SCORE_WEIGHTS["codeforces_solved"]
        + lc_solved * SCORE_WEIGHTS["leetcode_solved"]
        + cc_solved * SCORE_WEIGHTS["codechef_solved"]
        + gfg_solved * SCORE_WEIGHTS["gfg_solved"]
        + hr_solved * SCORE_WEIGHTS["hackerrank_solved"]
        + ct_solved * SCORE_WEIGHTS["codetantra_solved"]
        + cf_rating * SCORE_WEIGHTS["codeforces_rating"]
        + cc_rating * SCORE_WEIGHTS["codechef_rating"]
    )

    return round(score, 2), total_solved
