// The path map: set, clear, rename/move and delete, with children of folders.
import { normalizePath } from './colors.ts';
import type { ItemColor } from './colors.ts';

/** True when `path` is `ancestor` itself or lies below it. Matches whole path segments only. */
export function isInside(path: string, ancestor: string): boolean {
  return path === ancestor || path.startsWith(ancestor + '/');
}

/** The folders above a path, nearest first: `a/b/c.md` gives `a/b`, `a`. */
export function ancestors(path: string): string[] {
  const out: string[] = [];
  let i = path.lastIndexOf('/');
  while (i > 0) {
    path = path.slice(0, i);
    out.push(path);
    i = path.lastIndexOf('/');
  }
  return out;
}

export function getEntry(colors: readonly ItemColor[], path: string): ItemColor | undefined {
  return colors.find((c) => c.path === path);
}

/** A new list with the entry for `path` replaced or added. */
export function setEntry(colors: readonly ItemColor[], path: string, color: string, children?: boolean): ItemColor[] {
  path = normalizePath(path);
  if (!path) return [...colors];
  const entry: ItemColor = children === undefined ? { path, color } : { path, color, children };
  const i = colors.findIndex((c) => c.path === path);
  if (i < 0) return [...colors, entry];
  return colors.map((c, j) => (j === i ? entry : c));
}

export function clearEntry(colors: readonly ItemColor[], path: string): ItemColor[] {
  return colors.filter((c) => c.path !== path);
}

/**
 * A rename or move of `oldPath` to `newPath`. The entry itself and everything
 * recorded below a renamed folder follow. An entry already sitting at a target
 * path is replaced by the one that moved there.
 */
export function renameEntries(colors: readonly ItemColor[], oldPath: string, newPath: string): ItemColor[] {
  oldPath = normalizePath(oldPath);
  newPath = normalizePath(newPath);
  if (oldPath === newPath) return [...colors];
  const moved: ItemColor[] = [];
  const rest: ItemColor[] = [];
  for (const c of colors) {
    if (isInside(c.path, oldPath)) moved.push({ ...c, path: newPath + c.path.slice(oldPath.length) });
    else rest.push(c);
  }
  if (!moved.length) return [...colors];
  const targets = new Set(moved.map((m) => m.path));
  return [...rest.filter((c) => !targets.has(c.path)), ...moved];
}

/** A delete of `path`: the entry and everything below it, but never a sibling that merely shares the prefix. */
export function removeEntries(colors: readonly ItemColor[], path: string): ItemColor[] {
  path = normalizePath(path);
  return colors.filter((c) => !isInside(c.path, path));
}
