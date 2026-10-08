import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ancestors, clearEntry, getEntry, isInside, removeEntries, renameEntries, setEntry } from '../src/paths.ts';

const E = (path: string, color = 'red', children?: boolean) => (children === undefined ? { path, color } : { path, color, children });

test('isInside matches whole path segments', () => {
  assert.ok(isInside('a/b', 'a'));
  assert.ok(isInside('a', 'a'));
  assert.ok(!isInside('ab', 'a'));
  assert.ok(!isInside('a', 'a/b'));
  assert.ok(!isInside('Notes2/x.md', 'Notes'));
});

test('ancestors lists folders nearest first', () => {
  assert.deepEqual(ancestors('a/b/c.md'), ['a/b', 'a']);
  assert.deepEqual(ancestors('c.md'), []);
  assert.deepEqual(ancestors('a'), []);
});

test('setEntry adds, replaces in place, and never mutates the input', () => {
  const start = [E('a'), E('b', 'blue')];
  const frozen = Object.freeze([...start]);
  const added = setEntry(frozen, 'c.md', 'green');
  assert.deepEqual(added.map((e) => e.path), ['a', 'b', 'c.md']);
  const replaced = setEntry(added, 'b', 'pink', true);
  assert.deepEqual(replaced, [E('a'), E('b', 'pink', true), E('c.md', 'green')]);
  assert.deepEqual(setEntry(replaced, 'b', 'x'), [E('a'), E('b', 'x'), E('c.md', 'green')], 'children flag is not kept unless given');
  assert.deepEqual(setEntry(start, '/a/', 'z'), [E('a', 'z'), E('b', 'blue')], 'slashes are normalized');
  assert.deepEqual(setEntry(start, '', 'z'), start, 'the vault root cannot be colored');
});

test('clearEntry and getEntry', () => {
  const c = [E('a'), E('a/b')];
  assert.deepEqual(clearEntry(c, 'a'), [E('a/b')]);
  assert.deepEqual(clearEntry(c, 'zzz'), c);
  assert.equal(getEntry(c, 'a/b')?.path, 'a/b');
  assert.equal(getEntry(c, 'a/b/c'), undefined);
});

test('rename of a file moves its entry', () => {
  assert.deepEqual(renameEntries([E('a.md'), E('b.md', 'blue')], 'a.md', 'folder/c.md'), [E('b.md', 'blue'), E('folder/c.md')]);
});

test('rename of a folder moves the folder and every child entry, and only those', () => {
  const colors = [E('Notes', 'red', true), E('Notes/x.md', 'blue'), E('Notes/sub/y.md', 'green'), E('Notes2/z.md', 'pink'), E('Notes.md', 'gray')];
  const out = renameEntries(colors, 'Notes', 'Archive/Old');
  assert.deepEqual(out, [E('Notes2/z.md', 'pink'), E('Notes.md', 'gray'), E('Archive/Old', 'red', true), E('Archive/Old/x.md', 'blue'), E('Archive/Old/sub/y.md', 'green')]);
});

test('rename keeps the children flag and returns a copy when nothing matches or paths are equal', () => {
  const colors = [E('a', 'red', false)];
  assert.deepEqual(renameEntries(colors, 'a', 'b'), [E('b', 'red', false)]);
  const same = renameEntries(colors, 'q', 'r');
  assert.deepEqual(same, colors);
  assert.notEqual(same, colors);
  assert.deepEqual(renameEntries(colors, 'a', 'a'), colors);
  assert.equal(colors[0].path, 'a', 'input untouched');
});

test('rename onto an existing colored path replaces the old one', () => {
  assert.deepEqual(renameEntries([E('a.md', 'red'), E('b.md', 'blue')], 'a.md', 'b.md'), [E('b.md', 'red')]);
});

test('rename to a folder with a similar name does not touch lookalikes', () => {
  assert.deepEqual(renameEntries([E('ab/x.md')], 'a', 'z'), [E('ab/x.md')]);
});

test('delete removes the entry and its children but not siblings sharing a prefix', () => {
  const colors = [E('Notes'), E('Notes/x.md'), E('Notes/a/b.md'), E('Notes2'), E('Notes.md'), E('Other/Notes')];
  assert.deepEqual(removeEntries(colors, 'Notes').map((e) => e.path), ['Notes2', 'Notes.md', 'Other/Notes']);
  assert.deepEqual(removeEntries(colors, 'Notes/x.md').length, 5);
});
