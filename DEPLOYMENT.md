# Firebase Deployment Guide for ScriptAbility Patient Access Stack

## Overview

This application uses Firebase Hosting for the static frontend and Firebase Functions to securely proxy API calls that require secret keys.

## Prerequisites

- Firebase CLI installed: `npm install -g firebase-tools`
- Firebase project: `scriptability-patient-access`
- OpenAI API key for SIG Normalizer

## Initial Setup

### 1. Install Firebase Functions Dependencies

```bash
cd functions
npm install
cd ..
```

### 2. Set the Secret API Key

Firebase Functions uses secure secret management. Set your OpenAI API key as a secret:

```bash
firebase functions:secrets:set OPENAI_SIG_API_KEY
```

When prompted, paste your OpenAI API key (starts with `sk-`).

**Important:** This stores the key securely in Google Cloud Secret Manager. It will NOT be visible in your code or logs.

### 3. Verify the Secret is Set

```bash
firebase functions:secrets:access OPENAI_SIG_API_KEY
```

This will display your stored API key to confirm it's set correctly.

## Deployment

### Deploy Everything (Hosting + Functions)

```bash
firebase deploy
```

### Deploy Only Functions

```bash
firebase deploy --only functions
```

### Deploy Only Hosting

```bash
firebase deploy --only hosting
```

## Testing Locally

### 1. Start the Firebase Emulator

```bash
firebase emulators:start
```

This will start:
- Hosting emulator at `http://localhost:5000`
- Functions emulator at `http://localhost:5001`

### 2. Set Local Secret for Testing

For local development, you need to provide the secret to the emulator:

```bash
firebase functions:secrets:set OPENAI_SIG_API_KEY
```

Then run the emulator with secrets access:

```bash
firebase emulators:start
```

The frontend code automatically detects if you're running locally and uses the emulator URL.

## Architecture

### Frontend → Firebase Function → OpenAI

1. **Frontend (`sandbox.js`)**: Sends SIG normalization requests to Firebase Function
2. **Firebase Function (`functions/index.js`)**: Proxies the request to OpenAI with the secret API key
3. **OpenAI API**: Processes the request and returns normalized SIG data
4. **Firebase Function**: Returns the response to the frontend

### Security Benefits

- ✅ API key is never exposed in the frontend code
- ✅ API key is stored securely in Google Cloud Secret Manager
- ✅ Users cannot access or view your API key
- ✅ CORS is properly configured for your domain only

## Endpoints

After deployment, your Firebase Function will be available at:

```
https://normalizesig-z4vamvc43a-uc.a.run.app
```

(Note: Gen2 functions use Cloud Run URLs)

## Monitoring

### View Function Logs

```bash
firebase functions:log
```

### View Recent Errors

```bash
firebase functions:log --only normalizeSig
```

## Troubleshooting

### Error: "API key not configured"

Make sure the secret is set:
```bash
firebase functions:secrets:set OPENAI_SIG_API_KEY
```

### Error: "CORS error"

The function is configured to allow all origins (`Access-Control-Allow-Origin: *`). If you want to restrict this to your domain only, edit `functions/index.js`:

```javascript
res.set('Access-Control-Allow-Origin', 'https://scriptability-patient-access.web.app');
```

### Function Times Out

Firebase Functions on the free plan have a 60-second timeout. If you're on the free plan and experiencing timeouts, consider upgrading to the Blaze (pay-as-you-go) plan.

### Local Emulator Can't Access Secret

Make sure you've set the secret and started the emulator after setting it:
```bash
firebase functions:secrets:set OPENAI_SIG_API_KEY
firebase emulators:start
```

## Cost Considerations

- **Firebase Hosting**: Free tier includes 10GB storage and 360MB/day transfer
- **Firebase Functions**: 
  - Free tier: 2M invocations/month
  - Each SIG normalization is 1 invocation
  - After free tier: $0.40 per million invocations
- **OpenAI API**: Billed separately based on your OpenAI plan

## Updating the Secret

If you need to change your API key:

```bash
firebase functions:secrets:set OPENAI_SIG_API_KEY
firebase deploy --only functions
```

The function must be redeployed after updating a secret.
