import { esc } from './utils';
import QRCode from 'qrcode';
function revFromFilename(filename) {
    const base = filename.replace(/\.step$/i, '');
    const m = base.match(/_(v[\d.]+)$/i);
    if (!m?.[1])
        return null;
    const rev = m[1];
    return /^v\d+$/i.test(rev) ? `${rev}.0` : rev;
}
/** Render the printable document view and generate QR codes asynchronously. */
export function renderPrint(tbody, dateEl, metaEl, parts, state, getFormUrl) {
    dateEl.textContent = new Date().toLocaleDateString('de-DE', {
        day: '2-digit', month: '2-digit', year: 'numeric',
    });
    metaEl.innerHTML = `<span>PLA</span><span>${parts.length} files</span><span>&asymp;&thinsp;1.58 kg (BOM)</span><span>&asymp;&thinsp;70 h</span>`;
    tbody.innerHTML = '';
    let lastSec = null;
    for (const p of parts) {
        const s = state[p.pn];
        if (!s)
            continue;
        const rev = p.rev ?? revFromFilename(p.filename);
        if (p.sec !== null && p.sec !== lastSec) {
            lastSec = p.sec;
            const sr = document.createElement('tr');
            sr.className = 'p-sl';
            sr.innerHTML = `<td colspan="10">${esc(p.sec)}</td>`;
            tbody.appendChild(sr);
        }
        const tr = document.createElement('tr');
        if (p.warn)
            tr.className = 'p-wr';
        tr.innerHTML = `
      <td style="padding:7px 4px 7px 6px"><span class="p-cb"></span></td>
      <td class="p-pn">${esc(p.pn)}</td>
      <td class="p-nm">
        ${esc(p.name)}
        ${rev ? `<span class="p-tag p-tr">${esc(rev)}</span>` : ''}
        ${p.warn ? `<span class="p-tag p-tw">ATTN</span>` : ''}
        ${s.status === 'printed' ? `<span class="p-tag p-tok">Printed</span>` : ''}
      </td>
      <td class="p-qty">${p.qty > 1 ? `${p.qty}x` : p.qty}</td>
      <td class="p-mm">${esc(p.mass)}</td>
      <td class="p-mm">${esc(p.time)}</td>
      <td style="padding:5px 6px">
        <span class="p-wln"></span>
        <span class="p-wlbl">${esc(s.material || 'PLA')}</span>
      </td>
      <td style="padding:5px 6px">
        <span class="p-wln"></span>
        <span class="p-wlbl">${esc(s.color || 'Color')}</span>
      </td>
      <td style="padding:5px 6px">
        <span class="p-wln"></span>
        <span class="p-wlbl">${esc((s.notes || 'Notes').substring(0, 28))}</span>
      </td>
      <td class="p-qrc">
        <canvas data-qr-pn="${esc(p.pn)}"></canvas>
        <div class="p-qrpn">${esc(p.pn)}</div>
      </td>`;
        tbody.appendChild(tr);
        if (p.warn) {
            const wr = document.createElement('tr');
            wr.className = 'p-wd';
            wr.innerHTML = `<td colspan="10"><div class="p-wt"><strong>Printing Advice</strong>${esc(p.warn)}</div></td>`;
            tbody.appendChild(wr);
        }
    }
    renderQRCodes(tbody, getFormUrl);
}
async function renderQRCodes(tbody, getFormUrl) {
    const base = getFormUrl();
    const canvases = Array.from(tbody.querySelectorAll('canvas[data-qr-pn]'));
    await Promise.all(canvases.map(async (canvas) => {
        const pn = canvas.dataset.qrPn ?? '';
        const params = new URLSearchParams({ partnumber: pn, date: '', material: '', printer: '' });
        try {
            await QRCode.toCanvas(canvas, `${base}?${params}`, {
                width: 58,
                color: { dark: '#111111', light: '#ffffff' },
            });
        }
        catch {
            // QR generation failure is non-fatal; canvas stays blank
        }
    }));
}
