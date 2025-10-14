# Repository Guidelines

## Project Structure & Module Organization
- Front-end entry points live at `index.html`, `styles.css`, and `script.js`; shared media goes under `assets/`. Use `sandbox.html` and `sandbox.js` for experimental flows until they are production-ready.
- Cloud Functions reside in `functions/` with a dedicated `package.json`; deployable code starts at `functions/index.js`.
- Bundled hosting assets are committed under `dist/assets/`. Refresh them only when preparing a release to avoid noisy diffs.
- Firebase routing and emulator wiring are managed through `firebase.json`. Keep path updates synchronized there before deploying.

## Build, Test, and Development Commands
- `cd functions && npm install` installs backend dependencies after cloning or pulling changes touching `functions/`.
- `cd functions && npm run serve` launches the Functions emulator for iterating on `normalizeSig`.
- `firebase emulators:start --only hosting,functions` runs a full local stack; sign in via Firebase CLI beforehand.
- `cd functions && npm run deploy` publishes updated Functions. Use `firebase deploy --only hosting` for front-end-only updates.

## Coding Style & Naming Conventions
- Use 4-space indentation on front-end files and 2-space indentation inside `functions/`.
- Prefer `const`/`let`, camelCase variables, and kebab-case filenames (e.g., `sig-normalizer.js`).
- Keep DOM selectors and data attributes lowercase and descriptive. Reuse existing CSS custom properties instead of duplicating colors.
- Stick to ASCII unless the surrounding file already relies on Unicode glyphs.

## Testing Guidelines
- No automated suite exists yet; manually verify critical flows in both `index.html` and `sandbox.html`.
- When emulators are running, watch terminal logs and run `cd functions && npm run logs` to inspect function output.
- Document reproducible manual test steps in pull requests so reviewers can replay them.

## Commit & Pull Request Guidelines
- Write sentence-style commit subjects that summarise the change (e.g., “Refine medication analysis validation”) and group related edits per commit.
- Pull requests should include context, linked issues, and screenshots or GIFs for UI changes.
- Call out required secrets or configuration steps to help deployers reproduce the environment.

## Security & Configuration Tips
- Manage secrets through Firebase (`firebase functions:secrets:set OPENAI_SIG_API_KEY`); never commit `.env` files.
- Restrict allowed origins inside `functions/index.js` to trusted hosts, and validate any user-supplied text before you send it to external APIs.
