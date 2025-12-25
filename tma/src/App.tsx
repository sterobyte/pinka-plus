import { useEffect } from "react";

declare global {
  interface Window {
    Telegram?: any;
  }
}

/**
 * Triple-A fullscreen для Telegram Mini App:
 * - WebApp.ready() + WebApp.expand()
 * - корректная высота через CSS var(--tg-viewport-height) (убирает белые полосы/сдвиги)
 * - object-fit: cover для pixel-perfect PNG
 */
export default function App() {
  useEffect(() => {
    const wa = window.Telegram?.WebApp;
    if (!wa) return;

    try {
      wa.ready?.();
      wa.expand?.();

      const onViewportChanged = () => {
        // Telegram сам обновляет CSS vars --tg-viewport-height/width на :root.
        // Слушатель держим, чтобы клиент не "засыпал" с неверным вьюпортом.
      };

      wa.onEvent?.("viewportChanged", onViewportChanged);
      return () => wa.offEvent?.("viewportChanged", onViewportChanged);
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
