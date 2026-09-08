// ── Cheatsheet view: the merged A1–B1 grammar reference ───────
// The page is a self-contained static document (public/cheatsheet.html) with
// its own typography, colour system, search box and level filter. It is
// embedded in an iframe rather than ported to JSX so that its stylesheet stays
// isolated from the app's — nothing leaks either way — and it keeps working as
// a standalone page you can open directly at /cheatsheet.html or print.
//
// It replaces two earlier views: the JSON-driven cheatsheet (public/data/
// cheatsheet.json) and the A1 Brückentag page (public/bruecke.html). Both are
// merged into the single document; add new cards there, not here.
import { useEffect, useRef, useState } from "react";
import { COLORS, FAINT } from "../config/theme";

const SRC = `${import.meta.env.BASE_URL}cheatsheet.html`;

export function CheatsheetView() {
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
        title="Spickzettel — German grammar reference"
        style={{ display: "block", width: "100%", height, border: "none", background: COLORS.bg }}
      />
      <noscript style={{ color: FAINT }}>
        <a href={SRC}>Open the cheatsheet</a>
      </noscript>
    </div>
  );
}
