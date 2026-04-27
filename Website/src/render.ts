import type { Part, AppState } from './types';
import { esc, el, ICON_DL, ICON_CK, ICON_MAIL } from './utils';

// ── Card HTML helpers ───────────────────────────────────────────────────────

function revFromFilename(filename: string): string | null {
  const base = filename.replace(/\.step$/i, '');
  const m = base.match(/_(v[\d.]+)$/i);
  if (!m?.[1]) return null;
  const rev = m[1];
  return /^v\d+$/i.test(rev) ? `${rev}.0` : rev;
}

function dlPill(p: Part, status: string): string {
  const fn   = esc(p.filename);
  const href = esc(p.downloadUrl);
  if (status === 'available')
    return `<a class="dl av" href="${href}" download="${fn}" data-action="download">${ICON_DL}${fn}</a>`;
  if (status === 'downloaded')
    return `<a class="dl dl2" href="${href}" download="${fn}" data-action="download">${ICON_CK}${fn}</a>`;
  return `<a class="dl pr" href="${href}" download="${fn}" data-action="download">${ICON_CK}${fn}</a>`;
}

function cardInner(p: Part, s: AppState[string]): string {
  const cbChecked = s.status === 'printed';
  const rev       = p.rev ?? revFromFilename(p.filename);

  return `
<div class="part-row rgrid${s.expanded ? ' xopen' : ''}" data-action="toggle">
  <div class="sdot"></div>
  <div class="pn">${esc(p.pn)}</div>
  <div class="nm">
    <span class="nm-txt" title="${esc(p.name)}">${esc(p.name)}</span>
    ${rev    ? `<span class="bdg bdg-rev">${esc(rev)}</span>` : ''}
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
    <label class="fld-lbl">Material Used</label>
    <input class="fld-inp" value="${esc(s.material)}" placeholder="PLA, PETG, ASA…" data-field="material">
  </div>
  <div class="fld">
    <label class="fld-lbl">Color</label>
    <input class="fld-inp" value="${esc(s.color)}" placeholder="e.g. Black, RAL 9005" data-field="color">
  </div>
  <div class="fld">
    <label class="fld-lbl">Printer</label>
    <input class="fld-inp" value="${esc(s.printer)}" placeholder="e.g. Bambu X1C" data-field="printer">
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
  <div class="qr-row">
    <button class="qr-open-btn" data-action="feedback">${ICON_MAIL} Send Feedback</button>
  </div>
</div>`;
}

// ── Public render functions ─────────────────────────────────────────────────

/** Full re-render of the workshop parts list. */
export function renderWorkshop(container: HTMLElement, parts: Part[], state: AppState): void {
  container.innerHTML = '';
  let lastSec: string | null = null;

  for (const p of parts) {
    const s = state[p.pn];
    if (!s) continue;

    if (p.sec !== null && p.sec !== lastSec) {
      lastSec = p.sec;
      const h = document.createElement('div');
      h.className  = 'sec-lbl';
      h.textContent = p.sec;
      container.appendChild(h);
    }

    const card = document.createElement('div');
    card.className  = `part st-${s.status}`;
    card.dataset.pn = p.pn;
    card.innerHTML  = cardInner(p, s);
    container.appendChild(card);
  }

  updateStats(parts, state);
}

/** Re-render a single card in-place (status change, download, etc.). */
export function refreshCard(pn: string, parts: Part[], state: AppState): void {
  const card = document.querySelector<HTMLElement>(`[data-pn="${pn}"]`);
  if (!card) return;
  const p = parts.find(x => x.pn === pn);
  const s = state[pn];
  if (!p || !s) return;
  card.className = `part st-${s.status}`;
  card.innerHTML = cardInner(p, s);
}

/** Update the three stat counters and progress bars. */
export function updateStats(parts: Part[], state: AppState): void {
  const T = parts.length;
  if (!T) return;

  const a = parts.filter(p => state[p.pn] !== undefined).length;
  const d = parts.filter(p => ['downloaded', 'printed'].includes(state[p.pn]?.status ?? '')).length;
  const r = parts.filter(p => state[p.pn]?.status === 'printed').length;

  el('sv-a').textContent = String(a);
  el('sv-d').textContent = String(d);
  el('sv-p').textContent = String(r);
  el<'div'>('bf-a').style.width = `${(a / T) * 100}%`;
  el<'div'>('bf-d').style.width = `${(d / T) * 100}%`;
  el<'div'>('bf-p').style.width = `${(r / T) * 100}%`;
}

/** Update the subtitle text with the current file count. */
export function updateProgSub(count: number): void {
  const sub = document.getElementById('prog-sub');
  if (sub) sub.textContent = `${count} files · ~1.58 kg PLA (BOM) · ~70 h print time`;
}

// ── Event delegation ────────────────────────────────────────────────────────

export interface WorkshopCallbacks {
  onToggle(pn: string): void;
  onDownload(pn: string): void;
  onPrint(pn: string, checked: boolean): void;
  onFieldUpdate(pn: string, field: string, value: string): void;
  onFeedback(pn: string): void;
}

/** Attach all workshop interactions via a single delegated listener. */
export function initWorkshopListeners(container: HTMLElement, cb: WorkshopCallbacks): void {
  container.addEventListener('click', e => {
    const target = e.target as HTMLElement;
    const card   = target.closest<HTMLElement>('[data-pn]');
    if (!card) return;

    const pn     = card.dataset.pn!;
    const action = target.closest<HTMLElement>('[data-action]')?.dataset.action;

    if (action === 'toggle' && !target.closest('a, input, button, textarea, label')) {
      cb.onToggle(pn);
    } else if (action === 'download') {
      // slight delay so the browser initiates the download before we mutate state
      setTimeout(() => cb.onDownload(pn), 300);
    } else if (action === 'feedback') {
      cb.onFeedback(pn);
    }
  });

  container.addEventListener('change', e => {
    const target = e.target as HTMLInputElement;
    if (target.dataset.action !== 'print') return;
    const card = target.closest<HTMLElement>('[data-pn]');
    if (card) cb.onPrint(card.dataset.pn!, target.checked);
  });

  container.addEventListener('input', e => {
    const target = e.target as HTMLInputElement | HTMLTextAreaElement;
    const field  = (target as HTMLElement).dataset.field;
    if (!field) return;
    const card = target.closest<HTMLElement>('[data-pn]');
    if (card) cb.onFieldUpdate(card.dataset.pn!, field, target.value);
  });
}
