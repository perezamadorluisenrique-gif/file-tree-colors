// Settings model, defaults, validation and the palette text format.
// No `obsidian` import: tests/ run this under plain Node.

export type ColorMode = 'text' | 'background' | 'both';

export interface PaletteEntry {
  /** Stable reference stored in `colors`. Never starts with `#`. */
  id: string;
  name: string;
  /** A CSS color accepted by `sanitizeColor`. */
  value: string;
  /** Overrides the global "Apply color to" for this entry. */
  mode?: ColorMode;
}

export interface ItemColor {
  /** Vault path without a leading or trailing slash. */
  path: string;
  /** A palette id, or a custom color written `#rrggbb`. */
  color: string;
  /** Per-item cascade override. `undefined` follows the global setting. */
  children?: boolean;
}

export interface FileTreeColorsSettings {
  palette: PaletteEntry[];
  colors: ItemColor[];
  applyTo: ColorMode;
  cascade: boolean;
  /** Opacity of the background tint, in percent. */
  backgroundStrength: number;
}

export const MODES: readonly ColorMode[] = ['text', 'background', 'both'];

export const DEFAULT_PALETTE: readonly PaletteEntry[] = [
  { id: 'red', name: 'Red', value: '#e5484d' },
  { id: 'orange', name: 'Orange', value: '#f76b15' },
  { id: 'yellow', name: 'Yellow', value: '#e0a100' },
  { id: 'green', name: 'Green', value: '#30a46c' },
  { id: 'teal', name: 'Teal', value: '#12a594' },
  { id: 'blue', name: 'Blue', value: '#3e63dd' },
  { id: 'purple', name: 'Purple', value: '#8e4ec6' },
  { id: 'pink', name: 'Pink', value: '#d6409f' },
  { id: 'gray', name: 'Gray', value: '#8b8d98' },
];

export const DEFAULT_SETTINGS: FileTreeColorsSettings = {
  palette: DEFAULT_PALETTE.map((p) => ({ ...p })),
  colors: [],
  applyTo: 'text',
  cascade: false,
  backgroundStrength: 25,
};

const COLOR_RE = /^(#[0-9a-f]{3,8}|[a-z]{3,30}|(?:rgb|hsl|hwb|lab|lch|oklab|oklch)a?\([0-9a-z%.,\s/+-]{1,80}\))$/i;

/** The color as it may be written into a stylesheet, or null when it is not a plain color. */
export function sanitizeColor(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (!COLOR_RE.test(v)) return null;
  if (v[0] === '#' && ![4, 5, 7, 9].includes(v.length)) return null;
  return v;
}

export function isMode(v: unknown): v is ColorMode {
  return typeof v === 'string' && (MODES as readonly string[]).includes(v);
}

/** A lowercase id from a name, unique among `taken`. */
export function slugId(name: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  const base = name.toLowerCase().normalize('NFKD').replace(/\p{M}+/gu, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'color';
  let id = base;
  for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
  return id;
}

export function normalizePath(path: string): string {
  return path.replace(/^\/+|\/+$/g, '');
}

/** Whatever `loadData()` returned, turned into valid settings. */
export function normalizeSettings(raw: unknown): FileTreeColorsSettings {
  const out: FileTreeColorsSettings = {
    ...DEFAULT_SETTINGS,
    palette: DEFAULT_PALETTE.map((p) => ({ ...p })),
    colors: [],
  };
  if (!raw || typeof raw !== 'object') return out;
  const r = raw as Record<string, unknown>;
  if (Array.isArray(r.palette)) {
    const palette: PaletteEntry[] = [];
    for (const p of r.palette) {
      if (!p || typeof p !== 'object') continue;
      const e = p as Record<string, unknown>;
      const value = sanitizeColor(e.value);
      if (typeof e.id !== 'string' || !e.id || e.id.startsWith('#') || !value) continue;
      if (palette.some((x) => x.id === e.id)) continue;
      const entry: PaletteEntry = { id: e.id, name: typeof e.name === 'string' && e.name ? e.name : e.id, value };
      if (isMode(e.mode)) entry.mode = e.mode;
      palette.push(entry);
    }
    out.palette = palette;
  }
  if (Array.isArray(r.colors)) {
    const seen = new Set<string>();
    for (const c of r.colors) {
      if (!c || typeof c !== 'object') continue;
      const e = c as Record<string, unknown>;
      if (typeof e.path !== 'string' || typeof e.color !== 'string') continue;
      const path = normalizePath(e.path);
      if (!path || seen.has(path)) continue;
      seen.add(path);
      const item: ItemColor = { path, color: e.color };
      if (typeof e.children === 'boolean') item.children = e.children;
      out.colors.push(item);
    }
  }
  if (isMode(r.applyTo)) out.applyTo = r.applyTo;
  if (typeof r.cascade === 'boolean') out.cascade = r.cascade;
  if (typeof r.backgroundStrength === 'number' && Number.isFinite(r.backgroundStrength)) {
    out.backgroundStrength = Math.min(100, Math.max(5, Math.round(r.backgroundStrength)));
  }
  return out;
}

/** The value and mode a stored reference stands for, or null when it points nowhere valid. */
export function resolveColor(
  ref: string,
  palette: readonly PaletteEntry[],
  applyTo: ColorMode,
): { value: string; mode: ColorMode } | null {
  if (ref.startsWith('#')) {
    const value = sanitizeColor(ref);
    return value ? { value, mode: applyTo } : null;
  }
  const entry = palette.find((p) => p.id === ref);
  if (!entry) return null;
  const value = sanitizeColor(entry.value);
  return value ? { value, mode: entry.mode ?? applyTo } : null;
}

/** One line per entry: `Name: #hex` or `Name: #hex | background`. */
export function formatPalette(palette: readonly PaletteEntry[]): string {
  return palette.map((p) => `${p.name}: ${p.value}${p.mode ? ` | ${p.mode}` : ''}`).join('\n');
}

const LINE_RE = /^([^:|]+?)\s*:\s*([^|]+?)\s*(?:\|\s*(text|background|both)\s*)?$/i;

/**
 * Parses the palette text. Lines that are not a name and a valid color are
 * skipped. An entry keeps the id of the previous entry with the same name, or
 * else of the one on the same line when that one was renamed away, so colors
 * already assigned survive edits.
 */
export function parsePalette(text: string, previous: readonly PaletteEntry[]): PaletteEntry[] {
  const parsed: { name: string; value: string; mode?: ColorMode }[] = [];
  for (const line of text.split(/\r?\n/)) {
    const m = LINE_RE.exec(line.trim());
    if (!m) continue;
    const value = sanitizeColor(m[2]);
    if (!value) continue;
    const item: { name: string; value: string; mode?: ColorMode } = { name: m[1].trim(), value };
    if (m[3]) item.mode = m[3].toLowerCase() as ColorMode;
    parsed.push(item);
  }
  const names = new Set(parsed.map((p) => p.name.toLowerCase()));
  const taken = new Set<string>();
  const reuse = (prev: PaletteEntry | undefined): string | null => (prev && !taken.has(prev.id) ? prev.id : null);
  return parsed.map((p, i) => {
    let id = reuse(previous.find((x) => x.name.toLowerCase() === p.name.toLowerCase()));
    if (!id) {
      const same = previous[i];
      if (same && !names.has(same.name.toLowerCase())) id = reuse(same);
    }
    if (!id) id = slugId(p.name, [...taken, ...previous.map((x) => x.id)]);
    taken.add(id);
    return p.mode ? { id, name: p.name, value: p.value, mode: p.mode } : { id, name: p.name, value: p.value };
  });
}
