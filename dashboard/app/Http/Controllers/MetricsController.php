<?php

namespace App\Http\Controllers;

use App\Models\ProcessCategory;
use App\Services\ActivityMetrics;
use Illuminate\Http\Request;
use Inertia\Inertia;

/**
 * Serves the 2C dashboard views and the JSON metrics endpoints. Reads the
 * recorder's activity DB read-only through ActivityMetrics. The only write is
 * process categorization, which goes to the dashboard's OWN database (never
 * activity.db).
 */
class MetricsController extends Controller
{
    public function __construct(private readonly ActivityMetrics $metrics)
    {
    }

    public function overview()
    {
        return Inertia::render('Overview', [
            'summary' => $this->metrics->summary(),
            'timePerApp' => $this->metrics->timePerApp(),
            'timePerGazedApp' => $this->metrics->timePerGazedApp(),
            'timePerZone' => $this->metrics->timePerGazeZone(),
            'onOffScreen' => $this->metrics->onOffScreenRatio(),
            'presenceGaps' => $this->metrics->presenceGaps(50),
            'activityPerApp' => $this->metrics->activityPerApp(),
        ]);
    }

    public function heatmap()
    {
        return Inertia::render('Heatmap', [
            'summary' => $this->metrics->summary(),
            'heatmap' => $this->metrics->heatmap(),
        ]);
    }

    public function timeline(Request $request)
    {
        $days = $this->metrics->availableDays();
        $day = $request->query('day', $days[0] ?? null);

        return Inertia::render('Timeline', [
            'days' => $days,
            'selectedDay' => $day,
            'timeline' => $day ? $this->metrics->dayTimeline($day)
                : ['day' => null, 'bands' => [], 'events' => []],
        ]);
    }

    public function attention()
    {
        return Inertia::render('Attention', [
            'attention' => $this->metrics->attention(),
        ]);
    }

    public function sessions()
    {
        return Inertia::render('Sessions', [
            'sessions' => $this->metrics->sessions(),
        ]);
    }

    /** Category editor: every process seen in the data + its current category. */
    public function config()
    {
        $map = ProcessCategory::map();
        $apps = $this->metrics->timePerApp(100);
        $processes = array_map(fn ($a) => [
            'process' => $a->process,
            'minutes' => $a->minutes,
            'category' => $map[$a->process] ?? 'sin_categorizar',
        ], $apps);

        return Inertia::render('Config', [
            'processes' => $processes,
            'categories' => ProcessCategory::CATEGORIES,
        ]);
    }

    public function updateCategory(Request $request)
    {
        $data = $request->validate([
            'process' => 'required|string|max:255',
            'category' => 'required|in:'.implode(',', ProcessCategory::CATEGORIES),
        ]);
        ProcessCategory::updateOrCreate(
            ['process' => $data['process']],
            ['category' => $data['category']]
        );

        return back();
    }

    /** Serve an opt-in event snapshot from ../data/snapshots (local, guarded
     *  against path traversal). */
    public function snapshot(Request $request)
    {
        $rel = (string) $request->query('path', '');
        $base = realpath(base_path('../data'));
        $full = $base ? realpath($base.DIRECTORY_SEPARATOR.$rel) : false;
        if (! $base || ! $full
            || ! str_starts_with($full, $base.DIRECTORY_SEPARATOR)
            || ! str_contains($rel, 'snapshots/')
            || ! is_file($full)) {
            abort(404);
        }

        return response()->file($full);
    }

    // --- JSON endpoints (clean JSON, one per original sample query) --------
    public function apiTimePerApp()
    {
        return response()->json($this->metrics->timePerApp());
    }

    public function apiTimePerZone()
    {
        return response()->json($this->metrics->timePerGazeZone());
    }

    public function apiOnOffScreen()
    {
        return response()->json($this->metrics->onOffScreenRatio());
    }

    public function apiPresenceGaps()
    {
        return response()->json($this->metrics->presenceGaps());
    }

    public function apiActivityPerApp()
    {
        return response()->json($this->metrics->activityPerApp());
    }
}
