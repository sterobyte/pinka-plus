import { useEffect } from "react";

declare global {
  interface Window {
    Telegram?: any;
  }
}

export default function App() {
  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (!tg) return;

    tg.ready();

    // auto-fullscreen как у BLUM
    try {
      tg.requestFullscreen?.();
    } catch {}

    // fallback
    try {
      tg.expand?.();
    } catch {}
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,               // 🔑 ключ
        width: "100%",
        height: "100%",
        margin: 0,
        padding: 0,
        background: "#000",
        overflow: "hidden",
      }}
    >
      <img
        src="/welcome.png"
        alt="welcome"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
        }}
      />
    </div>
  );
}
