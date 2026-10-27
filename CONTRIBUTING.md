# Contributing

Issues and pull requests are welcome.

## Useful contributions

- New OCR or deep-vision adapters.
- Reproducible image cases where OCR and a vision model disagree.
- Better evidence fusion and confidence reporting.
- Cross-platform packaging.
- Performance and memory measurements on real screenshots.

## Before opening a PR

```bash
npm test
python src/deep_vision.py image.png --check   # optional, when touching the deep backend
```

Please keep image data, credentials and private screenshots out of commits. If a bug needs a fixture, redact it or generate a synthetic image.

## Design constraints

- Keep OCR, local deep vision and remote vision independently degradable.
- Never silently drop a source failure.
- Never put credentials in evidence.
- Keep the default evidence budget bounded.
- Prefer standard Node.js and Python APIs over new runtime dependencies.
