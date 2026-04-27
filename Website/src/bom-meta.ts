/** Optional BOM metadata keyed by canonical part name (lowercase-with-hyphens).
 *
 *  Rules:
 *  - Files NOT listed here still appear in the checklist automatically.
 *  - To add a new part: push a correctly-named .step file to the repo.
 *    No code changes required.
 *  - To enrich an auto-discovered file: add its canonical name here.
 */

export interface BomEntry {
  pn?:   string;   // part number override
  qty?:  number;
  mass?: string;
  time?: string;   // estimated print time hh:mm
  rev?:  string;   // revision badge (only shown when noteworthy)
  warn?: string;   // printing advice shown in detail panel and print view
  purchased?: boolean; // show in Purchased Parts section even without STEP file
}

export const BOM_META: Record<string, BomEntry> = {
  'core':                                  { pn:'VAC-100-01', qty:1, mass:'0.296 kg', time:'10:23', rev:'v1.2' },
  'core-motoradapter':                     { pn:'VAC-100-02', qty:1, mass:'0.056 kg', time:'1:50' },
  'dustbin-cyclone-flange':                { pn:'VAC-100-03', qty:1, mass:'0.064 kg', time:'2:01' },
  'core-batteryadapter-parkside_20v-slot': { pn:'VAC-100-04', qty:1, mass:'0.016 kg', time:'0:38' },
  'core-batteryadapter-parkside_20v-base': { pn:'VAC-100-05', qty:1, mass:'0.027 kg', time:'0:51' },
  'core-pcbmount':                         { pn:'VAC-100-06', qty:1, mass:'0.032 kg' },
  'dustbin-top':                           { pn:'VAC-200-01', qty:1, mass:'0.235 kg', time:'8:15' },
  'dustbin-bottom':                        { pn:'VAC-200-02', qty:1, mass:'0.146 kg', time:'4:49' },
  'dustbin-cyclone-bottom':                { pn:'VAC-200-03', qty:1, mass:'0.049 kg', time:'1:42' },
  'dustbin-cyclone-top':                   { pn:'VAC-200-04', qty:1, mass:'0.209 kg', time:'7:21',
    warn: 'Print very fine, without support if possible. Open the mesh groove after printing.' },
  'dustbin-stickadapter-xiaomi':           { pn:'VAC-200-05', qty:1, mass:'0.052 kg', time:'1:56' },
  'dustbin-hinge-side':                    { pn:'VAC-200-07', qty:2, mass:'0.002 kg', time:'0:09' },
  'dustbin-hinge-middle':                  { pn:'VAC-200-08', qty:1, mass:'0.004 kg', time:'0:15' },
  'dustbin-hinge-latch':                   { pn:'VAC-200-09', qty:1, mass:'0.002 kg', time:'0:09' },
  'dustbin-alignmentring':                 { pn:'VAC-200-10', qty:1, mass:'0.014 kg', time:'0:33' },
  'dustbin-latch':                         { pn:'VAC-200-11', qty:1, mass:'0.005 kg', time:'0:21',
    warn: 'Needs a small spring to function.' },
  'dustbin-stickadapter-genericfemale':    { pn:'VAC-210-01', qty:1, mass:'0.089 kg' },
  'lid':                                   { pn:'VAC-300-01', qty:1, mass:'0.102 kg', time:'3:08' },
  'lid-insert-blank':                      { pn:'VAC-300-04', qty:3, mass:'0.020 kg', time:'0:38' },
  'lid-insert-hmi':                        { pn:'VAC-300-05', qty:1, mass:'0.020 kg', time:'0:38' },
  'lid-insert-backhandle-left':            { pn:'VAC-310-01', qty:1, mass:'0.046 kg', time:'1:30' },
  'lid-insert-backhandle-right':           { pn:'VAC-310-02', qty:1, mass:'0.047 kg', time:'1:33' },
  'lid-insert-handle-button':              { pn:'VAC-310-03', qty:1, mass:'0.002 kg', time:'0:38' },
  'nozzle-flat-d35-w150':                  { pn:'VAC-700-06', qty:1, mass:'0.087 kg' },
  'dustbin-cyclone-mesh': { pn:'VAC-2XX-XX', qty:1 }, // TODO: set exact PN + metadata
  'dustbin-stickadapter-xiaomi-top': { pn:'VAC-2XX-XX', qty:1 }, // TODO: set exact PN + metadata
  'lid-insert-buckethandle-left': { pn:'VAC-3XX-XX', qty:1 }, // TODO: set exact PN + metadata
  'lid-insert-buckethandle-right': { pn:'VAC-3XX-XX', qty:1 }, // TODO: set exact PN + metadata
  'lid-insert-hmi-clamp': { pn:'VAC-3XX-XX', qty:1 }, // TODO: set exact PN + metadata
  'nozzle-flat-d32-w100': { pn:'VAC-7XX-XX', qty:1 }, // TODO: set exact PN + metadata
  'nozzle-flat-d32-w150': { pn:'VAC-7XX-XX', qty:1 }, // TODO: set exact PN + metadata
  'nozzle-flat-d32-w200': { pn:'VAC-7XX-XX', qty:1 }, // TODO: set exact PN + metadata
  'nozzle-flat-d32-w280': { pn:'VAC-7XX-XX', qty:1 }, // TODO: set exact PN + metadata
  'nozzle-flat-d35-w100': { pn:'VAC-7XX-XX', qty:1 }, // TODO: set exact PN + metadata
  'nozzle-flat-d35-w200': { pn:'VAC-7XX-XX', qty:1 }, // TODO: set exact PN + metadata
  'nozzle-flat-d35-w280': { pn:'VAC-7XX-XX', qty:1 }, // TODO: set exact PN + metadata
  'nozzle-flat-d40-w100': { pn:'VAC-7XX-XX', qty:1 }, // TODO: set exact PN + metadata
  'nozzle-flat-d40-w150': { pn:'VAC-7XX-XX', qty:1 }, // TODO: set exact PN + metadata
  'nozzle-flat-d40-w200': { pn:'VAC-7XX-XX', qty:1 }, // TODO: set exact PN + metadata
  'nozzle-flat-d40-w280': { pn:'VAC-7XX-XX', qty:1 }, // TODO: set exact PN + metadata

  // Purchased parts (no STEP files yet) - still rendered in checklist.
  'purchased-hepa-filter': { pn:'VAC-8XX-XX', qty:1, purchased:true }, // TODO: set exact PN + metadata
  'purchased-spring-latch': { pn:'VAC-8XX-XX', qty:1, purchased:true }, // TODO: set exact PN + metadata
  'purchased-fastener-set': { pn:'VAC-8XX-XX', qty:1, purchased:true }, // TODO: set exact PN + metadata
};

/**
 * Part-number family lookup by filename prefix (first token before '-').
 *
 * Examples:
 * - core-*    -> VAC-1XX-XX
 * - dustbin-* -> VAC-2XX-XX
 * - lid-*     -> VAC-3XX-XX
 * - nozzle-*  -> VAC-7XX-XX
 *
 * This table is the single source of truth for schema checks.
 */
export interface PartNumberFamily {
  filenamePrefix: string;
  expectedHundreds: string;
  label: string;
}

export const PART_NUMBER_FAMILY_LOOKUP: PartNumberFamily[] = [
  { filenamePrefix: 'core',    expectedHundreds: '1', label: 'VAC-1XX-XX' },
  { filenamePrefix: 'dustbin', expectedHundreds: '2', label: 'VAC-2XX-XX' },
  { filenamePrefix: 'lid',     expectedHundreds: '3', label: 'VAC-3XX-XX' },
  { filenamePrefix: 'nozzle',  expectedHundreds: '7', label: 'VAC-7XX-XX' },
];

export interface PartNumberSchemaCheck {
  ok: boolean;
  expected: string | null;
  found: string | null;
}

/**
 * Validate PN family against filename prefix.
 * Returns ok=true if no rule exists for the prefix (unknown family).
 */
export function validatePartNumberSchema(partName: string, pn: string): PartNumberSchemaCheck {
  const prefix = partName.split('-')[0]?.toLowerCase() ?? '';
  const rule   = PART_NUMBER_FAMILY_LOOKUP.find(r => r.filenamePrefix === prefix);
  if (!rule) return { ok: true, expected: null, found: null };

  const m = pn.match(/^VAC-(\d)\d{2}-\d{2}$/i);
  const found = m?.[1] ?? null;
  const ok = found === rule.expectedHundreds;
  return { ok, expected: rule.label, found: found ? `VAC-${found}XX-XX` : null };
}

/** Infer a placeholder PN family from filename prefix (e.g. dustbin-* -> VAC-2XX-XX). */
export function inferPlaceholderPn(partName: string): string | null {
  const prefix = partName.split('-')[0]?.toLowerCase() ?? '';
  const rule   = PART_NUMBER_FAMILY_LOOKUP.find(r => r.filenamePrefix === prefix);
  return rule?.label ?? null;
}

// ── Section / folder helpers ────────────────────────────────────────────────

/**
 * Convert a raw folder name to a readable label.
 * All-uppercase abbreviations (e.g. HMI) are kept as-is; CamelCase is split.
 */
export function fmtFolder(s: string): string {
  if (s === s.toUpperCase()) return s;
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
export function sectionFromPath(path: string): { key: string; label: string } {
  const segments = path.split('/');
  const vi       = segments.indexOf('VAC_Printed_Parts');
  const dirs     = vi >= 0 ? segments.slice(vi + 1, -1) : [];
  return {
    key:   dirs.join('/') || '_root',
    label: dirs.length ? dirs.map(fmtFolder).join(' / ') : 'Other',
  };
}
