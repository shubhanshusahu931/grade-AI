import asyncio, uuid
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.security import create_access_token
from app.db.session import SessionLocal
from app.models.user import User
from sqlalchemy import select

async def run_comprehensive_test():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://localhost:8000") as client:
        # Fetch 2 users
        async with SessionLocal() as session:
            users = (await session.execute(select(User).limit(2))).scalars().all()
            u1, u2 = users[0], users[1]
            token1 = create_access_token(u1.id, u1.email)
            token2 = create_access_token(u2.id, u2.email)
            u1_id = str(u1.id)
            u2_id = str(u2.id)

        h1 = {"Authorization": f"Bearer {token1}"}
        h2 = {"Authorization": f"Bearer {token2}"}

        # 1. Update Profile for User 1
        up_data = {
            "username": "Alex Rivera",
            "college": "Stanford University",
            "bio": "Competitive programmer | Incoming SWE Intern",
            "phone": "+1 (555) 019-2834",
            "github": "https://github.com/alexrivera",
            "linkedin": "https://linkedin.com/in/alexrivera",
            "instagram": "alex.codes"
        }
        res_up = await client.put("/api/v1/auth/profile", json=up_data, headers=h1)
        assert res_up.status_code == 200, f"Profile update failed: {res_up.text}"
        u1_prof = res_up.json()
        assert u1_prof["username"] == "Alex Rivera"
        assert u1_prof["bio"] == up_data["bio"]
        assert u1_prof["phone"] == up_data["phone"]
        assert u1_prof["github"] == up_data["github"]
        assert u1_prof["linkedin"] == up_data["linkedin"]
        assert u1_prof["instagram"] == up_data["instagram"]
        print("[PASS] Profile & Social links update succeeded.")

        # 2. User 2 views User 1's public profile
        res_view = await client.get(f"/api/v1/users/{u1_id}/profile", headers=h2)
        assert res_view.status_code == 200, f"Public view failed: {res_view.text}"
        view_data = res_view.json()
        assert view_data["username"] == "Alex Rivera"
        assert view_data["bio"] == up_data["bio"]
        assert view_data["phone"] == up_data["phone"]
        assert view_data["github"] == up_data["github"]
        print("[PASS] Public Profile fetched by User 2.")

        # 3. User 2 follows User 1
        res_follow = await client.post(f"/api/v1/users/{u1_id}/follow", headers=h2)
        assert res_follow.status_code == 200, f"Follow failed: {res_follow.text}"
        f_data = res_follow.json()
        assert f_data["is_following"] is True
        print(f"[PASS] User 2 followed User 1: followers={f_data['followers_count']}.")

        # 4. User 2 views User 1's profile again -> is_following must be True
        res_view2 = await client.get(f"/api/v1/users/{u1_id}/profile", headers=h2)
        assert res_view2.status_code == 200
        assert res_view2.json()["is_following"] is True
        assert res_view2.json()["followers_count"] >= 1
        print("[PASS] Follow verification confirmed is_following=True.")

        # 5. User 1 me endpoint -> followers_count increased
        res_me = await client.get("/api/v1/auth/me", headers=h1)
        assert res_me.status_code == 200
        assert res_me.json()["followers_count"] >= 1
        print(f"[PASS] User 1 /auth/me reflects followers_count={res_me.json()['followers_count']}.")

        # 6. User 2 /auth/me reflects following_count increased
        res_me2 = await client.get("/api/v1/auth/me", headers=h2)
        assert res_me2.status_code == 200
        assert res_me2.json()["following_count"] >= 1
        print(f"[PASS] User 2 /auth/me reflects following_count={res_me2.json()['following_count']}.")

        # 7. Followers list for User 1 includes User 2
        res_followers = await client.get(f"/api/v1/users/{u1_id}/followers", headers=h1)
        assert res_followers.status_code == 200
        followers = res_followers.json()
        assert any(f["user_id"] == u2_id for f in followers)
        print(f"[PASS] User 1 followers list contains User 2 (total: {len(followers)}).")

        # 8. User 2 unfollows User 1
        res_unfollow = await client.post(f"/api/v1/users/{u1_id}/follow", headers=h2)
        assert res_unfollow.status_code == 200
        assert res_unfollow.json()["is_following"] is False
        print("[PASS] User 2 unfollowed User 1 successfully.")

        # 9. Verify cannot follow yourself
        res_self = await client.post(f"/api/v1/users/{u1_id}/follow", headers=h1)
        assert res_self.status_code == 400
        print("[PASS] Self-follow correctly rejected with 400.")

    print("\n=========================================")
    print("ALL FEATURES & INTEGRATION CHECKS PASSED!")
    print("=========================================")

if __name__ == "__main__":
    asyncio.run(run_comprehensive_test())

