"""SQLite activity store for the productivity sensor (PHASE-02B).

100% local. Stores 5-second aggregates of gaze zone, presence, active window
and keyboard/mouse COUNTS. It NEVER stores key content (see activity_logger
for the keylogging prohibition) - only per-interval event counts.

WAL mode from the first write so the file survives the overlay's hard exit
(os._exit): each interval is a committed transaction, so a process kill loses
at most the in-progress interval, never a committed one. On open, any session
left without an end (previous hard kill) is closed to its last sample.
"""

from __future__ import annotations

import datetime as _dt
import sqlite3
from pathlib import Path

INTERVAL_SECONDS = 5
_CHECKPOINT_EVERY = 60          # passive WAL checkpoint cadence (intervals)

# Schema version (PRAGMA user_version). Bumped when the on-disk shape changes;
# _migrate() applies the delta so existing databases upgrade in place.
#   1 -> original 2B/2B.1 schema
#   2 -> add samples.gazed_process / samples.gazed_window_title (looked-at
#        window per interval; distinct from the active/foreground window)
SCHEMA_VERSION = 2

# Per-sample tracking states.
STATE_OK = "ok"
STATE_FACE_LOST = "face_lost"
STATE_POSE_EXTREME = "pose_extreme"
STATE_OFFSCREEN = "offscreen"
STATE_CAMERA_LOST = "camera_lost"

# 2B.1 event types (always logged as metrics; the snapshot image is opt-in).
EVENT_OFF_SCREEN_SUSTAINED = "off_screen_sustained"
EVENT_FACE_ABSENT = "face_absent"
EVENT_DISTRACTION_RETURN = "distraction_return"
EVENT_FOCUS_BLOCK_START = "focus_block_start"

_SCHEMA = """
CREATE TABLE IF NOT EXISTS sessions (
    id     INTEGER PRIMARY KEY AUTOINCREMENT,
    start  TEXT NOT NULL,
    end    TEXT,
    notes  TEXT
);
CREATE TABLE IF NOT EXISTS samples (
    ts             TEXT NOT NULL,
    session_id     INTEGER,
    gaze_zone      TEXT,      -- "c<col>r<row>" (modal on-screen zone) or "off"
    on_screen      REAL,      -- fraction 0..1 of frames on-screen
    tracking_state TEXT,      -- modal state (see STATE_*)
    face_present   REAL,      -- fraction 0..1 of frames with a face
    process        TEXT,      -- modal foreground process (e.g. Code.exe)
    window_title   TEXT,      -- modal title, or NULL under --no-titles
    kb_events      INTEGER,   -- key PRESS count this interval (no content)
    mouse_events   INTEGER,   -- mouse click/scroll/throttled-move count
    gazed_process       TEXT, -- modal process of the window UNDER the gaze
                              -- point (what the user LOOKED at); NULL when
                              -- off-screen / not tracking
    gazed_window_title  TEXT, -- modal looked-at title, NULL under --no-titles
    FOREIGN KEY (session_id) REFERENCES sessions(id)
);
CREATE TABLE IF NOT EXISTS events (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    ts            TEXT NOT NULL,
    session_id    INTEGER,
    event_type    TEXT NOT NULL,   -- EVENT_* above
    snapshot_path TEXT,            -- relative JPEG path, or NULL (opt-in off)
    duration_s    REAL,            -- length of the state that triggered it
    FOREIGN KEY (session_id) REFERENCES sessions(id)
);
CREATE INDEX IF NOT EXISTS idx_samples_ts ON samples(ts);
CREATE INDEX IF NOT EXISTS idx_samples_session ON samples(session_id);
CREATE INDEX IF NOT EXISTS idx_events_ts ON events(ts);
"""


def _now_iso() -> str:
    """UTC timestamp with a Z suffix. Stored in UTC so the data is robust to
    timezone/DST; the dashboard converts to the local zone for display."""
    return _dt.datetime.now(_dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


class ActivityDB:
    def __init__(self, path: Path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._conn = sqlite3.connect(str(self.path), isolation_level=None)
        # WAL from the first write; NORMAL is crash/kill-safe for committed
        # transactions (only a power loss, not a process kill, risks the last
        # commit) and much faster than FULL.
        self._conn.execute("PRAGMA journal_mode=WAL")
        self._conn.execute("PRAGMA synchronous=NORMAL")
        self._conn.executescript(_SCHEMA)
        self._migrate()
        self._recover_open_sessions()
        self._writes = 0

    def _migrate(self) -> None:
        """Bring an existing database up to SCHEMA_VERSION. Additive only:
        new columns are added with ALTER TABLE, so rows written by an older
        version keep their data and read back NULL for the new columns."""
        version = self._conn.execute("PRAGMA user_version").fetchone()[0]
        if version >= SCHEMA_VERSION:
            return
        cols = {r[1] for r in self._conn.execute("PRAGMA table_info(samples)")}
        if "gazed_process" not in cols:
            self._conn.execute(
                "ALTER TABLE samples ADD COLUMN gazed_process TEXT")
        if "gazed_window_title" not in cols:
            self._conn.execute(
                "ALTER TABLE samples ADD COLUMN gazed_window_title TEXT")
        self._conn.execute(f"PRAGMA user_version = {SCHEMA_VERSION}")

    def _recover_open_sessions(self) -> None:
        """Close any session left open by a previous hard kill, dating its end
        to that session's last sample (or its start if it has none)."""
        rows = self._conn.execute(
            "SELECT id, start FROM sessions WHERE end IS NULL").fetchall()
        for sid, start in rows:
            last = self._conn.execute(
                "SELECT MAX(ts) FROM samples WHERE session_id=?",
                (sid,)).fetchone()[0]
            self._conn.execute(
                "UPDATE sessions SET end=?, notes=COALESCE(notes,'') || "
                "' [closed on recovery]' WHERE id=?", (last or start, sid))

    def start_session(self, notes: str | None = None) -> int:
        cur = self._conn.execute(
            "INSERT INTO sessions(start, notes) VALUES(?, ?)",
            (_now_iso(), notes))
        return int(cur.lastrowid)

    def end_session(self, session_id: int) -> None:
        self._conn.execute("UPDATE sessions SET end=? WHERE id=?",
                           (_now_iso(), session_id))

    def insert_sample(self, session_id: int, gaze_zone: str, on_screen: float,
                      tracking_state: str, face_present: float,
                      process: str | None, window_title: str | None,
                      kb_events: int, mouse_events: int,
                      gazed_process: str | None = None,
                      gazed_window_title: str | None = None,
                      ts: str | None = None) -> None:
        self._conn.execute(
            "INSERT INTO samples(ts, session_id, gaze_zone, on_screen, "
            "tracking_state, face_present, process, window_title, kb_events, "
            "mouse_events, gazed_process, gazed_window_title) "
            "VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
            (ts or _now_iso(), session_id, gaze_zone, round(on_screen, 3),
             tracking_state, round(face_present, 3), process, window_title,
             int(kb_events), int(mouse_events),
             gazed_process, gazed_window_title))
        # isolation_level=None => each statement autocommits, so a hard kill
        # never loses a written interval. Periodically fold the WAL back.
        self._writes += 1
        if self._writes % _CHECKPOINT_EVERY == 0:
            self._conn.execute("PRAGMA wal_checkpoint(PASSIVE)")

    def insert_event(self, session_id: int, event_type: str,
                     snapshot_path: str | None, duration_s: float,
                     ts: str | None = None) -> int:
        cur = self._conn.execute(
            "INSERT INTO events(ts, session_id, event_type, snapshot_path, "
            "duration_s) VALUES(?,?,?,?,?)",
            (ts or _now_iso(), session_id, event_type, snapshot_path,
             round(float(duration_s), 1)))
        return int(cur.lastrowid)

    def enforce_retention(self, days: int, snapshots_dir: Path) -> int:
        """Delete snapshot image folders older than `days` and NULL the
        snapshot_path of their events (the event METRIC row is kept; only the
        opt-in image is removed). Returns the number of folders deleted."""
        import shutil
        snapshots_dir = Path(snapshots_dir)
        if not snapshots_dir.exists():
            return 0
        cutoff = (_dt.date.today() - _dt.timedelta(days=days))
        deleted = 0
        for folder in snapshots_dir.iterdir():
            if not folder.is_dir():
                continue
            try:
                folder_date = _dt.date.fromisoformat(folder.name)
            except ValueError:
                continue
            if folder_date < cutoff:
                shutil.rmtree(folder, ignore_errors=True)
                self._conn.execute(
                    "UPDATE events SET snapshot_path=NULL WHERE "
                    "snapshot_path LIKE ?", (f"%{folder.name}%",))
                deleted += 1
        return deleted

    def estimate_size_per_day(self) -> dict:
        """Extrapolate on-disk bytes/day from the current rows, plus an
        analytic fallback when there are too few rows yet."""
        n = self._conn.execute("SELECT COUNT(*) FROM samples").fetchone()[0]
        rows_per_day = 86400 / INTERVAL_SECONDS
        try:
            file_bytes = self.path.stat().st_size
        except OSError:
            file_bytes = 0
        bytes_per_row = (file_bytes / n) if n else 130.0  # analytic estimate
        return {
            "rows": n,
            "rows_per_day": int(rows_per_day),
            "bytes_per_row": round(bytes_per_row, 1),
            "mb_per_day": round(bytes_per_row * rows_per_day / 1e6, 2),
        }

    def query(self, sql: str, params: tuple = ()) -> list:
        return self._conn.execute(sql, params).fetchall()

    def close(self) -> None:
        try:
            self._conn.execute("PRAGMA wal_checkpoint(TRUNCATE)")
        except sqlite3.Error:
            pass
        self._conn.close()


# Sample review queries (used in the 2B gate report and reusable in 2C).
SAMPLE_QUERIES: dict[str, str] = {
    "time_per_app": """
        SELECT process,
               ROUND(COUNT(*) * :iv / 60.0, 1) AS minutes
        FROM samples
        WHERE process IS NOT NULL
        GROUP BY process
        ORDER BY minutes DESC
        LIMIT 15;
    """,
    "time_per_gaze_zone": """
        SELECT gaze_zone,
               ROUND(COUNT(*) * :iv / 60.0, 1) AS minutes
        FROM samples
        GROUP BY gaze_zone
        ORDER BY minutes DESC;
    """,
    "on_off_screen_ratio": """
        SELECT ROUND(AVG(on_screen) * 100, 1)       AS pct_on_screen,
               ROUND((1 - AVG(on_screen)) * 100, 1)  AS pct_off_screen,
               ROUND(COUNT(*) * :iv / 60.0, 1)       AS total_minutes
        FROM samples;
    """,
    "presence_gaps": """
        -- Intervals where the face was mostly absent (a presence gap),
        -- with the active process during the gap.
        SELECT ts, tracking_state, process,
               ROUND(face_present, 2) AS face_present
        FROM samples
        WHERE face_present < 0.5
        ORDER BY ts;
    """,
    "activity_per_app": """
        -- Keyboard/mouse intensity per app (events per active minute).
        SELECT process,
               SUM(kb_events)    AS keys,
               SUM(mouse_events) AS mouse,
               ROUND(COUNT(*) * :iv / 60.0, 1) AS minutes
        FROM samples
        WHERE process IS NOT NULL
        GROUP BY process
        ORDER BY (SUM(kb_events) + SUM(mouse_events)) DESC
        LIMIT 15;
    """,
    "time_per_gazed_app": """
        -- Minutes spent LOOKING at each app (the window under the gaze),
        -- independent of which window was active/foreground.
        SELECT gazed_process,
               ROUND(COUNT(*) * :iv / 60.0, 1) AS minutes
        FROM samples
        WHERE gazed_process IS NOT NULL
        GROUP BY gazed_process
        ORDER BY minutes DESC
        LIMIT 15;
    """,
    "gazed_vs_active": """
        -- Intervals where the looked-at window differs from the active one:
        -- the gap between where focus is and where the keyboard is.
        SELECT process        AS active_process,
               gazed_process   AS looked_process,
               ROUND(COUNT(*) * :iv / 60.0, 1) AS minutes
        FROM samples
        WHERE gazed_process IS NOT NULL
          AND process IS NOT NULL
          AND gazed_process <> process
        GROUP BY process, gazed_process
        ORDER BY minutes DESC
        LIMIT 15;
    """,
}
