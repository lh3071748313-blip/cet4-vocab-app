"""SQLite database connection, schema initialization, and CET-4 word seeding."""

from __future__ import annotations

import json
import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

BASE_DIR = Path(__file__).resolve().parent.parent
DEFAULT_DB_PATH = BASE_DIR / "data" / "cet4.db"
WORDS_JSON_PATH = BASE_DIR / "data" / "cet4_words.json"


def get_db_path() -> Path:
    env_path = os.getenv("CET4_DB_PATH")
    if env_path:
        return Path(env_path)
    return DEFAULT_DB_PATH


@contextmanager
def get_conn() -> Iterator[sqlite3.Connection]:
    db_path = get_db_path()
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(db_path), timeout=30.0, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    try:
        conn.execute("PRAGMA foreign_keys = ON;")
        conn.execute("PRAGMA journal_mode = WAL;")
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db() -> None:
    """Create tables if they do not exist and seed initial CET-4 vocabulary."""
    with get_conn() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                daily_goal INTEGER NOT NULL DEFAULT 20,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS words (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                word TEXT UNIQUE NOT NULL,
                phonetic TEXT NOT NULL DEFAULT '',
                pos TEXT NOT NULL DEFAULT '',
                meaning TEXT NOT NULL,
                example TEXT NOT NULL DEFAULT '',
                example_cn TEXT NOT NULL DEFAULT '',
                mnemonic TEXT NOT NULL DEFAULT '',
                frequency INTEGER NOT NULL DEFAULT 3,
                tags TEXT NOT NULL DEFAULT 'cet4'
            );

            CREATE TABLE IF NOT EXISTS user_word_progress (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                word_id INTEGER NOT NULL,
                repetitions INTEGER NOT NULL DEFAULT 0,
                interval_days INTEGER NOT NULL DEFAULT 0,
                ease_factor REAL NOT NULL DEFAULT 2.5,
                mastery_level INTEGER NOT NULL DEFAULT 0,
                wrong_count INTEGER NOT NULL DEFAULT 0,
                is_mistake INTEGER NOT NULL DEFAULT 0,
                last_review_at TEXT,
                next_review_at TEXT NOT NULL DEFAULT (datetime('now')),
                UNIQUE(user_id, word_id),
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY(word_id) REFERENCES words(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_progress_user_next
                ON user_word_progress(user_id, next_review_at);
            CREATE INDEX IF NOT EXISTS idx_progress_user_mistake
                ON user_word_progress(user_id, is_mistake);

            CREATE TABLE IF NOT EXISTS study_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                word_id INTEGER NOT NULL,
                study_date TEXT NOT NULL,
                action TEXT NOT NULL,
                mode TEXT NOT NULL DEFAULT 'card',
                is_correct INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY(word_id) REFERENCES words(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_logs_user_date
                ON study_logs(user_id, study_date);
            """
        )

        # Seed vocabulary if table is empty or new words were added to JSON
        if WORDS_JSON_PATH.exists():
            words_data = json.loads(WORDS_JSON_PATH.read_text(encoding="utf-8"))
            conn.executemany(
                """
                INSERT OR IGNORE INTO words
                    (word, phonetic, pos, meaning, example, example_cn, mnemonic, frequency, tags)
                VALUES
                    (:word, :phonetic, :pos, :meaning, :example, :example_cn, :mnemonic, :frequency, :tags)
                """,
                [
                    {
                        "word": w["word"].strip(),
                        "phonetic": w.get("phonetic", ""),
                        "pos": w.get("pos", ""),
                        "meaning": w["meaning"],
                        "example": w.get("example", ""),
                        "example_cn": w.get("example_cn", ""),
                        "mnemonic": w.get("mnemonic", ""),
                        "frequency": int(w.get("frequency", 3)),
                        "tags": w.get("tags", "cet4"),
                    }
                    for w in words_data
                ],
            )
