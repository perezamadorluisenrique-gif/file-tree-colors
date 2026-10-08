import { App, Modal, Notice, Plugin, PluginSettingTab, Setting, TFolder, debounce } from 'obsidian';
import type { SettingDefinitionItem, TAbstractFile } from 'obsidian';

import { effectiveColor } from './src/cascade.ts';
import {
  DEFAULT_PALETTE,
  MODES,
  formatPalette,
  normalizeSettings,
  parsePalette,
  resolveColor,
  sanitizeColor,
} from './src/colors.ts';
import type { ColorMode, FileTreeColorsSettings } from './src/colors.ts';
import { buildCss } from './src/css.ts';
import { convertFileColor, looksLikeFileColor } from './src/importer.ts';
import { clearEntry, getEntry, removeEntries, renameEntries, setEntry } from './src/paths.ts';

const FILE_COLOR_ID = 'obsidian-file-color';

const MODE_LABELS: Record<ColorMode, string> = {
  text: 'Text',
  background: 'Background',
  both: 'Text and background',
};

/** `undefined` follows the "Color everything inside" setting. */
type ChildrenChoice = 'default' | 'yes' | 'no';

export default class FileTreeColorsPlugin extends Plugin {
  settings: FileTreeColorsSettings = normalizeSettings(null);
  /**
   * One stylesheet per window. A constructed sheet can only be adopted by the
   * document that made it, and the window that is active at load time may be
   * the separate Settings window (where the plugin gets enabled), so the main
   * window and every popout get their own.
   */
  private sheets = new Map<Document, CSSStyleSheet>();

  async onload() {
    this.settings = normalizeSettings(await this.loadData());
    this.adopt(this.app.workspace.containerEl.ownerDocument);
    this.app.workspace.iterateAllLeaves((leaf) => this.adopt(leaf.view.containerEl.ownerDocument));
    this.registerEvent(this.app.workspace.on('window-open', (win) => this.adopt(win.doc)));
    this.registerEvent(this.app.workspace.on('window-close', (win) => this.release(win.doc)));
    this.refresh();

    this.registerEvent(
      this.app.workspace.on('file-menu', (menu, file) => {
        if (file.path === '/') return;
        menu.addItem((item) => item.setTitle('Set color').setIcon('palette').onClick(() => this.pick(file)));
      }),
    );

    this.registerEvent(
      this.app.vault.on('rename', (file, oldPath) => {
        const next = renameEntries(this.settings.colors, oldPath, file.path);
        if (next.length === this.settings.colors.length && next.every((c, i) => c.path === this.settings.colors[i]?.path)) return;
        this.settings.colors = next;
        this.commit();
      }),
    );
    this.registerEvent(
      this.app.vault.on('delete', (file) => {
        const next = removeEntries(this.settings.colors, file.path);
        if (next.length === this.settings.colors.length) return;
        this.settings.colors = next;
        this.commit();
      }),
    );

    this.addCommand({
      id: 'set-color',
      name: 'Set color of the active file',
      icon: 'palette',
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file) return false;
        if (!checking) this.pick(file);
        return true;
      },
    });
    this.addCommand({
      id: 'set-folder-color',
      name: "Set color of the active file's folder",
      icon: 'folder-open',
      checkCallback: (checking) => {
        const folder = this.app.workspace.getActiveFile()?.parent;
        if (!folder || folder.isRoot()) return false;
        if (!checking) this.pick(folder);
        return true;
      },
    });
    this.addCommand({
      id: 'clear-color',
      name: 'Clear color of the active file',
      icon: 'eraser',
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file || !getEntry(this.settings.colors, file.path)) return false;
        if (!checking) this.clear(file.path);
        return true;
      },
    });

    this.addSettingTab(new FileTreeColorsSettingTab(this.app, this));
  }

  onunload() {
    this.saveSoon.run();
    for (const doc of [...this.sheets.keys()]) this.release(doc);
  }

  private adopt(doc: Document) {
    if (this.sheets.has(doc) || !doc.defaultView) return;
    const sheet = new doc.defaultView.CSSStyleSheet();
    sheet.replaceSync(buildCss(this.settings));
    doc.adoptedStyleSheets = [...doc.adoptedStyleSheets, sheet];
    this.sheets.set(doc, sheet);
  }

  private release(doc: Document) {
    const sheet = this.sheets.get(doc);
    if (!sheet) return;
    doc.adoptedStyleSheets = doc.adoptedStyleSheets.filter((s) => s !== sheet);
    this.sheets.delete(doc);
  }

  /** Regenerates the stylesheet of every window from the settings. */
  refresh() {
    const css = buildCss(this.settings);
    for (const sheet of this.sheets.values()) sheet.replaceSync(css);
  }

  private saveSoon = debounce(() => void this.saveData(this.settings), 300, true);

  /** Applies and stores a change. */
  commit() {
    this.refresh();
    this.saveSoon();
  }

  async commitNow() {
    this.refresh();
    await this.saveData(this.settings);
  }

  pick(file: TAbstractFile) {
    new ColorPickerModal(this.app, this, file).open();
  }

  setColor(path: string, color: string, children: ChildrenChoice) {
    const flag = children === 'default' ? undefined : children === 'yes';
    this.settings.colors = setEntry(this.settings.colors, path, color, flag);
    this.commit();
  }

  clear(path: string) {
    this.settings.colors = clearEntry(this.settings.colors, path);
    this.commit();
  }

  /** Reads File Color's data.json from this vault's config folder and merges it in. */
  async importFileColor(): Promise<string> {
    const adapter = this.app.vault.adapter;
    const path = `${this.app.vault.configDir}/plugins/${FILE_COLOR_ID}/data.json`;
    if (!(await adapter.exists(path))) return 'File Color has no saved data in this vault.';
    let raw: unknown;
    try {
      raw = JSON.parse(await adapter.read(path));
    } catch {
      return 'Could not read the data file of File Color.';
    }
    if (!looksLikeFileColor(raw)) return 'The data file of File Color has no colors in it.';
    const result = convertFileColor(raw, this.settings);
    this.settings = result.settings;
    await this.commitNow();
    const skipped = result.skipped ? `, skipped ${result.skipped} that could not be converted` : '';
    return `Imported ${result.colors} colors and ${result.palette} palette entries${skipped}.`;
  }
}

class ColorPickerModal extends Modal {
  constructor(
    app: App,
    private plugin: FileTreeColorsPlugin,
    private file: TAbstractFile,
  ) {
    super(app);
  }

  onOpen() {
    const { contentEl, plugin, file } = this;
    const s = plugin.settings;
    this.setTitle(`Set color: ${file.name}`);
    contentEl.addClass('ftc-picker');
    const own = getEntry(s.colors, file.path);
    const inherited = !own ? effectiveColor(file.path, s) : null;
    if (inherited) contentEl.createEl('p', { cls: 'ftc-note', text: `Inherits its color from ${inherited.entry.path}.` });

    let children: ChildrenChoice = own?.children === undefined ? 'default' : own.children ? 'yes' : 'no';
    if (file instanceof TFolder) {
      new Setting(contentEl)
        .setName('Color everything inside')
        .setDesc(`Follows the setting (${s.cascade ? 'on' : 'off'}) unless you choose.`)
        .addDropdown((d) =>
          d
            .addOptions({ default: 'Follow the setting', yes: 'Yes', no: 'No' })
            .setValue(children)
            .onChange((v) => (children = v as ChildrenChoice)),
        );
    }

    const apply = (color: string) => {
      plugin.setColor(file.path, color, file instanceof TFolder ? children : 'default');
      this.close();
    };

    const grid = contentEl.createDiv({ cls: 'ftc-swatches' });
    for (const entry of s.palette) {
      if (!resolveColor(entry.id, s.palette, s.applyTo)) continue;
      const b = grid.createEl('button', { cls: 'ftc-swatch', attr: { type: 'button', 'aria-label': entry.name, title: entry.name } });
      b.setCssProps({ '--ftc-swatch': entry.value });
      if (own?.color === entry.id) b.addClass('is-current');
      b.addEventListener('click', () => apply(entry.id));
    }
    if (!s.palette.length) contentEl.createEl('p', { cls: 'ftc-note', text: 'The palette is empty. Add colors in the settings, or pick a custom color.' });

    let custom = own && own.color.startsWith('#') ? own.color : '#3e63dd';
    if (custom.length !== 7) custom = '#3e63dd';
    new Setting(contentEl)
      .setName('Custom color')
      .addColorPicker((c) => c.setValue(custom).onChange((v) => (custom = v)))
      .addButton((b) => b.setButtonText('Use').setCta().onClick(() => sanitizeColor(custom) && apply(custom)));

    if (own) {
      new Setting(contentEl).addButton((b) => {
        b.setButtonText('Clear color').onClick(() => {
          plugin.clear(file.path);
          this.close();
        });
        b.buttonEl.addClass('mod-warning');
      });
    }
  }

  onClose() {
    this.contentEl.empty();
  }
}

const TEXT = {
  applyTo: { name: 'Apply color to', desc: 'The text of the item, its background, or both. A palette entry can override this with "| text", "| background" or "| both".' },
  strength: { name: 'Background strength', desc: 'How strong the background tint is, in percent. The tint is translucent so it works in light and dark themes.' },
  cascade: { name: 'Color everything inside folders', desc: 'A colored folder also colors the files and folders inside it, unless they have a color of their own. Each folder can override this when you set its color.' },
  palette: { name: 'Palette', desc: 'One color per line: Name: #hex. Optionally add | text, | background or | both. Renaming a color keeps the items that use it.' },
  reset: { name: 'Reset the palette', desc: 'Restore the default colors. Items using a color that is not in the palette stop being colored until you add it back.' },
  import: { name: 'Import from File Color', desc: "Reads the palette and colors saved by File Color in this vault and adds them here. Run it once; running it again does no harm." },
};

class FileTreeColorsSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private plugin: FileTreeColorsPlugin,
  ) {
    super(app, plugin);
  }

  getSettingDefinitions(): SettingDefinitionItem[] {
    return [
      {
        type: 'group',
        heading: 'Appearance',
        items: [
          { ...TEXT.applyTo, control: { type: 'dropdown', key: 'applyTo', options: MODE_LABELS, defaultValue: 'text' } },
          { ...TEXT.strength, control: { type: 'slider', key: 'backgroundStrength', min: 5, max: 100, step: 5, defaultValue: 25 } },
          { ...TEXT.cascade, control: { type: 'toggle', key: 'cascade', defaultValue: false } },
        ],
      },
      {
        type: 'group',
        heading: 'Palette',
        items: [
          { ...TEXT.palette, control: { type: 'textarea', key: 'palette', rows: 9, defaultValue: '' } },
          { ...TEXT.reset, action: () => void this.resetPalette() },
        ],
      },
      {
        type: 'group',
        heading: 'Migration',
        items: [{ ...TEXT.import, action: () => void this.runImport() }],
      },
    ];
  }

  getControlValue(key: string): unknown {
    if (key === 'palette') return formatPalette(this.plugin.settings.palette);
    return (this.plugin.settings as unknown as Record<string, unknown>)[key];
  }

  setControlValue(key: string, value: unknown): void {
    const s = this.plugin.settings;
    if (key === 'palette') s.palette = parsePalette(String(value), s.palette);
    else Object.assign(s, { [key]: value });
    this.plugin.commit();
  }

  private async resetPalette() {
    this.plugin.settings.palette = DEFAULT_PALETTE.map((p) => ({ ...p }));
    await this.plugin.commitNow();
    this.redraw();
  }

  private async runImport() {
    new Notice(await this.plugin.importFileColor());
    this.redraw();
  }

  private redraw() {
    if (this.legacy) {
      this.draw();
      return;
    }
    // Obsidian 1.13's re-render of the declarative definitions, looked up because older versions lack it.
    (this as unknown as { update?: () => void }).update?.();
  }

  private legacy = false;

  /** The pre-1.13 rendering. Obsidian skips it once `getSettingDefinitions()` returns anything. */
  display(): void {
    this.legacy = true;
    this.draw();
  }

  private draw() {
    const { containerEl } = this;
    const s = this.plugin.settings;
    containerEl.empty();
    new Setting(containerEl).setName('Appearance').setHeading();
    new Setting(containerEl)
      .setName(TEXT.applyTo.name)
      .setDesc(TEXT.applyTo.desc)
      .addDropdown((d) =>
        d
          .addOptions(MODE_LABELS)
          .setValue(s.applyTo)
          .onChange((v) => this.setControlValue('applyTo', MODES.includes(v as ColorMode) ? v : 'text')),
      );
    new Setting(containerEl)
      .setName(TEXT.strength.name)
      .setDesc(TEXT.strength.desc)
      .addSlider((sl) => sl.setLimits(5, 100, 5).setValue(s.backgroundStrength).onChange((v) => this.setControlValue('backgroundStrength', v)));
    new Setting(containerEl)
      .setName(TEXT.cascade.name)
      .setDesc(TEXT.cascade.desc)
      .addToggle((t) => t.setValue(s.cascade).onChange((v) => this.setControlValue('cascade', v)));
    new Setting(containerEl).setName('Palette').setHeading();
    new Setting(containerEl)
      .setName(TEXT.palette.name)
      .setDesc(TEXT.palette.desc)
      .addTextArea((t) => {
        t.setValue(formatPalette(s.palette)).onChange((v) => this.setControlValue('palette', v));
        t.inputEl.rows = 9;
      });
    new Setting(containerEl)
      .setName(TEXT.reset.name)
      .setDesc(TEXT.reset.desc)
      .addButton((b) => b.setButtonText('Reset').onClick(() => void this.resetPalette()));
    new Setting(containerEl).setName('Migration').setHeading();
    new Setting(containerEl)
      .setName(TEXT.import.name)
      .setDesc(TEXT.import.desc)
      .addButton((b) => b.setButtonText('Import').onClick(() => void this.runImport()));
  }
}

