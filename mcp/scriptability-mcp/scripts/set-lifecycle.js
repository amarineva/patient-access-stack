import { Storage } from "@google-cloud/storage";

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const [k, v] = arg.split("=", 2);
      const key = k.replace(/^--/, "");
      if (typeof v === "string") {
        args[key] = v;
      } else {
        const next = argv[i + 1];
        if (next && !next.startsWith("--")) {
          args[key] = next;
          i++;
        } else {
          args[key] = true;
        }
      }
    }
  }
  return args;
}

function usage() {
  console.log("Usage: node ./scripts/set-lifecycle.js --bucket <bucket> [--days 1] [--prefix uploads]");
  console.log("Environment fallbacks: MCP_UPLOAD_BUCKET or MCP_OUTPUT_BUCKET for --bucket; MCP_UPLOAD_OBJECT_PREFIX for --prefix");
}

async function main() {
  const args = parseArgs(process.argv);
  const bucketName = args.bucket || process.env.MCP_UPLOAD_BUCKET || process.env.MCP_OUTPUT_BUCKET;
  const days = Number.isFinite(parseInt(args.days, 10)) ? parseInt(args.days, 10) : 1;
  const prefixRaw = args.prefix || process.env.MCP_UPLOAD_OBJECT_PREFIX || "uploads";
  const prefix = prefixRaw.endsWith("/") ? prefixRaw : `${prefixRaw}/`;

  if (!bucketName) {
    usage();
    process.exit(2);
  }

  const storage = new Storage();
  const bucket = storage.bucket(bucketName);

  const rule = {
    action: { type: "Delete" },
    condition: { age: days, matchesPrefix: [prefix] }
  };

  try {
    await bucket.setMetadata({ lifecycle: { rule: [rule] } });
    console.log(`Lifecycle set on gs://${bucketName}: delete objects with prefix '${prefix}' after ${days} day(s).`);
  } catch (e) {
    console.error(`Failed to set lifecycle on gs://${bucketName}:`, e?.message || e);
    process.exit(1);
  }
}

main();


