// Sober, neutral palette shared across the analytical views.

export const CATEGORY_LABEL: Record<string, string> = {
    trabajo: 'Trabajo',
    neutral: 'Neutral',
    distraccion: 'Distraccion',
    sin_categorizar: 'Sin categorizar',
    ausente: 'Ausente',
};

export const CATEGORY_COLOR: Record<string, string> = {
    trabajo: '#5b8266', // muted green
    neutral: '#6f7076', // gray
    distraccion: '#a86a6a', // muted rose
    sin_categorizar: '#4b4b52',
    ausente: '#333338',
};

export function categoryColor(cat: string): string {
    return CATEGORY_COLOR[cat] ?? CATEGORY_COLOR.sin_categorizar;
}
