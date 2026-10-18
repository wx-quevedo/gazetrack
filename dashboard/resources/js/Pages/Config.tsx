import { router } from '@inertiajs/react';
import DashboardLayout from '../Layouts/DashboardLayout';
import { categoryColor, CATEGORY_LABEL } from '../lib/categories';

interface Proc {
    process: string;
    minutes: number;
    category: string;
}

export default function Config({
    processes,
    categories,
}: {
    processes: Proc[];
    categories: string[];
}) {
    const change = (process: string, category: string) => {
        router.post(
            '/config/category',
            { process, category },
            { preserveScroll: true, preserveState: false },
        );
    };

    return (
        <DashboardLayout title="Configuracion">
            <p className="mb-5 max-w-2xl text-sm text-neutral-500">
                Asigna una categoria a cada proceso. Se usa para el heatmap de
                horas productivas y la distribucion de atencion. Esto se guarda
                en la base propia del dashboard; activity.db permanece de solo
                lectura.
            </p>
            {processes.length === 0 ? (
                <p className="text-sm text-neutral-500">
                    Aun no hay procesos registrados.
                </p>
            ) : (
                <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white shadow-sm">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-neutral-200 text-left text-neutral-500">
                                <th className="px-4 py-3 font-medium">
                                    Proceso
                                </th>
                                <th className="px-4 py-3 font-medium tabular-nums">
                                    Tiempo (min)
                                </th>
                                <th className="px-4 py-3 font-medium">
                                    Categoria
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {processes.map((p) => (
                                <tr
                                    key={p.process}
                                    className="border-t border-neutral-100 text-neutral-700"
                                >
                                    <td className="px-4 py-3">
                                        <span
                                            className="mr-2 inline-block h-2.5 w-2.5 rounded-full align-middle"
                                            style={{
                                                backgroundColor: categoryColor(
                                                    p.category,
                                                ),
                                            }}
                                        />
                                        {p.process}
                                    </td>
                                    <td className="px-4 py-3 tabular-nums text-neutral-500">
                                        {p.minutes}
                                    </td>
                                    <td className="px-4 py-3">
                                        <select
                                            value={p.category}
                                            onChange={(e) =>
                                                change(
                                                    p.process,
                                                    e.target.value,
                                                )
                                            }
                                            className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-800"
                                        >
                                            {categories.map((c) => (
                                                <option key={c} value={c}>
                                                    {CATEGORY_LABEL[c] ?? c}
                                                </option>
                                            ))}
                                        </select>
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
