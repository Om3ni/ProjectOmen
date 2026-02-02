# RPR Data Editor - User Guide

## Overview

The RPR Data Editor is a desktop application for creating and editing game data files for Project Omen. It provides a structured interface for managing attributes, skills, perks, stats, runes, abilities, mutators, and status effects.

## File Format

The editor works with `.txt` files containing pipe-delimited data (`|`). This is the format the game expects and can read.

**Important:** The editor automatically maintains the correct table order expected by the game:
1. SkillDef (Attributes and Skills)
2. PerkDef (with PerkAction children)
3. RuneDef (with RuneCondition and RuneAction children)
4. Stat
5. SpellDef (Abilities with children)
6. MutatorDef (with children)
7. StatusDef (with children)

## Getting Started

### Creating a New File

**File → New File**

Creates a blank data file. You can immediately start adding records in any category.

### Loading an Existing File

**File → Load File**

Opens a file dialog to select an existing `.txt` or `.json` file. The editor automatically detects the format:
- `.txt` files: Raw pipe-delimited format (game format)
- `.json` files: Internal JSON format (for compatibility)

### Saving Your Work

**File → Save File**

Saves your data in `.txt` format (pipe-delimited). The editor ensures:
- Records are exported in the correct order for the game
- Parent records appear with their children grouped together
- All data maintains proper formatting

**Auto-save:** Your work is automatically saved to browser storage every few seconds. If the app closes unexpectedly, your data will be restored on next launch.

## Navigation

### Category Tabs

Switch between different data categories using the tabs at the top:
- **Attributes** - Character attributes (Strength, Dexterity, etc.)
- **Skills** - Character skills (Acrobatics, Perception, etc.)
- **Perks** - Perks, races, classes, and bonuses
- **Stats** - Game statistics (Health, Mana, etc.)
- **Runes** - Equipment and items
- **Abilities** - Spells and abilities
- **Statuses** - Status effects
- **Mutators** - Combat and game state modifiers

### Record List

The left sidebar shows all records in the current category. Click any record to select and edit it.

**Search:** Use the search box at the top of the sidebar to filter records by name or ID.

## Editing Records

### Basic Editing

1. Select a record from the sidebar
2. Edit fields in the main editor panel
3. Changes are saved automatically as you type

### Field Types

- **Text fields** - Enter any text
- **Number fields** - Enter numeric values (integers or decimals)
- **Dropdown/Select** - Choose from predefined options
- **Checkbox** - Toggle true/false values
- **Formula fields** - Enter game formulas (e.g., `1*1.0`, `{c.Strength} + 5`)

### Adding Records

Click the **+ Add [Type]** button at the bottom of the record list to create a new record.

**Auto-naming:** New records are automatically named (e.g., "Skill 15", "Perk 23"). You can change these names immediately after creation.

### Deleting Records

Select the record and click **Delete [Type]** at the bottom of the editor panel.

**Warning:** Deletion is permanent and cannot be undone.

## Child Records

Some record types have child records that define detailed behavior:

- **PerkDef** → PerkAction (perk effects)
- **RuneDef** → RuneCondition, RuneAction (item conditions and effects)
- **SpellDef** → SpellReqDef, SpellTargetCond, SpellEffect (ability requirements, targeting, and effects)
- **MutatorDef** → MutatorCondition, MutatorAction (mutator conditions and actions)
- **StatusDef** → StatusAction (status effect actions)

### Managing Child Records

Child records appear in collapsible sections within the parent record editor:

1. Click **[+]** or **[-]** to expand/collapse the child section
2. Click **+ Add [Child Type]** to create a new child record
3. Edit child records inline or click **Edit** for detailed editing
4. Click **Delete** on a child row to remove it

**Automatic Linking:** Child records are automatically linked to their parent by ID.

## Raw Editor

The Raw Editor provides direct access to the underlying pipe-delimited data format.

### Opening Raw Editor

**Edit → Import from Raw...**

Opens the raw editor modal showing all data or the current category.

### Raw Editor Features

#### Grid View
- Edit data directly in a spreadsheet-like grid
- Click any cell to edit
- Use Tab to move between cells
- Changes update in real-time

#### Copy Data
Click **Copy** to copy the raw data to clipboard in the correct game format. You can paste this directly into game files or share it.

**Important:** Copy always uses the correct table order, even if you've been editing in the raw grid.

#### Paste Data
Click **Paste** to show the paste panel where you can paste raw pipe-delimited data from:
- Game exports
- Other editors
- Shared data

The editor will automatically parse and import the data.

#### Find and Replace
Use the Find & Replace toolbar to:
- Search for text across all cells
- Navigate between matches with ◀ ▶ buttons
- Replace individual matches or all at once
- Case-insensitive search

#### Sequence IDs
Click **Seq IDs** to automatically renumber the ID column in sequence. Useful after adding/removing rows.

#### Category Switching
Use the dropdown to switch between viewing:
- Current category only
- All data

### Applying Changes

After editing in the raw editor:
1. Click **Apply to [Category]** or **Apply All** to update the main data
2. Click **Close** to exit without applying changes

## Special Features

### Formulas

Many numeric fields support formulas that reference character stats:

**Examples:**
- `{c.Strength} * 2` - Twice the character's Strength
- `1d20 + {c.Dexterity}` - D20 roll plus Dexterity
- `5 * 1.0` - Simple multiplication

**Attribute References:**
- `{c.AttributeName}` - References any attribute or stat
- Attribute names: Strength, Dexterity, Constitution, Intelligence, Wisdom, Charisma, Willpower

### Type Flags

SkillDef records have a TypeFlag field:
- `t` (true) - Marks the skill as an Attribute
- `f` (false) - Marks the skill as a regular skill

This determines how the skill appears in the game.

### Record Order

The editor automatically maintains proper record order for game compatibility:
- New parent records are added at the end of their table section
- New child records are placed immediately after their parent
- Export always uses the canonical order

You don't need to worry about ordering - the editor handles it automatically.

## Desktop App Features

### Native Menus

Access all functions through native menus:
- **File** - New, Open, Save
- **Edit** - Raw import
- **Tools** - Additional utilities
- **Help** - Documentation

### File Dialogs

Use native file dialogs for opening and saving files. The app remembers your last-used directory.

### Character Sheet

**View → Character Sheet** (if available)

Opens a separate window showing a live preview of character data. Updates automatically as you edit.

## Tips and Best Practices

### Working with Large Files

- Use the search box to quickly find specific records
- Use the Raw Editor's Find feature to locate specific values
- Work on one category at a time to reduce cognitive load

### Avoiding Errors

- **Always save before making major changes** - Use File → Save frequently
- **Test in small increments** - Add a few records, save, test in game, repeat
- **Validate formulas** - Test formula fields with different character stats
- **Check IDs** - Ensure child records reference valid parent IDs

### Organizing Data

- Use consistent naming conventions (e.g., all race names capitalized)
- Group related perks/abilities together by ID range
- Use separator records (with names like "=====Section=====") to organize categories
- Comment fields with descriptions for complex formulas

### Sharing Data

1. Use **Copy** in the Raw Editor to export specific categories
2. Share the raw text with others
3. They can use **Paste** to import into their editor
4. Ensure IDs don't conflict with their existing data

### Backup Strategy

- Save multiple versions: `schema-data-v1.txt`, `schema-data-v2.txt`, etc.
- Export before major changes
- Keep working copies separate from production files
- Use version control (Git) if you're comfortable with it

## Keyboard Shortcuts

### Navigation
- **Tab** - Next field
- **Shift+Tab** - Previous field
- **Enter** - Save and move to next field (in forms)

### Raw Editor
- **Tab** - Next cell
- **Shift+Tab** - Previous cell
- **Enter** - Edit current cell
- **Escape** - Cancel cell edit

## Troubleshooting

### "Schema not loaded" Error

The app couldn't load the schema files. Ensure:
- `schema-structure.json` exists in the app folder
- The file is valid JSON
- You have read permissions

### Data Not Saving

- Check file permissions on the save location
- Ensure you have write access to the directory
- Try saving to a different location

### Records Not Appearing in Game

- Verify the file is saved in the correct game data folder
- Check that the file format is `.txt` (not `.json`)
- Ensure IDs don't conflict with existing game data
- Review the game console/logs for parse errors

### Child Records Missing Parent

If child records show no parent:
- Verify the parent ID exists in the parent table
- Check that the foreign key field (e.g., PerkID) matches the parent's ID
- Re-link by editing the child record's foreign key field

### Performance Issues

If the editor becomes slow:
- Reduce the number of open categories
- Close the Raw Editor when not in use
- Restart the app to clear memory
- Consider splitting large files into smaller sections

## Advanced Usage

### Custom Categories

The editor loads categories from `schema-structure.json`. To add custom categories:
1. Edit `schema-structure.json`
2. Add your table definition
3. Restart the app

### Batch Editing

Use the Raw Editor for bulk operations:
1. Open Raw Editor for the category
2. Use Find & Replace to update multiple records
3. Use Seq IDs to renumber after deletions
4. Apply changes

### Importing Game Data

To import existing game data:
1. File → Load File
2. Select the game's data file (`.txt` format)
3. The editor imports all records
4. Save as a new file to avoid overwriting

## Support

For issues, suggestions, or questions:
- Check the game's documentation
- Review the schema files for field definitions
- Test changes in a development environment first
- Keep backups before making major changes

---

**Version:** 1.0  
**Last Updated:** February 2026
