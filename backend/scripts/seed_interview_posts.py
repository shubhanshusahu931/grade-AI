"""
backend/scripts/seed_interview_posts.py

One-off helper to populate `interview_posts` with a handful of sample
interview experiences, each embedded via Gemini `text-embedding-004`, so
the RAG search endpoint has something to retrieve out of the box.

Run from the `backend/` directory (after installing requirements and
setting GEMINI_API_KEY + DATABASE_URL in .env):

    python -m scripts.seed_interview_posts

Safe to re-run -- it skips posts that already exist (matched by company +
role + first 40 chars of content) instead of duplicating rows.
"""
import asyncio
import sys

from sqlalchemy import select

# Allow running as `python -m scripts.seed_interview_posts` or directly.
sys.path.insert(0, ".")

from app.core.config import settings  # noqa: E402
from app.db.session import SessionLocal, init_db  # noqa: E402
from app.models.interview import InterviewPost  # noqa: E402
from app.services.rag_engine import embed_text  # noqa: E402

SAMPLE_POSTS = [
    {
        "company": "Google",
        "role": "SDE Intern",
        "content": (
            "Three rounds total. Round 1 was a DSA screen: two medium "
            "problems, one on sliding-window substring counting and one "
            "on a graph reachability question using BFS. Round 2 focused "
            "on dynamic programming -- a variant of the coin-change "
            "problem with additional constraints on ordering, and I had "
            "to derive both the recurrence and the space-optimized "
            "version on the whiteboard. Round 3 was a googliness/behavioral "
            "round asking about a time I disagreed with a teammate and "
            "how I handled ambiguous requirements."
        ),
    },
    {
        "company": "Google",
        "role": "New Grad SWE",
        "content": (
            "System design light round even for new grad: design a "
            "URL shortener, focusing on hashing strategy, read/write "
            "ratio, and how you'd shard the key-value store at scale. "
            "Also asked to reason about caching and TTL eviction "
            "policies. Coding round covered a tree-diameter problem and "
            "a follow-up on iterative vs recursive DFS trade-offs."
        ),
    },
    {
        "company": "Amazon",
        "role": "SDE-1",
        "content": (
            "Amazon leans heavily on Leadership Principles -- expect at "
            "least one full round dedicated to behavioral questions "
            "structured around Ownership, Bias for Action, and Dive "
            "Deep. Technical rounds included a matrix rotation problem, "
            "a LRU cache implementation from scratch, and a question on "
            "detecting cycles in a linked list with O(1) space."
        ),
    },
    {
        "company": "Microsoft",
        "role": "SDE Intern",
        "content": (
            "Two technical rounds. First was array/string manipulation: "
            "find the longest palindromic substring and discuss time "
            "complexity trade-offs between the DP and expand-around-"
            "center approaches. Second round was OOP design -- design a "
            "parking lot system with extensibility for different vehicle "
            "types, then a quick discussion of SOLID principles applied "
            "to the design."
        ),
    },
    {
        "company": "Flipkart",
        "role": "SDE-2",
        "content": (
            "Focused heavily on real-world scaling scenarios given "
            "Flipkart's e-commerce traffic patterns during sales events. "
            "Asked to design a rate limiter, then extend it to handle "
            "distributed rate limiting across multiple service "
            "instances using Redis. Coding round included a top-K "
            "frequent elements problem and a discussion of heap vs "
            "bucket-sort approaches."
        ),
    },
]


async def seed() -> None:
    if not settings.GEMINI_API_KEY:
        print("GEMINI_API_KEY is not set in .env -- cannot generate embeddings. Aborting.")
        return

    await init_db()

    async with SessionLocal() as db:
        inserted, skipped = 0, 0

        for post in SAMPLE_POSTS:
            fingerprint_prefix = post["content"][:40]
            existing = await db.execute(
                select(InterviewPost).where(
                    InterviewPost.company == post["company"],
                    InterviewPost.role == post["role"],
                    InterviewPost.content.like(f"{fingerprint_prefix}%"),
                )
            )
            if existing.scalar_one_or_none():
                skipped += 1
                continue

            embedding = await embed_text(post["content"], task_type="retrieval_document")
            db.add(
                InterviewPost(
                    company=post["company"],
                    role=post["role"],
                    content=post["content"],
                    embedding=embedding,
                )
            )
            inserted += 1

        await db.commit()

    print(f"Seed complete: {inserted} inserted, {skipped} already present.")


if __name__ == "__main__":
    asyncio.run(seed())
