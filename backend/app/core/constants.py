"""
app/core/constants.py

Single source of truth for scoring weights and platform base URLs, so
services/scoring.py and services/scrapers/* never hardcode magic numbers
or endpoints inline.
"""

# --- Composite score weights ---
# Composite Score =
#     (CF_Solved * 3) + (LC_Solved * 2) + (CC_Solved * 2) + (GFG_Solved * 1.5)
#   + (HR_Solved * 1) + (CT_Solved * 1) + (CF_Rating * 1.2) + (CC_Rating * 1.0)
SCORE_WEIGHTS = {
    "codeforces_solved": 3.0,
    "leetcode_solved": 2.0,
    "codechef_solved": 2.0,
    "gfg_solved": 1.5,
    "hackerrank_solved": 1.0,
    "codetantra_solved": 1.0,
    "codeforces_rating": 1.2,
    "codechef_rating": 1.0,
}

# --- Platform base URLs / endpoints ---
CODEFORCES_API_BASE = "https://codeforces.com/api"
LEETCODE_GRAPHQL_URL = "https://leetcode.com/graphql"
CODECHEF_PROFILE_BASE = "https://www.codechef.com/users"
GFG_PROFILE_BASE = "https://www.geeksforgeeks.org/user"
HACKERRANK_BADGES_BASE = "https://www.hackerrank.com/rest/hackers"

PLATFORM_NAMES = [
    "codeforces",
    "leetcode",
    "codechef",
    "gfg",
    "hackerrank",
    "codetantra",
]

DEFAULT_REQUEST_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0 Safari/537.36 IndustryGradeAI-Bot/1.0"
    )
}
