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

2. **Build and push to Google Container Registry**:
```bash
cd mcp/scriptability-mcp
gcloud config set project scriptability-patient-access
gcloud builds submit --tag gcr.io/scriptability-patient-access/scriptability-mcp:latest
```

3. **Deploy to Cloud Run**:
```bash
gcloud run deploy scriptability-mcp \
  --image gcr.io/scriptability-patient-access/scriptability-mcp:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars="MCP_HTTP=1,MCP_PORT=8080,MCP_ALLOWED_ORIGINS=https://scriptability-patient-access.web.app,https://scriptability-patient-access.firebaseapp.com"
```

4. **Note the service URL** (e.g., `https://scriptability-mcp-xxxx-uc.a.run.app`)

5. **Update Sandbox**: Use the Cloud Run URL + `/mcp` as the endpoint in the Sandbox MCP section.

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

## Cost Estimates (Cloud Run)

- **Free tier**: 2M requests/month, 360K GB-seconds/month
- **Beyond free tier**: ~$0.40 per million requests
- For typical MCP usage (100-1000 calls/day): Should stay within free tier
