# Kiln (blast-radius-demo)

One-page LLM workshop. Blast Radius watches this app.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Type a charge, click **Fire**. Drafts fire against a live model.

`POST /api/chat` `{ "prompt": "..." }` — real model call, then OTel ingest to Blast Radius (`service.version` = git SHA). Copy `.env.example` to `.env`.

Production traffic is ingested live against the git SHA Vercel deployed.
