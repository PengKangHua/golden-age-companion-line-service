## Summary

- 

## Verification

```bash
npm test
npm run typecheck
npm run build
```

## Safety review

- [ ] Does not overclaim medical, legal, financial, emergency, OCR, payment, or live-LLM capability.
- [ ] Preserves AI identity disclosure where relevant.
- [ ] Does not commit `.env`, `.data`, logs, local SQLite files, or generated build output.
- [ ] Documents user-facing changes to LINE webhook, simulator, image intake, fake payment, or companion tone.
