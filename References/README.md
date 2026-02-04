# RPR Schema Editor

This is a static web app (HTML + JS) that reads the immutable table definitions from `schema-structure.json` and the editable data from `schema-data.json`. Because browsers block `fetch` from the filesystem, you must open it via a web server.

## Easiest: double‑click the launcher (Windows)

1. In this folder, double‑click `start_server.bat`.
2. Your default browser opens to:
   - http://localhost:8000/index.html (main data editor)
   - http://localhost:8000/schema_editor/index.html (schema meta editor)
3. When done, close the terminal window to stop the server.

## Share a link (free hosting)

### GitHub Pages
1. Create a new GitHub repo (public or private with Pages for private repos if available).
2. Add these files at the repo root:
   - `index.html`, `schema-structure.json`, `schema-data.json`, and any other assets (e.g., `rpr_example.csv`).
3. Commit and push.
4. In the repo: Settings → Pages → Build and deployment: “Deploy from a branch”.
5. Select `main` (or `master`) and the `/ (root)` folder. Save.
6. After a minute, your site is live at:
   - https://<your_user>.github.io/<your_repo>/index.html

Note: The app loads `schema-structure.json` and `schema-data.json` with relative paths, so it works on Pages without changes.

### Schema meta editor (structure only)
Use `schema_editor/index.html` to modify the immutable structure (columns, labels, tooltips, categories, layout metadata). This editor now:

1. Loads the canonical `../schema-structure.json` by default.
2. Lets you edit top-level metadata: `version`, `categories` (comma‑separated), and multi‑line `notes`.
3. Preserves per‑column indexes and UI config (displayOrder, hidden, hiddenByTab, span, rows, scale, skipLineBefore, bonusBuilderPlacement).
4. Exports a normalized file as `schema-structure.json`.

Workflow:
- Open: http://localhost:8000/schema_editor/index.html
- If the structure fails to auto‑load, use “Upload schema-structure.json”.
- After edits, click “Download schema-structure.json”.
- Clear read-only, replace, then re‑protect:

```powershell
attrib -R schema-structure.json
move /Y .\schema-structure.json .\schema-structure.json.bak
copy /Y .\Downloads\schema-structure.json .\schema-structure.json
attrib +R schema-structure.json
```

(Adjust the `Downloads` path to wherever the browser saved your export.)

GitHub Pages URL pattern: `https://<your_user>.github.io/<your_repo>/schema_editor/index.html`

#### Direct Save (optional)
The schema editor supports experimental direct saving with the File System Access API (Chromium/Edge on localhost or secure origins):

1. Click “Connect File…” and select your existing `schema-structure.json`.
2. Make changes (columns, UI metadata, categories, notes, version).
3. Click “Save” to overwrite in place or “Save As…” to choose a new location.
4. If Windows blocks write due to the read-only attribute:

```powershell
attrib -R schema-structure.json
```

Retry the save; re-apply protection afterward:

```powershell
attrib +R schema-structure.json
```

Limitations:
- Not available in Firefox/Safari (use Download instead).
- Prompts for permission; if denied, use the Download button.
- Keep backups in `archive/` before large refactors.

### Netlify (drag‑and‑drop)
1. Go to https://app.netlify.com/drop
2. Drag this folder (containing `index.html`, `schema-structure.json`, and `schema-data.json`).
3. Netlify gives you a URL like `https://<random>.netlify.app/index.html`.

## Optional: run in PowerShell
If you prefer PowerShell instead of the `.bat` file, run:

```powershell
cd d:\Z_Parser
Start-Process "http://localhost:8000/index.html"; python -m http.server 8000
```

## Troubleshooting
- If the page says it can’t load `schema-structure.json`, you likely opened `index.html` directly. Use the launcher or host it.
- If port 8000 is in use, edit `start_server.bat` and change `8000` to another free port; then use that port in the browser URL.
- Chrome not opening? Copy/paste the URL manually: `http://localhost:8000/index.html`.
 - If the schema editor shows an error, ensure `schema-structure.json` exists at repo root or upload manually.
 - Direct Save missing or failing? Your browser may not support File System Access, or the file is read-only. Use Download or clear read-only with `attrib -R`.
 - Dark mode styles not applying? Hard reload (Ctrl+F5) to refresh embedded CSS.
