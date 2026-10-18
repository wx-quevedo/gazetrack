import { Link, usePage } from '@inertiajs/react';
import { ReactNode } from 'react';

const NAV = [
    { href: '/', label: 'Resumen' },
    { href: '/heatmap', label: 'Heatmap' },
    { href: '/timeline', label: 'Linea de tiempo' },
    { href: '/attention', label: 'Atencion' },
    { href: '/sessions', label: 'Sesiones' },
    { href: '/config', label: 'Configuracion' },
];

export default function DashboardLayout({
    children,
    title,
}: {
    children: ReactNode;
    title?: string;
}) {
    const { url } = usePage();

    return (
        <div className="flex min-h-full bg-neutral-100 text-neutral-800">
            <aside className="w-56 shrink-0 border-r border-neutral-200 bg-white">
                <div className="border-b border-neutral-200 px-5 py-5">
                    <div className="text-sm font-semibold tracking-wide text-neutral-900">
                        gazetrack
                    </div>
                    <div className="text-xs text-neutral-500">
                        panel de productividad
                    </div>
                </div>
                <nav className="space-y-1 p-3">
                    {NAV.map((item) => {
                        const active =
                            url === item.href ||
                            (item.href !== '/' && url.startsWith(item.href));
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={
                                    'block rounded-md px-3 py-2 text-sm transition-colors ' +
                                    (active
                                        ? 'bg-neutral-200 font-medium text-neutral-900'
                                        : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900')
                                }
                            >
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>
            </aside>
            <main className="min-w-0 flex-1">
                <header className="border-b border-neutral-200 bg-white px-8 py-5">
                    <h1 className="text-lg font-medium text-neutral-900">
                        {title}
                    </h1>
                </header>
                <div className="p-8">{children}</div>
            </main>
        </div>
    );
}
