import {
    Bar,
    BarChart,
    Cell,
    Legend,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import DashboardLayout from '../Layouts/DashboardLayout';
import { categoryColor, CATEGORY_LABEL } from '../lib/categories';

interface Zone {
    gaze_zone: string;
    minutes: number;
}
interface App {
    process: string;
    minutes: number;
    category: string;
}
interface Diverge {
    active_process: string;
    looked_process: string;
    minutes: number;
}
interface Alignment {
    tracked_min: number;
    same: number;
    diff: number;
    pct_same: number | null;
    pct_diff: number | null;
}
interface Props {
    attention: {
        zones: Zone[];
        grid: { cols: number; rows: number };
        on_off: {
            pct_on_screen: number;
            pct_off_screen: number;
            total_minutes: number;
        } | null;
        apps: App[];
        gazed_apps: App[];
        gazed_vs_active: Diverge[];
        alignment: Alignment | null;
    };
}

// Distinct, sober hues for the two series (kept apart from the category colors
// so the comparison never reads as a category encoding).
const ACTIVE_COLOR = '#5b7a99'; // where the keyboard is (foreground window)
const GAZED_COLOR = '#c08a4a'; // where the eyes are (looked-at window)

export default function Attention({ attention }: Props) {
    const { zones, grid, on_off, apps, gazed_apps, gazed_vs_active, alignment } =
        attention;
    const cell = new Map<string, number>();
    let offMin = 0;
    zones.forEach((z) => {
        if (z.gaze_zone === 'off') offMin = z.minutes;
        else cell.set(z.gaze_zone, z.minutes);
    });
    const max = Math.max(
        0.001,
        ...zones.filter((z) => z.gaze_zone !== 'off').map((z) => z.minutes),
    );

    // Merge active + gazed minutes per process for the side-by-side chart.
    const byProc = new Map<
        string,
        { process: string; active_min: number; gazed_min: number }
    >();
    const bump = (p: string) =>
        byProc.get(p) ?? { process: p, active_min: 0, gazed_min: 0 };
    apps.forEach((a) => {
        const e = bump(a.process);
        e.active_min = a.minutes;
        byProc.set(a.process, e);
    });
    gazed_apps.forEach((a) => {
        const e = bump(a.process);
        e.gazed_min = a.minutes;
        byProc.set(a.process, e);
    });
    const merged = [...byProc.values()]
        .sort((x, y) => y.active_min + y.gazed_min - (x.active_min + x.gazed_min))
        .slice(0, 12);
    const hasGazed = gazed_apps.length > 0;

    return (
        <DashboardLayout title="Distribucion de atencion">
            <div className="grid gap-6 lg:grid-cols-2">
                <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
                    <h2 className="mb-1 text-sm font-medium text-neutral-700">
                        Zonas de mirada ({grid.cols}x{grid.rows})
                    </h2>
                    <p className="mb-4 text-xs text-neutral-500">
                        La pantalla dividida en celdas; intensidad = minutos
                        mirando cada zona.
                    </p>
                    <div
                        className="grid gap-1"
                        style={{
                            gridTemplateColumns: `repeat(${grid.cols}, minmax(0,1fr))`,
                            aspectRatio: `${grid.cols} / ${grid.rows}`,
                        }}
                    >
                        {Array.from({ length: grid.rows }).flatMap((_, r) =>
                            Array.from({ length: grid.cols }).map((__, c) => {
                                const min = cell.get(`c${c}r${r}`) ?? 0;
                                const a = 0.08 + 0.92 * (min / max);
                                return (
                                    <div
                                        key={`c${c}r${r}`}
                                        title={`Zona c${c}r${r}: ${min} min`}
                                        className="flex items-center justify-center rounded-sm border border-neutral-200 text-[10px] tabular-nums text-neutral-700"
                                        style={{
                                            backgroundColor: `rgba(70,105,150,${a})`,
                                        }}
                                    >
                                        {min > 0 ? min : ''}
                                    </div>
                                );
                            }),
                        )}
                    </div>
                    <div className="mt-4 text-xs text-neutral-500">
                        Fuera de pantalla: {offMin} min
                    </div>
                </section>

                <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
                    <h2 className="mb-4 text-sm font-medium text-neutral-700">
                        On / off-screen
                    </h2>
                    {on_off ? (
                        <>
                            <div className="flex h-6 w-full overflow-hidden rounded border border-neutral-200">
                                <div
                                    className="bg-[#5b8266]"
                                    style={{ width: `${on_off.pct_on_screen}%` }}
                                    title={`On-screen ${on_off.pct_on_screen}%`}
                                />
                                <div
                                    className="bg-neutral-300"
                                    style={{ width: `${on_off.pct_off_screen}%` }}
                                    title={`Off-screen ${on_off.pct_off_screen}%`}
                                />
                            </div>
                            <div className="mt-3 flex justify-between text-sm text-neutral-600">
                                <span>On-screen {on_off.pct_on_screen}%</span>
                                <span>Off-screen {on_off.pct_off_screen}%</span>
                            </div>
                            <div className="mt-1 text-xs text-neutral-400">
                                {on_off.total_minutes} min totales
                            </div>

                            {alignment && alignment.pct_same !== null && (
                                <div className="mt-5 border-t border-neutral-100 pt-4">
                                    <h3 className="mb-2 text-xs font-medium text-neutral-600">
                                        Foco vs mirada
                                    </h3>
                                    <div className="flex h-5 w-full overflow-hidden rounded border border-neutral-200">
                                        <div
                                            style={{
                                                width: `${alignment.pct_same}%`,
                                                backgroundColor: GAZED_COLOR,
                                            }}
                                            title={`Mira la app activa ${alignment.pct_same}%`}
                                        />
                                        <div
                                            className="bg-neutral-300"
                                            style={{
                                                width: `${alignment.pct_diff ?? 0}%`,
                                            }}
                                            title={`Mira otra app ${alignment.pct_diff}%`}
                                        />
                                    </div>
                                    <div className="mt-2 flex justify-between text-xs text-neutral-500">
                                        <span>
                                            Mira la app activa{' '}
                                            {alignment.pct_same}%
                                        </span>
                                        <span>
                                            Mira otra app {alignment.pct_diff}%
                                        </span>
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <p className="text-sm text-neutral-500">Sin datos.</p>
                    )}
                </section>
            </div>

            <section className="mt-6 rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
                <h2 className="mb-1 text-sm font-medium text-neutral-700">
                    Apps miradas vs apps activas (min)
                </h2>
                <p className="mb-4 text-xs text-neutral-500">
                    <span
                        className="mr-1 inline-block h-2 w-2 rounded-sm align-middle"
                        style={{ backgroundColor: ACTIVE_COLOR }}
                    />
                    Activa = ventana en primer plano (donde escribes).
                    <span
                        className="mx-1 ml-3 inline-block h-2 w-2 rounded-sm align-middle"
                        style={{ backgroundColor: GAZED_COLOR }}
                    />
                    Mirada = ventana bajo el punto de mirada (donde ves). La
                    brecha entre ambas es tiempo de foco dividido.
                </p>
                {hasGazed ? (
                    <div style={{ height: Math.max(180, merged.length * 34) }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={merged}
                                layout="vertical"
                                barGap={2}
                                margin={{ left: 24, right: 16 }}
                            >
                                <XAxis
                                    type="number"
                                    stroke="#9ca3af"
                                    fontSize={11}
                                />
                                <YAxis
                                    type="category"
                                    dataKey="process"
                                    width={120}
                                    stroke="#4b5563"
                                    fontSize={11}
                                />
                                <Tooltip
                                    cursor={{ fill: '#00000008' }}
                                    contentStyle={{
                                        background: '#ffffff',
                                        border: '1px solid #e5e5e5',
                                        borderRadius: 6,
                                        color: '#374151',
                                        fontSize: 12,
                                    }}
                                />
                                <Legend
                                    wrapperStyle={{ fontSize: 11 }}
                                    formatter={(v) =>
                                        v === 'active_min'
                                            ? 'Activa'
                                            : 'Mirada'
                                    }
                                />
                                <Bar
                                    dataKey="active_min"
                                    name="active_min"
                                    fill={ACTIVE_COLOR}
                                    radius={[0, 3, 3, 0]}
                                />
                                <Bar
                                    dataKey="gazed_min"
                                    name="gazed_min"
                                    fill={GAZED_COLOR}
                                    radius={[0, 3, 3, 0]}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <p className="rounded border border-dashed border-neutral-300 bg-neutral-50 px-4 py-3 text-sm text-neutral-500">
                            Aun no hay datos de app mirada (el mapeo de ventana
                            se agrego despues de las sesiones actuales). Se
                            llenara en la proxima sesion registrada. Debajo, las
                            apps activas por ahora.
                        </p>
                        <div style={{ height: Math.max(160, apps.length * 26) }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={apps}
                                    layout="vertical"
                                    margin={{ left: 24, right: 16 }}
                                >
                                    <XAxis
                                        type="number"
                                        stroke="#9ca3af"
                                        fontSize={11}
                                    />
                                    <YAxis
                                        type="category"
                                        dataKey="process"
                                        width={120}
                                        stroke="#4b5563"
                                        fontSize={11}
                                    />
                                    <Tooltip
                                        cursor={{ fill: '#00000008' }}
                                        contentStyle={{
                                            background: '#ffffff',
                                            border: '1px solid #e5e5e5',
                                            borderRadius: 6,
                                            color: '#374151',
                                            fontSize: 12,
                                        }}
                                        formatter={(
                                            v: number,
                                            _n,
                                            p: { payload: App },
                                        ) => [
                                            `${v} min - ${CATEGORY_LABEL[p.payload.category]}`,
                                            p.payload.process,
                                        ]}
                                    />
                                    <Bar dataKey="minutes" radius={[0, 3, 3, 0]}>
                                        {apps.map((a, i) => (
                                            <Cell
                                                key={i}
                                                fill={categoryColor(a.category)}
                                            />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}
            </section>

            {hasGazed && gazed_vs_active.length > 0 && (
                <section className="mt-6 rounded-lg border border-neutral-200 bg-white shadow-sm">
                    <h2 className="border-b border-neutral-200 px-4 py-3 text-sm font-medium text-neutral-700">
                        Miraba otra app mientras otra estaba activa
                    </h2>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm tabular-nums">
                            <thead>
                                <tr className="text-left text-neutral-500">
                                    <th className="px-4 py-2 font-medium">
                                        App activa
                                    </th>
                                    <th className="px-4 py-2 font-medium">
                                        App mirada
                                    </th>
                                    <th className="px-4 py-2 font-medium">
                                        Minutos
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {gazed_vs_active.map((d, i) => (
                                    <tr
                                        key={i}
                                        className="border-t border-neutral-100"
                                    >
                                        <td className="px-4 py-2 text-neutral-700">
                                            {d.active_process}
                                        </td>
                                        <td className="px-4 py-2 text-neutral-700">
                                            {d.looked_process}
                                        </td>
                                        <td className="px-4 py-2 text-neutral-700">
                                            {d.minutes}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}
        </DashboardLayout>
    );
}
