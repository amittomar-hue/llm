#!/usr/bin/env node
/**
 * Push the Marketing LLM training notebook to Kaggle as a non-interactive kernel
 * via the official Kaggle REST API (no kaggle CLI required).
 *
 * Reads credentials from KAGGLE_USERNAME + KAGGLE_KEY env vars.
 * Reads the notebook from ../marketing_llm_finetune.ipynb.
 *
 * Kaggle's push API runs the kernel automatically (no separate trigger needed).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const NB_PATH = path.resolve(__dirname, "../marketing_llm_finetune.ipynb");

const USERNAME = process.env.KAGGLE_USERNAME;
const KEY = process.env.KAGGLE_KEY;

if (!USERNAME || !KEY) {
  console.error("KAGGLE_USERNAME and KAGGLE_KEY env vars required");
  process.exit(1);
}

const authHeader = "Basic " + Buffer.from(`${USERNAME}:${KEY}`).toString("base64");
const notebookText = fs.readFileSync(NB_PATH, "utf-8");

// Updating existing kernel: pass numeric id of the previous push
const payload = {
  id: 120907273,
  slug: "marketing-llm-qlora-fine-tune",
  text: notebookText,
  language: "python",
  kernelType: "notebook",
  isPrivate: true,
  enableGpu: true,
  enableTpu: false,
  enableInternet: true,
  // Undocumented fields — try multiple names to coerce T4×2
  gpuType: "GpuT4x2",
  acceleratorType: "GpuT4x2",
  accelerator: "GpuT4x2",
  datasetDataSources: [],
  competitionDataSources: [],
  kernelDataSources: [],
  modelDataSources: [],
  categoryIds: [],
  dockerImagePinningType: "original",
};

console.log("Pushing notebook to Kaggle...");
const res = await fetch("https://www.kaggle.com/api/v1/kernels/push", {
  method: "POST",
  headers: {
    "Authorization": authHeader,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(payload),
});

const text = await res.text();
console.log(`HTTP ${res.status}`);
console.log(text);
