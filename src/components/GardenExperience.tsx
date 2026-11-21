import { useEffect, useRef, useState } from "react";

import type { GardenHandle } from "@/lib/garden-scene";

export function GardenExperience() {
  const mountRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<GardenHandle | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const el = mountRef.current;
    if (!el) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    import("@/lib/garden-scene")
      .then(({ createGardenScene }) => {
        if (cancelled) return;
        handleRef.current = createGardenScene(el, {
          reducedMotion,
          onReady: () => !cancelled && setReady(true),
        });
      })
      .catch((err) => {
        console.error(err);
        setFailed(true);
      });
    return () => {
      cancelled = true;
      handleRef.current?.dispose();
      handleRef.current = null;
    };
  }, []);

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-background text-foreground">
      <div ref={mountRef} className="absolute inset-0" aria-label="Taman mawar 3D interaktif" role="img" />
      <div className="garden-vignette pointer-events-none absolute inset-0" />

      <header
        className={`pointer-events-none absolute left-0 top-0 p-6 sm:p-10 transition-all duration-[1600ms] ${
          ready ? "translate-y-0 opacity-100" : "-translate-y-3 opacity-0"
        }`}
      >
        <p className="font-sans text-xs uppercase tracking-[0.35em] text-accent text-glow">
          Sebuah kisah di taman
        </p>
        <h1 className="mt-3 max-w-md font-display text-4xl italic leading-[0.95] text-foreground text-glow sm:text-6xl">
          Di Bawah Lengkungan Mawar
        </h1>
      </header>

      <div
        className={`absolute inset-x-0 bottom-0 flex justify-center p-4 sm:p-8 transition-all delay-700 duration-[1400ms] ${
          ready ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
        }`}
      >
        <div className="glass-panel flex max-w-2xl flex-col items-center gap-3 rounded-2xl px-5 py-4 sm:flex-row sm:gap-6">
          <p className="text-center font-sans text-sm text-muted-foreground sm:text-left">
            Gerakkan kursor atau geser layar untuk menjelajah. Ketuk pasangan, hewan, atau kupu-kupu.
          </p>
          <button
            type="button"
            className="btn-bloom shrink-0"
            onClick={() => handleRef.current?.summonButterfly()}
          >
            Panggil kupu-kupu
          </button>
        </div>
      </div>

      <div
        className={`pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background transition-opacity duration-1000 ${
          ready ? "opacity-0" : "opacity-100"
        }`}
      >
        <div className="loader-petal" />
        <p className="font-display text-2xl italic text-muted-foreground">
          {failed ? "Taman tidak dapat dimuat di perangkat ini." : "Menyiapkan taman…"}
        </p>
      </div>
    </main>
  );
}
