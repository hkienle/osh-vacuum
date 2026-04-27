import './style.css';

import type { AppState } from './types';
import { el } from './utils';
import { inferPlaceholderPn } from './bom-meta';
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
let maxMassKg: number | null = null;
let maxTimeMin: number | null = null;

// ── DOM refs ────────────────────────────────────────────────────────────────

const wsContainer = el('ws-parts');
const formUrlEl   = el<'input'>('form-url');
const fltMassEl   = el<'input'>('flt-mass');
const fltTimeEl   = el<'input'>('flt-time');

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

function parseMassKg(mass: string): number | null {
  const m = mass.match(/([\d.]+)\s*kg/i);
  if (!m) return null;
  const v = Number(m[1]);
  return Number.isFinite(v) ? v : null;
}

function parseTimeMinutes(time: string): number | null {
  const m = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
  return h * 60 + min;
}

function getFilteredParts(): Part[] {
  return parts.filter((p) => {
    if (maxMassKg != null) {
      const kg = parseMassKg(p.mass);
      if (kg == null || kg > maxMassKg) return false;
    }
    if (maxTimeMin != null) {
      const mins = parseTimeMinutes(p.time);
      if (mins == null || mins > maxTimeMin) return false;
    }
    return true;
  });
}

function renderFilteredWorkshop(): void {
  renderWorkshop(wsContainer, getFilteredParts(), state);
}

function migrateCachedPn(partsIn: Part[], stateIn: AppState | undefined): { partsOut: Part[]; stateOut: AppState } {
  const stateOut: AppState = { ...(stateIn ?? {}) };
  const partsOut = partsIn.map((p) => {
    // Keep exact numeric PNs and existing placeholders as-is.
    if (/^VAC-[0-9X]{3}-[0-9X]{2}$/i.test(p.pn)) return p;

    const placeholder = inferPlaceholderPn(p.name);
    if (!placeholder || placeholder === p.pn) return p;

    // Move cached state to the new placeholder PN key if needed.
    if (stateOut[p.pn] && !stateOut[placeholder]) {
      stateOut[placeholder] = stateOut[p.pn];
    }
    delete stateOut[p.pn];

    return { ...p, pn: placeholder };
  });
  return { partsOut, stateOut };
}

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
    renderFilteredWorkshop();
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
    updateStats(getFilteredParts(), state);
  },

  onPrint(pn, checked) {
    const s = state[pn];
    if (!s) return;
    s.status = checked ? 'printed' : 'available';
    save();
    refreshCard(pn, parts, state);
    updateStats(getFilteredParts(), state);
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
  renderFilteredWorkshop();
});

el('btn-collapse').addEventListener('click', () => {
  parts.forEach(p => { if (state[p.pn]) state[p.pn].expanded = false; });
  renderFilteredWorkshop();
});

el('btn-reset').addEventListener('click', () => {
  if (!confirm('Reset check states? File links are kept.')) return;
  parts.forEach(p => { state[p.pn] = defaultPartState(); });
  save();
  renderFilteredWorkshop();
});

el('btn-form-url').addEventListener('click', () => {
  cfgOpen = !cfgOpen;
  el('cfg-bar').classList.toggle('open', cfgOpen);
});

// ── Print button ─────────────────────────────────────────────────────────────

el('btn-print').addEventListener('click', () => {
  renderPrint(el('pt-tbody'), el('pt-date'), el('pt-meta'), getFilteredParts(), state, getFormUrl);
  setTimeout(() => window.print(), 200);
});

fltMassEl.addEventListener('input', () => {
  const raw = fltMassEl.value.trim();
  if (!raw) {
    maxMassKg = null;
  } else {
    const v = Number(raw);
    maxMassKg = Number.isFinite(v) ? v : null;
  }
  renderFilteredWorkshop();
});

fltTimeEl.addEventListener('input', () => {
  const raw = fltTimeEl.value.trim();
  maxTimeMin = raw ? parseTimeMinutes(raw) : null;
  renderFilteredWorkshop();
});

// ── Modal ────────────────────────────────────────────────────────────────────

initModal();

// ── Init — render cached data immediately, then refresh from GitHub ──────────

(function init(): void {
  const saved = loadSaved();
  if (saved?._parts?.length) {
    const migrated = migrateCachedPn(saved._parts, saved._state);
    parts = migrated.partsOut;
    state = buildState(parts, migrated.stateOut);
    save();
    renderFilteredWorkshop();
    updateProgSub(parts.length);
  } else {
    wsContainer.innerHTML =
      '<div style="padding:40px 24px;color:var(--mt);font-size:11px;text-align:center">Fetching files from GitHub\u2026</div>';
  }
  void fetchRepo();
})();
