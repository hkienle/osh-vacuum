import { STORE_KEY, today } from './utils';
export function loadSaved() {
    try {
        const raw = localStorage.getItem(STORE_KEY);
        return raw ? JSON.parse(raw) : null;
    }
    catch {
        return null;
    }
}
export function saveToStorage(parts, state) {
    try {
        localStorage.setItem(STORE_KEY, JSON.stringify({ _parts: parts, _state: state }));
    }
    catch {
        // storage quota exceeded — silently ignore
    }
}
/**
 * Build a fresh AppState for the given parts, optionally restoring
 * status/material/etc. from a previously saved state.
 */
export function buildState(parts, saved) {
    const state = {};
    for (const p of parts) {
        const prev = saved?.[p.pn];
        const wasDone = prev?.status === 'downloaded' || prev?.status === 'printed';
        state[p.pn] = {
            status: wasDone ? prev.status : 'available',
            material: prev?.material ?? 'PLA',
            color: prev?.color ?? '',
            notes: prev?.notes ?? '',
            printer: prev?.printer ?? '',
            date: prev?.date ?? today,
            expanded: false,
        };
    }
    return state;
}
export function defaultPartState() {
    return {
        status: 'available',
        material: 'PLA',
        color: '',
        notes: '',
        printer: '',
        date: today,
        expanded: false,
    };
}
