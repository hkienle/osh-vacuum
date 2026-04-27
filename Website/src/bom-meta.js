/** Optional BOM metadata keyed by canonical part name (lowercase-with-hyphens).
 *
 *  Rules:
 *  - Files NOT listed here still appear in the checklist automatically.
 *  - To add a new part: push a correctly-named .step file to the repo.
 *    No code changes required.
 *  - To enrich an auto-discovered file: add its canonical name here.
 */
export const BOM_META = {
    'core': { pn: 'VAC-100-01', qty: 1, mass: '0.296 kg', time: '10:23', rev: 'v1.2' },
    'core-motoradapter': { pn: 'VAC-100-02', qty: 1, mass: '0.056 kg', time: '1:50' },
    'dustbin-cyclone-flange': { pn: 'VAC-100-03', qty: 1, mass: '0.064 kg', time: '2:01' },
    'core-batteryadapter-parkside_20v-slot': { pn: 'VAC-100-04', qty: 1, mass: '0.016 kg', time: '0:38' },
    'core-batteryadapter-parkside_20v-base': { pn: 'VAC-100-05', qty: 1, mass: '0.027 kg', time: '0:51' },
    'core-pcbmount': { pn: 'VAC-100-06', qty: 1, mass: '0.032 kg' },
    'dustbin-top': { pn: 'VAC-200-01', qty: 1, mass: '0.235 kg', time: '8:15' },
    'dustbin-bottom': { pn: 'VAC-200-02', qty: 1, mass: '0.146 kg', time: '4:49' },
    'dustbin-cyclone-bottom': { pn: 'VAC-200-03', qty: 1, mass: '0.049 kg', time: '1:42' },
    'dustbin-cyclone-top': { pn: 'VAC-200-04', qty: 1, mass: '0.209 kg', time: '7:21',
        warn: 'Print very fine, without support if possible. Open the mesh groove after printing.' },
    'dustbin-stickadapter-xiaomi': { pn: 'VAC-200-05', qty: 1, mass: '0.052 kg', time: '1:56' },
    'dustbin-hinge-side': { pn: 'VAC-200-07', qty: 2, mass: '0.002 kg', time: '0:09' },
    'dustbin-hinge-middle': { pn: 'VAC-200-08', qty: 1, mass: '0.004 kg', time: '0:15' },
    'dustbin-hinge-latch': { pn: 'VAC-200-09', qty: 1, mass: '0.002 kg', time: '0:09' },
    'dustbin-alignmentring': { pn: 'VAC-200-10', qty: 1, mass: '0.014 kg', time: '0:33' },
    'dustbin-latch': { pn: 'VAC-200-11', qty: 1, mass: '0.005 kg', time: '0:21',
        warn: 'Needs a small spring to function.' },
    'dustbin-stickadapter-genericfemale': { pn: 'VAC-210-01', qty: 1, mass: '0.089 kg' },
    'lid': { pn: 'VAC-300-01', qty: 1, mass: '0.102 kg', time: '3:08' },
    'lid-insert-blank': { pn: 'VAC-300-04', qty: 3, mass: '0.020 kg', time: '0:38' },
    'lid-insert-hmi': { pn: 'VAC-300-05', qty: 1, mass: '0.020 kg', time: '0:38' },
    'lid-insert-backhandle-left': { pn: 'VAC-310-01', qty: 1, mass: '0.046 kg', time: '1:30' },
    'lid-insert-backhandle-right': { pn: 'VAC-310-02', qty: 1, mass: '0.047 kg', time: '1:33' },
    'lid-insert-handle-button': { pn: 'VAC-310-03', qty: 1, mass: '0.002 kg', time: '0:38' },
    'nozzle-flat-d35-w150': { pn: 'VAC-700-06', qty: 1, mass: '0.087 kg' },
};
// ── Section / folder helpers ────────────────────────────────────────────────
/**
 * Convert a raw folder name to a readable label.
 * All-uppercase abbreviations (e.g. HMI) are kept as-is; CamelCase is split.
 */
export function fmtFolder(s) {
    if (s === s.toUpperCase())
        return s;
    return s.replace(/([A-Z])/g, ' $1').trim();
}
/**
 * Derive section key (for sorting) and display label from a file's full repo path.
 *
 * Example:
 *   "…/VAC_Printed_Parts/Lid/Handle/BackHandle/file.step"
 *   → key: "Lid/Handle/BackHandle"
 *   → label: "Lid / Handle / Back Handle"
 */
export function sectionFromPath(path) {
    const segments = path.split('/');
    const vi = segments.indexOf('VAC_Printed_Parts');
    const dirs = vi >= 0 ? segments.slice(vi + 1, -1) : [];
    return {
        key: dirs.join('/') || '_root',
        label: dirs.length ? dirs.map(fmtFolder).join(' / ') : 'Other',
    };
}
