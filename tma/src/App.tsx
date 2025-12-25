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

    // Попытка true fullscreen (как BLUM / Tiny Verse)
    try {
      if (tg.requestFullscreen) {
        tg.requestFullscreen();
      }
    } catch {}

    // Fallback — максимум без шапки не гарантируем, но растягиваемся
    try {
      if (tg.expand) {
        tg.expand();
      }
    } catch {}
  }, []);

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background: "#000", // или твой welcome
      }}
    >
      {/* твой welcome / UI */}
    </div>
  );
}
