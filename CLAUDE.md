# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

ScriptAbility Patient Access Stack is a unified framework showcasing APIs and services for healthcare accessibility. This is a **static web application** (pure HTML/CSS/JS) that serves as a demonstration and sandbox environment for ScriptAbility's pharmacy-focused APIs.

## Architecture

### Deployment Model

This project uses **Firebase** for hosting and backend functions:
- **Frontend**: Static files served via Firebase Hosting
- **Backend**: Firebase Functions (Gen2/Cloud Run) act as a secure proxy for API calls
- The SIG Normalizer API requires a secret key, which is stored in Google Cloud Secret Manager and accessed only by the Firebase Function

### Core Structure

- **index.html** - Main landing page showcasing the application suite, features, and testimonials
- **sandbox.html** - Interactive API testing environment for all services
- **script.js** - Main page functionality (category filtering, modals, app launches, PDF brochure generation)
- **sandbox.js** - Sandbox orchestration and API client implementations
- **styles.css** - Comprehensive styling for both pages
- **functions/index.js** - Firebase Cloud Function that proxies SIG Normalizer requests to OpenAI

### Key Design Patterns

1. **Product Router**: The `PRODUCT_MAP` in script.js:32-38 maps product names to URL-safe identifiers used for deep linking
2. **Sandbox Product Switcher**: sandbox.js uses `data-product` attributes on `.sandbox-grid` sections to show/hide different API testing interfaces
3. **State Persistence**: LocalStorage is used to persist last-used inputs and selected product (see `LS_KEYS` in sandbox.js:2-9)
4. **Modal System**: All modals (app details, search, menu) are dynamically created/destroyed rather than being pre-rendered in HTML

### API Integrations

The sandbox integrates with four external APIs:

1. **SIG Normalizer** (`runSigNormalizer` in sandbox.js:52)
   - Frontend calls Firebase Function: `https://normalizesig-z4vamvc43a-uc.a.run.app` (production) or `http://127.0.0.1:5001/.../normalizeSig` (local)
   - Firebase Function proxies to: `https://api.openai.com/v1/responses`
   - Auth: `OPENAI_SIG_API_KEY` stored in Google Cloud Secret Manager (never exposed to frontend)
   - Normalizes pharmacy instructions (SIGs) using OpenAI with prompt ID `pmpt_68d1aac7137081978a62cfad87ffd3730b5be593908223a0`
   - The function handles CORS and validates origins (sandbox.js:16-18 detects localhost vs production)

2. **NDC Analysis** (`runNdcAnalysis` in sandbox.js:119)
   - Endpoint: `https://ndcanalysis.scriptability.net/ndc_descriptor.php`
   - No auth required
   - Returns pharmaceutical data for NDC codes

3. **Medcast** (`runMedcast` in sandbox.js:158)
   - Endpoint: `https://medcast.scriptability.net/generate_podcast`
   - Generates audio podcasts from medication files, text, and NDC numbers
   - Returns WAV file download as `output.wav`
   - 3-minute timeout, supports up to 10 files (max 5MB each, 10MB total)

4. **Pill Identifier** (`runPillIdentifier` in sandbox.js:273)
   - Endpoint: `https://picanalysis.scriptability.net/analyze`
   - Analyzes medication images against expected medications
   - Requires medication name, 11-digit NDC, and image upload

## Development Workflow

### Running the Application Locally

**Option 1: Local Static Server (API calls will hit production endpoints)**
```bash
# Simple HTTP server (Python 3)
python -m http.server 8000

# Alternative: using Node.js
npx serve .
```
Then navigate to `http://localhost:8000`

**Option 2: Firebase Emulator (recommended for testing SIG Normalizer with local function)**
```bash
# Install dependencies for Firebase Functions first
cd functions && npm install && cd ..

# Start the Firebase emulator (includes hosting + functions)
firebase emulators:start
```
Then navigate to `http://localhost:5000`

### Firebase Deployment

See `DEPLOYMENT.md` for complete Firebase deployment instructions. Key commands:

```bash
# Deploy everything (hosting + functions)
firebase deploy

# Deploy only functions
firebase deploy --only functions

# Deploy only hosting
firebase deploy --only hosting

# Set the OpenAI API key secret (required before first deploy)
firebase functions:secrets:set OPENAI_SIG_API_KEY

# View function logs
firebase functions:log
```

### Environment Configuration

**For Firebase Functions:** The `OPENAI_SIG_API_KEY` is stored securely in Google Cloud Secret Manager, not in `.env` files. Set it using:
```bash
firebase functions:secrets:set OPENAI_SIG_API_KEY
```

**Legacy `.env` approach:** The codebase previously supported loading API keys client-side from a `.env` file, but this has been replaced with the Firebase Function proxy for security.

### Deep Linking to Sandbox

Apps can be launched directly via URL parameter:
```
sandbox.html?product=sig-normalizer
sandbox.html?product=ndc-analysis
sandbox.html?product=medcast
sandbox.html?product=pill-identifier
```

This is handled in `hydrateFromStorage()` at sandbox.js:490-515.

### Input Validation

- **SIG Normalizer**: 200 character limit enforced at sandbox.js:385-399
- **NDC Analysis**: Allows digits and hyphens, max 11 digits (sandbox.js:415-450)
- **Pill Identifier**: Requires exactly 11 digits, removes hyphens automatically (sandbox.js:471-479)
- **Medcast**: File type and size validation at sandbox.js:169-195

## Important Notes

- **Firebase Functions proxy**: SIG Normalizer uses a Firebase Function to keep API keys secure; other APIs are called directly from the browser
- **CORS**: The Firebase Function validates origins (functions/index.js:17-42) to prevent unauthorized use
- **Security**: API keys are stored in Google Cloud Secret Manager, never committed to version control
- **Brochure Generation**: Uses html2pdf.js library loaded from CDN. Falls back to dynamic generation if static PDF at `assets/ScriptAbility-Patient-Access-Stack-Brochure.pdf` is not available (see script.js:106-261)
- **Notification System**: Shared toast notification function `showNotification(message, type)` in script.js:545 is called by sandbox.js via `window.showNotification` (sandbox.js:24-30)
- **Firebase Configuration**: The project ID is `scriptability-patient-access` (see firebase.json and DEPLOYMENT.md)

## Firebase Functions Structure

- **functions/index.js**: Contains the `normalizeSig` Cloud Function (Gen2)
- **functions/package.json**: Specifies Node.js 22 runtime and dependencies (firebase-admin, firebase-functions)
- The function uses `defineSecret()` to access `OPENAI_SIG_API_KEY` from Secret Manager
- CORS is restricted to specific origins for security (localhost for testing, production domains)

## Testing

No formal test suite. Manual testing workflow:

1. Test each API endpoint in sandbox.html
2. Verify category filtering on index.html works
3. Test modal interactions (app launch, search, menu)
4. Verify brochure PDF generation
5. Test deep linking to sandbox with different products
6. Verify LocalStorage persistence of form inputs
7. Test Firebase Function locally using `firebase emulators:start`