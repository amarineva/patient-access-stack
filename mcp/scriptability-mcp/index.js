import undici from "undici";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import express from "express";
import cors from "cors";
import { randomUUID } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { InMemoryEventStore } from "@modelcontextprotocol/sdk/examples/shared/inMemoryEventStore.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
const fetch = globalThis.fetch || undici.fetch;
const FormData = globalThis.FormData || undici.FormData;
const File = globalThis.File || undici.File;
const Blob = globalThis.Blob || undici.Blob;
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import mime from "mime-types";

const SERVER_NAME = "scriptability-mcp";
const SERVER_VERSION = "0.1.0";

const SIG_ENDPOINT = "https://normalizesig-z4vamvc43a-uc.a.run.app";
const NDC_ENDPOINT = "https://ndcanalysis.scriptability.net/ndc_descriptor.php";
const MEDCAST_BASE = "https://medcast.scriptability.net";
const PICANALYSIS_ENDPOINT = "https://picanalysis.scriptability.net/analyze";

const DEFAULT_SIG_MODEL = "gpt-4.1-mini";
const PROMPT_ID = "pmpt_68d1aac7137081978a62cfad87ffd3730b5be593908223a0";
const PROMPT_VERSION = "7";

function extractResponseText(data) {
  if (!data) return "";
  if (data.output_text && typeof data.output_text === "string" && data.output_text.trim().length > 0) {
    return data.output_text;
  }
  if (Array.isArray(data.output)) {
    for (const item of data.output) {
      if (item && item.type === "message" && Array.isArray(item.content)) {
        for (const part of item.content) {
          if (part && part.type === "output_text" && typeof part.text === "string") {
            return part.text;
          }
        }
      }
    }
  }
  return "";
}

async function ensureDirectory(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

function nowTimestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return (
    d.getFullYear() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    "-" +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  );
}

async function readFileAsFileObject(filePath) {
  const absolutePath = path.resolve(filePath);
  const data = await fs.readFile(absolutePath);
  const base = path.basename(absolutePath);
  const mimeType = mime.lookup(base) || "application/octet-stream";
  const blob = new Blob([data], { type: mimeType });
  return new File([blob], base, { type: mimeType });
}

function toJsonContent(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return { content: [{ type: "text", text }] };
}

function errorContent(message) {
  return { content: [{ type: "text", text: `Error: ${message}` }] };
}

const server = new Server({ name: SERVER_NAME, version: SERVER_VERSION }, { capabilities: { tools: {} } });

// Tool registry
const tools = new Map();

tools.set("sig_normalize", {
  name: "sig_normalize",
  description: "Normalize pharmacy SIG instructions into a structured JSON using ScriptAbility pipeline.",
  inputSchema: {
    type: "object",
    properties: {
      sig: { type: "string", description: "Free-text SIG, max ~200 characters" },
      model: { type: "string", description: "OpenAI model ID override" },
      includeJsonSuffix: { type: "boolean", description: "Force 'json' suffix in prompt" }
    },
    required: ["sig"]
  },
  async invoke(input) {
    try {
      const sigRaw = String(input.sig || "").trim();
      if (!sigRaw) return errorContent("Missing 'sig'.");
      const trimmedSig = sigRaw.slice(0, 200);
      const model = (input.model && String(input.model)) || DEFAULT_SIG_MODEL;
      const needsJsonTag = input.includeJsonSuffix === true ? true : !/json/i.test(trimmedSig);

      const requestBody = {
        model,
        prompt: { id: PROMPT_ID, version: PROMPT_VERSION },
        input: `SIG: ${trimmedSig}${needsJsonTag ? " json" : ""}`,
        text: { format: { type: "json_object" } },
        temperature: 0.25,
        max_output_tokens: 2048,
        top_p: 1,
        store: true
      };

      const res = await fetch(SIG_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // The backend restricts origins. Present a permitted origin.
          "Origin": "https://scriptability-patient-access.web.app"
        },
        body: JSON.stringify(requestBody)
      });

      if (!res.ok) {
        const errText = await res.text();
        return errorContent(`HTTP ${res.status}: ${errText}`);
      }

      const data = await res.json();
      let text = extractResponseText(data);
      if (text) {
        const trimmed = text.trim();
        if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
          try { text = JSON.stringify(JSON.parse(trimmed), null, 2); } catch {}
        }
        return toJsonContent(text);
      }
      return toJsonContent(data);
    } catch (err) {
      return errorContent(err.message || String(err));
    }
  }
});

tools.set("ndc_analysis", {
  name: "ndc_analysis",
  description: "Look up NDC descriptor details for a given NDC (digits and hyphens allowed).",
  inputSchema: {
    type: "object",
    properties: {
      ndc: { type: "string", description: "NDC number (digits and hyphens)" }
    },
    required: ["ndc"]
  },
  async invoke(input) {
    try {
      const ndcRaw = String(input.ndc || "").trim();
      if (!ndcRaw) return errorContent("Missing 'ndc'.");
      const safeNdc = ndcRaw.replace(/[^0-9-]/g, "");
      const url = `${NDC_ENDPOINT}?ndc=${encodeURIComponent(safeNdc)}`;

      const res = await fetch(url, { method: "GET", headers: { Accept: "application/json" } });
      if (!res.ok) {
        const errText = await res.text();
        return errorContent(`HTTP ${res.status}: ${errText}`);
      }
      const data = await res.json();
      return toJsonContent(data);
    } catch (err) {
      return errorContent(err.message || String(err));
    }
  }
});

tools.set("medcast_generate_podcast", {
  name: "medcast_generate_podcast",
  description: "Generate a medication podcast from files, text, and/or NDC. Saves WAV locally and returns the file path.",
  inputSchema: {
    type: "object",
    properties: {
      files: { type: "array", items: { type: "string" }, description: "Local file paths (.txt, .md, .pdf, .docx). Max 10, each <=5MB, total <=10MB" },
      text: { type: "string", description: "Free text source" },
      ndc: { type: "string", description: "NDC number (optional)" },
      outputDir: { type: "string", description: "Directory to save output WAV. Defaults to ./mcp_outputs/medcast" }
    }
  },
  async invoke(input) {
    try {
      const filePaths = Array.isArray(input.files) ? input.files.map(String) : [];
      const sourceText = input.text ? String(input.text) : "";
      const ndcRaw = input.ndc ? String(input.ndc) : "";

      if (filePaths.length === 0 && !sourceText && !ndcRaw) {
        return errorContent("Provide at least one of: files, text, or ndc.");
      }

      // Validate and build form data
      const allowedExt = [".txt", ".md", ".pdf", ".docx"];
      let totalBytes = 0;
      const formData = new FormData();

      for (const p of filePaths) {
        const stats = await fs.stat(path.resolve(p));
        totalBytes += stats.size;
        if (stats.size > 5 * 1024 * 1024) {
          return errorContent(`File too large (>5MB): ${p}`);
        }
        if (totalBytes > 10 * 1024 * 1024) {
          return errorContent("Total attachment size exceeds 10MB.");
        }
        const lower = p.toLowerCase();
        if (!allowedExt.some((ext) => lower.endsWith(ext))) {
          return errorContent(`Unsupported file type: ${p}`);
        }
        const fileObj = await readFileAsFileObject(p);
        formData.append("source_files", fileObj, fileObj.name);
      }

      if (sourceText) formData.append("source_text", sourceText);
      if (ndcRaw) formData.append("ndc_number", ndcRaw);

      const endpoint = `${MEDCAST_BASE}/generate_podcast`;
      const controller = new AbortController();
      const timeoutMs = 180000; // 3 minutes
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      let res;
      try {
        res = await fetch(endpoint, { method: "POST", body: formData, signal: controller.signal });
      } finally {
        clearTimeout(timeoutId);
      }

      if (!res.ok) {
        let errText = await res.text();
        try { errText = JSON.stringify(JSON.parse(errText), null, 2); } catch {}
        return errorContent(`URL: ${endpoint}\nStatus: ${res.status}\nResponse: ${errText}`);
      }

      const arrayBuffer = await res.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const baseOutDir = path.resolve(process.cwd(), input.outputDir ? String(input.outputDir) : path.join("mcp_outputs", "medcast"));
      await ensureDirectory(baseOutDir);
      const outPath = path.join(baseOutDir, `output-${nowTimestamp()}.wav`);
      await fs.writeFile(outPath, buffer);

      return toJsonContent({ message: "Podcast generated", path: outPath });
    } catch (err) {
      const details = err && err.name === "AbortError" ? "Request timed out (3 min)." : String(err.message || err);
      return errorContent(details);
    }
  }
});

tools.set("pill_identifier", {
  name: "pill_identifier",
  description: "Analyze a medication image against expected medication details (name + 11-digit NDC).",
  inputSchema: {
    type: "object",
    properties: {
      name: { type: "string", description: "Medication name" },
      ndc11: { type: "string", description: "Exactly 11 digits (hyphens removed automatically)" },
      imagePath: { type: "string", description: "Local path to medication image (jpg, png, gif, webp). <=5MB" },
      description: { type: "string", description: "Optional physical description" }
    },
    required: ["name", "ndc11", "imagePath"]
  },
  async invoke(input) {
    try {
      const medName = String(input.name || "").trim();
      const ndcRaw = String(input.ndc11 || "").trim();
      const normalizedNdc = ndcRaw.replace(/[^0-9]/g, "");
      if (!medName) return errorContent("Missing 'name'.");
      if (!normalizedNdc) return errorContent("Missing 'ndc11'.");
      if (normalizedNdc.length !== 11) return errorContent("NDC must contain exactly 11 digits.");

      const imagePath = String(input.imagePath || "").trim();
      if (!imagePath) return errorContent("Missing 'imagePath'.");
      const stats = await fs.stat(path.resolve(imagePath));
      if (stats.size > 5 * 1024 * 1024) return errorContent("Image is too large. Max size is 5MB.");

      const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
      const fileObj = await readFileAsFileObject(imagePath);
      const mimeType = fileObj.type || mime.lookup(fileObj.name) || "application/octet-stream";
      if (!allowedTypes.includes(mimeType)) {
        return errorContent("Unsupported image format. Use JPG, PNG, GIF, or WebP.");
      }

      const formData = new FormData();
      formData.append("medications[0][name]", medName);
      formData.append("medications[0][ndc]", normalizedNdc);
      if (input.description) {
        formData.append("medications[0][physical_description]", String(input.description));
      }
      formData.append("image[]", fileObj, fileObj.name || "upload");

      const res = await fetch(PICANALYSIS_ENDPOINT, { method: "POST", body: formData });
      if (!res.ok) {
        let errText = await res.text();
        try { errText = JSON.stringify(JSON.parse(errText), null, 2); } catch {}
        return errorContent(`HTTP ${res.status}: ${errText}`);
      }

      const data = await res.json();
      return toJsonContent(data);
    } catch (err) {
      return errorContent(err.message || String(err));
    }
  }
});

// Tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: Array.from(tools.values()).map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const tool = tools.get(name);
  if (!tool) {
    return errorContent(`Unknown tool: ${name}`);
  }
  const input = args || {};
  return await tool.invoke(input, request);
});

async function startStdioIfRequested() {
  if (process.env.MCP_STDIO === "1") {
    await server.connect(new StdioServerTransport());
  }
}

async function startHttpIfRequested() {
  if (process.env.MCP_HTTP !== "1") return;
  const port = process.env.MCP_PORT ? parseInt(process.env.MCP_PORT, 10) : 3333;
  const app = express();
  app.use(express.json({ limit: "4mb" }));
  app.use(cors({ origin: "*", exposedHeaders: ["Mcp-Session-Id"] }));

  // Single stateless transport (no session management)
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    eventStore: new InMemoryEventStore(),
    enableJsonResponse: true,
  });
  await server.connect(transport);

  app.post("/mcp", async (req, res) => {
    try {
      const body = req.body;
      const method = (Array.isArray(body) ? body[0]?.method : body?.method) || "<unknown>";
      console.log(`[${SERVER_NAME}] POST /mcp method=${method}`);
      await transport.handleRequest(req, res, req.body);
    } catch (e) {
      res.status(500).json({ jsonrpc: "2.0", error: { code: -32603, message: String(e) }, id: null });
    }
  });

  app.get("/mcp", async (req, res) => {
    await transport.handleRequest(req, res);
  });

  app.delete("/mcp", async (req, res) => {
    await transport.handleRequest(req, res);
  });

  app.listen(port, () => {
    console.log(`[${SERVER_NAME}] HTTP MCP listening on http://localhost:${port}/mcp`);
  });
}

Promise.all([startStdioIfRequested(), startHttpIfRequested()]).catch((err) => {
  console.error(`[${SERVER_NAME}] Fatal error:`, err);
  process.exit(1);
});
