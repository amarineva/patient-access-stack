import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { ListToolsResultSchema, CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";

async function main() {
  const url = new URL(process.env.MCP_URL || "http://localhost:3333/mcp");
  const client = new Client({ name: "http-test-client", version: "0.1.0" });
  const transport = new StreamableHTTPClientTransport(url, { requestInit: { headers: { Accept: "application/json, text/event-stream" } } });
  await client.connect(transport);

  const tools = await client.request({ method: "tools/list", params: {} }, ListToolsResultSchema);
  console.log("Tools:", tools.tools.map(t => t.name).join(", "));

  const res = await client.request({ method: "tools/call", params: { name: "ndc_analysis", arguments: { ndc: "65162089803" } } }, CallToolResultSchema);
  for (const item of res.content || []) {
    if (item.type === "text") console.log(item.text);
  }

  await transport.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
