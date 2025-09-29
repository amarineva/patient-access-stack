# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

ScriptAbility Patient Access Stack is a unified framework showcasing APIs and services for healthcare accessibility. This is a **static web application** (pure HTML/CSS/JS) that serves as a demonstration and sandbox environment for ScriptAbility's pharmacy-focused APIs.

## Architecture

### Core Structure

- **index.html** - Main landing page showcasing the application suite, features, and testimonials
- **sandbox.html** - Interactive API testing environment for all services
- **script.js** - Main page functionality (category filtering, modals, app launches, PDF brochure generation)
- **sandbox.js** - Sandbox orchestration and API client implementations
- **styles.css** - Comprehensive styling for both pages

### Key Design Patterns

1. **Product Router**: The `PRODUCT_MAP` in script.js:32-38 maps product names to URL-safe identifiers used for deep linking
2. **Sandbox Product Switcher**: sandbox.js uses `data-product` attributes on `.sandbox-grid` sections to show/hide different API testing interfaces
3. **State Persistence**: LocalStorage is used to persist last-used inputs and selected product (see `LS_KEYS` in sandbox.js:2-9)
4. **Modal System**: All modals (app details, search, menu) are dynamically created/destroyed rather than being pre-rendered in HTML

### API Integrations

The sandbox integrates with four external APIs:

1. **SIG Normalizer** (`runSigNormalizer` in sandbox.js:80)
   - Endpoint: `https://api.openai.com/v1/responses`
   - Auth: Requires `OPENAI_SIG_API_KEY` from `.env` file or `window.SIG_API_KEY`
   - Normalizes pharmacy instructions (SIGs) using OpenAI with prompt ID `pmpt_68d1aac7137081978a62cfad87ffd3730b5be593908223a0`

2. **NDC Analysis** (`runNdcAnalysis` in sandbox.js:149)
   - Endpoint: `https://ndcanalysis.scriptability.net/ndc_descriptor.php`
   - No auth required
   - Returns pharmaceutical data for NDC codes

3. **Medcast** (`runMedcast` in sandbox.js:188)
   - Endpoint: `https://medcast.scriptability.net/generate_podcast`
   - Generates audio podcasts from medication files, text, and NDC numbers
   - Returns WAV file download as `output.wav`
   - 3-minute timeout, supports up to 10 files (max 5MB each, 10MB total)

4. **Pill Identifier** (`runPillIdentifier` in sandbox.js:303)
   - Endpoint: `https://picanalysis.scriptability.net/analyze`
   - Analyzes medication images against expected medications
   - Requires medication name, 11-digit NDC, and image upload
   - See `README_for_picAnalysis.md` for detailed API documentation

## Development Workflow

### Running the Application

This is a static site with no build step. Open directly in a browser:

```bash
# Simple HTTP server (Python 3)
python -m http.server 8000

# Alternative: using Node.js
npx serve .
```

Then navigate to `http://localhost:8000`

### Environment Configuration

The `.env` file must contain:

```
OPENAI_SIG_API_KEY=sk-...
```

This is loaded client-side by `getSigApiKey()` in sandbox.js:46-78.

### Deep Linking to Sandbox

Apps can be launched directly via URL parameter:
```
sandbox.html?product=sig-normalizer
sandbox.html?product=ndc-analysis
sandbox.html?product=medcast
sandbox.html?product=pill-identifier
```

This is handled in `hydrateFromStorage()` at sandbox.js:540-546.

### Input Validation

- **SIG Normalizer**: 200 character limit enforced at sandbox.js:415-429
- **NDC Analysis**: Allows digits and hyphens, max 11 digits (sandbox.js:445-480)
- **Pill Identifier**: Requires exactly 11 digits, removes hyphens automatically (sandbox.js:501-509)
- **Medcast**: File type and size validation at sandbox.js:200-225

## Important Notes

- **No backend**: All API calls are made directly from the browser to external services
- **CORS considerations**: Some APIs may require CORS proxy configuration
- **Security**: The `.env` file should NOT be committed to version control (already in `.gitignore`)
- **Brochure Generation**: Uses html2pdf.js library loaded from CDN. Falls back to dynamic generation if static PDF at `assets/ScriptAbility-Patient-Access-Stack-Brochure.pdf` is not available (see script.js:106-261)
- **Notification System**: Shared toast notification function `showNotification(message, type)` in script.js:544 is called by sandbox.js via `window.showNotification`

## Testing

No formal test suite. Manual testing workflow:

1. Test each API endpoint in sandbox.html
2. Verify category filtering on index.html works
3. Test modal interactions (app launch, search, menu)
4. Verify brochure PDF generation
5. Test deep linking to sandbox with different products
6. Verify LocalStorage persistence of form inputs