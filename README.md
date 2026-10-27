# NexcoreVision

> **OCR sees characters. CNNs see objects. Vision models see context. Your text model should see evidence—not a 4 MB base64 blob.**

[![License: MIT](https://img.shields.io/badge/license-MIT-0ea5a6.svg)](LICENSE)
[![Node.js 22+](https://img.shields.io/badge/Node.js-22%2B-339933.svg)](https://nodejs.org/)
[![Local first](https://img.shields.io/badge/local--first-images%20stay%20local-2563eb.svg)](#privacy-and-security)
[![test](https://github.com/yan-stone-computer/NexcoreVision/actions/workflows/test.yml/badge.svg)](https://github.com/yan-stone-computer/NexcoreVision/actions/workflows/test.yml)

NexcoreVision is a small, inspectable visual-evidence layer for text-first AI agents. It runs **OCR**, optional **local CNN inference**, and an **independent vision model** in parallel, then gives the downstream language model a bounded Markdown report with sources kept separate.

The project exists for one reason: passing raw image payloads into a chat model is expensive, fragile, and often impossible under a 16K or 32K context window. A screenshot can contain a few hundred useful words and several megabytes of pixels. NexcoreVision extracts the useful evidence first.

```text
image
  ├─ local OCR ─────────────── exact visible text
  ├─ local CNN ─────────────── classes, objects, boxes, image quality
  └─ vision model ──────────── layout, relationships, scene semantics
                         ↓
              bounded evidence report
                         ↓
                 text-only agent
```

## What makes it different

- **Exact text and visual interpretation are separate.** OCR text wins for names, errors, labels, prices and code. The vision model explains what those things mean.
- **The main model never receives the original image by default.** It receives a bounded evidence report, so image size does not consume its context budget.
- **Failures are partial, not fatal.** If the cloud vision endpoint fails, OCR and local CNN results still survive.
- **Three inference layers are independent.** A conflict is surfaced instead of being silently summarized away.
- **No mandatory runtime dependency.** The core is TypeScript + Node.js standard library. Local CNN inference is an opt-in Python/torchvision adapter.
- **No hidden service.** Images are processed locally unless you explicitly configure a vision API.

## Quick start

Requirements:

- Node.js 22.13+
- Windows OCR language pack, or an installed `tesseract` executable
- Optional: Python 3 + `torch`, `torchvision`, `Pillow` for local CNN analysis

```bash
git clone https://github.com/yan-stone-computer/NexcoreVision.git
cd NexcoreVision

# OCR only
npm run cli -- screenshot.png

# OCR + local MobileNetV3 classification + SSDLite object detection
npm run cli -- screenshot.png --deep

# Add an independent OpenAI-compatible vision model
NEXCORE_VISION_API_KEY=... npm run cli -- screenshot.png --deep \
  --question "为什么这个页面上的保存按钮是灰色？" \
  --vision-base-url https://your-provider.example/v1 \
  --vision-model your-vision-model
```

On Windows PowerShell:

```powershell
$env:NEXCORE_VISION_API_KEY = "..."
npm run cli -- .\screenshot.png --deep `
  --vision-base-url https://your-provider.example/v1 `
  --vision-model your-vision-model
```

## Example evidence

~~~md
## Visual evidence

### Local OCR · Windows.Media.Ocr · zh-Hans-CN

```text
保存失败：HTTP 401
当前模型：deepseek-chat
```

### Independent vision model · vision-model-2026

The page shows a modal error. The primary button is disabled and the status
message points to an authentication failure.

### Local deep vision · torchvision MobileNetV3 + SSDLite · cpu

Image: 900 × 2000
Quality: brightness 160.2, contrast 54.1
Top CNN classes:
- desktop computer: 81.0%
Detected objects:
- laptop: 72.0% at [20, 300, 800, 1200]

### Evidence rules

- Literal visible text: prefer the OCR transcript.
- Objects, layout, relationships and visual semantics: use the vision model.
- Keep disagreements explicit. Do not silently merge conflicting claims.
~~~

## CLI

```text
nexcore-vision <image> [options]

--question <text>       Focus the visual analysis
--ocr <mode>            auto | windows | tesseract | off
--deep                  Enable local torchvision CNN inference
--python <path>         Python executable for local deep vision
--deep-min-score <n>    Object confidence threshold
--vision-base-url <url> OpenAI-compatible /v1 base URL
--vision-model <name>   Vision model identifier
--vision-key <key>      API key; environment variables are safer
--max-chars <number>    Evidence budget, default 14000
--json                  Structured JSON output
```

Environment variables:

| Variable | Purpose |
| --- | --- |
| `NEXCORE_VISION_API_KEY` | API key for the optional vision endpoint |
| `NEXCORE_VISION_PYTHON` | Python executable used by `--deep` |
| `NEXCORE_VISION_DEVICE` | `cpu`, `cuda`, `mps` or `auto` |
| `TESSERACT_LANGS` | OCR languages, default `chi_sim+eng` |

## Library API

```ts
import {
  analyzeImage,
  openAICompatibleVision
} from "nexcorevision";

const result = await analyzeImage({
  imagePath: "./screenshot.png",
  question: "这个错误应该怎么修？",
  ocr: "auto",
  deep: true,
  vision: openAICompatibleVision({
    baseUrl: "https://your-provider.example/v1",
    apiKey: process.env.NEXCORE_VISION_API_KEY,
    model: "your-vision-model"
  }),
  maxEvidenceCharacters: 12_000
});

console.log(result.markdown);
console.log(result.warnings);
```

`analyzeImage()` returns separate `ocr`, `deep` and `vision` objects plus the fused Markdown. A downstream agent can therefore cite exactly which layer supplied a claim.

## Local deep vision

`src/deep_vision.py` uses pretrained torchvision CNNs:

- **MobileNetV3 Large** for image classification.
- **SSDLite320 MobileNetV3** for object detection and normalized boxes.
- Pillow statistics for basic brightness and contrast.

```bash
python -m pip install torch torchvision pillow
python src/deep_vision.py screenshot.png --min-score 0.35
```

The first run downloads pretrained weights from PyTorch. They are cached outside the repository. Image pixels never leave the machine. `--deep` is opt-in because the initial model download and CPU inference are not free in time.

## Privacy and security

- OCR and CNN inference run locally.
- A remote vision request is made only when you construct and pass a `vision` adapter.
- API keys are never printed or included in evidence.
- Image text is treated as untrusted data, not as instructions.
- Evidence is capped before it reaches the downstream model.
- Child processes receive file paths as argument arrays, never through a shell string.

## Limits

- OCR cannot infer objects, relationships or intent.
- Object detection uses a finite label vocabulary and is not a replacement for a capable VLM.
- A classifier confidence score is not a truth probability.
- Video, animation timing and temporal reasoning are not part of this version.
- Windows OCR requires a language pack. Tesseract must be installed separately.
- The local CNN layer requires Python and PyTorch; the OCR + cloud VLM path does not.

## Roadmap

- PaddleOCR / RapidOCR adapters
- Optional CLIP zero-shot labels
- Page-layout detection for screenshots and documents
- ONNX Runtime backend without Python
- Evaluation set for OCR-to-VLM conflict detection
- Multi-frame visual evidence for animation and video

## Contribute

Useful contributions are adapter implementations, reproducible visual test cases and evidence-fusion evaluations. Please run `npm test` before opening a pull request. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT. See [LICENSE](LICENSE).
