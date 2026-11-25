"""Backend unit and integration tests for CET-4 learning app."""

from __future__ import annotations

import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    db_file = tmp_path / "test_cet4.db"
    monkeypatch.setenv("CET4_DB_PATH", str(db_file))
    monkeypatch.setenv("CET4_SECRET_KEY", "test-secret-key-123")

    from app.main import app

    with TestClient(app) as c:
        yield c


def test_health(client: TestClient):
    resp = client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


def test_auth_study_mistakes_and_stats_flow(client: TestClient):
    # 1. Register
    reg = client.post(
        "/api/auth/register",
        json={"username": "alice", "password": "password123", "daily_goal": 15},
    )
    assert reg.status_code == 200
    token = reg.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Fetch today's queue
    today = client.get("/api/study/today?limit=10", headers=headers)
    assert today.status_code == 200
    data = today.json()
    assert len(data["queue"]) == 10
    first_word = data["queue"][0]
    second_word = data["queue"][1]
    assert len(first_word["quiz_options"]) == 4

    # 3. Mark first word as forgot -> should appear in mistakes
    r1 = client.post(
        "/api/study/review",
        json={"word_id": first_word["id"], "action": "forgot", "mode": "card"},
        headers=headers,
    )
    assert r1.status_code == 200
    assert r1.json()["is_mistake"] is True

    # 4. Mark second word as known -> interval 1 day
    r2 = client.post(
        "/api/study/review",
        json={"word_id": second_word["id"], "action": "known", "mode": "quiz"},
        headers=headers,
    )
    assert r2.status_code == 200
    assert r2.json()["interval_days"] == 1
    assert r2.json()["is_mistake"] is False

    # 5. Check mistakes list
    mistakes = client.get("/api/mistakes", headers=headers)
    assert mistakes.status_code == 200
    assert mistakes.json()["total"] == 1
    assert mistakes.json()["items"][0]["id"] == first_word["id"]

    # 6. Resolve mistake via mistake mode known
    r3 = client.post(
        "/api/study/review",
        json={"word_id": first_word["id"], "action": "known", "mode": "mistake"},
        headers=headers,
    )
    assert r3.status_code == 200
    assert r3.json()["is_mistake"] is False

    # 7. Check overview stats
    stats = client.get("/api/stats/overview", headers=headers)
    assert stats.status_code == 200
    s = stats.json()
    assert s["studied_today"] == 2
    assert s["streak_days"] >= 1
    assert len(s["daily_trend"]) == 14

    # 8. Dictionary search
    search = client.get("/api/words?q=abandon", headers=headers)
    assert search.status_code == 200
    assert search.json()["total"] >= 1
