"""SM-2 / Ebbinghaus spaced repetition scheduling engine."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone


@dataclass
class ReviewResult:
    repetitions: int
    interval_days: int
    ease_factor: float
    mastery_level: int  # 0: 新词, 1: 初识, 2: 熟悉, 3: 掌握
    next_review_at: str
    is_mistake: int
    wrong_count_delta: int


def compute_sm2(
    action: str,
    repetitions: int,
    interval_days: int,
    ease_factor: float,
    now: datetime | None = None,
) -> ReviewResult:
    """Compute next review schedule based on user feedback ('known', 'fuzzy', 'forgot')."""
    now_dt = now or datetime.now(timezone.utc)
    # Map 3-level user feedback to SM-2 quality (5, 3, 1)
    quality_map = {
        "known": 5,
        "fuzzy": 3,
        "forgot": 1,
    }
    if action not in quality_map:
        raise ValueError(f"Unsupported review action: {action}")

    q = quality_map[action]

    if q < 3:
        # Forgot: reset repetitions, review soon (10 minutes / same day), mark as mistake
        new_reps = 0
        new_interval = 0
        new_ef = max(1.3, round(ease_factor - 0.2, 2))
        next_dt = now_dt + timedelta(minutes=10)
        mastery = 1
        is_mistake = 1
        wrong_delta = 1
    elif q == 3:
        # Fuzzy: keep progress cautious, short interval (1 day or half current)
        new_reps = max(1, repetitions)
        new_interval = 1 if interval_days <= 1 else max(1, round(interval_days * 0.6))
        new_ef = max(1.3, round(ease_factor - 0.14, 2))
        next_dt = now_dt + timedelta(days=new_interval)
        mastery = 1 if new_reps < 2 else 2
        is_mistake = 0
        wrong_delta = 0
    else:
        # Known: advance along Ebbinghaus / SM-2 curve (1d -> 6d -> interval * EF)
        new_reps = repetitions + 1
        if new_reps == 1:
            new_interval = 1
        elif new_reps == 2:
            new_interval = 6
        else:
            new_interval = max(new_interval := round(interval_days * ease_factor), 1)
        new_ef = max(1.3, round(ease_factor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)), 2))
        next_dt = now_dt + timedelta(days=new_interval)
        if new_reps >= 3 and new_interval >= 10:
            mastery = 3
        elif new_reps >= 2:
            mastery = 2
        else:
            mastery = 1
        is_mistake = 0
        wrong_delta = 0

    return ReviewResult(
        repetitions=new_reps,
        interval_days=new_interval,
        ease_factor=new_ef,
        mastery_level=mastery,
        next_review_at=next_dt.strftime("%Y-%m-%d %H:%M:%S"),
        is_mistake=is_mistake,
        wrong_count_delta=wrong_delta,
    )
