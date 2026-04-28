export const STORE_KEY = 'vac_cl_v5';
export const today = new Date().toISOString().split('T')[0];
export function esc(s) {
    if (s == null)
        return '';
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
export function el(id) {
    const node = document.getElementById(id);
    if (!node)
        throw new Error(`Element #${id} not found`);
    return node;
}
<<<<<<< HEAD
=======
/** Save a remote file via fetch+blob so `download` works for cross-origin URLs (e.g. raw.githubusercontent.com). */
export async function downloadUrlToFile(url, filename) {
    const res = await fetch(url);
    if (!res.ok)
        throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    try {
        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = filename;
        a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        a.remove();
    }
    finally {
        URL.revokeObjectURL(objectUrl);
    }
}
>>>>>>> 59d52ee2a284374524f0f9c5e570e07d8757497d
// Inline SVG icons
export const ICON_DL = `<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
  <polyline points="7 10 12 15 17 10"/>
  <line x1="12" y1="15" x2="12" y2="3"/>
</svg>`;
export const ICON_CK = `<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
  <polyline points="20 6 9 17 4 12"/>
</svg>`;
export const ICON_MAIL = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <rect x="2" y="4" width="20" height="16" rx="2"/>
  <polyline points="2,4 12,13 22,4"/>
</svg>`;
