import { el, today } from './utils';
import QRCode from 'qrcode';
export function initModal() {
    el('modal-bg').addEventListener('click', e => {
        if (e.target === e.currentTarget)
            closeModal();
    });
    el('modal-x-btn').addEventListener('click', closeModal);
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape')
            closeModal();
    });
}
export function closeModal() {
    el('modal-bg').classList.remove('open');
}
export async function openModal(pn, parts, state, getFormUrl) {
    const p = parts.find(x => x.pn === pn);
    const s = state[pn];
    el('m-pn').textContent = pn;
    el('m-nm').textContent = p?.name ?? pn;
    const params = new URLSearchParams({
        partnumber: pn,
        date: s?.date ?? today,
        material: s?.material ?? '',
        printer: s?.printer ?? '',
    });
    const url = `${getFormUrl()}?${params}`;
    el('m-url').textContent = url;
    const wrap = el('m-qr');
    wrap.innerHTML = '';
    const canvas = document.createElement('canvas');
    wrap.appendChild(canvas);
    el('modal-bg').classList.add('open');
    try {
        await QRCode.toCanvas(canvas, url, {
            width: 160,
            color: { dark: '#000000', light: '#ffffff' },
        });
    }
    catch {
        // QR generation failure is non-fatal
    }
}
