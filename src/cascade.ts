// Which color an item ends up with. The stylesheet in css.ts implements the
// same rules with selectors; this is the reference both are tested against.
import { resolveColor } from './colors.ts';
import type { FileTreeColorsSettings, ItemColor } from './colors.ts';
import { ancestors, getEntry } from './paths.ts';

export interface EffectiveColor {
  entry: ItemColor;
  /** True when the color comes from a folder above rather than from the item. */
  inherited: boolean;
}

/** Whether a colored folder passes its color to what is inside it. */
export function cascades(entry: ItemColor, settings: Pick<FileTreeColorsSettings, 'cascade'>): boolean {
  return entry.children ?? settings.cascade;
}

/**
 * The item's own color wins. Otherwise the nearest folder above that has a
 * valid color and cascades. Entries pointing at a deleted palette color are ignored.
 */
export function effectiveColor(path: string, settings: FileTreeColorsSettings): EffectiveColor | null {
  const valid = (e: ItemColor) => resolveColor(e.color, settings.palette, settings.applyTo) !== null;
  const own = getEntry(settings.colors, path);
  if (own && valid(own)) return { entry: own, inherited: false };
  for (const a of ancestors(path)) {
    const e = getEntry(settings.colors, a);
    if (e && valid(e) && cascades(e, settings)) return { entry: e, inherited: true };
  }
  return null;
}
