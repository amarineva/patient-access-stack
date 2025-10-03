# Repository Guidelines

## Project Structure & Module Organization
Front-end assets live at `index.html`, `styles.css`, and `script.js`, with supporting media in `assets/`. Production-ready bundles are checked into `dist/assets/`; update them only when a release is imminent. Use `sandbox.html` and `sandbox.js` for experimental flows and keep unfinished work isolated there. Backend automation resides in `functions/` (Node 22) alongside its own `package.json`; `firebase.json` ties hosting and Cloud Functions together.

## Build, Test, and Development Commands
Install Firebase function deps with `cd functions && npm install`. Run the functions emulator via `npm run serve` from the same folder when iterating on `normalizeSig`. For an end-to-end local check, use `firebase emulators:start --only hosting,functions` at the repo root (requires logged-in Firebase CLI). Deploy updated functions with `npm run deploy`; follow with `firebase deploy --only hosting` if front-end files changed.

## Coding Style & Naming Conventions
Match existing indentation: 4 spaces in front-end scripts, 2 spaces inside Cloud Functions. Favor `const`/`let`, camelCase for JS variables, and kebab-case for file names (e.g., `sig-normalizer`). Keep DOM selectors and data attributes descriptive and lowercase. When touching CSS, group related rules and reuse custom properties instead of duplicating color tokens.

## Testing Guidelines
There is no automated test suite yet—perform manual checks in `sandbox.html` and the main `index.html`. Exercise critical launches (SIG Normalizer, Pill Identifier) after every change. While running emulators, watch terminal output and the Firebase logs (`npm run logs`) for errors. Document reproducible manual test steps in your PR description to aid reviewers.

## Commit & Pull Request Guidelines
Use clear, sentence-style commit subjects that summarize the change (“Refine medication analysis validation”). Group related edits into a single commit to keep history readable. PRs should include context, screenshots or GIFs for UI updates, and links to tracked issues. Call out required secrets or config steps so deployers can replicate the setup.

## Security & Configuration Tips
Store secrets with Firebase (`firebase functions:secrets:set OPENAI_SIG_API_KEY`) and never commit `.env` files. Restrict new origins in `functions/index.js` to vetted hosts. Validate user-provided text before passing it to external APIs, and prefer parameterized utilities over inline fetch logic when expanding backend features.
