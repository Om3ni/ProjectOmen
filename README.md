# RPR Parser Editor

This is a Vite + React + TypeScript editor for `schema-data.json`, driven by `schema-structure.json`.

## UI layout modularity

The canonical schema structure is loaded from `public/schema-structure.json`.

To avoid putting large, page/tab-specific UI layout data into the core schema file, the app also optionally loads `public/schema-ui.json` and merges any per-table `ui` overrides on top of the base schema at runtime.

- If `schema-ui.json` is missing, the app works normally.
- This is where you can move things like `ui.layoutGrid`, `ui.layoutGridScoped`, `ui.hiddenByTab`, etc.

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is enabled on this template. See [this documentation](https://react.dev/learn/react-compiler) for more information.

Note: This will impact Vite dev & build performances.

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

## Desktop builds and code signing

This project uses Electron + `electron-builder` for the desktop app (see the `electron/` folder and the `build` section in `package.json`).

To build a distributable Windows installer:

- Run `npm run dist` from the `Project Omen` folder (project root).

To have the installer and executable be **code-signed** (reducing “unknown publisher” warnings on other machines), you need a Windows code-signing certificate and must provide it via environment variables before building:

1. Obtain a code-signing certificate from a trusted CA and export it as a `.pfx` file.
2. In PowerShell, set:

   ```powershell
   $env:CSC_LINK=\"C:\\path\\to\\your-cert.pfx\"
   $env:CSC_KEY_PASSWORD=\"your_pfx_password\"
   npm run dist
   ```

`electron-builder` will pick these up automatically and sign the generated app and installer. SmartScreen warnings may still appear for a while until the signed binary gains enough reputation from real-world usage.
