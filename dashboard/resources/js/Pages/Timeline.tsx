import { Link } from '@inertiajs/react';
import DashboardLayout from '../Layouts/DashboardLayout';
import { categoryColor, CATEGORY_LABEL } from '../lib/categories';

interface Band {
    process: string | null;
    category: string;
    start: string; // HH:MM
    end: string;
    minutes: number;
    active_ratio: number;
}
interface Event {
    local_time: string; // HH:MM:SS
    event_type: string;
    snapshot_path: string | null;
    duration_s: number;
}
interface Props {
    days: string[];
    selectedDay: string | null;
    timeline: { day: string | null; bands: Band[]; events: Event[] };
}

const toMin = (hm: string) => {
    const [h, m] = hm.split(':').map(Number);
    return h * 60 + m;
};

export default function Timeline({ days, selectedDay, timeline }: Props) {
    const { bands, events } = timeline;
    const starts = bands.map((b) => toMin(b.start));
    const ends = bands.map((b) => toMin(b.end) + 1);
    const spanStart = bands.length ? Math.min(...starts) : 0;
    const spanEnd = bands.length ? Math.max(...ends) : 1;
    const span = Math.max(1, spanEnd - spanStart);
    const pct = (min: number) => ((min - spanStart) / span) * 100;

    return (
        <DashboardLayout title="Linea de tiempo del dia">
            <div className="mb-5 flex flex-wrap gap-2">
                {days.length === 0 && (
                    <span className="text-sm text-neutral-500">
                        Aun no hay dias registrados.
                    </span>
                )}
                {days.map((d) => (
                    <Link
                        key={d}
                        href={`/timeline?day=${d}`}
                        className={
                            'rounded-md px-3 py-1.5 text-sm ' +
                            (d === selectedDay
                                ? 'bg-neutral-800 text-white'
                                : 'border border-neutral-200 bg-white text-neutral-600 hover:text-neutral-900')
                        }
                    >
                        {d}
                    </Link>
                ))}
            </div>

            {bands.length === 0 ? (
                <p className="text-sm text-neutral-500">
                    Sin datos para este dia.
                </p>
            ) : (
                <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
                    <div className="relative h-14 w-full rounded bg-neutral-100">
                        {bands.map((b, i) => (
                            <div
                                key={i}
                                title={`${b.process ?? CATEGORY_LABEL[b.category]} ${b.start}-${b.end} (${b.minutes} min, actividad ${Math.round(
                                    b.active_ratio * 100,
                                )}%)`}
                                className="absolute top-0 flex h-14 items-center overflow-hidden rounded-sm"
                                style={{
                                    left: `${pct(toMin(b.start))}%`,
                                    width: `${Math.max(
                                        0.4,
                                        (b.minutes / span) * 100,
                                    )}%`,
                                    backgroundColor: categoryColor(b.category),
                                    opacity: 0.5 + 0.5 * b.active_ratio,
                                }}
                            >
                                <span className="truncate px-1 text-[10px] text-white/95">
                                    {b.process ?? CATEGORY_LABEL[b.category]}
                                </span>
                            </div>
                        ))}
                        {events.map((e, i) => (
                            <div
                                key={`e${i}`}
                                title={`${e.event_type} @ ${e.local_time} (${e.duration_s}s)`}
                                className="absolute -top-1 h-16 w-0.5 bg-amber-500"
                                style={{ left: `${pct(toMin(e.local_time.slice(0, 5)))}%` }}
                            />
                        ))}
                    </div>
                    <div className="mt-2 flex justify-between text-xs tabular-nums text-neutral-500">
                        <span>
                            {String(Math.floor(spanStart / 60)).padStart(2, '0')}
                            :{String(spanStart % 60).padStart(2, '0')}
                        </span>
                        <span>
                            {String(Math.floor(spanEnd / 60)).padStart(2, '0')}:
                            {String(spanEnd % 60).padStart(2, '0')}
                        </span>
                    </div>

                    {events.length > 0 && (
                        <div className="mt-6">
                            <h3 className="mb-2 text-sm font-medium text-neutral-700">
                                Eventos ({events.length})
                            </h3>
                            <ul className="space-y-1 text-sm">
                                {events.map((e, i) => (
                                    <li
                                        key={i}
                                        className="flex items-center gap-3 text-neutral-600"
                                    >
                                        <span className="tabular-nums text-neutral-400">
                                            {e.local_time}
                                        </span>
                                        <span className="text-neutral-800">
                                            {e.event_type}
                                        </span>
                                        <span className="text-neutral-400">
                                            {e.duration_s}s
                                        </span>
                                        {e.snapshot_path && (
                                            <a
                                                href={`/snapshot?path=${encodeURIComponent(e.snapshot_path)}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="text-neutral-700 underline decoration-neutral-300 hover:decoration-neutral-500"
                                            >
                                                ver captura
                                            </a>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}
        </DashboardLayout>
    );
}
