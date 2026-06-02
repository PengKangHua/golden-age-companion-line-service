# Security Policy

## Supported Versions

This repository is an early prototype. Security and safety reports should target the current `main` branch.

## Reporting a Vulnerability

Please do not disclose vulnerabilities, sensitive safety failures, private data exposure, or abuse paths in a public issue.

Report privately to the maintainer through GitHub's private vulnerability reporting if enabled. If that is not available, contact the maintainer through the email listed on the maintainer's GitHub profile.

Please include:

- A short description of the issue.
- Reproduction steps or affected routes.
- Whether the issue exposes secrets, personal data, payment behavior, LINE webhook validation, or senior-safety risk.
- Any suggested fix or mitigation.

## Scope

In scope:

- LINE webhook signature handling.
- Simulator routes and local API behavior.
- Storage of messages, events, and image metadata.
- Fake-payment tracking.
- Safety wording that could misrepresent medical, legal, financial, emergency, OCR, or payment capabilities.

Out of scope:

- Social engineering against maintainers.
- Denial-of-service testing against public infrastructure.
- Scanning systems or repositories you do not own or lack permission to test.

## Current Safety Boundaries

- The current service is deterministic and does not call a live LLM.
- Image intake is metadata-only and does not perform OCR.
- Fake payment never charges or creates an order.
- This project is not a medical, legal, financial, or emergency service.
