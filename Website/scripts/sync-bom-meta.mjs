import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WEBSITE_DIR = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(WEBSITE_DIR, '..');
const STEP_ROOT = path.join(REPO_ROOT, 'Hardware', 'VAC_Printed_Parts');
const BOM_META_FILE = path.join(WEBSITE_DIR, 'src', 'bom-meta.ts');

const FAMILY_HINTS = {
  core: 'VAC-1XX-XX',
  dustbin: 'VAC-2XX-XX',
  lid: 'VAC-3XX-XX',
  nozzle: 'VAC-7XX-XX',
};

function canonicalPartNameFromFileName(fileName) {
  const base = fileName.replace(/\.step$/i, '');
  const match = base.match(/^OSH_Vac_(.+?)(?:_(v[\d.]+))?$/i);
  return (match ? match[1] : base).toLowerCase();
}

function partPrefix(partName) {
  return partName.split('-')[0]?.toLowerCase() ?? '';
}

function entryLine(partName) {
  const prefix = partPrefix(partName);
  const family = FAMILY_HINTS[prefix] ?? 'VAC-XXX-XX';
  return `  '${partName}': { pn:'${family}', qty:1 }, // TODO: set exact PN + metadata`;
}

async function collectStepFilesRec(dir) {
  const out = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...await collectStepFilesRec(full));
      continue;
    }
    if (entry.isFile() && entry.name.toLowerCase().endsWith('.step')) {
      out.push(full);
    }
  }
  return out;
}

function extractBomMetaBlock(fileContent) {
  const startToken = 'export const BOM_META: Record<string, BomEntry> = {';
  const start = fileContent.indexOf(startToken);
  if (start < 0) {
    throw new Error('BOM_META block start not found');
  }

  const fromStart = fileContent.slice(start);
  const endRel = fromStart.indexOf('\n};');
  if (endRel < 0) {
    throw new Error('BOM_META block end not found');
  }

  const end = start + endRel + '\n};'.length;
  const block = fileContent.slice(start, end);
  return { start, end, block };
}

function extractBomKeys(bomBlock) {
  const keys = new Set();
  const rx = /'([^']+)'\s*:/g;
  let m = null;
  while ((m = rx.exec(bomBlock)) !== null) {
    keys.add(m[1]);
  }
  return keys;
}

async function main() {
  const [bomMetaContent, stepPaths] = await Promise.all([
    fs.readFile(BOM_META_FILE, 'utf8'),
    collectStepFilesRec(STEP_ROOT),
  ]);

  const { start, end, block } = extractBomMetaBlock(bomMetaContent);
  const existingKeys = extractBomKeys(block);

  const discovered = new Set();
  for (const stepPath of stepPaths) {
    const fileName = path.basename(stepPath);
    discovered.add(canonicalPartNameFromFileName(fileName));
  }

  const missing = [...discovered]
    .filter(name => !existingKeys.has(name))
    .sort((a, b) => a.localeCompare(b));

  if (missing.length === 0) {
    console.log('BOM_META is already in sync. No missing entries.');
    return;
  }

  const insertion = missing.map(entryLine).join('\n');
  const blockWithInsert = block.replace(/\n};$/, `\n${insertion}\n};`);
  const updated = bomMetaContent.slice(0, start) + blockWithInsert + bomMetaContent.slice(end);
  await fs.writeFile(BOM_META_FILE, updated, 'utf8');

  console.log(`Added ${missing.length} missing BOM_META entries:`);
  for (const name of missing) {
    const prefix = partPrefix(name);
    const family = FAMILY_HINTS[prefix] ?? 'VAC-XXX-XX';
    console.log(`- ${name} (placeholder PN family: ${family})`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
