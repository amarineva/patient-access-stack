import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { ListToolsResultSchema, CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const serverCommand = process.execPath; // node
  const serverArgs = [path.resolve(__dirname, "index.js")];

  const client = new Client({ name: "scriptability-mcp-test", version: "0.1.0" });
  const transport = new StdioClientTransport({ command: serverCommand, args: serverArgs, stderr: "pipe", cwd: __dirname });
  try {
    await client.connect(transport);

    const tools = await client.request({ method: "tools/list", params: {} }, ListToolsResultSchema);
    console.log("Tools:");
    for (const t of tools.tools) {
      console.log(`- ${t.name}: ${t.description}`);
    }

    console.log("\nCalling sig_normalize...");
    const callRes = await client.request(
      {
        method: "tools/call",
        params: { name: "sig_normalize", arguments: { sig: "Take 1 tablet by mouth twice daily" } }
      },
      CallToolResultSchema
    );
    for (const item of callRes.content || []) {
      if (item.type === "text") {
        console.log(item.text);
      } else {
        console.log(item);
      }
    }
  } finally {
    await transport.close();
  }
}

main().catch((err) => {
  console.error("Test client error:", err);
  process.exit(1);
});
