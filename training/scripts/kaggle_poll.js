#!/usr/bin/env node
/**
 * Poll Kaggle kernel status every 5 minutes until it finishes (or fails).
 * Prints status updates with timestamps.
 */

const USERNAME = process.env.KAGGLE_USERNAME ?? "amittomar23";
const KEY = process.env.KAGGLE_KEY;
const KERNEL_SLUG = process.env.KAGGLE_KERNEL_SLUG ?? "marketing-llm-qlora-fine-tune";

if (!KEY) {
  console.error("KAGGLE_KEY required");
  process.exit(1);
}

const auth = "Basic " + Buffer.from(`${USERNAME}:${KEY}`).toString("base64");
const POLL_INTERVAL_MS = 5 * 60 * 1000;  // 5 min
const MAX_DURATION_MS = 3 * 60 * 60 * 1000;  // 3 hr safety cap

const startedAt = Date.now();

async function getStatus() {
  const url = `https://www.kaggle.com/api/v1/kernels/status?userName=${USERNAME}&kernelSlug=${KERNEL_SLUG}`;
  const res = await fetch(url, {
    headers: { "Authorization": auth, "Accept": "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Status check failed: HTTP ${res.status}`);
  }
  return res.json();
}

function ts() {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

async function main() {
  console.log(`[${ts()}] Starting poller for kernel ${USERNAME}/${KERNEL_SLUG}`);
  console.log(`[${ts()}] Polling every ${POLL_INTERVAL_MS/60000} min, max duration ${MAX_DURATION_MS/3600000}h`);

  while (true) {
    if (Date.now() - startedAt > MAX_DURATION_MS) {
      console.log(`[${ts()}] Timeout reached after ${MAX_DURATION_MS/3600000}h`);
      process.exit(1);
    }

    try {
      const status = await getStatus();
      const elapsed = Math.floor((Date.now() - startedAt) / 60000);
      console.log(`[${ts()}] elapsed=${elapsed}m status=${status.status} ${status.hasFailureMessage ? `failure=${status.failureMessage}` : ""}`);

      if (status.status === "complete") {
        console.log(`\n✓ COMPLETE after ${elapsed}m`);
        process.exit(0);
      }
      if (status.status === "error" || status.status === "cancelAcknowledged") {
        console.log(`\n✗ FAILED: ${status.failureMessage || status.status}`);
        process.exit(2);
      }
    } catch (err) {
      console.log(`[${ts()}] Poll error: ${err.message}`);
    }

    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
  }
}

main();
