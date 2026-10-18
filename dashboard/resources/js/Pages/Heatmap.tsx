import DashboardLayout from '../Layouts/DashboardLayout';

interface Cell {
    dow: number;
    day: string;
    hour: number;
    has_data: boolean;
    total_min: number;
    present_min: number;
    productive_min: number;
}

interface Props {
    summary: { has_data: boolean; samples: number };
    heatmap: { days: string[]; cells: Cell[] };
}

// Cell background: three clearly distinct states on a light ground.
function cellStyle(c: Cell | undefined, max: number) {
    if (!c || !c.has_data) {
        return { backgroundColor: '#ffffff', border: '1px solid #e5e5e5' }; // sin datos
    }
    if (c.productive_min <= 0) {
        return { backgroundColor: '#e2e2e2', border: '1px solid transparent' }; // presente, no productivo
    }
    const a = 0.18 + 0.82 * (c.productive_min / max);
    return {
        backgroundColor: `rgba(74,115,85,${a})`,
        border: '1px solid transparent',
    };
}

export default function Heatmap({ summary, heatmap }: Props) {
    const { days, cells } = heatmap;
    const byCell = new Map<string, Cell>();
    cells.forEach((c) => byCell.set(`${c.dow}-${c.hour}`, c));
    const max = Math.max(0.001, ...cells.map((c) => c.productive_min));
    const hours = Array.from({ length: 24 }, (_, h) => h);

    return (
        <DashboardLayout title="Heatmap de horas productivas">
            {!summary.has_data && (
                <div className="mb-6 rounded-lg border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-500">
                    Aun no hay datos. Ejecuta{' '}
                    <code className="rounded bg-neutral-100 px-1 text-neutral-700">
                        python main.py record --background
                    </code>
                    .
                </div>
            )}
            <p className="mb-5 max-w-2xl text-sm text-neutral-500">
                Intensidad = minutos productivos (presente + con actividad + app
                categorizada como trabajo), agrupados por hora local. Las celdas
                sin datos se muestran vacias, sin interpolar. Con pocos dias la
                lectura es parcial.
            </p>

            <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
                <div className="inline-block">
                    <div className="flex">
                        <div className="w-10" />
                        {hours.map((h) => (
                            <div
                                key={h}
                                className="w-6 text-center text-[10px] text-neutral-400"
                            >
                                {h % 3 === 0 ? h : ''}
                            </div>
                        ))}
                    </div>
                    {days.map((dayName, d) => (
                        <div key={d} className="flex items-center">
                            <div className="w-10 pr-2 text-right text-xs text-neutral-500">
                                {dayName}
                            </div>
                            {hours.map((h) => {
                                const c = byCell.get(`${d}-${h}`);
                                const prod = c?.productive_min ?? 0;
                                const title = c?.has_data
                                    ? `${dayName} ${h}:00 - productivo ${prod} min / presente ${c.present_min} min / total ${c.total_min} min`
                                    : `${dayName} ${h}:00 - sin datos`;
                                return (
                                    <div
                                        key={h}
                                        title={title}
                                        className="m-px h-6 w-6 rounded-sm"
                                        style={cellStyle(c, max)}
                                    />
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-neutral-500">
                <span>menos</span>
                {[0.2, 0.45, 0.7, 0.95].map((a) => (
                    <div
                        key={a}
                        className="h-4 w-6 rounded-sm"
                        style={{ backgroundColor: `rgba(74,115,85,${a})` }}
                    />
                ))}
                <span>mas productivo</span>
                <span className="ml-4 flex items-center gap-1">
                    <div className="h-4 w-6 rounded-sm bg-[#e2e2e2]" />
                    presente sin producir
                </span>
                <span className="flex items-center gap-1">
                    <div className="h-4 w-6 rounded-sm border border-neutral-300 bg-white" />
                    sin datos
                </span>
            </div>
        </DashboardLayout>
    );
}
