// ── Bridge view: the A1 → A2.1 Brückentag plan + Spickzettel ──
// The page is a self-contained static document (public/bruecke.html) with its
// own typography, its own checkbox progress state (localStorage "a1bridge.v1")
// and its own sticky progress bar. It is embedded in an iframe rather than
// ported to JSX so that its stylesheet stays isolated from the app's — nothing
// leaks either way — and it keeps working as a standalone page you can open
// directly at /bruecke.html.
import { useEffect, useRef, useState } from "react";
import { COLORS, FAINT } from "../config/theme";

const SRC = `${import.meta.env.BASE_URL}bruecke.html`;

export function BridgeView() {
  const ref = useRef(null);
  const [height, setHeight] = useState(600);

  // Fill whatever viewport is left below the header, minus the bottom nav on
  // narrow screens (it is fixed, so it would otherwise cover the last rows).
  useEffect(() => {
    const fit = () => {
      const top = ref.current?.getBoundingClientRect().top ?? 0;
      const nav = window.innerWidth <= 640 ? 58 : 0;
      setHeight(Math.max(360, window.innerHeight - top - nav));
    };
    fit();
    window.addEventListener("resize", fit);
    window.addEventListener("orientationchange", fit);
    return () => {
      window.removeEventListener("resize", fit);
      window.removeEventListener("orientationchange", fit);
    };
  }, []);

  return (
    <div ref={ref} style={{ width: "100%" }}>
      <iframe
        src={SRC}
        title="A1 → A2.1 Brückentag"
        style={{ display: "block", width: "100%", height, border: "none", background: COLORS.bg }}
      />
      <noscript style={{ color: FAINT }}>
        <a href={SRC}>Open the Brückentag page</a>
      </noscript>
    </div>
  );
}
