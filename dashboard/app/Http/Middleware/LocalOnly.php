<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Hard guard: this dashboard exposes face snapshots and behavior data, which
 * must NEVER leave the machine. It only answers requests from localhost. Run
 * it with `php artisan serve` (binds 127.0.0.1); do not deploy it to a VPS.
 */
class LocalOnly
{
    public function handle(Request $request, Closure $next): Response
    {
        if (! in_array($request->ip(), ['127.0.0.1', '::1'], true)) {
            abort(403, 'This dashboard is local-only and refuses non-localhost requests.');
        }

        return $next($request);
    }
}
