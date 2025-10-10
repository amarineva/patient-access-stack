# Deploying ScriptAbility MCP Server for HTTPS Access

## Overview
For production use with the Firebase-hosted Sandbox (HTTPS), the MCP HTTP server must also be served over HTTPS to avoid mixed content blocking.

## Option 1: Google Cloud Run (Recommended)

### Prerequisites
- Google Cloud account with billing enabled
- `gcloud` CLI installed and authenticated
- Docker installed locally

### Steps

1. **Create a Dockerfile** in `mcp/scriptability-mcp/`:
```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
ENV MCP_HTTP=1
ENV MCP_PORT=8080
CMD ["node", "index.js"]
```

2. **Build and push an image** (Cloud Build → Artifact/Container Registry):
```bash
cd mcp/scriptability-mcp
gcloud config set project scriptability-patient-access
# Versioned tag recommended for clear rollouts
IMAGE="gcr.io/scriptability-patient-access/scriptability-mcp:$(date +%Y%m%d-%H%M%S)"
gcloud builds submit --tag "$IMAGE"
```

3. **Deploy to Cloud Run** (use env file to avoid comma-escaping issues):
```bash
cat >/tmp/mcp-env.yaml <<'EOF'
MCP_HTTP: "1"
MCP_PORT: "8080"
MCP_ALLOWED_ORIGINS: "https://scriptability-patient-access.web.app,https://scriptability-patient-access.firebaseapp.com"
EOF

gcloud run deploy scriptability-mcp \
  --image "$IMAGE" \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --env-vars-file=/tmp/mcp-env.yaml
```

4. **Note the service URL** (e.g., `https://scriptability-mcp-xxxx-uc.a.run.app`)

5. **Hosting integration**: Firebase Hosting rewrites `/mcp` to this Cloud Run service (see `firebase.json`). The Sandbox should call `/mcp` on your hosting domain; you can also call the Cloud Run URL directly.

## Option 2: Firebase Hosting with Cloud Functions

Not ideal for this use case since MCP requires persistent stateless HTTP transport which is better suited to Cloud Run.

## Option 3: Self-hosted with HTTPS Reverse Proxy

If hosting on your own infrastructure:

1. **Setup Nginx/Caddy reverse proxy** with SSL certificate (Let's Encrypt)
2. **Start MCP server**:
```bash
MCP_HTTP=1 MCP_PORT=3434 MCP_ALLOWED_ORIGINS=https://scriptability-patient-access.web.app node index.js
```

3. **Configure reverse proxy** to forward `/mcp` to `localhost:3434/mcp`

Example Nginx config:
```nginx
location /mcp {
    proxy_pass http://localhost:3434/mcp;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_cache_bypass $http_upgrade;
}
```

## Security Considerations

- **CORS**: Always set `MCP_ALLOWED_ORIGINS` to restrict access to your Sandbox domains
- **Authentication**: For paid access, implement token-based auth middleware in the Express app
- **Rate Limiting**: Add rate limiting middleware to prevent abuse
- **Monitoring**: Enable Cloud Run/server logging to track usage

## Testing Production Deployment

Once deployed, test from the Sandbox:
1. Enter your HTTPS MCP endpoint URL
2. Click "Connect"
3. Verify status shows "Connected"
4. Try "List Tools" and a tool call

Direct curl tests (Cloud Run URL). The server requires Accept for both JSON and SSE:

```bash
SERVICE_URL="https://scriptability-mcp-xxxx-uc.a.run.app"

# List tools
curl -sS -X POST "$SERVICE_URL/mcp" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  --data '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'

# Start Medcast job and wait up to 180s in the same call
curl -sS -X POST "$SERVICE_URL/mcp" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  --data '{"jsonrpc":"2.0","id":"start","method":"tools/call","params":{"name":"medcast_generate_podcast","arguments":{"text":"Hello world","waitMs":180000}}}'

# Optional: Poll status with long-poll wait
curl -sS -X POST "$SERVICE_URL/mcp" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  --data '{"jsonrpc":"2.0","id":"status","method":"tools/call","params":{"name":"medcast_job_status","arguments":{"jobId":"<JOB_ID>","waitMs":30000}}}'
```

## Cost Estimates (Cloud Run)

- **Free tier**: 2M requests/month, 360K GB-seconds/month
- **Beyond free tier**: ~$0.40 per million requests
- For typical MCP usage (100-1000 calls/day): Should stay within free tier
