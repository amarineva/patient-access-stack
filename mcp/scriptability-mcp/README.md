### ScriptAbility MCP Server

Expose ScriptAbility APIs as MCP tools for AI agents (Claude Desktop, Cursor, etc.).

- **SIG Normalizer**: Routes to your Firebase Function proxy (keeps API key server-side)
- **NDC Analysis**: Queries descriptor API for NDC details
- **Medcast**: Generates a WAV podcast via async job flow, saved locally
- **Pill Identifier**: Analyzes a medication image against expected medication

### Prerequisites
- Node.js 18.17+ (Node 20+ recommended)
- Internet access to ScriptAbility endpoints

### Install
```bash
cd mcp/scriptability-mcp
npm install
```

### Run
```bash
npm start
```
This starts a stdio MCP server. Most clients will spawn it via command config (see below) rather than you running it manually.

HTTP mode (stateless Streamable HTTP transport):
```bash
npm run start:http
# or custom port
MCP_HTTP=1 MCP_PORT=3434 node index.js
```
Endpoint will be at `http://localhost:3333/mcp` (or your custom port).

Quick test over HTTP:
```bash
node http-test-client.js           # uses MCP_URL or defaults to http://localhost:3333/mcp
MCP_URL=http://localhost:3434/mcp node http-test-client.js
```

### Configure in Claude Desktop
Add (or update) your `claude_desktop_config.json` to include the server:
```json
{
  "mcpServers": {
    "scriptability": {
      "command": "node",
      "args": ["/absolute/path/to/mcp/scriptability-mcp/index.js"],
      "env": {}
    }
  }
}
```
Restart Claude Desktop. You should see the "scriptability" server load in the Tools panel.

### Tools
- **sig_normalize**
  - Inputs: `sig` (string, required), `model` (string, optional), `includeJsonSuffix` (boolean, optional)
  - Output: JSON text string with normalized SIG
  - Notes: Adds `Origin` header to satisfy CORS/origin checks on your Firebase Function
- **ndc_analysis**
  - Inputs: `ndc` (string)
  - Output: JSON text of descriptor
- **medcast_generate_podcast**
  - Inputs: `files` (string[]), `text` (string), `ndc` (string), `outputDir` (string)
  - Output: JSON text `{ jobId, status }`; initial status is `pending`. If `waitMs` is provided (or `MCP_MEDCAST_AUTO_WAIT_MS` is configured), returns the final job state if it completes in time. On success, includes `path`, `downloadUrl`, and `signedUrl`. When `MCP_PUBLIC_BASE_URL` is set, `downloadUrl` points to `<base>/files/medcast/:jobId` which streams (or downloads, if `MCP_MEDCAST_FORCE_ATTACHMENT=1`) the WAV from Cloud Run. `signedUrl` contains the direct Google Cloud Storage signed link for fallback.
- **medcast_job_status**
  - Inputs: `jobId` (string)
  - Output: JSON text `{ id, type, status, path?, error?, createdAt, updatedAt }`
  - Notes: Poll until `status` becomes `succeeded` (then `path` is available) or `failed`
- **pill_identifier**
  - Inputs: `name` (string), `ndc11` (string, 11 digits), `imageUrl` (https); optional `description` (string)
  - Output: JSON text of analysis
  - Notes: Only publicly accessible HTTPS URLs are supported. Max size 5MB; allowed types: JPG, PNG, GIF, WebP.
  - Example: `imageUrl: "https://www.drugs.com/images/pills/fio/AUR00140/amoxicillin-trihydrate.JPG"`

### Endpoints Used
- SIG Normalizer: `https://normalizesig-z4vamvc43a-uc.a.run.app` (Firebase Functions Gen2)
- NDC Analysis: `https://ndcanalysis.scriptability.net/ndc_descriptor.php`
- Medcast: `https://medcast.scriptability.net/generate_podcast`
- Pill Identifier: `https://picanalysis.scriptability.net/analyze`

### Notes & Troubleshooting
- The SIG function enforces an allowed `Origin`. This server sets `Origin: https://scriptability-patient-access.web.app`. If you lock this down further, update `index.js`.
- Medcast requests run asynchronously; start with `medcast_generate_podcast`, optionally pass `waitMs` to block, or poll `medcast_job_status`. Set `MCP_OUTPUT_BUCKET` to write results to Cloud Storage (signed URL returned). If using local disk, set `MCP_PUBLIC_BASE_URL` and keep `/files/medcast/:jobId` accessible.
- When deploying to Cloud Run, set `MCP_PUBLIC_BASE_URL` (e.g., `https://scriptability-mcp-xxxxx-uc.a.run.app`) so the tool shares the friendly streaming link served by `/files/medcast/:jobId`.
- To emit publicly shareable Google Cloud Storage links (no signed query string), set `MCP_OUTPUT_PUBLIC_READ=1`. Objects will be uploaded with `publicRead` access and the tool returns the direct `https://storage.googleapis.com/<bucket>/<object>` URL alongside the signed link.
- To force agents to use only the streaming link, set `MCP_FORCE_DOWNLOAD_URL_ONLY=1`. In this mode, when a job is complete the tool returns a plain text body containing only the `downloadUrl` and omits other link-like fields that could confuse clients.
- Set `MCP_MEDCAST_AUTO_WAIT_MS` (e.g., `180000`) to enforce a minimum wait time for Medcast jobs. Even if a caller supplies a smaller `waitMs`, the tool will wait at least this long before responding, so agents generally get the finished link in one round-trip.
- Set `MCP_MEDCAST_FORCE_ATTACHMENT=1` if you prefer browsers to download the WAV instead of streaming inline; this toggles the `Content-Disposition` header from `inline` to `attachment` for Cloud Run and local responses.
- Ensure file paths passed to tools are accessible to the server process.
- If your Node doesn't support `fetch`/`FormData`, this package vendors `undici` and uses it explicitly.

### Environment Flags
- `MCP_MEDCAST_AUTO_WAIT_MS` — minimum wait duration (ms) for Medcast jobs when the caller supplies a shorter `waitMs`.
- `MCP_HTTP_MAX_WAIT_MS` — caps Medcast wait durations when running in HTTP mode (`MCP_HTTP=1`). Defaults to `25000` to avoid Cloud Run / load balancer 502s on long-held requests. Set a larger value if your HTTP deployment can safely handle longer waits.
- `MCP_HTTP_INLINE_WAIT` — set to `1` to allow HTTP callers to wait inside the initial `medcast_generate_podcast` call (subject to the clamp above). Defaults to `0` so HTTP responses return immediately with a job ID, avoiding HTTP timeout issues.

Hosting guidance:
- For production, front this service with HTTPS and restrict allowed hosts/origins in the HTTP transport if needed.
- The current HTTP server runs statelessly; OAuth can be added using the SDK's auth utilities if you need token-based access control.
