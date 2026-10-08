// The one stylesheet the plugin writes. Items are matched by the `data-path`
// the file explorer puts on every row, so nothing is set on the rows.
import { resolveColor } from './colors.ts';
import type { FileTreeColorsSettings } from './colors.ts';
import { cascades } from './cascade.ts';

/** The text of a CSS string literal for `value`, without the quotes. */
export function escapeCssString(value: string): string {
  let out = '';
  for (const ch of value) {
    const code = ch.codePointAt(0)!;
    if (ch === '\\' || ch === '"') out += '\\' + ch;
    else if (code < 0x20 || code === 0x7f || code === 0x2028 || code === 0x2029) out += '\\' + code.toString(16) + ' ';
    else out += ch;
  }
  return out;
}

const EXPLORER = '.workspace-leaf-content[data-type="file-explorer"]';

/** Rows that are not being hovered, selected or active keep the theme's own highlight. */
const IDLE = ':not(.is-active):not(.is-selected):not(:hover)';

const TEXT_VARS = [
  '--nav-item-color',
  '--nav-item-color-hover',
  '--nav-item-color-active',
  '--nav-item-color-selected',
  '--nav-collapse-icon-color',
  '--nav-collapse-icon-color-collapsed',
];

/** The custom properties Obsidian's explorer reads for the text, the arrow and the icon. `value` null hands them back to the theme. */
export function textDeclarations(value: string | null): string {
  return TEXT_VARS.map((v) => `${v}: ${value ?? 'unset'};`).join(' ');
}

/** A translucent mix over whatever the theme has underneath, so it reads in light and dark. `value` null clears it. */
export function backgroundDeclaration(value: string | null, strength: number): string {
  if (value === null) return 'background-color: unset;';
  const s = Math.min(100, Math.max(5, Math.round(strength)));
  return `background-color: color-mix(in srgb, ${value} ${s}%, transparent);`;
}

/**
 * Rules for every colored item. An item's own rule has higher specificity
 * than any cascaded one; cascaded rules are ordered from the outermost folder
 * inwards so the nearest folder wins. When some folder cascades, an item's own
 * color also resets whatever the other channel inherits, so "own color wins"
 * holds for text and background alike.
 */
export function buildCss(settings: FileTreeColorsSettings): string {
  const own: string[] = [];
  const cascaded: { depth: number; css: string[] }[] = [];
  const anyCascade = settings.colors.some((e) => cascades(e, settings));
  for (const e of settings.colors) {
    if (!e.path) continue;
    const r = resolveColor(e.color, settings.palette, settings.applyTo);
    if (!r) continue;
    const path = escapeCssString(e.path);
    const text = r.mode === 'text' || r.mode === 'both';
    const bg = r.mode === 'background' || r.mode === 'both';
    const self = `${EXPLORER} .tree-item-self[data-path="${path}"]`;
    if (text) own.push(`${self} { ${textDeclarations(r.value)} }`);
    else if (anyCascade) own.push(`${self} { ${textDeclarations(null)} }`);
    if (bg) own.push(`${self}${IDLE} { ${backgroundDeclaration(r.value, settings.backgroundStrength)} }`);
    else if (anyCascade) own.push(`${self}${IDLE} { ${backgroundDeclaration(null, 0)} }`);
    if (cascades(e, settings)) {
      const inside = `${EXPLORER} :where(.nav-folder-title[data-path="${path}"] + .nav-folder-children) .tree-item-self`;
      const css: string[] = [];
      if (text) css.push(`${inside} { ${textDeclarations(r.value)} }`);
      if (bg) css.push(`${inside}${IDLE} { ${backgroundDeclaration(r.value, settings.backgroundStrength)} }`);
      cascaded.push({ depth: e.path.split('/').length, css });
    }
  }
  cascaded.sort((a, b) => a.depth - b.depth);
  return [...cascaded.map((c) => c.css.join('\n')), ...own].join('\n');
}
