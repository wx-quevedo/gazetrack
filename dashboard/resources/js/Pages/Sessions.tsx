import DashboardLayout from '../Layouts/DashboardLayout';

interface Session {
    id: number;
    start_local: string;
    end_local: string | null;
    minutes: number;
    on_pct: number;
    activity_ratio: number;
    events: number;
    top_apps: string[];
    notes: string | null;
}

export default function Sessions({ sessions }: { sessions: Session[] }) {
    return (
        <DashboardLayout title="Sesiones">
            {sessions.length === 0 ? (
                <p className="text-sm text-neutral-500">
                    Aun no hay sesiones registradas.
                </p>
            ) : (
                <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white shadow-sm">
                    <table className="w-full text-sm tabular-nums">
                        <thead>
                            <tr className="border-b border-neutral-200 text-left text-neutral-500">
                                <th className="px-4 py-3 font-medium">Inicio</th>
                                <th className="px-4 py-3 font-medium">Fin</th>
                                <th className="px-4 py-3 font-medium">
                                    Duracion
                                </th>
                                <th className="px-4 py-3 font-medium">
                                    On-screen
                                </th>
                                <th className="px-4 py-3 font-medium">
                                    Actividad
                                </th>
                                <th className="px-4 py-3 font-medium">
                                    Eventos
                                </th>
                                <th className="px-4 py-3 font-medium">
                                    Apps dominantes
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {sessions.map((s) => (
                                <tr
                                    key={s.id}
                                    className="border-t border-neutral-100 text-neutral-700"
                                >
                                    <td className="px-4 py-3">
                                        {s.start_local}
                                    </td>
                                    <td className="px-4 py-3 text-neutral-500">
                                        {s.end_local ?? 'en curso'}
                                    </td>
                                    <td className="px-4 py-3">{s.minutes} min</td>
                                    <td className="px-4 py-3">{s.on_pct}%</td>
                                    <td className="px-4 py-3">
                                        {Math.round(s.activity_ratio * 100)}%
                                    </td>
                                    <td className="px-4 py-3 text-neutral-500">
                                        {s.events}
                                    </td>
                                    <td className="px-4 py-3 text-neutral-500">
                                        {s.top_apps.join(', ') || '-'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </DashboardLayout>
    );
}
