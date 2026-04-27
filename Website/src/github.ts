import type { Part } from './types';
import { BOM_META, sectionFromPath } from './bom-meta';

const REPO_TREE = 'https://api.github.com/repos/hkienle/osh-vacuum/git/trees/hardware-v1?recursive=1';
const RAW_BASE  = 'https://raw.githubusercontent.com/hkienle/osh-vacuum/hardware-v1/';

interface TreeItem {
  type: string;
  path: string;
}

interface GithubFile {
  name:        string;
  path:        string;
  downloadUrl: string;
}

/** Fetch all .step files under VAC_Printed_Parts from the GitHub Trees API. */
export async function fetchStepFiles(): Promise<GithubFile[]> {
  const res  = await fetch(REPO_TREE);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data: { tree: TreeItem[] } = await res.json();

  return data.tree
    .filter(i =>
      i.type === 'blob' &&
      i.path.includes('VAC_Printed_Parts') &&
      i.path.toLowerCase().endsWith('.step'))
    .map(i => ({
      name:        i.path.split('/').pop()!,
      path:        i.path,
      downloadUrl: RAW_BASE + i.path.split('/').map(encodeURIComponent).join('/'),
    }));
}

// Internal type that includes sort/section fields before they are stripped
interface RawPart extends Part {
  _skey:  string;
  _slbl:  string;
  _sort:  string;
}

/**
 * Convert the raw file list into a sorted Part array.
 * Section headers are derived from folder paths; BOM_META provides optional enrichment.
 */
export function buildPartsFromFiles(files: GithubFile[]): Part[] {
  const raw: RawPart[] = files.map(f => {
    const base     = f.name.replace(/\.step$/i, '');
    const m        = base.match(/^OSH_Vac_(.+?)(?:_(v[\d.]+))?$/i);
    const partName = m ? m[1].toLowerCase() : base.toLowerCase();
    const fileRev  = m?.[2] ?? null;
    const meta     = BOM_META[partName] ?? {};
    const { key, label } = sectionFromPath(f.path);

    return {
      pn:          meta.pn   ?? partName,
      name:        partName,
      qty:         meta.qty  ?? 1,
      mass:        meta.mass ?? '-',
      time:        meta.time ?? '-',
      rev:         meta.rev  ?? (fileRev && fileRev !== 'v1' ? fileRev : null),
      warn:        meta.warn ?? null,
      sec:         null,
      filename:    f.name,
      downloadUrl: f.downloadUrl,
      _skey:       key,
      _slbl:       label,
      _sort:       meta.pn   ?? ('ZZZ-' + partName),
    };
  });

  // Sort by folder path first (natural directory order), then by PN/name within folder
  raw.sort((a, b) => {
    const sk = a._skey.localeCompare(b._skey);
    return sk !== 0 ? sk : a._sort.localeCompare(b._sort);
  });

  // Annotate the first part in each new section with the section label
  let lastKey: string | null = null;
  return raw.map(({ _skey, _slbl, _sort, ...part }) => {
    part.sec = _skey !== lastKey ? _slbl : null;
    lastKey  = _skey;
    return part as Part;
  });
}
