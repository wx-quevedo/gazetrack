<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Editable process -> category mapping (dashboard-owned, writable). Uses the
 * default connection (database/database.sqlite), never the read-only activity
 * connection.
 */
class ProcessCategory extends Model
{
    protected $primaryKey = 'process';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = ['process', 'category'];

    /** Allowed categories; anything else is normalized to sin_categorizar. */
    public const CATEGORIES = ['trabajo', 'neutral', 'distraccion', 'sin_categorizar'];

    /** process => category map for quick classification in PHP. */
    public static function map(): array
    {
        return static::query()->pluck('category', 'process')->all();
    }
}
