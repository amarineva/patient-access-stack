# Repository Guidelines

## Project Structure & Module Organization
Front-end sources live at `index.html`, `styles.css`, and `script.js`, with shared media under `assets/`. Use `sandbox.html` and `sandbox.js` for experiments; keep unfinished flows there until promoted. Production bundles are checked into `dist/assets/`—only refresh them when a release is ready. Backend automation sits in `functions/` (Node 22) with its own `package.json`; Cloud Functions deploy from `functions/index.js`. Hosting and function routing are coordinated through `firebase.json`.

## Build, Test, and Development Commands
- `cd functions && npm install`: install function dependencies after cloning or pulling backend changes.
- `cd functions && npm run serve`: launch the functions emulator while iterating on `normalizeSig`.
- `firebase emulators:start --only hosting,functions`: run an end-to-end local stack; requires Firebase CLI login.
- `cd functions && npm run deploy`: deploy updated Cloud Functions.
- `firebase deploy --only hosting`: publish front-end updates after assets change.

## Coding Style & Naming Conventions
Use 4-space indentation in front-end scripts and 2-space indentation inside Cloud Functions. Prefer `const`/`let`, camelCase for variables, and kebab-case file names (e.g., `sig-normalizer`). Keep DOM selectors and data attributes lowercase and descriptive. Reuse CSS custom properties instead of duplicating colors. Commit only ASCII content unless extending existing Unicode.

## Testing Guidelines
No automated suite exists yet. Manually exercise critical flows in both `index.html` and `sandbox.html`, covering SIG Normalizer and Pill Identifier launches. When emulators run, monitor terminal output plus Firebase logs via `npm run logs`. Document reproducible test steps in PRs so reviewers can replay them.

## Commit & Pull Request Guidelines
Write sentence-style commit subjects that summarize the change (e.g., “Refine medication analysis validation”). Group related edits per commit. PRs should include context, linked issues, and screenshots or GIFs for UI changes. Call out any required secrets or config steps to help deployers reproduce the environment.

## Security & Configuration Tips
Store secrets with Firebase (`firebase functions:secrets:set OPENAI_SIG_API_KEY`) and avoid committing `.env` files. Restrict allowed origins in `functions/index.js` to vetted hosts. Validate user-provided text before sending it to external APIs, and favor reusable utilities instead of inline fetch logic when expanding backend features.

