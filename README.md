# File Tree Colors

Color files and folders in the file explorer, with a palette, cascading to children, and import from File Color.

## What it does

Right-click any file or folder in the file explorer and choose **Set color**. Pick a color from your palette or any custom color, and the item is tinted in the explorer: its text, its background, or both, plus the folder arrow. Colors follow files when you rename or move them, and disappear when you delete them.

It is the successor to [File Color](https://github.com/ecustic/obsidian-file-color), which has not been updated in almost three years. You can bring your colors over in one click (see below).

- **Palette** of named colors that you edit as plain text, plus a custom color picker for one-offs.
- **Text, background or both**, globally, and per palette entry. Backgrounds are a translucent tint, so they look right in light and dark themes.
- **Color everything inside a folder**, globally or per folder, with the nearest colored folder winning and any item's own color always winning.
- **Commands** to set or clear the color of the active file, or of its folder, from the command palette or a hotkey.
- **Light on the app:** colors are written as a single stylesheet that the plugin adds on load and removes on unload. Nothing is set on individual rows and nothing is touched in your notes.
- **Works on mobile** (long-press a file, then Set color).

## Usage

1. In the file explorer, right-click (or long-press) a file or folder and choose **Set color**.
2. Click a swatch, or choose a custom color and press **Use**. For a folder you can also decide whether its color reaches the files and folders inside it.
3. To remove a color, open **Set color** again and press **Clear color**, or run the command **Clear color of the active file**.

Commands:

| Command | What it does |
| --- | --- |
| Set color of the active file | Opens the picker for the file in the active tab |
| Set color of the active file's folder | Opens the picker for the folder that holds it |
| Clear color of the active file | Removes the file's own color |

## Import from File Color

If you used File Color, open **Settings -> File Tree Colors -> Migration** and press **Import from File Color**. The plugin reads File Color's saved data from your vault's `plugins/obsidian-file-color/data.json` (inside your configuration folder) and adds its palette and the color of every file and folder. Colors with the same name and value are reused, and File Color's "color the background" and "cascade" switches become the matching settings here. Running it again changes nothing. Entries that point at a color File Color no longer has are skipped, and the notice tells you how many.

File Color does not need to be enabled for this, only installed once. Turn it off when you are done so the two plugins do not both color the explorer.

## Settings

| Setting | What it does |
| --- | --- |
| Apply color to | Text, background, or both. |
| Background strength | How strong the background tint is (5 to 100 percent). |
| Color everything inside folders | Colored folders also color what is inside them, unless it has a color of its own. Each folder can override this in the picker. |
| Palette | One color per line as `Name: #hex`. Add `| text`, `| background` or `| both` to override where that color applies. Renaming a color keeps the items that use it. |
| Reset the palette | Restores the default colors. |
| Import from File Color | See above. |

## Privacy

File Tree Colors makes no network requests and collects nothing. Your colors are stored in the plugin's `data.json` inside your vault, as file paths and color names.

## Installation

In Obsidian, open **Settings -> Community plugins -> Browse** and search for "File Tree Colors".

## More plugins by Siulved54

| Plugin | What it does | Source |
| --- | --- | --- |
| [Shared Blocks](https://obsidian.md/plugins?id=shared-blocks) | Write a block of text once and reuse it in any note. Edit the source and every reference re-renders live. | [shared-blocks](https://github.com/perezamadorluisenrique-gif/shared-blocks) |
| [Text Case and Cleanup](https://obsidian.md/plugins?id=text-format) | Change case, make camelCase or slugs, sort lines and remove duplicates, and repair text pasted out of a PDF, without touching code or URLs. | [text-format](https://github.com/perezamadorluisenrique-gif/text-format) |
| [Typography as You Type](https://obsidian.md/plugins?id=typography-as-you-type) | Curly quotes, dashes and ellipses as you type, kept out of code and maths, with Backspace to take one back. | [smart-typography-plugin](https://github.com/perezamadorluisenrique-gif/smart-typography-plugin) |
| [Section Numbering](https://obsidian.md/plugins?id=section-numbering) | Number headings as an outline (1, 1.1, 1.2) and keep every link to them working when they renumber. | [section-numbering](https://github.com/perezamadorluisenrique-gif/section-numbering) |
| [Spreadsheet to Table](https://obsidian.md/plugins?id=spreadsheet-to-table) | Paste cells from Excel or Google Sheets as a Markdown table with a real header, insert CSV files, and copy tables back out. | [spreadsheet-to-table](https://github.com/perezamadorluisenrique-gif/spreadsheet-to-table) |
| [Hybrid Line Numbers](https://obsidian.md/plugins?id=hybrid-line-numbers) | Relative and hybrid line numbers for Vim-style jumps, where a folded section counts as one line. | [hybrid-line-numbers](https://github.com/perezamadorluisenrique-gif/hybrid-line-numbers) |
| [List Item Callouts](https://obsidian.md/plugins?id=list-item-callouts) | Colour a single list item as a callout by starting it with a character such as `&`, `!` or `?`. | [list-item-callouts](https://github.com/perezamadorluisenrique-gif/list-item-callouts) |
| [Folder Counts](https://obsidian.md/plugins?id=folder-counts) | See how many notes or files each folder holds, right in the file explorer, with a vault total and folder exclusions. | [folder-counts](https://github.com/perezamadorluisenrique-gif/folder-counts) |
| [Note Reading Time](https://obsidian.md/plugins?id=note-reading-time) | Reading time of the current note or your selection in the status bar, optionally saved to a property. | [note-reading-time](https://github.com/perezamadorluisenrique-gif/note-reading-time) |
| [Task Rollover](https://obsidian.md/plugins?id=task-rollover) | Roll unfinished tasks from your last daily note into today's when it is created, with a real undo. | [task-rollover](https://github.com/perezamadorluisenrique-gif/task-rollover) |
| [Zoom Into Section](https://obsidian.md/plugins?id=zoom-into-section) | Zoom into a heading or list item to see only it and its contents, with a breadcrumb bar to climb back out. | [zoom-into-section](https://github.com/perezamadorluisenrique-gif/zoom-into-section) |
| [Link Title on Paste](https://obsidian.md/plugins?id=link-title-on-paste) | Paste a web address and get a Markdown link with the page's title, fetched in the background and undone in one step. | [link-title-on-paste](https://github.com/perezamadorluisenrique-gif/link-title-on-paste) |
| [Update Radar](https://obsidian.md/plugins?id=update-radar) | Checks your installed community plugins for updates in the background, shows what changed, and flags the ones that look abandoned. | [community-update-checker](https://github.com/perezamadorluisenrique-gif/community-update-checker) |
| [Dataview to Bases](https://obsidian.md/plugins?id=dataview-to-bases) | Convert Dataview queries into Bases blocks, and see which queries in your vault can be converted. | [dataview-to-bases](https://github.com/perezamadorluisenrique-gif/dataview-to-bases) |
| [Line Editing Commands](https://obsidian.md/plugins?id=line-editing-commands) | Duplicate, join, sort and reverse lines, insert blank lines and jump to a line number, with multi-cursor support. | [line-editing-commands](https://github.com/perezamadorluisenrique-gif/line-editing-commands) |
| [Note Mover Rules](https://obsidian.md/plugins?id=note-mover-rules) | Move notes into folders by ordered rules on tags, properties, titles and paths, with a preview before any bulk move. | [note-mover-rules](https://github.com/perezamadorluisenrique-gif/note-mover-rules) |
| [Tab History](https://obsidian.md/plugins?id=tab-history) | Keeps each tab's back and forward history across restarts, and adds commands to move, maximize and close tabs. | [tab-history](https://github.com/perezamadorluisenrique-gif/tab-history) |
| [URL Cards](https://obsidian.md/plugins?id=url-cards) | Shows web addresses as cards with title, description and image, and reads existing cardlink blocks. | [url-cards](https://github.com/perezamadorluisenrique-gif/url-cards) |
| [Vim Config](https://obsidian.md/plugins?id=vim-config) | Loads a vimrc-style file from your vault so your key mappings and editor commands are ready when vim mode starts. | [vim-config](https://github.com/perezamadorluisenrique-gif/vim-config) |
| [Task Archive](https://obsidian.md/plugins?id=task-archive) | Moves completed tasks, with their sub-items, into an archive section or note. | [task-archive](https://github.com/perezamadorluisenrique-gif/task-archive) |

All of them are in the community directory: Settings -> Community plugins ->
Browse, then search for the name.
