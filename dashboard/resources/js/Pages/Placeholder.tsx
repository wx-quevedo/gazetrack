import DashboardLayout from '../Layouts/DashboardLayout';

export default function Placeholder({ title }: { title: string }) {
    return (
        <DashboardLayout title={title}>
            <div className="rounded-lg border border-dashed border-neutral-300 bg-white px-6 py-16 text-center">
                <p className="text-sm text-neutral-500">
                    Vista pendiente de validacion de datos.
                </p>
                <p className="mt-2 text-xs text-neutral-400">
                    Se construira tras la revision conjunta del activity.db de
                    una sesion real de trabajo.
                </p>
            </div>
        </DashboardLayout>
    );
}
