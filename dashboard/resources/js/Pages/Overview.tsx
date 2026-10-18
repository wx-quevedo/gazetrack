import DashboardLayout from '../Layouts/DashboardLayout';

type Row = Record<string, string | number | null>;

interface Summary {
    has_data: boolean;
    samples: number;
    sessions: number;
    first_ts: string | null;
    last_ts: string | null;
}

function DataTable({
    title,
    rows,
    empty,
}: {
    title: string;
    rows: Row[];
    empty?: string;
}) {
    const cols = rows.length ? Object.keys(rows[0]) : [];
    return (
        <section className="rounded-lg border border-neutral-200 bg-white shadow-sm">
            <h2 className="border-b border-neutral-200 px-4 py-3 text-sm font-medium text-neutral-700">
                {title}
            </h2>
            {rows.length === 0 ? (
                <p className="px-4 py-6 text-sm text-neutral-400">
                    {empty ?? 'Sin datos todavia.'}
                </p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm tabular-nums">
                        <thead>
                            <tr className="text-left text-neutral-500">
                                {cols.map((c) => (
                                    <th key={c} className="px-4 py-2 font-medium">
                                        {c}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((r, i) => (
                                <tr
                                    key={i}
                                    className="border-t border-neutral-100"
                                >
                                    {cols.map((c) => (
                                        <td
                                            key={c}
                                            className="px-4 py-2 text-neutral-700"
                                        >
                                            {r[c] ?? '-'}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
}

export default function Overview({
    summary,
    timePerApp,
    timePerGazedApp,
    timePerZone,
    onOffScreen,
    presenceGaps,
    activityPerApp,
}: {
    summary: Summary;
    timePerApp: Row[];
    timePerGazedApp: Row[];
    timePerZone: Row[];
    onOffScreen: Row[];
    presenceGaps: Row[];
    activityPerApp: Row[];
}) {
    return (
        <DashboardLayout title="Resumen">
            {!summary?.has_data && (
                <div className="mb-6 rounded-lg border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-500">
                    Aun no hay datos de actividad. Ejecuta{' '}
                    <code className="rounded bg-neutral-100 px-1 text-neutral-700">
                        python main.py record --background
                    </code>{' '}
                    para registrar una sesion.
                </div>
            )}
            <p className="mb-6 text-sm text-neutral-500">
                {summary?.samples ?? 0} intervalos en{' '}
                {summary?.sessions ?? 0} sesion(es). Las vistas analiticas
                (heatmap, linea de tiempo, distribucion de atencion) toman los
                datos de esta misma base.
            </p>
            <div className="grid gap-6 xl:grid-cols-2">
                <DataTable
                    title="Tiempo por aplicacion activa (min)"
                    rows={timePerApp}
                />
                <DataTable
                    title="Tiempo por aplicacion mirada (min)"
                    rows={timePerGazedApp}
                    empty="Sin datos de mirada aun. Se llenan en la proxima sesion registrada con el mapeo de ventana."
                />
                <DataTable
                    title="Tiempo por zona de mirada (min)"
                    rows={timePerZone}
                />
                <DataTable title="On / off-screen (%)" rows={onOffScreen} />
                <DataTable
                    title="Intensidad por app (teclas / mouse)"
                    rows={activityPerApp}
                />
                <DataTable
                    title="Huecos de presencia (cara ausente)"
                    rows={presenceGaps}
                    empty="Sin huecos de presencia registrados."
                />
            </div>
        </DashboardLayout>
    );
}
