/** A single printable part, derived from a .step file + optional BOM metadata. */
export interface Part {
  pn:          string;        // part number (e.g. VAC-200-01) or canonical name for unknown files
  name:        string;        // canonical name (lowercase-with-hyphens)
  qty:         number;
  mass:        string;        // e.g. "0.296 kg" or "-"
  time:        string;        // estimated print time, e.g. "10:23" or "-"
  rev:         string | null; // revision badge, e.g. "v1.2" when relevant
  warn:        string | null; // optional printing advice shown in detail panel
  sec:         string | null; // section header label; null = same section as previous row
  filename:    string;        // actual .step filename in the repo
  downloadUrl: string;        // direct raw download URL
}

export type PartStatus = 'available' | 'downloaded' | 'printed';

/** Mutable per-part tracking state, persisted to localStorage. */
export interface PartState {
  status:   PartStatus;
  material: string;
  color:    string;
  notes:    string;
  printer:  string;
  date:     string;           // ISO date string YYYY-MM-DD
  expanded: boolean;
}

export type AppState = Record<string, PartState>;

/** Shape of the localStorage blob. */
export interface SavedData {
  _parts: Part[];
  _state: AppState;
}
