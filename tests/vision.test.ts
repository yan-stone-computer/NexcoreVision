import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { fuseEvidence, openAICompatibleVision, truncateEvidence } from "../src/index.ts";

test("fusion keeps OCR, deep vision and model evidence separate", () => {
  const fused = fuseEvidence({
    ocr: {
      ok: true,
      engine: "Windows.Media.Ocr",
      language: "zh-Hans-CN",
      text: "错误代码 ETIMEDOUT"
    },
    deep: {
      ok: true,
      engine: "torchvision MobileNetV3 + SSDLite",
      device: "cpu",
      image: { width: 900, height: 2000 },
      quality: { brightness: 160.2, contrast: 54.1 },
      classification: [{ label: "desktop computer", score: 0.81 }],
      detections: [{
        label: "laptop",
        score: 0.72,
        box: { x1: 20, y1: 300, x2: 800, y2: 1200 }
      }]
    },
    vision: {
      ok: true,
      model: "vision-test",
      text: "A settings page with a blue primary button."
    },
    maxCharacters: 4000
  });

  assert.match(fused.markdown, /Windows\.Media\.Ocr/);
  assert.match(fused.markdown, /ETIMEDOUT/);
  assert.match(fused.markdown, /desktop computer: 81\.0%/);
  assert.match(fused.markdown, /laptop: 72\.0%/);
  assert.match(fused.markdown, /A settings page/);
  assert.match(fused.markdown, /prefer the OCR transcript/);
});

test("evidence truncation respects the downstream context budget", () => {
  const result = truncateEvidence("line\n".repeat(2000), 200);
  assert.equal(result.truncated, true);
  assert.ok(result.text.length < 300);
  assert.match(result.text, /Evidence truncated/);
});

test("OpenAI-compatible adapter sends image blocks and reads text content", async () => {
  let received: Record<string, any> | null = null;
  const server = createServer(async (req, res) => {
    let raw = "";
    for await (const chunk of req) raw += chunk;
    received = { headers: req.headers, body: JSON.parse(raw) };
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      model: "vision-test-2026",
      choices: [{ message: { content: "图片里是一个设置页面。" } }]
    }));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const port = (server.address() as { port: number }).port;
    const adapter = openAICompatibleVision({
      baseUrl: `http://127.0.0.1:${port}/v1`,
      apiKey: "local-test-key",
      model: "vision-test"
    });
    const result = await adapter({
      prompt: "描述这张图",
      imageUrl: "data:image/png;base64,iVBORw0KGgo=",
      signal: new AbortController().signal
    });
    assert.equal(result.text, "图片里是一个设置页面。");
    assert.equal(result.model, "vision-test-2026");
    assert.equal(received?.headers.authorization, "Bearer local-test-key");
    assert.equal(received?.body.model, "vision-test");
    assert.equal(received?.body.messages[0].content[1].type, "image_url");
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
