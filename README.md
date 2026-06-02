# Golden Age Companion LINE Service

Golden Age Companion LINE Service is an open-source prototype toolkit for builders working on senior-friendly companion services in Taiwan. It is LINE-first: a 65-75 year-old user can start chatting with no setup, receive low-friction companionship, send suspicious content for "help me look at this", and interact with fake-door paid offers without any real payment.

The project is intentionally deterministic in its current form. That makes it suitable for QA, screenshots, early user-test preparation, and maintainer review before connecting live LLM workflows.

## What This Builds

- LINE webhook backend for text and image message events.
- Local web simulator that behaves like a LINE chat.
- Deterministic companion agent with:
  - first-run low-friction messages,
  - AI identity disclosure,
  - companionship replies,
  - senior daily-chat tone scenarios,
  - cadence adjustment from natural language,
  - suspicious content and document/offer analysis,
  - fake-door payment offers.
- Validation loop with:
  - deterministic A/B cadence grouping,
  - product event tracking,
  - proactive check-in due-user calculation,
  - local scheduler execution through the simulator.
- SQLite-backed storage using Node 24 built-in `node:sqlite`.

## Why Open Source

Senior-care and anti-scam products need careful handling before they are put in front of real older adults. This repository keeps the early workflow inspectable: builders can review the simulator, tests, tone templates, fake-payment loop, and safety boundaries before adapting it to their own context.

Current focus areas:

- LINE-first onboarding for older adults.
- Companion tone that does not overclaim human identity.
- Scam-message and suspicious-offer triage patterns.
- Local validation metrics before real payment, OCR, or live LLM use.

## Setup

Requires Node.js 24 or newer.

```bash
npm install
cp .env.example .env
npm run dev
```

Open:

```text
http://localhost:3000
```

The simulator defaults to user id `demo-user`.

## Scripts

```bash
npm run dev
npm run typecheck
npm test
npm run build
```

## Optional LINE Configuration

Set these in `.env` when connecting to a real LINE channel:

```bash
LINE_CHANNEL_ACCESS_TOKEN=your-token
LINE_CHANNEL_SECRET=your-secret
```

Webhook URL:

```text
POST /line/webhook
```

When LINE credentials are not configured, the local simulator and unsigned webhook development still work.

## Simulator Flows

- Click `跟我聊聊` to trigger first-run companion messages.
- Try companion tone scenarios:

```text
今天有點悶，不知道要跟誰說話
我有點想女兒，但不想一直打擾她
昨晚睡不好，今天很累
今天身體有點酸，走路沒什麼力
我怕又被騙，心裡一直不安心
```

- Click `幫我看一下`, then paste suspicious text like:

```text
幫我看一下 這個投資叫我點連結轉帳
```

- Click `模擬截圖` to test image intake. The current behavior records the image event and asks the user to paste or explain the key text; it does not run OCR yet.
- Click `少一點` or `多一點` to test cadence adjustment.
- Click fake-door plans to record plan views, then either `申請試用目前方案` or a reason for not applying. No real payment is made.
- Use the validation panel to inspect recent events, check due users, run the local scheduler, and send a simulated proactive check-in.

## Validation APIs

```text
GET  /api/sim/events/:userId
GET  /api/sim/metrics
POST /api/sim/image
POST /api/sim/fake-payment-view
POST /api/sim/fake-payment-abandon
GET  /api/sim/due-check-ins?now=2026-05-24T00:00:00.000Z
POST /api/sim/run-scheduler
```

Example:

```bash
curl "http://localhost:3000/api/sim/due-check-ins?now=2026-05-26T00:00:00.000Z"
curl -X POST http://localhost:3000/api/sim/run-scheduler \
  -H "Content-Type: application/json" \
  -d '{"now":"2026-05-26T00:00:00.000Z","limit":10}'
```

## Safety Boundaries

- This prototype is not a medical, legal, financial, or emergency service.
- Image intake is metadata-only; the system does not download, OCR, or claim to understand image content.
- Fake payment is for willingness-to-pay validation only. It does not charge, create an order, or claim purchase success.
- The current companion logic is deterministic and does not call a live LLM.
- Real user testing should include local safety review, consent, privacy review, and escalation planning.

## Data

Default database path:

```text
.data/companion.sqlite
```

Tables:

- `users`
- `messages`
- `memories`
- `fake_payment_events`
- `events`

Experiment groups:

- `weekly_3`: starts at `three_per_week`.
- `daily_1`: starts at `daily`.

The current prototype assigns groups deterministically from `userId` so repeated local tests are stable.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for local setup, pull request expectations, and safety review notes.

## Security

Please do not open public issues for suspected vulnerabilities or sensitive safety failures. See [SECURITY.md](SECURITY.md).

## License

MIT. See [LICENSE](LICENSE).
