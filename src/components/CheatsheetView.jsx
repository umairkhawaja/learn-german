// ── Cheatsheet view: the merged A1–B1 grammar reference ───────
// The page is a self-contained static document (public/cheatsheet.html) with
// its own search box and level filter; its colours and type copy the app's
// tokens (config/theme.js). It is
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
      // Measure the nav rather than assume 58px: on an iPhone it also
      // carries the home-indicator inset, which hid the last rows.
      const navEl = document.querySelector(".dm-bottom-nav");
      const nav = navEl && getComputedStyle(navEl).display !== "none" ? navEl.offsetHeight : 0;
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

  // iOS Safari sizes an iframe to its content's width unless the width is
  // pinned; `width: 1px; min-width: 100%` is the standard fix. The document
  // inside then clips its own sideways overflow, so wide grammar tables
  // scroll within their own frames instead of dragging the whole
  // cheatsheet (search bar included) sideways and cropping its edges.
  return (
    <div ref={ref} style={{ width: "100%", maxWidth: "100%", overflow: "hidden" }}>
      <iframe
        src={SRC}
        title="Spickzettel — German grammar reference"
        scrolling="yes"
        style={{ display: "block", width: 1, minWidth: "100%", maxWidth: "100%", height, border: "none", background: COLORS.bg }}
      />
      <noscript style={{ color: FAINT }}>
        <a href={SRC}>Open the cheatsheet</a>
      </noscript>
    </div>
  );
}
