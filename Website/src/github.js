import { BOM_META, inferPlaceholderPn, sectionFromPath, validatePartNumberSchema } from './bom-meta';
const REPO_TREE = 'https://api.github.com/repos/hkienle/osh-vacuum/git/trees/hardware-v1?recursive=1';
const RAW_BASE = 'https://raw.githubusercontent.com/hkienle/osh-vacuum/hardware-v1/';
/** Fetch all .step files under VAC_Printed_Parts from the GitHub Trees API. */
export async function fetchStepFiles() {
    const res = await fetch(REPO_TREE);
    if (!res.ok)
        throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.tree
        .filter(i => i.type === 'blob' &&
        i.path.includes('VAC_Printed_Parts') &&
        i.path.toLowerCase().endsWith('.step'))
        .map(i => ({
        name: i.path.split('/').pop(),
        path: i.path,
        downloadUrl: RAW_BASE + i.path.split('/').map(encodeURIComponent).join('/'),
    }));
}
function normalizeRev(rev) {
    if (!rev)
        return null;
    // Show explicit patch level for v1-style filenames.
    if (/^v\d+$/i.test(rev))
        return `${rev}.0`;
    return rev;
}
/**
 * Convert the raw file list into a sorted Part array.
 * Section headers are derived from folder paths; BOM_META provides optional enrichment.
 */
export function buildPartsFromFiles(files) {
    const raw = files.map(f => {
        const base = f.name.replace(/\.step$/i, '');
        const m = base.match(/^OSH_Vac_(.+?)(?:_(v[\d.]+))?$/i);
        const partName = m ? m[1].toLowerCase() : base.toLowerCase();
        const fileRev = normalizeRev(m?.[2] ?? null);
        const meta = BOM_META[partName] ?? {};
        const pn = meta.pn ?? inferPlaceholderPn(partName) ?? partName;
        const schema = validatePartNumberSchema(partName, pn);
        const { key, label } = sectionFromPath(f.path);
        if (!schema.ok) {
            console.warn(`[PN schema mismatch] ${f.name}: expected ${schema.expected}, found ${pn}`);
        }
        return {
            pn,
            name: partName,
            qty: meta.qty ?? 1,
            mass: meta.mass ?? '-',
            time: meta.time ?? '-',
            rev: fileRev,
            warn: meta.warn ?? null,
            sec: null,
            filename: f.name,
            downloadUrl: f.downloadUrl,
            _skey: key,
            _slbl: label,
            _sort: meta.pn ?? ('ZZZ-' + partName),
        };
    });
    const existingNames = new Set(raw.map(p => p.name));
    const purchasedRows = Object.entries(BOM_META)
        .filter(([name, meta]) => meta.purchased && !existingNames.has(name))
        .map(([name, meta]) => ({
        pn: meta.pn ?? inferPlaceholderPn(name) ?? name,
        name,
        qty: meta.qty ?? 1,
        mass: meta.mass ?? '-',
        time: meta.time ?? '-',
        rev: null,
        warn: meta.warn ?? null,
        sec: null,
        filename: null,
        downloadUrl: null,
        _skey: 'ZZZ/Purchased',
        _slbl: 'Purchased Parts',
        _sort: meta.pn ?? ('ZZZ-' + name),
    }));
    raw.push(...purchasedRows);
    // Sort by folder path first (natural directory order), then by PN/name within folder
    raw.sort((a, b) => {
        const sk = a._skey.localeCompare(b._skey);
        return sk !== 0 ? sk : a._sort.localeCompare(b._sort);
    });
    // Annotate the first part in each new section with the section label
    let lastKey = null;
    return raw.map(({ _skey, _slbl, _sort, ...part }) => {
        part.sec = _skey !== lastKey ? _slbl : null;
        lastKey = _skey;
        return part;
    });
}
