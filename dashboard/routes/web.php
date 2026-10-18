<?php

use App\Http\Controllers\MetricsController;
use Illuminate\Support\Facades\Route;

// Localhost-only (LocalOnly middleware, registered globally in bootstrap/app).
Route::get('/', [MetricsController::class, 'overview'])->name('overview');
Route::get('/heatmap', [MetricsController::class, 'heatmap'])->name('heatmap');
Route::get('/timeline', [MetricsController::class, 'timeline'])->name('timeline');
Route::get('/attention', [MetricsController::class, 'attention'])->name('attention');
Route::get('/sessions', [MetricsController::class, 'sessions'])->name('sessions');
Route::get('/config', [MetricsController::class, 'config'])->name('config');

// The only write path: process categorization -> dashboard's own DB.
Route::post('/config/category', [MetricsController::class, 'updateCategory'])
    ->name('config.category');

// Opt-in event snapshots (local files, path-traversal guarded).
Route::get('/snapshot', [MetricsController::class, 'snapshot'])->name('snapshot');

// Clean JSON endpoints mirroring the five sample queries.
Route::prefix('api/metrics')->group(function () {
    Route::get('time-per-app', [MetricsController::class, 'apiTimePerApp']);
    Route::get('time-per-zone', [MetricsController::class, 'apiTimePerZone']);
    Route::get('on-off-screen', [MetricsController::class, 'apiOnOffScreen']);
    Route::get('presence-gaps', [MetricsController::class, 'apiPresenceGaps']);
    Route::get('activity-per-app', [MetricsController::class, 'apiActivityPerApp']);
});
