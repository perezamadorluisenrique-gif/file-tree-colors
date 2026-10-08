import { test } from 'node:test';
import assert from 'node:assert/strict';
import { convertFileColor, looksLikeFileColor } from '../src/importer.ts';
import { DEFAULT_SETTINGS } from '../src/colors.ts';
import type { FileTreeColorsSettings } from '../src/colors.ts';

const base = (): FileTreeColorsSettings => ({ ...DEFAULT_SETTINGS, palette: [{ id: 'red', name: 'Red', value: '#e5484d' }], colors: [] });

const FC = {
  cascadeColors: true,
  colorBackground: true,
  palette: [
    { id: 'uuid-1', name: 'Ocean', value: '#0077be' },
    { id: 'uuid-2', name: 'Red', value: '#E5484D' },
    { id: 'uuid-3', name: 'Broken', value: 'url(javascript:alert(1))' },
  ],
  fileColors: [
    { path: 'Projects', color: 'uuid-1' },
    { path: '/Projects/Plan.md/', color: 'uuid-2' },
    { path: 'Missing.md', color: 'nope' },
    { path: 'Broken.md', color: 'uuid-3' },
    { path: '', color: 'uuid-1' },
    null,
  ],
};

test('looksLikeFileColor', () => {
  assert.ok(looksLikeFileColor(FC));
  assert.ok(looksLikeFileColor({ fileColors: [] }));
  assert.ok(!looksLikeFileColor({}));
  assert.ok(!looksLikeFileColor(null));
  assert.ok(!looksLikeFileColor('x'));
});

test('converts palette, per-path colors and the two switches', () => {
  const r = convertFileColor(FC, base());
  assert.equal(r.settings.palette.length, 2, 'Red matched, Ocean added, Broken dropped');
  assert.deepEqual(r.settings.palette[1], { id: 'ocean', name: 'Ocean', value: '#0077be' });
  assert.deepEqual(r.settings.colors, [{ path: 'Projects', color: 'ocean' }, { path: 'Projects/Plan.md', color: 'red' }]);
  assert.equal(r.settings.cascade, true);
  assert.equal(r.settings.applyTo, 'background');
  assert.deepEqual([r.colors, r.palette, r.skipped], [2, 1, 5]);
});

test('colorBackground false maps to text, missing switches keep the current values', () => {
  assert.equal(convertFileColor({ colorBackground: false }, { ...base(), applyTo: 'both' }).settings.applyTo, 'text');
  const kept = convertFileColor({ palette: [], fileColors: [] }, { ...base(), applyTo: 'both', cascade: true });
  assert.equal(kept.settings.applyTo, 'both');
  assert.equal(kept.settings.cascade, true);
});

test('a different color with the same name is kept under a suffixed name', () => {
  const r = convertFileColor({ palette: [{ id: 'x', name: 'Red', value: '#111111' }], fileColors: [{ path: 'a.md', color: 'x' }] }, base());
  assert.deepEqual(r.settings.palette[1], { id: 'red-2', name: 'Red 2', value: '#111111' });
  assert.deepEqual(r.settings.colors, [{ path: 'a.md', color: 'red-2' }]);
});

test('existing colors are kept; an imported path replaces the same path', () => {
  const cur = { ...base(), colors: [{ path: 'keep.md', color: 'red' }, { path: 'Projects', color: 'red', children: true }] };
  const r = convertFileColor(FC, cur);
  assert.deepEqual(r.settings.colors.map((c) => c.path), ['keep.md', 'Projects', 'Projects/Plan.md']);
  assert.equal(r.settings.colors[1].color, 'ocean');
  assert.equal(cur.colors[1].color, 'red', 'input not mutated');
  assert.equal(cur.palette.length, 1);
});

test('numeric ids and junk input do not throw', () => {
  const r = convertFileColor({ palette: [{ id: 7, name: 'Seven', value: 'teal' }], fileColors: [{ path: 'a', color: 7 }] }, base());
  assert.deepEqual(r.settings.colors, [{ path: 'a', color: 'seven' }]);
  for (const junk of [null, undefined, 5, 'x', [], { palette: 'no', fileColors: 3 }]) {
    const out = convertFileColor(junk, base());
    assert.deepEqual(out.settings, base());
    assert.equal(out.colors, 0);
  }
});

test('importing twice gives the same result', () => {
  const once = convertFileColor(FC, base());
  const twice = convertFileColor(FC, once.settings);
  assert.deepEqual(twice.settings, once.settings);
  assert.equal(twice.palette, 0);
});
