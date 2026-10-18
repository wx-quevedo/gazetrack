"""One-shot migration: convert naive local timestamps in activity.db to UTC.

Before 2C the recorder wrote local time (America/Guayaquil, a fixed UTC-5, no
DST). It now writes UTC with a 'Z' suffix. This script shifts the pre-existing
naive rows by +5 h and appends 'Z' so the whole DB is UTC internally; the
dashboard converts to local for display.

Idempotent and safe to re-run: rows already ending in 'Z' (UTC) are skipped, so
mixing old and new rows is fine. Run once:

    .venv\\Scripts\\python.exe tools\\migrate_ts_utc.py [data/activity.db]
"""

import datetime as dt
import sqlite3
import sys
from pathlib import Path

LOCAL_UTC_OFFSET_HOURS = 5  # America/Guayaquil is UTC-5, no DST.


def to_utc(value):
    if not value or value.endswith("Z"):
        return None  # empty or already UTC -> leave as is
    naive = dt.datetime.fromisoformat(value)
    return (naive + dt.timedelta(hours=LOCAL_UTC_OFFSET_HOURS)) \
        .strftime("%Y-%m-%dT%H:%M:%SZ")


def migrate(path: Path) -> None:
    conn = sqlite3.connect(str(path), isolation_level=None)
    total = 0
    for table, col in [("samples", "ts"), ("sessions", "start"),
                       ("sessions", "end"), ("events", "ts")]:
        try:
            rows = conn.execute(
                f"SELECT rowid, {col} FROM {table} WHERE {col} IS NOT NULL"
            ).fetchall()
        except sqlite3.OperationalError:
            continue
        for rowid, value in rows:
            new = to_utc(value)
            if new is not None:
                conn.execute(f"UPDATE {table} SET {col}=? WHERE rowid=?",
                             (new, rowid))
                total += 1
    conn.close()
    print(f"migrated {total} timestamp(s) to UTC in {path}")


if __name__ == "__main__":
    target = Path(sys.argv[1] if len(sys.argv) > 1 else "data/activity.db")
    if not target.exists():
        print(f"ERROR: {target} not found")
        sys.exit(1)
    migrate(target)
