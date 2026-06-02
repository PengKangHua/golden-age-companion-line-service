# Validation Notes

The current prototype is designed for local validation before real-user testing.

## What Can Be Validated Locally

- Whether a first-time senior user can start without setup.
- Whether AI identity disclosure is visible in the conversation.
- Whether companion tone scenarios feel calm and non-pushy.
- Whether suspicious-message triage avoids overclaiming certainty.
- Whether fake-payment events can measure interest without charging.
- Whether proactive check-in cadence can be tested deterministically.

## Local Checks

Run:

```bash
npm test
npm run typecheck
npm run build
```

Use the simulator at `http://localhost:3000` and inspect:

- first-run chat,
- loneliness and family-missing scenarios,
- scam-anxiety scenario,
- image intake,
- cadence adjustment,
- fake-payment view/click/abandon events,
- metrics summary.

## Before Real-User Testing

- Review consent and privacy language.
- Confirm escalation wording for distress and urgent-risk language.
- Confirm no medical, legal, financial, or emergency-service claim is made.
- Confirm image intake expectations are clear.
- Confirm fake-payment tests are visibly not real purchases.
