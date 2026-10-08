import { test } from 'node:test';
import assert from 'node:assert/strict';
import { effectiveColor } from '../src/cascade.ts';
import { backgroundDeclaration, buildCss, escapeCssString, textDeclarations } from '../src/css.ts';
import { DEFAULT_SETTINGS } from '../src/colors.ts';
import type { FileTreeColorsSettings } from '../src/colors.ts';

const S = (over: Partial<FileTreeColorsSettings>): FileTreeColorsSettings => ({
  ...DEFAULT_SETTINGS,
  palette: [
    { id: 'red', name: 'Red', value: '#ff0000' },
    { id: 'blue', name: 'Blue', value: '#0000ff', mode: 'background' },
  ],
  colors: [],
  ...over,
});

test('escapeCssString escapes quotes, backslashes and control characters', () => {
  assert.equal(escapeCssString('plain/path.md'), 'plain/path.md');
  assert.equal(escapeCssString('a"b'), 'a\\"b');
  assert.equal(escapeCssString('a\\b'), 'a\\\\b');
  assert.equal(escapeCssString('a\nb'), 'a\\a b');
  assert.equal(escapeCssString('a\u0000b'), 'a\\0 b');
  assert.equal(escapeCssString('a b'), 'a\\2028 b');
  assert.equal(escapeCssString('日本語 ñ [x] ]"'), '日本語 ñ [x] ]\\"');
});

test('a hostile path cannot close the selector or inject rules', () => {
  const path = 'x"] { color: red } .evil[data-path="';
  const css = buildCss(S({ colors: [{ path, color: 'red' }] }));
  assert.equal(css.split('\n').length, 1);
  assert.ok(css.includes('x\\"] { color: red } .evil[data-path=\\""]'));
  // Strip the escaped string literal and what is left must be the plain rule.
  const stripped = css.replace(/"(?:[^"\\]|\\.)*"/g, '""');
  assert.equal(stripped.match(/\{/g)?.length, 1);
  assert.equal(stripped.match(/\}/g)?.length, 1);
});

test('text declarations set the explorer color variables; null hands them back to the theme', () => {
  assert.match(textDeclarations('#f00'), /--nav-item-color: #f00;/);
  assert.match(textDeclarations('#f00'), /--nav-item-color-active: #f00;/);
  assert.match(textDeclarations('#f00'), /--nav-collapse-icon-color: #f00;/);
  assert.match(textDeclarations(null), /--nav-item-color: unset;/);
});

test('background is a translucent mix with a clamped strength', () => {
  assert.equal(backgroundDeclaration('#f00', 25), 'background-color: color-mix(in srgb, #f00 25%, transparent);');
  assert.match(backgroundDeclaration('#f00', 1), / 5%,/);
  assert.match(backgroundDeclaration('#f00', 900), / 100%,/);
  assert.equal(backgroundDeclaration(null, 25), 'background-color: unset;');
});

test('background rules leave hover, active and selected rows to the theme', () => {
  const css = buildCss(S({ applyTo: 'background', colors: [{ path: 'a', color: 'red' }] }));
  assert.match(css, /\[data-path="a"\]:not\(\.is-active\):not\(\.is-selected\):not\(:hover\) \{ background-color: color-mix/);
  assert.doesNotMatch(css, /--nav-item/);
});

test('rules never use !important or inline styles and are scoped to the explorer', () => {
  const css = buildCss(S({ cascade: true, applyTo: 'both', colors: [{ path: 'a', color: 'red' }, { path: 'a/b.md', color: 'blue' }, { path: 'c.md', color: '#123456' }] }));
  assert.doesNotMatch(css, /!important/);
  for (const line of css.split('\n')) assert.ok(line.startsWith('.workspace-leaf-content[data-type="file-explorer"] '), line);
});

test('palette mode overrides the global mode, custom colors follow the global one', () => {
  const css = buildCss(S({ applyTo: 'text', colors: [{ path: 'p', color: 'blue' }, { path: 'q', color: '#00ff00' }] }));
  const [p, q] = css.split('\n');
  assert.match(p, /data-path="p"\]:not.*background-color: color-mix/);
  assert.doesNotMatch(css.split('\n')[0], /--nav-item-color:/);
  assert.match(q, /data-path="q"\] \{ --nav-item-color: #00ff00/);
});

test('with a cascading folder, an item of another mode resets the channel it does not set', () => {
  const css = buildCss(S({ cascade: true, applyTo: 'text', colors: [{ path: 'a', color: 'blue' }, { path: 'b', color: 'red' }] }));
  const own = css.split('\n').filter((l) => !l.includes(':where'));
  // 'a' (palette mode background) resets text; 'b' (text) resets background.
  assert.ok(own.some((l) => l.includes('data-path="a"] { --nav-item-color: unset;')));
  assert.ok(own.some((l) => l.includes('data-path="b"]:not') && l.includes('background-color: unset;')));
  const noCascade = buildCss(S({ cascade: false, applyTo: 'text', colors: [{ path: 'a', color: 'blue' }] }));
  assert.doesNotMatch(noCascade, /unset/);
});

test('entries pointing at removed palette colors or bad values produce no rule', () => {
  assert.equal(buildCss(S({ colors: [{ path: 'a', color: 'gone' }, { path: 'b', color: '#zzz' }, { path: '', color: 'red' }] })), '');
});

test('cascade emits an ancestor rule only for folders that cascade', () => {
  const colors = [{ path: 'on', color: 'red', children: true }, { path: 'off', color: 'red', children: false }, { path: 'dflt', color: 'red' }];
  const off = buildCss(S({ cascade: false, colors })).split('\n').filter((l) => l.includes(':where'));
  assert.equal(off.length, 1);
  assert.match(off[0], /data-path="on"\]/);
  const on = buildCss(S({ cascade: true, colors })).split('\n').filter((l) => l.includes(':where'));
  assert.deepEqual(on.map((l) => /data-path="(\w+)"/.exec(l)![1]).sort(), ['dflt', 'on']);
});

test('cascaded rules come first and outer folders before inner ones, own rules last', () => {
  const css = buildCss(S({ cascade: true, colors: [{ path: 'a/b/c', color: 'blue' }, { path: 'a', color: 'red' }, { path: 'a/b', color: 'red' }] }));
  const lines = css.split('\n');
  const kinds = lines.map((l) => (l.includes(':where') ? 'cascade' : 'own'));
  assert.ok(kinds.join().startsWith('cascade,cascade,cascade,own'));
  assert.ok(!kinds.slice(kinds.indexOf('own')).includes('cascade'));
  assert.deepEqual(lines.slice(0, 3).map((l) => /data-path="([^"]+)"/.exec(l)![1]), ['a', 'a/b', 'a/b/c']);
});

test('effectiveColor: own color wins over any ancestor', () => {
  const s = S({ cascade: true, colors: [{ path: 'a', color: 'red' }, { path: 'a/x.md', color: 'blue' }] });
  assert.deepEqual(effectiveColor('a/x.md', s), { entry: { path: 'a/x.md', color: 'blue' }, inherited: false });
});

test('effectiveColor: inherits from the nearest cascading ancestor', () => {
  const s = S({ cascade: true, colors: [{ path: 'a', color: 'red' }, { path: 'a/b', color: 'blue' }] });
  assert.equal(effectiveColor('a/b/c/d.md', s)?.entry.path, 'a/b');
  assert.equal(effectiveColor('a/q.md', s)?.entry.path, 'a');
  assert.equal(effectiveColor('a/b/c/d.md', s)?.inherited, true);
  assert.equal(effectiveColor('z.md', s), null);
});

test('effectiveColor: global cascade off needs the per-item toggle, and per-item off beats global on', () => {
  const off = S({ cascade: false, colors: [{ path: 'a', color: 'red' }, { path: 'b', color: 'red', children: true }] });
  assert.equal(effectiveColor('a/x.md', off), null);
  assert.equal(effectiveColor('b/x.md', off)?.entry.path, 'b');
  const on = S({ cascade: true, colors: [{ path: 'a', color: 'red', children: false }] });
  assert.equal(effectiveColor('a/x.md', on), null);
});

test('effectiveColor skips a non-cascading nearer folder and uses a farther cascading one, as the stylesheet does', () => {
  const s = S({ cascade: false, colors: [{ path: 'a', color: 'red', children: true }, { path: 'a/b', color: 'blue', children: false }] });
  assert.equal(effectiveColor('a/b/x.md', s)?.entry.path, 'a');
});

test('effectiveColor ignores entries whose palette color was deleted', () => {
  const s = S({ cascade: true, colors: [{ path: 'a', color: 'red' }, { path: 'a/b', color: 'deleted' }] });
  assert.equal(effectiveColor('a/b/x.md', s)?.entry.path, 'a');
  assert.equal(effectiveColor('a/b', s)?.entry.path, 'a');
});
