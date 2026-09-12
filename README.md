# Kiln (blast-radius-demo)

One-page LLM workshop. Blast Radius watches this app.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Type a charge, click **Fire**.

`POST /api/chat` `{ "prompt": "..." }` — real model call, then OTel ingest to Blast Radius (`service.version` = git SHA). Copy `.env.example` to `.env`.

New endpoints:
- `GET /api/health` — light canary, sub-5ms.
- `POST /api/report` `{ "items": [{ "name": "...", "qty": n }] }` — heavy report build (~220ms per item), a `buildReport` function span is ingested.
- `GET /api/orders?order_id=N` — order lookup; ids divisible by 7 are quarantined (503), missing/invalid ids fail (500).

Known rehearsed failure modes:
- Chat: prompts containing "escalate" fail closed before the LLM call (502).
- Report: line items without a `name` crash the build (500).
- Orders: `order_id` missing or non-numeric (500); `order_id % 7 === 0` quarantined (503).
