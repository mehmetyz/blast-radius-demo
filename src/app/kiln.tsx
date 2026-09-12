"use client";

import { FormEvent, useState } from "react";

type ChatResponse = {
  reply?: string;
  error?: string;
  ingest_ok?: boolean;
  sha?: string;
  model?: string;
};

export default function Kiln() {
  const [prompt, setPrompt] = useState("");
  const [reply, setReply] = useState("");
  const [status, setStatus] = useState("hearth cold");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const text = prompt.trim();
    if (!text || busy) return;
    setBusy(true);
    setError("");
    setStatus("kiln at temp");
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: text }),
      });
      const data = (await res.json()) as ChatResponse;
      if (!res.ok) {
        throw new Error(data.error ?? `request failed (${res.status})`);
      }
      setReply(data.reply ?? "");
      const short = data.sha ? data.sha.slice(0, 7) : "";
      setStatus(
        data.ingest_ok
          ? `glaze set · ${short}`
          : `glaze set · ingest missed${short ? ` · ${short}` : ""}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "firing failed");
      setStatus("hearth cold");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col px-5 py-8 sm:px-8 sm:py-12">
      <header className="mb-10 flex items-end justify-between gap-6 border-b border-[#3d2c22] pb-6">
        <div>
          <p className="font-[family-name:var(--font-mono)] text-[11px] tracking-[0.22em] text-ash uppercase">
            internal · support drafts
          </p>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-5xl font-medium tracking-tight text-clay sm:text-6xl">
            Kiln
          </h1>
        </div>
        <p className="max-w-[14rem] text-right font-[family-name:var(--font-mono)] text-[11px] leading-5 text-ash">
          {status}
        </p>
      </header>

      <form onSubmit={onSubmit} className="flex flex-1 flex-col gap-0">
        <label htmlFor="prompt" className="mb-2 font-[family-name:var(--font-mono)] text-[11px] tracking-[0.18em] text-ash uppercase">
          Charge
        </label>
        <textarea
          id="prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Write the customer reply you want fired…"
          rows={7}
          className="w-full resize-y rounded-none border border-[#3d2c22] bg-soot px-4 py-3 font-[family-name:var(--font-sans)] text-base leading-relaxed text-clay outline-none placeholder:text-ash/70 focus:border-copper"
        />
        <div className="thermocouple" data-hot={busy ? "true" : "false"} />
        <div className="mt-5 flex items-center justify-between gap-4">
          <p className="font-[family-name:var(--font-mono)] text-[11px] text-ash">
            One prompt. One firing.
          </p>
          <button
            type="submit"
            disabled={busy || !prompt.trim()}
            className="rounded-none bg-copper px-5 py-2 font-[family-name:var(--font-mono)] text-xs tracking-[0.16em] text-brick uppercase disabled:opacity-40"
          >
            {busy ? "Firing…" : "Fire"}
          </button>
        </div>
      </form>

      {error ? (
        <p className="mt-8 border border-ember/40 bg-soot px-4 py-3 text-sm text-ember" role="alert">
          {error}
        </p>
      ) : null}

      <section className="mt-10 border-t border-[#3d2c22] pt-6">
        <h2 className="font-[family-name:var(--font-mono)] text-[11px] tracking-[0.18em] text-ash uppercase">
          Glaze
        </h2>
        {reply ? (
          <p className="mt-3 whitespace-pre-wrap font-[family-name:var(--font-display)] text-xl leading-snug text-glaze">
            {reply}
          </p>
        ) : (
          <p className="mt-3 text-sm text-ash">No firing yet. Write a charge and pull Fire.</p>
        )}
      </section>
    </main>
  );
}
