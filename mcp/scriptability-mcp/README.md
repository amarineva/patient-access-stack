### ScriptAbility MCP Server

Expose ScriptAbility APIs as MCP tools for AI agents (Claude Desktop, Cursor, etc.).

- **SIG Normalizer**: Routes to your Firebase Function proxy (keeps API key server-side)
- **NDC Analysis**: Queries descriptor API for NDC details
- **Medcast**: Generates a WAV podcast, saved locally
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
  - Output: JSON text `{ message, path }`; WAV saved to `./mcp_outputs/medcast` by default
- **pill_identifier**
  - Inputs: `name` (string), `ndc11` (string, 11 digits), `imagePath` (string), `description` (string?)
  - Output: JSON text of analysis

### Endpoints Used
- SIG Normalizer: `https://normalizesig-z4vamvc43a-uc.a.run.app` (Firebase Functions Gen2)
- NDC Analysis: `https://ndcanalysis.scriptability.net/ndc_descriptor.php`
- Medcast: `https://medcast.scriptability.net/generate_podcast`
- Pill Identifier: `https://picanalysis.scriptability.net/analyze`

### Notes & Troubleshooting
- The SIG function enforces an allowed `Origin`. This server sets `Origin: https://scriptability-patient-access.web.app`. If you lock this down further, update `index.js`.
- Medcast responses are WAV bytes; this server writes to disk to avoid huge inline responses.
- Ensure file paths passed to tools are accessible to the server process.
- If your Node doesn't support `fetch`/`FormData`, this package vendors `undici` and uses it explicitly.

Hosting guidance:
- For production, front this service with HTTPS and restrict allowed hosts/origins in the HTTP transport if needed.
- The current HTTP server runs statelessly; OAuth can be added using the SDK's auth utilities if you need token-based access control.
