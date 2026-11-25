"""Authentication routes: register, login, current user, daily goal update."""

from __future__ import annotations

import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status

from ..auth import create_access_token, get_current_user, hash_password, verify_password
from ..database import get_conn
from ..schemas import AuthLoginRequest, AuthRegisterRequest, UpdateGoalRequest

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register")
def register(req: AuthRegisterRequest) -> dict[str, Any]:
    username = req.username.strip()
    if not username:
        raise HTTPException(status_code=400, detail="用户名不能为空")

    pw_hash = hash_password(req.password)
    try:
        with get_conn() as conn:
            cursor = conn.execute(
                "INSERT INTO users (username, password_hash, daily_goal) VALUES (?, ?, ?)",
                (username, pw_hash, req.daily_goal),
            )
            user_id = int(cursor.lastrowid)
            row = conn.execute(
                "SELECT id, username, daily_goal, created_at FROM users WHERE id = ?",
                (user_id,),
            ).fetchone()
    except sqlite3.IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="该用户名已被注册",
        ) from exc

    token = create_access_token(user_id, username)
    return {"access_token": token, "token_type": "bearer", "user": dict(row)}


@router.post("/login")
def login(req: AuthLoginRequest) -> dict[str, Any]:
    username = req.username.strip()
    with get_conn() as conn:
        row = conn.execute(
            "SELECT id, username, password_hash, daily_goal, created_at FROM users WHERE username = ?",
            (username,),
        ).fetchone()
    if row is None or not verify_password(req.password, row["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码错误",
        )
    user = {
        "id": row["id"],
        "username": row["username"],
        "daily_goal": row["daily_goal"],
        "created_at": row["created_at"],
    }
    token = create_access_token(row["id"], row["username"])
    return {"access_token": token, "token_type": "bearer", "user": user}


@router.get("/me")
def me(current_user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    return {"user": current_user}


@router.patch("/goal")
def update_goal(
    req: UpdateGoalRequest,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    with get_conn() as conn:
        conn.execute(
            "UPDATE users SET daily_goal = ? WHERE id = ?",
            (req.daily_goal, current_user["id"]),
        )
        row = conn.execute(
            "SELECT id, username, daily_goal, created_at FROM users WHERE id = ?",
            (current_user["id"],),
        ).fetchone()
    return {"user": dict(row)}
