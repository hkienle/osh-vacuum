import { esc, el, ICON_DL, ICON_CK, ICON_MAIL, downloadUrlToFile } from './utils';
// ── Card HTML helpers ───────────────────────────────────────────────────────
const SUG_TITLE = 'Values used on other checklist items. Type or open the list to pick one.';
function safePnId(pn) {
    return pn.replace(/[^a-zA-Z0-9_-]/g, '_');
}
function collectFieldSuggestions(state, parts, excludePn) {
    const mats = new Set();
    const colors = new Set();
    const printers = new Set();
    const cmp = (a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' });
    for (const q of parts) {
        if (q.pn === excludePn)
            continue;
        const st = state[q.pn];
        if (!st)
            continue;
        const m = st.material.trim();
        const c = st.color.trim();
        const pr = st.printer.trim();
        if (m)
            mats.add(m);
        if (c)
            colors.add(c);
        if (pr)
            printers.add(pr);
    }
    return {
        material: [...mats].sort(cmp),
        color: [...colors].sort(cmp),
        printer: [...printers].sort(cmp),
    };
}
function datalistHtml(id, values) {
    if (!values.length)
        return '';
    const opts = values.map((v) => `<option value="${esc(v)}"></option>`).join('');
    return `<datalist id="${esc(id)}">${opts}</datalist>`;
}
/**
 * After a field changes, refresh all &lt;datalist&gt; option sets so suggestions
 * stay in sync without re-rendering the full list (keeps input focus).
 */
export function syncFieldSuggestionDatalists(container, parts, state) {
    for (const p of parts) {
        const card = Array.from(container.querySelectorAll('.part[data-pn]')).find((c) => c.dataset.pn === p.pn);
        if (!card)
            continue;
        const sid = safePnId(p.pn);
        const sug = collectFieldSuggestions(state, parts, p.pn);
        patchFieldDatalist(card, 'material', `sug-m-${sid}`, sug.material);
        patchFieldDatalist(card, 'color', `sug-c-${sid}`, sug.color);
        patchFieldDatalist(card, 'printer', `sug-p-${sid}`, sug.printer);
    }
}
function patchFieldDatalist(card, field, listId, values) {
    const inp = card.querySelector(`input.fld-inp[data-field="${field}"]`);
    if (!inp)
        return;
    if (values.length === 0) {
        inp.removeAttribute('list');
        inp.removeAttribute('title');
        document.getElementById(listId)?.remove();
        return;
    }
    let dl = document.getElementById(listId);
    if (!dl) {
        dl = document.createElement('datalist');
        dl.id = listId;
        const detail = card.querySelector('.detail');
        const qr = card.querySelector('.qr-row');
        if (detail && qr)
            detail.insertBefore(dl, qr);
        else
            detail?.appendChild(dl);
    }
    dl.innerHTML = values.map((v) => `<option value="${esc(v)}"></option>`).join('');
    inp.setAttribute('list', listId);
    inp.setAttribute('title', SUG_TITLE);
}
function revFromFilename(filename) {
    const base = filename.replace(/\.step$/i, '');
    const m = base.match(/_(v[\d.]+)$/i);
    if (!m?.[1])
        return null;
    const rev = m[1];
    return /^v\d+$/i.test(rev) ? `${rev}.0` : rev;
}
function dlPill(p, status) {
    if (!p.downloadUrl || !p.filename) {
        return `<span class="dl">Purchased Part</span>`;
    }
    const fn = esc(p.filename);
    const href = esc(p.downloadUrl);
    if (status === 'available')
        return `<a class="dl av" href="${href}" download="${fn}" rel="noopener noreferrer" data-action="download">${ICON_DL}${fn}</a>`;
    if (status === 'downloaded')
        return `<a class="dl dl2" href="${href}" download="${fn}" rel="noopener noreferrer" data-action="download">${ICON_CK}${fn}</a>`;
    return `<a class="dl pr" href="${href}" download="${fn}" rel="noopener noreferrer" data-action="download">${ICON_CK}${fn}</a>`;
}
function cardInner(p, s, sug) {
    const cbChecked = s.status === 'printed';
    const rev = p.rev ?? (p.filename ? revFromFilename(p.filename) : null);
    const pnClass = /X/i.test(p.pn) ? 'pn pn-ph' : 'pn';
    const sid = safePnId(p.pn);
    const idMat = `sug-m-${sid}`;
    const idCol = `sug-c-${sid}`;
    const idPrn = `sug-p-${sid}`;
    const listMat = sug.material.length ? ` list="${idMat}" title="${esc(SUG_TITLE)}"` : '';
    const listCol = sug.color.length ? ` list="${idCol}" title="${esc(SUG_TITLE)}"` : '';
    const listPrn = sug.printer.length ? ` list="${idPrn}" title="${esc(SUG_TITLE)}"` : '';
    return `
<div class="part-row rgrid${s.expanded ? ' xopen' : ''}" data-action="toggle">
  <div class="sdot"></div>
  <div class="${pnClass}">${esc(p.pn)}</div>
  <div class="nm">
    <span class="nm-txt" title="${esc(p.name)}">${esc(p.name)}</span>
    ${rev ? `<span class="bdg bdg-rev">${esc(rev)}</span>` : ''}
    ${p.warn ? `<span class="bdg bdg-warn">ATTN</span>` : ''}
  </div>
  <div class="qty">${p.qty > 1 ? `${p.qty}&times;` : p.qty}</div>
  <div class="mass">${esc(p.mass)}</div>
  <div class="time">${esc(p.time)}</div>
  <div>${dlPill(p, s.status)}</div>
  <div class="pcb-wrap">
    <input type="checkbox" class="pcb on" ${cbChecked ? 'checked' : ''} data-action="print">
  </div>
</div>
<div class="detail${s.expanded ? ' open' : ''}">
  <div class="fld">
    <label class="fld-lbl">Material Used <span class="fld-sug-hint">(filament)</span></label>
    <input class="fld-inp" value="${esc(s.material)}" placeholder="PLA, PETG, ASA…" data-field="material"${listMat}>
  </div>
  <div class="fld">
    <label class="fld-lbl">Color <span class="fld-sug-hint">(filament)</span></label>
    <input class="fld-inp" value="${esc(s.color)}" placeholder="e.g. Black, RAL 9005" data-field="color"${listCol}>
  </div>
  <div class="fld">
    <label class="fld-lbl">Printer</label>
    <input class="fld-inp" value="${esc(s.printer)}" placeholder="e.g. Bambu X1C" data-field="printer"${listPrn}>
  </div>
  <div class="fld">
    <label class="fld-lbl">Date Printed</label>
    <input class="fld-inp" type="date" value="${esc(s.date)}" data-field="date">
  </div>
  <div class="fld" style="grid-column:span 2">
    <label class="fld-lbl">Notes</label>
    <textarea class="fld-ta" placeholder="Infill %, layer height, issues…" data-field="notes">${esc(s.notes)}</textarea>
  </div>
  ${p.warn ? `<div class="warn-box"><div class="warn-ttl">Printing Advice</div>${esc(p.warn)}</div>` : ''}
  ${datalistHtml(idMat, sug.material)}
  ${datalistHtml(idCol, sug.color)}
  ${datalistHtml(idPrn, sug.printer)}
  <div class="qr-row">
    <button class="qr-open-btn" data-action="feedback">${ICON_MAIL} Send Feedback</button>
  </div>
</div>`;
}
// ── Public render functions ─────────────────────────────────────────────────
/** Full re-render of the workshop parts list. */
export function renderWorkshop(container, parts, state) {
    container.innerHTML = '';
    let lastSec = null;
    for (const p of parts) {
        const s = state[p.pn];
        if (!s)
            continue;
        if (p.sec !== null && p.sec !== lastSec) {
            lastSec = p.sec;
            const h = document.createElement('div');
            h.className = p.sec === 'Purchased Parts' ? 'sec-lbl sec-lbl-major' : 'sec-lbl';
            h.textContent = p.sec;
            container.appendChild(h);
        }
        const card = document.createElement('div');
        card.className = `part st-${s.status}`;
        card.dataset.pn = p.pn;
        card.innerHTML = cardInner(p, s, collectFieldSuggestions(state, parts, p.pn));
        container.appendChild(card);
    }
    updateStats(parts, state);
}
/** Re-render a single card in-place (status change, download, etc.). */
export function refreshCard(pn, parts, state) {
    const card = document.querySelector(`[data-pn="${pn}"]`);
    if (!card)
        return;
    const p = parts.find(x => x.pn === pn);
    const s = state[pn];
    if (!p || !s)
        return;
    card.className = `part st-${s.status}`;
    card.innerHTML = cardInner(p, s, collectFieldSuggestions(state, parts, pn));
}
/** Update the three stat counters and progress bars. */
export function updateStats(parts, state) {
    const T = parts.length;
    if (!T)
        return;
    const a = parts.filter(p => state[p.pn] !== undefined).length;
    const d = parts.filter(p => ['downloaded', 'printed'].includes(state[p.pn]?.status ?? '')).length;
    const r = parts.filter(p => state[p.pn]?.status === 'printed').length;
    el('sv-a').textContent = String(a);
    el('sv-d').textContent = String(d);
    el('sv-p').textContent = String(r);
    el('bf-a').style.width = `${(a / T) * 100}%`;
    el('bf-d').style.width = `${(d / T) * 100}%`;
    el('bf-p').style.width = `${(r / T) * 100}%`;
}
/** Update the subtitle text with the current file count. */
export function updateProgSub(count) {
    const sub = document.getElementById('prog-sub');
    if (sub)
        sub.textContent = `${count} files · ~1.58 kg PLA (BOM) · ~70 h print time`;
}
/** Attach all workshop interactions via a single delegated listener. */
export function initWorkshopListeners(container, cb) {
    container.addEventListener('click', e => {
        const target = e.target;
        const card = target.closest('[data-pn]');
        if (!card)
            return;
        const pn = card.dataset.pn;
        const action = target.closest('[data-action]')?.dataset.action;
        if (action === 'toggle' && !target.closest('a, input, button, textarea, label')) {
            cb.onToggle(pn);
        }
        else if (action === 'download') {
            const link = target.closest('a[data-action="download"]');
            if (!link)
                return;
            e.preventDefault();
            const url = link.href;
            const filename = link.download || 'part.step';
            void downloadUrlToFile(url, filename)
                .then(() => cb.onDownload(pn))
                .catch((err) => {
                console.error(err);
                const msg = err instanceof Error ? err.message : String(err);
                alert(`Could not download file: ${msg}`);
            });
        }
        else if (action === 'feedback') {
            cb.onFeedback(pn);
        }
    });
    container.addEventListener('change', e => {
        const target = e.target;
        if (target.dataset.action !== 'print')
            return;
        const card = target.closest('[data-pn]');
        if (card)
            cb.onPrint(card.dataset.pn, target.checked);
    });
    container.addEventListener('input', e => {
        const target = e.target;
        const field = target.dataset.field;
        if (!field)
            return;
        const card = target.closest('[data-pn]');
        if (card)
            cb.onFieldUpdate(card.dataset.pn, field, target.value);
    });
}
