# Kiln (blast-radius-demo)

One-page LLM workshop. Blast Radius watches this app.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Type a charge, click **Fire**.

`POST /api/chat` `{ "prompt": "..." }` — real model call, then OTel ingest to Blast Radius (`service.version` = git SHA). Copy `.env.example` to `.env`.

Notes:
- Serves `gpt-4o` with a house-style system prompt.
- Prompts are enriched with order context on the request path (~800ms, HTTP span only).
- Prompts containing the word "escalate" fail closed with a 502 before the model call.
