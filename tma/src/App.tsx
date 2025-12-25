import React, { useEffect, useState } from "react";

type EnsureResp =
  | { ok: true; user: any; meta?: any }
  | { ok: false; error: string };

const ADMIN_API = import.meta.env.VITE_ADMIN_API_URL as string;

function getInitData(): string {
  return window.Telegram?.WebApp?.initData || "";
}

export default function App() {
  const [status, setStatus] = useState("idle");
  const [resp, setResp] = useState<any>(null);
  const isTelegram = Boolean(window.Telegram?.WebApp);

  useEffect(() => {
    try {
      window.Telegram?.WebApp?.ready?.();
      window.Telegram?.WebApp?.expand?.();
    } catch {}
  }, []);

  async function sync() {
    setStatus("loading");
    setResp(null);

    const initData = getInitData();

    try {
      const r = await fetch(`${ADMIN_API}/api/users/ensure`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ initData, meta: { source: "tma" } }),
      });

      const j = (await r.json()) as EnsureResp;
      setResp(j);
      setStatus(j.ok ? "ok" : "error");
    } catch (e: any) {
      setResp({ ok: false, error: String(e?.message || e) });
      setStatus("error");
    }
  }

  return (
    <div
      style={{
        fontFamily:
          "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
        padding: 18,
        maxWidth: 760,
      }}
    >
      <h1 style={{ margin: 0 }}>Pinka Plus</h1>
      <p style={{ marginTop: 8, opacity: 0.8 }}>
        MVP: пустое мини-приложение, которое сохраняет учетку юзера в MongoDB.
      </p>

      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          marginTop: 14,
          flexWrap: "wrap",
        }}
      >
        <button
          onClick={sync}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #ccc",
            background: "#111",
            color: "white",
          }}
        >
          Sync account
        </button>
        <span style={{ opacity: 0.75 }}>
          api: <code>{ADMIN_API}</code> • telegram:{" "}
          <b>{isTelegram ? "yes" : "no"}</b> • status: <b>{status}</b>
        </span>
      </div>

      <pre
        style={{
          marginTop: 16,
          padding: 12,
          borderRadius: 12,
          background: "#f6f6f6",
          overflow: "auto",
        }}
      >
        {resp ? JSON.stringify(resp, null, 2) : "Нажми Sync account"}
      </pre>
    </div>
  );
}
