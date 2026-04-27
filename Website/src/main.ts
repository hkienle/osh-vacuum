import './style.css';

import type { AppState } from './types';
import { el } from './utils';
import { fetchStepFiles, buildPartsFromFiles } from './github';
import { loadSaved, saveToStorage, buildState, defaultPartState } from './state';
import {
  renderWorkshop,
  refreshCard,
  updateStats,
  updateProgSub,
  initWorkshopListeners,
} from './render';
import { renderPrint }  from './print';
import type { Part, PartState } from './types';
import { initModal } from './modal';

// ── App-level state ─────────────────────────────────────────────────────────

let parts: Part[]    = [];
let state: AppState  = {};
let cfgOpen          = false;

// ── DOM refs ────────────────────────────────────────────────────────────────

const wsContainer = el('ws-parts');
const formUrlEl   = el<'input'>('form-url');

// ── Helpers ─────────────────────────────────────────────────────────────────

function getFormUrl(): string {
  return formUrlEl.value.trim() || 'https://your-form.example.com/feedback';
}

const FEEDBACK_MAIL = 'osh-vac-feedback@proton.me';

function buildFeedbackMailto(pn: string, part: Part | undefined, s: PartState): string {
  const subject = `Feedback OSH-Vac | Part: ${pn}`;
  const body = [
    `Part Number : ${pn}`,
    `Part Name   : ${part?.name ?? pn}`,
    ``,
    `── Print Details ──────────────────`,
    `Material    : ${s.material || '-'}`,
    `Color       : ${s.color    || '-'}`,
    `Printer     : ${s.printer  || '-'}`,
    `Date Printed: ${s.date     || '-'}`,
    `Notes       : ${s.notes    || '-'}`,
    ``,
    `── Feedback ───────────────────────`,
    `(Describe your feedback here)`,
  ].join('\n');
  return `mailto:${FEEDBACK_MAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function save(): void { saveToStorage(parts, state); }

function setRepo(status: 'loading' | 'ok' | 'err', label: string): void {
  el('rdot').className   = `rdot ${status}`;
  el('rlbl').textContent = label;
}

// ── GitHub fetch ────────────────────────────────────────────────────────────

async function fetchRepo(): Promise<void> {
  setRepo('loading', 'Fetching from GitHub…');
  try {
    const files   = await fetchStepFiles();
    const saved   = loadSaved();
    parts = buildPartsFromFiles(files);
    state = buildState(parts, saved?._state);
    save();
    setRepo('ok', `${parts.length} files`);
    updateProgSub(parts.length);
    renderWorkshop(wsContainer, parts, state);
  } catch (err) {
    setRepo('err', `GitHub: ${(err as Error).message}`);
  }
}

// ── Workshop event callbacks ─────────────────────────────────────────────────

initWorkshopListeners(wsContainer, {
  onToggle(pn) {
    const s = state[pn];
    if (!s) return;
    s.expanded = !s.expanded;
    const card = wsContainer.querySelector<HTMLElement>(`[data-pn="${pn}"]`);
    card?.querySelector('.detail')?.classList.toggle('open', s.expanded);
    card?.querySelector('.part-row')?.classList.toggle('xopen', s.expanded);
  },

  onDownload(pn) {
    const s = state[pn];
    if (!s || s.status !== 'available') return;
    s.status = 'downloaded';
    save();
    refreshCard(pn, parts, state);
    updateStats(parts, state);
  },

  onPrint(pn, checked) {
    const s = state[pn];
    if (!s) return;
    s.status = checked ? 'printed' : 'available';
    save();
    refreshCard(pn, parts, state);
    updateStats(parts, state);
  },

  onFieldUpdate(pn, field, value) {
    const s = state[pn];
    if (!s) return;
    (s as unknown as Record<string, unknown>)[field] = value;
    save();
  },

  onFeedback(pn) {
    const s = state[pn];
    if (!s) return;
    const p = parts.find(x => x.pn === pn);
    window.location.href = buildFeedbackMailto(pn, p, s);
  },
});

// ── Toolbar buttons ──────────────────────────────────────────────────────────

el('btn-expand').addEventListener('click', () => {
  parts.forEach(p => { if (state[p.pn]) state[p.pn].expanded = true; });
  renderWorkshop(wsContainer, parts, state);
});

el('btn-collapse').addEventListener('click', () => {
  parts.forEach(p => { if (state[p.pn]) state[p.pn].expanded = false; });
  renderWorkshop(wsContainer, parts, state);
});

el('btn-reset').addEventListener('click', () => {
  if (!confirm('Reset check states? File links are kept.')) return;
  parts.forEach(p => { state[p.pn] = defaultPartState(); });
  save();
  renderWorkshop(wsContainer, parts, state);
});

el('btn-form-url').addEventListener('click', () => {
  cfgOpen = !cfgOpen;
  el('cfg-bar').classList.toggle('open', cfgOpen);
});

// ── Print button ─────────────────────────────────────────────────────────────

el('btn-print').addEventListener('click', () => {
  renderPrint(el('pt-tbody'), el('pt-date'), el('pt-meta'), parts, state, getFormUrl);
  setTimeout(() => window.print(), 200);
});

// ── Modal ────────────────────────────────────────────────────────────────────

initModal();

// ── Init — render cached data immediately, then refresh from GitHub ──────────

(function init(): void {
  const saved = loadSaved();
  if (saved?._parts?.length) {
    parts = saved._parts;
    state = buildState(parts, saved._state);
    renderWorkshop(wsContainer, parts, state);
    updateProgSub(parts.length);
  } else {
    wsContainer.innerHTML =
      '<div style="padding:40px 24px;color:var(--mt);font-size:11px;text-align:center">Fetching files from GitHub\u2026</div>';
  }
  void fetchRepo();
})();
