import { ButtonSimulator, type ButtonId } from './buttonSim';
import { downloadCanvasPng, renderDisplay15 } from './renderer';
import { loadScenarioIntoSim, SCENARIOS } from './scenarios';
import { displaySideCssPx, formatDisplaySizeHint } from './displaySize';

const canvas = document.getElementById('display-canvas') as HTMLCanvasElement;
const select = document.getElementById('scenario-select') as HTMLSelectElement;
const telemetryJson = document.getElementById('telemetry-json') as HTMLPreElement;
const btnDownload = document.getElementById('btn-download') as HTMLButtonElement;
const btnExportAll = document.getElementById('btn-export-all') as HTMLButtonElement;
const scaleSelect = document.getElementById('scale-select') as HTMLSelectElement;
const previewHint = document.getElementById('preview-hint') as HTMLParagraphElement;
const statusLine = document.getElementById('status-line') as HTMLParagraphElement;
const dualHoldMeter = document.getElementById('dual-hold-meter') as HTMLDivElement;
const triggerHoldMeter = document.getElementById('trigger-hold-meter') as HTMLDivElement;
const dualHoldBar = document.getElementById('dual-hold-bar') as HTMLDivElement;
const triggerHoldBar = document.getElementById('trigger-hold-bar') as HTMLDivElement;

const btnUp = document.getElementById('btn-up') as HTMLButtonElement;
const btnDown = document.getElementById('btn-down') as HTMLButtonElement;
const btnTrigger = document.getElementById('btn-trigger') as HTMLButtonElement;

const ctx = canvas.getContext('2d');
if (!ctx) {
  throw new Error('Could not get 2D context');
}
const displayCtx: CanvasRenderingContext2D = ctx;

const sim = new ButtonSimulator();
let rafId = 0;

function applyScale(): void {
  const zoom = Number(scaleSelect.value);
  const sidePx = displaySideCssPx(zoom);
  canvas.style.width = `${sidePx}px`;
  canvas.style.height = `${sidePx}px`;
  document.documentElement.style.setProperty('--display-side-px', `${sidePx}px`);
  previewHint.textContent = formatDisplaySizeHint(zoom);
}

function updateHoldBars(): void {
  const snap = sim.getSnapshot();
  dualHoldBar.style.width = `${snap.dualHoldProgress * 100}%`;
  dualHoldMeter.hidden = snap.dualHoldProgress <= 0;
  triggerHoldBar.style.width = `${snap.triggerHoldProgress * 100}%`;
  triggerHoldMeter.hidden = snap.triggerHoldProgress <= 0;
}

function redraw(nowMs = performance.now()): void {
  sim.tick(nowMs);
  const scenario = sim.buildScenario();
  renderDisplay15(displayCtx, scenario, nowMs);
  statusLine.textContent = sim.getSnapshot().statusLine;
  telemetryJson.textContent = JSON.stringify(scenario, null, 2);
  updateHoldBars();
}

function loop(nowMs: number): void {
  redraw(nowMs);
  rafId = requestAnimationFrame(loop);
}

function setButton(id: ButtonId, down: boolean): void {
  sim.setButton(id, down);
  if (id === 'up') btnUp.classList.toggle('pressed', down);
  if (id === 'down') btnDown.classList.toggle('pressed', down);
  if (id === 'trigger') btnTrigger.classList.toggle('pressed', down);
}

function wireButton(el: HTMLButtonElement, id: ButtonId): void {
  const press = (e: Event) => {
    e.preventDefault();
    setButton(id, true);
  };
  const release = () => setButton(id, false);

  el.addEventListener('mousedown', press);
  el.addEventListener('mouseup', release);
  el.addEventListener('mouseleave', release);
  el.addEventListener('touchstart', press, { passive: false });
  el.addEventListener('touchend', release);
  el.addEventListener('touchcancel', release);
}

function populateSelect(): void {
  for (const scenario of SCENARIOS) {
    const opt = document.createElement('option');
    opt.value = scenario.id;
    opt.textContent = scenario.label;
    select.appendChild(opt);
  }
}

select.addEventListener('change', () => {
  const scenario = SCENARIOS.find((s) => s.id === select.value);
  if (scenario) loadScenarioIntoSim(sim, scenario);
});

scaleSelect.addEventListener('change', applyScale);
window.addEventListener('resize', applyScale);

btnDownload.addEventListener('click', () => {
  downloadCanvasPng(canvas, `display15-${select.value}.png`);
});

btnExportAll.addEventListener('click', async () => {
  btnExportAll.disabled = true;
  const previous = select.value;
  for (const scenario of SCENARIOS) {
    loadScenarioIntoSim(sim, scenario);
    await new Promise((r) => setTimeout(r, 50));
    redraw();
    await new Promise((r) => setTimeout(r, 50));
    downloadCanvasPng(canvas, `display15-${scenario.id}.png`);
    await new Promise((r) => setTimeout(r, 120));
  }
  const restore = SCENARIOS.find((s) => s.id === previous);
  if (restore) loadScenarioIntoSim(sim, restore);
  select.value = previous;
  btnExportAll.disabled = false;
});

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.key === 'ArrowUp') {
    e.preventDefault();
    setButton('up', true);
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    setButton('down', true);
  }
  if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault();
    setButton('trigger', true);
  }
});

window.addEventListener('keyup', (e) => {
  if (e.key === 'ArrowUp') setButton('up', false);
  if (e.key === 'ArrowDown') setButton('down', false);
  if (e.key === ' ' || e.key === 'Enter') setButton('trigger', false);
});

wireButton(btnUp, 'up');
wireButton(btnDown, 'down');
wireButton(btnTrigger, 'trigger');

populateSelect();
applyScale();
loadScenarioIntoSim(sim, SCENARIOS[0]);
cancelAnimationFrame(rafId);
rafId = requestAnimationFrame(loop);
