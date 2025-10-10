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
import { Storage } from "@google-cloud/storage";
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

const OUTPUT_BUCKET = (process.env.MCP_OUTPUT_BUCKET || "").trim();
const OUTPUT_OBJECT_PREFIX = (process.env.MCP_OUTPUT_OBJECT_PREFIX || "medcast").replace(/^\/+|\/+$/g, "");
const OUTPUT_SIGNED_URL_SECONDS = (() => {
  const raw = process.env.MCP_OUTPUT_SIGNED_URL_SECONDS;
  const parsed = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 3600;
})();
const OUTPUT_PUBLIC_READ = (() => {
  const raw = (process.env.MCP_OUTPUT_PUBLIC_READ || "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
})();
const FORCE_DL_ONLY = (() => {
  const raw = (process.env.MCP_FORCE_DOWNLOAD_URL_ONLY || "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
})();
const AUTO_WAIT_MS = (() => {
  const raw = process.env.MCP_MEDCAST_AUTO_WAIT_MS;
  if (!raw) return 0;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
})();
const FORCE_ATTACHMENT = (() => {
  const raw = (process.env.MCP_MEDCAST_FORCE_ATTACHMENT || "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
})();
let storage = null;
if (OUTPUT_BUCKET) {
  storage = new Storage();
}

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

function toTextContent(text) {
  return { content: [{ type: "text", text: String(text) }] };
}

function errorContent(message) {
  return { content: [{ type: "text", text: `Error: ${message}` }] };
}

function nowIso() {
  return new Date().toISOString();
}

const jobs = new Map();
const jobPromises = new Map();

function createJob(type) {
  const jobId = randomUUID();
  const timestamp = nowIso();
  const job = {
    id: jobId,
    type,
    status: "pending",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  jobs.set(jobId, job);
  return job;
}

function getJob(jobId) {
  return jobs.get(jobId);
}

function updateJob(jobId, updates) {
  const job = jobs.get(jobId);
  if (!job) return null;
  const next = { ...job, ...updates, updatedAt: nowIso() };
  jobs.set(jobId, next);
  return next;
}

function serializeJob(job) {
  if (!job) return null;
  const base = getPublicBaseUrl();
  const preferredUrl = job.downloadUrl || (base ? `${base}/files/medcast/${job.id}` : null);
  // Put url first for better linkification in some clients
  const serialized = {
    url: preferredUrl || undefined,
    downloadUrl: job.downloadUrl,
    signedUrl: job.signedUrl,
    id: job.id,
    type: job.type,
    status: job.status,
    path: job.path,
    error: job.error,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
  return serialized;
}

function getPublicBaseUrl() {
  const base = (process.env.MCP_PUBLIC_BASE_URL || process.env.MCP_BASE_URL || "").trim();
  if (!base) return "";
  return base.endsWith("/") ? base.slice(0, -1) : base;
}

function buildDownloadUrl(jobId) {
  const base = getPublicBaseUrl();
  if (!base) return null;
  return `${base}/files/medcast/${jobId}`;
}

function resolveDownloadUrl(jobId, signedUrl) {
  const routeUrl = buildDownloadUrl(jobId);
  return routeUrl || signedUrl || null;
}

function streamGcsFile(file, res, filename) {
  res.setHeader("Content-Type", "audio/wav");
  const disposition = FORCE_ATTACHMENT ? "attachment" : "inline";
  res.setHeader("Content-Disposition", `${disposition}; filename="${filename}"`);
  res.setHeader("Cache-Control", "private, max-age=3600");
  const stream = file.createReadStream();
  stream.on("error", (err) => {
    if (!res.headersSent) {
      res.status(500).json({ error: String(err?.message || err) });
    } else {
      res.destroy(err);
    }
  });
  stream.pipe(res);
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
      outputDir: { type: "string", description: "Directory to save output WAV. Defaults to ./mcp_outputs/medcast" },
      waitMs: { type: "number", description: "Optional: block this call up to N ms for completion; returns final status if finished in time" }
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

      const job = createJob("medcast");

      const processPromise = processMedcastJob(job.id, {
        filePaths,
        sourceText,
        ndcRaw,
        outputDir: input.outputDir ? String(input.outputDir) : undefined,
      });

      jobPromises.set(job.id, processPromise);
      processPromise.finally(() => { jobPromises.delete(job.id); });

      processPromise.catch((err) => {
        const message = err && err.message ? err.message : String(err);
        updateJob(job.id, { status: "failed", error: message });
      });

      const requestedWait = Number.isFinite(input.waitMs) ? Number(input.waitMs) : 0;
      const effectiveWait = Math.max(requestedWait, AUTO_WAIT_MS);
      if (effectiveWait > 0) {
        await waitForJob(job.id, effectiveWait);
        const done = getJob(job.id);
        if (FORCE_DL_ONLY && done && done.status === "succeeded") {
          const s = serializeJob(done);
          const url = s?.url || s?.downloadUrl || s?.signedUrl || "";
          return toTextContent(String(url));
        }
        return toJsonContent(serializeJob(done));
      }
      return toJsonContent({ jobId: job.id, status: job.status });
    } catch (err) {
      const details = err && err.name === "AbortError" ? "Request timed out (3 min)." : String(err.message || err);
      return errorContent(details);
    }
  }
});

async function processMedcastJob(jobId, { filePaths, sourceText, ndcRaw, outputDir }) {
  updateJob(jobId, { status: "running" });

  try {
    const allowedExt = [".txt", ".md", ".pdf", ".docx"];
    let totalBytes = 0;
    const formData = new FormData();

    for (const p of filePaths) {
      const absolute = path.resolve(p);
      const stats = await fs.stat(absolute);
      totalBytes += stats.size;
      if (stats.size > 5 * 1024 * 1024) {
        throw new Error(`File too large (>5MB): ${p}`);
      }
      if (totalBytes > 10 * 1024 * 1024) {
        throw new Error("Total attachment size exceeds 10MB.");
      }
      const lower = p.toLowerCase();
      if (!allowedExt.some((ext) => lower.endsWith(ext))) {
        throw new Error(`Unsupported file type: ${p}`);
      }
      const fileObj = await readFileAsFileObject(absolute);
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
      throw new Error(`URL: ${endpoint}\nStatus: ${res.status}\nResponse: ${errText}`);
    }

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let outPath = null;
    let downloadUrl = null;
    let signedUrl = null;

    if (storage && OUTPUT_BUCKET) {
      const objectName = `${OUTPUT_OBJECT_PREFIX}/${jobId}/output-${nowTimestamp()}.wav`;
      const bucket = storage.bucket(OUTPUT_BUCKET);
      const file = bucket.file(objectName);
      await file.save(buffer, { contentType: "audio/wav" });
      outPath = `gs://${OUTPUT_BUCKET}/${objectName}`;
      if (OUTPUT_PUBLIC_READ) {
        try {
          await file.makePublic();
          downloadUrl = `https://storage.googleapis.com/${OUTPUT_BUCKET}/${objectName}`;
        } catch (err) {
          // Public access prevention may block makePublic; fall back to signed URL
          console.warn(`[medcast] makePublic failed for ${objectName}: ${err?.message || err}`);
        }
      }
      const [signed] = await file.getSignedUrl({ version: "v4", action: "read", expires: Date.now() + OUTPUT_SIGNED_URL_SECONDS * 1000 });
      signedUrl = signed;
      downloadUrl = resolveDownloadUrl(jobId, downloadUrl || signed);
    } else {
      const resolvedOutputDir = outputDir ? path.resolve(process.cwd(), outputDir) : path.resolve(process.cwd(), path.join("mcp_outputs", "medcast"));
      await ensureDirectory(resolvedOutputDir);
      outPath = path.join(resolvedOutputDir, `output-${nowTimestamp()}.wav`);
      await fs.writeFile(outPath, buffer);
      downloadUrl = resolveDownloadUrl(jobId, null);
    }

    const updated = updateJob(jobId, { status: "succeeded", path: outPath, downloadUrl, signedUrl });
  } catch (err) {
    const message = err && err.name === "AbortError" ? "Request timed out (3 min)." : String(err.message || err);
    updateJob(jobId, { status: "failed", error: message });
  }
}

async function waitForJob(jobId, waitMs) {
  const promise = jobPromises.get(jobId);
  if (!promise) {
    // Job may have completed already; return immediately
    return getJob(jobId);
  }
  if (!Number.isFinite(waitMs) || waitMs <= 0) {
    return getJob(jobId);
  }
  try {
    await Promise.race([
      promise,
      new Promise((resolve) => setTimeout(resolve, waitMs)),
    ]);
  } catch (e) {
    // ignore; status will be read below
  }
  return getJob(jobId);
}

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

tools.set("medcast_job_status", {
  name: "medcast_job_status",
  description: "Check the status of a Medcast podcast job started via medcast_generate_podcast.",
  inputSchema: {
    type: "object",
    properties: {
      jobId: { type: "string", description: "Job identifier returned by medcast_generate_podcast" },
      waitMs: { type: "number", description: "Optional: block this call up to N ms for completion; returns final status if finished in time" },
    },
    required: ["jobId"],
  },
  async invoke(input) {
    const jobId = String(input.jobId || "").trim();
    if (!jobId) {
      return errorContent("Missing 'jobId'.");
    }

    const job = getJob(jobId);
    if (!job) {
      return errorContent(`Unknown job: ${jobId}`);
    }

    const requestedWait = Number.isFinite(input.waitMs) ? Number(input.waitMs) : 0;
    const canWait = job.status === "pending" || job.status === "running";
    const effectiveWait = canWait ? Math.max(requestedWait, AUTO_WAIT_MS) : 0;
    if (effectiveWait > 0 && canWait) {
      const after = await waitForJob(jobId, effectiveWait);
      if (FORCE_DL_ONLY && after && after.status === "succeeded") {
        const s = serializeJob(after);
        const url = s?.url || s?.downloadUrl || s?.signedUrl || "";
        return toTextContent(String(url));
      }
      return toJsonContent(serializeJob(after));
    }
    if (FORCE_DL_ONLY && job && job.status === "succeeded") {
      const s = serializeJob(job);
      const url = s?.url || s?.downloadUrl || s?.signedUrl || "";
      return toTextContent(String(url));
    }
    return toJsonContent(serializeJob(job));
  },
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
  const allowedOriginsEnv = process.env.MCP_ALLOWED_ORIGINS || "";
  const allowedOrigins = allowedOriginsEnv
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  app.use(
    cors({
      origin: allowedOrigins.length ? allowedOrigins : "*",
      exposedHeaders: ["Mcp-Session-Id"],
    })
  );

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

  // Signed or public download route for completed Medcast jobs
  // Download route: stateless fallback to GCS if in-memory job not present
  app.get("/files/medcast/:jobId", async (req, res) => {
    try {
      const jobId = String(req.params.jobId || "").trim();
      let job = getJob(jobId);
      if (!job && storage && OUTPUT_BUCKET) {
        // Try to find object by prefix: medcast/<jobId>/
        const [files] = await storage.bucket(OUTPUT_BUCKET).getFiles({ prefix: `${OUTPUT_OBJECT_PREFIX}/${jobId}/`, maxResults: 1 });
        if (files && files.length > 0) {
          const file = files[0];
          streamGcsFile(file, res, path.basename(file.name));
          return;
        }
      }
      if (!job) return res.status(404).json({ error: "Job not found" });
      if (job.status !== "succeeded" || !job.path) return res.status(409).json({ error: "Job not completed" });
      if (storage && job.path && job.path.startsWith("gs://")) {
        const withoutScheme = job.path.replace(/^gs:\/\//, "");
        const [bucketName, ...objectParts] = withoutScheme.split("/");
        if (!bucketName) {
          return res.status(500).json({ error: "Configured output path is missing a bucket name." });
        }
        const objectName = objectParts.join("/");
        const file = storage.bucket(bucketName).file(objectName);
        streamGcsFile(file, res, path.basename(objectName));
        return;
      }
      const absolutePath = path.resolve(job.path);
      res.setHeader("Content-Type", "audio/wav");
      const disposition = FORCE_ATTACHMENT ? "attachment" : "inline";
      res.setHeader("Content-Disposition", `${disposition}; filename="${path.basename(absolutePath)}"`);
      const read = await fs.readFile(absolutePath);
      res.status(200).end(read);
    } catch (e) {
      res.status(500).json({ error: String(e?.message || e) });
    }
  });

  app.listen(port, () => {
    console.log(`[${SERVER_NAME}] HTTP MCP listening on http://localhost:${port}/mcp`);
  });
}

Promise.all([startStdioIfRequested(), startHttpIfRequested()]).catch((err) => {
  console.error(`[${SERVER_NAME}] Fatal error:`, err);
  process.exit(1);
});
