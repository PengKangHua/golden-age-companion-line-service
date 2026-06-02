# Contributing

Thanks for helping improve Golden Age Companion LINE Service. This project is an early prototype for senior-friendly companion and scam-assistance workflows, so changes should stay conservative, testable, and explicit about safety boundaries.

## Local Setup

```bash
npm install
cp .env.example .env
npm run dev
```

Open `http://localhost:3000` and use the simulator.

## Verification

Run these before opening a pull request:

```bash
npm test
npm run typecheck
npm run build
```

The test suite should remain deterministic. Avoid adding live API calls, network calls, or timing-dependent tests unless the behavior is isolated and clearly documented.

## Pull Request Expectations

- Keep changes focused on one behavior or workflow.
- Add or update tests for behavior changes.
- Do not commit `.env`, `.data`, logs, local SQLite files, or generated build output.
- Keep senior-safety and anti-scam claims narrow. Do not imply medical, legal, financial, emergency, OCR, or payment capabilities unless they are actually implemented and reviewed.
- If a change affects LINE webhook behavior, simulator behavior, fake-payment tracking, image intake, or companion tone, describe the user-facing impact in the PR.

## Safety Review Notes

Before proposing real-user testing, review:

- AI identity disclosure.
- Crisis or high-risk language handling.
- Scam and payment wording.
- Privacy expectations for screenshots and message content.
- Whether escalation guidance is clear and local-context appropriate.

## Maintainer Workflow

Maintainers should prefer small PRs, direct tests, and explicit release notes. Codex-assisted review is welcome for:

- Pull request review summaries.
- Regression-risk checks.
- Release checklist generation.
- Security and safety wording review.
