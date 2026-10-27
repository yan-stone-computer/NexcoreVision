# Security

## Reporting

Do not open a public issue for credential leakage, command injection, path traversal or prompt injection that can cause unsafe tool execution. Report privately to the repository owner.

## Security model

- Images are local by default.
- OCR and CNN child processes receive argument arrays, not shell command strings.
- Remote vision is opt-in through a caller-supplied adapter.
- Text extracted from images is data, not instructions.
- Evidence is capped before entering a downstream agent context.
- API keys belong in environment variables and must never be committed.

## Known limitations

OCR and vision models can be wrong. Confidence scores are model outputs, not security decisions. Do not use this project as the sole authority for financial, medical, legal or access-control decisions.
