<?php

namespace App\Services;

use App\Models\ProcessCategory;
use Illuminate\Support\Facades\DB;

/**
 * Read-only access layer over the Python recorder's activity.db (SQLite WAL).
 *
 * Timestamps are stored in UTC (Z suffix); every method that groups or reports
 * by local time converts using the app timezone (America/Guayaquil) so the
 * user sees their own hours. The connection is opened read-only via
 * `PRAGMA query_only = ON`; the Python side is the sole writer. If the DB file
 * does not exist yet, methods return empty results instead of creating it.
 */
class ActivityMetrics
{
    /** Seconds represented by one aggregated sample row. */
    private const INTERVAL = 5;

    private function ready(): bool
    {
        return is_file(config('database.connections.activity.database'));
    }

    private function db()
    {
        $conn = DB::connection('activity');
        $conn->statement('PRAGMA query_only = ON');

        return $conn;
    }

    /** SQLite datetime modifier that shifts UTC -> the app's local zone. */
    private function localOffset(): string
    {
        $tz = new \DateTimeZone(config('app.timezone', 'UTC'));
        $seconds = $tz->getOffset(new \DateTime('now', new \DateTimeZone('UTC')));

        return sprintf('%+d minutes', intdiv($seconds, 60));
    }

    private function categoryMap(): array
    {
        return ProcessCategory::map();
    }

    /**
     * Whether the samples table has the gaze->window columns (schema v2). A
     * database written by an older recorder lacks them; the gazed methods
     * degrade to empty instead of erroring on the missing column.
     */
    private function hasGazedColumn(): bool
    {
        if (! $this->ready()) {
            return false;
        }
        foreach ($this->db()->select('PRAGMA table_info(samples)') as $c) {
            if ($c->name === 'gazed_process') {
                return true;
            }
        }

        return false;
    }

    private function categoryOf(array $map, ?string $process): string
    {
        return $map[$process] ?? 'sin_categorizar';
    }

    // --- the original five (unchanged semantics) --------------------------
    public function timePerApp(int $limit = 15): array
    {
        if (! $this->ready()) {
            return [];
        }
        $map = $this->categoryMap();
        $rows = $this->db()->select(
            'SELECT process, ROUND(COUNT(*) * ? / 60.0, 1) AS minutes
             FROM samples WHERE process IS NOT NULL
             GROUP BY process ORDER BY minutes DESC LIMIT ?',
            [self::INTERVAL, $limit]
        );
        foreach ($rows as $r) {
            $r->category = $this->categoryOf($map, $r->process);
        }

        return $rows;
    }

    public function timePerGazeZone(): array
    {
        if (! $this->ready()) {
            return [];
        }

        return $this->db()->select(
            'SELECT gaze_zone, ROUND(COUNT(*) * ? / 60.0, 1) AS minutes
             FROM samples GROUP BY gaze_zone ORDER BY minutes DESC',
            [self::INTERVAL]
        );
    }

    public function onOffScreenRatio(): array
    {
        if (! $this->ready()) {
            return [];
        }

        return $this->db()->select(
            'SELECT ROUND(AVG(on_screen) * 100, 1)       AS pct_on_screen,
                    ROUND((1 - AVG(on_screen)) * 100, 1) AS pct_off_screen,
                    ROUND(COUNT(*) * ? / 60.0, 1)        AS total_minutes
             FROM samples',
            [self::INTERVAL]
        );
    }

    public function presenceGaps(int $limit = 200): array
    {
        if (! $this->ready()) {
            return [];
        }

        return $this->db()->select(
            "SELECT strftime('%Y-%m-%d %H:%M:%S', ts, ?) AS ts,
                    tracking_state, process, ROUND(face_present, 2) AS face_present
             FROM samples WHERE face_present < 0.5 ORDER BY ts LIMIT ?",
            [$this->localOffset(), $limit]
        );
    }

    public function activityPerApp(int $limit = 15): array
    {
        if (! $this->ready()) {
            return [];
        }

        return $this->db()->select(
            'SELECT process, SUM(kb_events) AS keys, SUM(mouse_events) AS mouse,
                    ROUND(COUNT(*) * ? / 60.0, 1) AS minutes
             FROM samples WHERE process IS NOT NULL
             GROUP BY process ORDER BY (SUM(kb_events)+SUM(mouse_events)) DESC LIMIT ?',
            [self::INTERVAL, $limit]
        );
    }

    // --- gaze -> window mapping (schema v2) -------------------------------

    /** Minutes spent LOOKING at each app (window under the gaze), with
     *  category. Independent of which window was active/foreground. */
    public function timePerGazedApp(int $limit = 15): array
    {
        if (! $this->hasGazedColumn()) {
            return [];
        }
        $map = $this->categoryMap();
        $rows = $this->db()->select(
            'SELECT gazed_process AS process, ROUND(COUNT(*) * ? / 60.0, 1) AS minutes
             FROM samples WHERE gazed_process IS NOT NULL
             GROUP BY gazed_process ORDER BY minutes DESC LIMIT ?',
            [self::INTERVAL, $limit]
        );
        foreach ($rows as $r) {
            $r->category = $this->categoryOf($map, $r->process);
        }

        return $rows;
    }

    /** Intervals where the looked-at window differs from the active one:
     *  the gap between where attention is and where the keyboard is. */
    public function gazedVsActive(int $limit = 15): array
    {
        if (! $this->hasGazedColumn()) {
            return [];
        }

        return $this->db()->select(
            'SELECT process AS active_process, gazed_process AS looked_process,
                    ROUND(COUNT(*) * ? / 60.0, 1) AS minutes
             FROM samples
             WHERE gazed_process IS NOT NULL AND process IS NOT NULL
               AND gazed_process <> process
             GROUP BY process, gazed_process ORDER BY minutes DESC LIMIT ?',
            [self::INTERVAL, $limit]
        );
    }

    /** Share of tracked time where the looked-at app matches vs differs from
     *  the active app (attention-vs-focus alignment). Null pre-migration. */
    public function gazeFocusAlignment(): ?array
    {
        if (! $this->hasGazedColumn()) {
            return null;
        }
        $r = $this->db()->selectOne(
            'SELECT ROUND(COUNT(*) * ? / 60.0, 1) AS tracked_min,
                    SUM(CASE WHEN gazed_process = process  THEN 1 ELSE 0 END) AS same,
                    SUM(CASE WHEN gazed_process <> process THEN 1 ELSE 0 END) AS diff
             FROM samples
             WHERE gazed_process IS NOT NULL AND process IS NOT NULL',
            [self::INTERVAL]
        );
        $total = (int) ($r->same ?? 0) + (int) ($r->diff ?? 0);

        return [
            'tracked_min' => $r->tracked_min ?? 0,
            'same' => (int) ($r->same ?? 0),
            'diff' => (int) ($r->diff ?? 0),
            'pct_same' => $total ? round(($r->same / $total) * 100, 1) : null,
            'pct_diff' => $total ? round(($r->diff / $total) * 100, 1) : null,
        ];
    }

    // --- 2C analytical aggregates -----------------------------------------

    public function summary(): array
    {
        if (! $this->ready()) {
            return ['has_data' => false, 'samples' => 0, 'sessions' => 0,
                'events' => 0, 'first_ts' => null, 'last_ts' => null];
        }
        $s = $this->db()->selectOne(
            'SELECT COUNT(*) AS samples, MIN(ts) AS first_ts, MAX(ts) AS last_ts FROM samples'
        );

        return [
            'has_data' => ($s->samples ?? 0) > 0,
            'samples' => $s->samples ?? 0,
            'sessions' => $this->db()->selectOne('SELECT COUNT(*) AS n FROM sessions')->n ?? 0,
            'events' => $this->db()->selectOne('SELECT COUNT(*) AS n FROM events')->n ?? 0,
            'first_ts' => $s->first_ts ?? null,
            'last_ts' => $s->last_ts ?? null,
        ];
    }

    /** Distinct local calendar days present in the data (for the day picker). */
    public function availableDays(): array
    {
        if (! $this->ready()) {
            return [];
        }
        $off = $this->localOffset();

        return array_map(
            fn ($r) => $r->day,
            $this->db()->select(
                "SELECT DISTINCT strftime('%Y-%m-%d', ts, ?) AS day
                 FROM samples ORDER BY day DESC", [$off]
            )
        );
    }

    /**
     * Weekday x hour productivity matrix. Productive = face present + input
     * activity + a process categorized as 'trabajo'. Empty cells stay null
     * (honest "no data") instead of being interpolated.
     */
    public function heatmap(): array
    {
        $days = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
        $cells = [];
        for ($d = 0; $d < 7; $d++) {
            for ($h = 0; $h < 24; $h++) {
                $cells[$d][$h] = ['total' => 0, 'present' => 0, 'productive' => 0];
            }
        }
        if ($this->ready()) {
            $map = $this->categoryMap();
            $off = $this->localOffset();
            $rows = $this->db()->select(
                "SELECT CAST(strftime('%w', ts, ?) AS INTEGER) AS dow,
                        CAST(strftime('%H', ts, ?) AS INTEGER) AS hour,
                        process,
                        COUNT(*) AS total,
                        SUM(CASE WHEN face_present >= 0.5 THEN 1 ELSE 0 END) AS present,
                        SUM(CASE WHEN face_present >= 0.5 AND (kb_events+mouse_events) > 0 THEN 1 ELSE 0 END) AS active
                 FROM samples GROUP BY dow, hour, process",
                [$off, $off]
            );
            foreach ($rows as $r) {
                $c = &$cells[$r->dow][$r->hour];
                $c['total'] += $r->total;
                $c['present'] += $r->present;
                if ($this->categoryOf($map, $r->process) === 'trabajo') {
                    $c['productive'] += $r->active;
                }
            }
        }

        $grid = [];
        foreach ($cells as $d => $hours) {
            foreach ($hours as $h => $c) {
                $grid[] = [
                    'dow' => $d,
                    'day' => $days[$d],
                    'hour' => $h,
                    'has_data' => $c['total'] > 0,
                    'total_min' => round($c['total'] * self::INTERVAL / 60, 1),
                    'present_min' => round($c['present'] * self::INTERVAL / 60, 1),
                    'productive_min' => round($c['productive'] * self::INTERVAL / 60, 1),
                ];
            }
        }

        return ['days' => $days, 'cells' => $grid];
    }

    /** Attention distribution: gaze zones (with grid dims), on/off, apps. */
    public function attention(): array
    {
        if (! $this->ready()) {
            return ['zones' => [], 'grid' => ['cols' => 6, 'rows' => 3],
                'on_off' => null, 'apps' => [], 'gazed_apps' => [],
                'gazed_vs_active' => [], 'alignment' => null];
        }
        $off = $this->onOffScreenRatio();

        return [
            'zones' => $this->timePerGazeZone(),
            'grid' => ['cols' => 6, 'rows' => 3],
            'on_off' => $off[0] ?? null,
            'apps' => $this->timePerApp(30),
            'gazed_apps' => $this->timePerGazedApp(30),
            'gazed_vs_active' => $this->gazedVsActive(15),
            'alignment' => $this->gazeFocusAlignment(),
        ];
    }

    /** One day's process bands + presence gaps + events (local time). */
    public function dayTimeline(string $day): array
    {
        if (! $this->ready()) {
            return ['day' => $day, 'bands' => [], 'events' => []];
        }
        $off = $this->localOffset();
        $map = $this->categoryMap();

        $rows = $this->db()->select(
            "SELECT strftime('%Y-%m-%dT%H:%M:%SZ', ts) AS ts,
                    strftime('%H:%M', ts, ?) AS local_hm,
                    process, tracking_state, on_screen, face_present,
                    (kb_events + mouse_events) AS activity
             FROM samples
             WHERE strftime('%Y-%m-%d', ts, ?) = ?
             ORDER BY ts", [$off, $off, $day]
        );

        // Collapse consecutive equal-process (or gap) intervals into bands.
        $bands = [];
        foreach ($rows as $r) {
            $present = $r->face_present >= 0.5;
            $key = $present ? ($r->process ?? 'sin_proceso') : 'ausente';
            $last = $bands ? $bands[count($bands) - 1] : null;
            if ($last && $last['key'] === $key) {
                $bands[count($bands) - 1]['end'] = $r->local_hm;
                $bands[count($bands) - 1]['intervals']++;
                $bands[count($bands) - 1]['active'] += $r->activity > 0 ? 1 : 0;
            } else {
                $bands[] = ['key' => $key, 'process' => $present ? $r->process : null,
                    'category' => $present ? $this->categoryOf($map, $r->process) : 'ausente',
                    'start' => $r->local_hm, 'end' => $r->local_hm,
                    'intervals' => 1, 'active' => $r->activity > 0 ? 1 : 0];
            }
        }
        foreach ($bands as &$b) {
            $b['minutes'] = round($b['intervals'] * self::INTERVAL / 60, 1);
            $b['active_ratio'] = $b['intervals'] ? round($b['active'] / $b['intervals'], 2) : 0;
            unset($b['key']);
        }

        $events = $this->db()->select(
            "SELECT strftime('%H:%M:%S', ts, ?) AS local_time, event_type,
                    snapshot_path, duration_s
             FROM events WHERE strftime('%Y-%m-%d', ts, ?) = ? ORDER BY ts",
            [$off, $off, $day]
        );

        return ['day' => $day, 'bands' => $bands, 'events' => $events];
    }

    /** Session list with duration, dominant apps, activity ratio, events. */
    public function sessions(): array
    {
        if (! $this->ready()) {
            return [];
        }
        $off = $this->localOffset();
        $map = $this->categoryMap();
        $sessions = $this->db()->select(
            "SELECT id,
                    strftime('%Y-%m-%d %H:%M', start, ?) AS start_local,
                    CASE WHEN end IS NULL THEN NULL
                         ELSE strftime('%H:%M', end, ?) END AS end_local,
                    notes
             FROM sessions ORDER BY start DESC"
        , [$off, $off]);

        foreach ($sessions as $s) {
            $agg = $this->db()->selectOne(
                'SELECT COUNT(*) AS intervals,
                        ROUND(AVG(on_screen) * 100, 0) AS on_pct,
                        SUM(CASE WHEN (kb_events+mouse_events) > 0 THEN 1 ELSE 0 END) AS active,
                        SUM(kb_events) AS keys, SUM(mouse_events) AS mouse
                 FROM samples WHERE session_id = ?', [$s->id]
            );
            $s->minutes = round(($agg->intervals ?? 0) * self::INTERVAL / 60, 1);
            $s->on_pct = $agg->on_pct ?? 0;
            $s->activity_ratio = ($agg->intervals ?? 0)
                ? round($agg->active / $agg->intervals, 2) : 0;
            $s->events = $this->db()->selectOne(
                'SELECT COUNT(*) AS n FROM events WHERE session_id = ?', [$s->id]
            )->n ?? 0;
            $top = $this->db()->select(
                'SELECT process, COUNT(*) AS n FROM samples
                 WHERE session_id = ? AND process IS NOT NULL
                 GROUP BY process ORDER BY n DESC LIMIT 3', [$s->id]
            );
            $s->top_apps = array_map(fn ($t) => $t->process, $top);
        }

        return $sessions;
    }
}
