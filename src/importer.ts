// Conversion of File Color's data.json (palette of {id, name, value},
// fileColors of {path, color: paletteId}, cascadeColors, colorBackground).
import { normalizePath, sanitizeColor, slugId } from './colors.ts';
import type { ColorMode, FileTreeColorsSettings, ItemColor, PaletteEntry } from './colors.ts';
import { setEntry } from './paths.ts';

export interface ImportResult {
  settings: FileTreeColorsSettings;
  /** Colors assigned to paths. */
  colors: number;
  /** Palette entries added (the rest matched one already there). */
  palette: number;
  /** Entries dropped: no such palette color, bad value or empty path. */
  skipped: number;
}

/** Whether `raw` looks like File Color's data at all. */
export function looksLikeFileColor(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object') return false;
  const r = raw as Record<string, unknown>;
  return Array.isArray(r.palette) || Array.isArray(r.fileColors);
}

/**
 * Merges File Color's data into `current`. Palette colors that match one
 * already there (same name and value) are reused. Colors for a path replace
 * what that path had. File Color's two switches replace ours.
 */
export function convertFileColor(raw: unknown, current: FileTreeColorsSettings): ImportResult {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const palette: PaletteEntry[] = current.palette.map((p) => ({ ...p }));
  let colors: ItemColor[] = current.colors.map((c) => ({ ...c }));
  const idMap = new Map<string, string>();
  let added = 0;
  let skipped = 0;

  for (const p of Array.isArray(r.palette) ? r.palette : []) {
    const e = (p && typeof p === 'object' ? p : {}) as Record<string, unknown>;
    const value = sanitizeColor(e.value);
    const oldId = typeof e.id === 'string' ? e.id : typeof e.id === 'number' ? String(e.id) : '';
    if (!value || !oldId) {
      skipped++;
      continue;
    }
    const name = typeof e.name === 'string' && e.name.trim() ? e.name.trim() : value;
    const same = palette.find((x) => x.name.toLowerCase() === name.toLowerCase() && x.value.toLowerCase() === value.toLowerCase());
    if (same) {
      idMap.set(oldId, same.id);
      continue;
    }
    // A different color with the same name keeps both: the new one gets a suffixed name.
    let finalName = name;
    for (let n = 2; palette.some((x) => x.name.toLowerCase() === finalName.toLowerCase()); n++) finalName = `${name} ${n}`;
    const id = slugId(finalName, palette.map((x) => x.id));
    palette.push({ id, name: finalName, value });
    idMap.set(oldId, id);
    added++;
  }

  let assigned = 0;
  for (const f of Array.isArray(r.fileColors) ? r.fileColors : []) {
    const e = (f && typeof f === 'object' ? f : {}) as Record<string, unknown>;
    const path = typeof e.path === 'string' ? normalizePath(e.path) : '';
    const ref = typeof e.color === 'string' || typeof e.color === 'number' ? idMap.get(String(e.color)) : undefined;
    if (!path || !ref) {
      skipped++;
      continue;
    }
    colors = setEntry(colors, path, ref);
    assigned++;
  }

  const applyTo: ColorMode = typeof r.colorBackground === 'boolean' ? (r.colorBackground ? 'background' : 'text') : current.applyTo;
  const cascade = typeof r.cascadeColors === 'boolean' ? r.cascadeColors : current.cascade;
  return { settings: { ...current, palette, colors, applyTo, cascade }, colors: assigned, palette: added, skipped };
}
