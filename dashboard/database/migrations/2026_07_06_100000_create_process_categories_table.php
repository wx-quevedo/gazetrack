<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Process -> category mapping, edited from the dashboard's Configuracion page.
 * This is the ONLY writable store in the dashboard; it lives in the dashboard's
 * own SQLite DB (database/database.sqlite). The recorder's activity.db stays
 * read-only. New processes seen in activity.db but absent here are treated as
 * "sin_categorizar" until the user assigns them.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('process_categories', function (Blueprint $table) {
            $table->string('process')->primary();
            $table->string('category')->default('sin_categorizar');
            $table->timestamps();
        });

        // Sensible, fully editable defaults so the heatmap tells a story out
        // of the box; the user re-categorizes anything from the dashboard.
        $now = now();
        $seed = [
            'trabajo' => ['Code.exe', 'claude.exe', 'python.exe', 'Unity.exe',
                'WindowsTerminal.exe', 'powershell.exe', 'pwsh.exe', 'cmd.exe',
                'php.exe', 'node.exe'],
            'neutral' => ['chrome.exe', 'msedge.exe', 'firefox.exe',
                'explorer.exe'],
        ];
        $rows = [];
        foreach ($seed as $category => $procs) {
            foreach ($procs as $process) {
                $rows[] = compact('process', 'category')
                    + ['created_at' => $now, 'updated_at' => $now];
            }
        }
        DB::table('process_categories')->insert($rows);
    }

    public function down(): void
    {
        Schema::dropIfExists('process_categories');
    }
};
