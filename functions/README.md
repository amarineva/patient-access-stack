# Firebase Functions for ScriptAbility Patient Access Stack

## Overview

This directory contains Firebase Cloud Functions that act as secure backend proxies for API calls requiring secret credentials.

## Functions

### `normalizeSig`

**Purpose:** Proxies SIG normalization requests to OpenAI's API while keeping the API key secure on the server.

**Endpoint:** `https://us-central1-scriptability-patient-access.cloudfunctions.net/normalizeSig`

**Method:** POST

**Request Body:**
```json
{
  "model": "gpt-4o-mini",
  "prompt": {
    "id": "pmpt_68d1aac7137081978a62cfad87ffd3730b5be593908223a0",
    "version": "latest"
  },
  "input": "SIG: take 1 tablet by mouth twice daily json",
  "text": {
    "format": {
      "type": "json_object"
    }
  },
  "temperature": 0.25,
  "max_output_tokens": 2048,
  "top_p": 1,
  "store": true
}
```

**Response:** Returns the OpenAI API response as-is.

**Security:**
- Uses Google Cloud Secret Manager to store the `OPENAI_SIG_API_KEY`
- CORS enabled for all origins (can be restricted to your domain)
- No API key exposed in frontend code

## Setup

### Install Dependencies

```bash
npm install
```

### Set the Secret

```bash
firebase functions:secrets:set OPENAI_SIG_API_KEY
```

### Deploy

```bash
firebase deploy --only functions
```

## Local Development

### Start Emulator

```bash
firebase emulators:start --only functions
```

The function will be available at:
```
http://127.0.0.1:5001/scriptability-patient-access/us-central1/normalizeSig
```

## Adding New Functions

To add more API proxies (e.g., for other services that require API keys):

1. Define the secret in `index.js`:
   ```javascript
   const myApiKey = defineSecret('MY_API_KEY');
   ```

2. Create the function:
   ```javascript
   exports.myFunction = functions
     .runWith({ secrets: ['MY_API_KEY'] })
     .https.onRequest(async (req, res) => {
       // Enable CORS
       res.set('Access-Control-Allow-Origin', '*');
       
       // ... function logic
     });
   ```

3. Set the secret:
   ```bash
   firebase functions:secrets:set MY_API_KEY
   ```

4. Deploy:
   ```bash
   firebase deploy --only functions
   ```

## Monitoring

View logs:
```bash
firebase functions:log
```

View specific function logs:
```bash
firebase functions:log --only normalizeSig
```

## Cost

Firebase Functions pricing (as of 2024):
- **Free tier:** 2M invocations/month
- **After free tier:** $0.40 per million invocations
- **Memory:** 256MB (default)
- **Timeout:** 60 seconds (default)

This function uses minimal resources, so costs should be negligible for typical usage.
