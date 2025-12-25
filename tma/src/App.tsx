import { useEffect } from "react";

declare global {
  interface Window {
    Telegram?: any;
  }
}

/**
 * Fullscreen splash (stable):
 * - expand() to request full height
 * - NO safe-area padding on container (it was shifting the image)
 * - viewport height uses Telegram vars + dvh fallback
 */
export default function App() {
  useEffect(() => {
    const wa = window.Telegram?.WebApp;
    if (!wa) return;

    try {
      wa.ready?.();
      wa.expand?.();
    } catch {
      // ignore
    }
  }, []);

  return (
    <div className="pp-viewport">
      <img className="pp-bg" src="/welcome.png" alt="Pinka Plus" />
    </div>
  );
}
