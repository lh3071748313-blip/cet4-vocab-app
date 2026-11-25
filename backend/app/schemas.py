"""Pydantic request and response schemas."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class AuthRegisterRequest(BaseModel):
    username: str = Field(min_length=2, max_length=32)
    password: str = Field(min_length=4, max_length=64)
    daily_goal: int = Field(default=20, ge=5, le=200)


class AuthLoginRequest(BaseModel):
    username: str
    password: str


class UpdateGoalRequest(BaseModel):
    daily_goal: int = Field(ge=5, le=200)


class ReviewSubmitRequest(BaseModel):
    word_id: int
    action: Literal["known", "fuzzy", "forgot"]
    mode: Literal["card", "quiz", "spell", "mistake"] = "card"


class WordImportItem(BaseModel):
    word: str
    phonetic: str = ""
    pos: str = ""
    meaning: str
    example: str = ""
    example_cn: str = ""
    mnemonic: str = ""
    frequency: int = Field(default=3, ge=1, le=5)
    tags: str = "cet4"
