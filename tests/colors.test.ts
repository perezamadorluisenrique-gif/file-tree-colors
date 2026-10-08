import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_PALETTE, DEFAULT_SETTINGS, formatPalette, normalizeSettings, parsePalette, resolveColor, sanitizeColor, slugId,
} from '../src/colors.ts';

test('sanitizeColor accepts plain colors and rejects anything that could escape a declaration', () => {
  for (const ok of ['#fff', '#FFAA00', '#ff000080', 'red', 'rgb(1, 2, 3)', 'hsl(120 50% 40% / 0.5)', ' #abc ']) {
    assert.ok(sanitizeColor(ok), ok);
  }
  for (const bad of ['', '#ff', '#ggg', '#12345', 'red; color: blue', 'url(x)', 'rgb(1,2,3);}', 'a{b}', 'var(--x)', 'rgb(1,2,3) !important', 5, null, undefined]) {
    assert.equal(sanitizeColor(bad), null, String(bad));
  }
  assert.equal(sanitizeColor(' #abc '), '#abc');
});

test('slugId makes unique lowercase ids', () => {
  assert.equal(slugId('Sky Blue', []), 'sky-blue');
  assert.equal(slugId('Sky Blue', ['sky-blue']), 'sky-blue-2');
  assert.equal(slugId('Sky Blue', ['sky-blue', 'sky-blue-2']), 'sky-blue-3');
  assert.equal(slugId('???', []), 'color');
  assert.equal(slugId('Rojo ñandú', []), 'rojo-nandu');
});

test('normalizeSettings gives defaults for nothing and for garbage', () => {
  for (const raw of [undefined, null, 5, 'x', []]) {
    const s = normalizeSettings(raw);
    assert.deepEqual(s, DEFAULT_SETTINGS);
  }
  const a = normalizeSettings(null);
  a.palette[0].name = 'changed';
  assert.equal(DEFAULT_PALETTE[0].name, 'Red', 'defaults are copied, not shared');
  assert.equal(normalizeSettings(null).palette[0].name, 'Red');
});

test('normalizeSettings keeps valid data and drops invalid entries', () => {
  const s = normalizeSettings({
    palette: [
      { id: 'a', name: 'A', value: '#111' },
      { id: 'a', name: 'dup', value: '#222' },
      { id: '#x', name: 'hash', value: '#333' },
      { id: 'b', name: 'B', value: 'red; x' },
      { id: 'c', value: '#444', mode: 'both' },
      { id: 'd', name: 'D', value: '#555', mode: 'nope' },
      null,
    ],
    colors: [
      { path: '/Notes/', color: 'a', children: true },
      { path: 'Notes', color: 'c' },
      { path: 'x.md', color: '#abcdef', children: 'yes' },
      { path: '', color: 'a' },
      { path: 3, color: 'a' },
    ],
    applyTo: 'both',
    cascade: true,
    backgroundStrength: 500,
  });
  assert.deepEqual(s.palette, [
    { id: 'a', name: 'A', value: '#111' },
    { id: 'c', name: 'c', value: '#444', mode: 'both' },
    { id: 'd', name: 'D', value: '#555' },
  ]);
  assert.deepEqual(s.colors, [
    { path: 'Notes', color: 'a', children: true },
    { path: 'x.md', color: '#abcdef' },
  ]);
  assert.equal(s.applyTo, 'both');
  assert.equal(s.cascade, true);
  assert.equal(s.backgroundStrength, 100);
  assert.equal(normalizeSettings({ backgroundStrength: 1 }).backgroundStrength, 5);
  assert.equal(normalizeSettings({ backgroundStrength: NaN }).backgroundStrength, 25);
});

test('an empty palette array is respected (the user may delete every color)', () => {
  assert.deepEqual(normalizeSettings({ palette: [] }).palette, []);
});

test('resolveColor: palette ids, custom hex, mode override, dangling refs', () => {
  const palette = [{ id: 'a', name: 'A', value: '#111111' }, { id: 'b', name: 'B', value: '#222', mode: 'background' as const }];
  assert.deepEqual(resolveColor('a', palette, 'text'), { value: '#111111', mode: 'text' });
  assert.deepEqual(resolveColor('b', palette, 'text'), { value: '#222', mode: 'background' });
  assert.deepEqual(resolveColor('#abcdef', palette, 'both'), { value: '#abcdef', mode: 'both' });
  assert.equal(resolveColor('zzz', palette, 'text'), null);
  assert.equal(resolveColor('#xyz', palette, 'text'), null);
});

test('formatPalette and parsePalette round-trip', () => {
  const p = [
    { id: 'a', name: 'Sky', value: '#0af' },
    { id: 'b', name: 'Soft', value: 'rgb(1, 2, 3)', mode: 'background' as const },
  ];
  const text = formatPalette(p);
  assert.equal(text, 'Sky: #0af\nSoft: rgb(1, 2, 3) | background');
  assert.deepEqual(parsePalette(text, p), p);
});

test('parsePalette skips bad lines and tolerates spacing, CRLF and case', () => {
  const out = parsePalette('Good:#123456\r\n\r\nno color here\nBad: nope!\n  Spaced  :  #abc  |  BOTH \n: #fff', []);
  assert.deepEqual(out.map((e) => [e.name, e.value, e.mode]), [['Good', '#123456', undefined], ['Spaced', '#abc', 'both']]);
});

test('parsePalette keeps ids across edits so assigned colors survive', () => {
  const prev = [
    { id: 'red', name: 'Red', value: '#f00' },
    { id: 'green', name: 'Green', value: '#0f0' },
    { id: 'blue', name: 'Blue', value: '#00f' },
  ];
  // Reordered and recolored: same names keep ids.
  let out = parsePalette('Blue: #00a\nRed: #a00', prev);
  assert.deepEqual(out.map((e) => e.id), ['blue', 'red']);
  // Renamed in place: same line keeps the id.
  out = parsePalette('Red: #f00\nLime: #0f0\nBlue: #00f', prev);
  assert.deepEqual(out.map((e) => e.id), ['red', 'green', 'blue']);
  // A new entry gets a fresh id that does not collide with old ones.
  out = parsePalette('Red: #f00\nRed 2: #e00\nGreen: #0f0', prev);
  assert.deepEqual(out.map((e) => e.id), ['red', 'red-2', 'green']);
  // The same name twice does not give the same id twice.
  out = parsePalette('Red: #f00\nRed: #e00', prev);
  assert.equal(new Set(out.map((e) => e.id)).size, 2);
});
