#!/usr/bin/env node
import { analyzeImage, openAICompatibleVision } from "./index.ts";

function usage() {
  console.log(`NexcoreVision

Usage:
  nexcore-vision <image> [options]

Options:
  --question <text>       Focus the visual analysis
  --ocr <mode>            auto | windows | tesseract | off (default: auto)
  --deep                  Enable local torchvision CNN classification + object detection
  --python <path>         Python executable for local deep vision
  --deep-min-score <n>    Object confidence threshold (default: 0.35)
  --vision-base-url <url> OpenAI-compatible /v1 base URL
  --vision-model <name>   Vision model identifier
  --vision-key <key>      API key (prefer NEXCORE_VISION_API_KEY)
  --max-chars <number>    Evidence budget (default: 14000)
  --json                  Print structured JSON
  --help                  Show this help
`);
}

const args = process.argv.slice(2);
if (!args.length || args.includes("--help") || args.includes("-h")) {
  usage();
  process.exit(0);
}

const imagePath = args.find((item, index) => !item.startsWith("--") && !args[index - 1]?.startsWith("--"));
if (!imagePath) {
  usage();
  process.exit(1);
}

const value = (name: string) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};

const baseUrl = value("--vision-base-url");
const model = value("--vision-model");
const apiKey = value("--vision-key") || process.env.NEXCORE_VISION_API_KEY;
const ocr = (value("--ocr") || "auto") as "auto" | "windows" | "tesseract" | "off";
const maxCharacters = Number(value("--max-chars") || 14_000);
const deepMinScore = Number(value("--deep-min-score") || 0.35);

const result = await analyzeImage({
  imagePath,
  question: value("--question"),
  ocr,
  deep: args.includes("--deep"),
  python: value("--python"),
  deepMinScore: Number.isFinite(deepMinScore) ? deepMinScore : 0.35,
  maxEvidenceCharacters: Number.isFinite(maxCharacters) ? maxCharacters : 14_000,
  vision: baseUrl && model ? openAICompatibleVision({ baseUrl, model, apiKey }) : undefined
});

if (args.includes("--json")) console.log(JSON.stringify(result, null, 2));
else {
  console.log(result.markdown);
  if (result.warnings.length) {
    console.error("\nWarnings:\n" + result.warnings.map(item => `- ${item}`).join("\n"));
  }
}
