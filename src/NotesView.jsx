import { useState, useEffect, useCallback, useMemo } from "react";
import { NotionRenderer } from "react-notion-x";
import "react-notion-x/src/styles.css";
import {
  NOTION_PROXY_URL,
  NOTION_ROOT_PAGE_ID,
  NOTE_LEVELS,
  GENERAL_LABEL,
} from "./notesConfig";
import { fetchNotionPage, fetchNotionChildPages } from "./notionClient";
import { COLORS, TXT, MUTE, FAINT } from "./config/theme";
import { levelMeta } from "./config/levels";

// Match a leading level token in a subpage title, ignoring a leading emoji.
// "🇩🇪 A1 Course Notes — Learn German" → "A1"; "05 · Die Fälle … [A1–A2]" → null.
function levelOf(title) {
  const m = (title || "").match(/^[^\p{L}\p{N}]*([ABC][12])\b/iu);
  const token = m ? m[1].toUpperCase() : null;
  return token && NOTE_LEVELS.includes(token) ? token : null;
}

// Turn a flat list of subpages into { level: [{ label, pageId }] } groups,
// preserving NOTE_LEVELS order and appending a General bucket last.
function groupByLevel(childPages) {
  const groups = {};
  for (const { pageId, title } of childPages) {
    const level = levelOf(title) ?? GENERAL_LABEL;
    (groups[level] ??= []).push({ label: title || "Untitled", pageId });
  }
  const ordered = {};
  for (const level of NOTE_LEVELS) {
    if (groups[level]) ordered[level] = groups[level];
  }
  if (groups[GENERAL_LABEL]) ordered[GENERAL_LABEL] = groups[GENERAL_LABEL];
  return ordered;
}

// "05 · Die Fälle — The Four Cases … [A1–A2]" → main "05 · Die Fälle",
// sub "The Four Cases … [A1–A2]", so the sidebar can stack them.
function splitLabel(label) {
  const i = label.indexOf(" — ");
  return i === -1 ? { main: label, sub: null } : { main: label.slice(0, i), sub: label.slice(i + 3) };
}

function SetupNotice() {
  return (
    <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.borderSoft}`, borderRadius: 12, padding: 20, maxWidth: 560 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: TXT, marginBottom: 10 }}>One-time proxy setup needed</div>
      <p style={{ fontSize: 13.5, color: MUTE, lineHeight: 1.6, margin: "0 0 12px" }}>
        Notion's API blocks direct browser requests (CORS). A tiny Cloudflare Worker acts as a
        passthrough proxy. It's free and takes about 5 minutes to deploy.
      </p>
      <ol style={{ fontSize: 13, color: MUTE, lineHeight: 2, paddingLeft: 18, margin: "0 0 14px" }}>
        <li>Install the Cloudflare CLI: <code style={{ color: TXT }}>npm i -g wrangler</code></li>
        <li>Run <code style={{ color: TXT }}>wrangler deploy worker/notion-proxy.js --name notion-proxy</code></li>
        <li>Copy the deployed URL (e.g. <code style={{ color: TXT }}>https://notion-proxy.YOUR.workers.dev</code>)</li>
        <li>Create <code style={{ color: TXT }}>.env.local</code> in the project root and add:<br />
          <code style={{ color: COLORS.successText }}>VITE_NOTION_PROXY_URL=https://notion-proxy.YOUR.workers.dev</code>
        </li>
        <li>Restart the dev server / redeploy the app</li>
      </ol>
      <div style={{ fontSize: 12, color: FAINT }}>
        The worker code is at <code style={{ color: TXT }}>worker/notion-proxy.js</code> in this repo.
      </div>
    </div>
  );
}

function NotionPage({ pageId, proxyUrl }) {
  const [pageStack, setPageStack] = useState([pageId]);
  const currentId = pageStack[pageStack.length - 1];
  const [recordMap, setRecordMap] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setRecordMap(null);
    setError(null);
    fetchNotionPage(currentId, proxyUrl)
      .then(setRecordMap)
      .catch((e) => setError(e.message));
  }, [currentId, proxyUrl]);

  const pushPage = useCallback((id) => setPageStack((s) => [...s, id]), []);
  const popPage = useCallback(() => setPageStack((s) => s.slice(0, -1)), []);

  const PageLink = useMemo(() => function PageLink({ href, children, className, style }) {
    // mapPageUrl returns "#<rawId>" — extract it
    const subId = href?.startsWith("#") ? href.slice(1) : null;
    if (!subId) return <a href={href} className={className} style={style}>{children}</a>;
    return (
      <a href="#" className={className} style={style}
        onClick={(e) => { e.preventDefault(); pushPage(subId); }}>
        {children}
      </a>
    );
  }, [pushPage]);

  if (error) {
    return (
      <div style={{ color: COLORS.dangerText, fontSize: 13, padding: "20px 0" }}>
        Failed to load page: {error}
      </div>
    );
  }

  return (
    <div>
      {pageStack.length > 1 && (
        <button onClick={popPage}
          style={{ marginBottom: 14, background: "transparent", border: `1px solid ${COLORS.borderSoft}`, borderRadius: 10, padding: "7px 14px", color: MUTE, fontSize: 13, cursor: "pointer" }}>
          ← Back
        </button>
      )}
      {!recordMap ? (
        <div style={{ color: FAINT, fontSize: 13, padding: "20px 0" }}>Loading…</div>
      ) : (
        <div className="dm-notion-wrap">
          <NotionRenderer
            recordMap={recordMap}
            fullPage={false}
            darkMode={true}
            disableHeader={true}
            mapPageUrl={(id) => `#${id.replace(/-/g, "")}`}
            components={{ PageLink }}
          />
        </div>
      )}
    </div>
  );
}

export function NotesView() {
  const [groups, setGroups] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [level, setLevel] = useState(null);
  const [pageIdx, setPageIdx] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // The sidebar and the chapter bar stick just below the app header, whose
  // height changes with screen width — publish it as a CSS variable.
  useEffect(() => {
    const header = document.querySelector("header");
    if (!header) return;
    const set = () => document.documentElement.style.setProperty("--dm-header-h", `${header.offsetHeight}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(header);
    return () => ro.disconnect();
  }, []);

  // Escape closes the chapter drawer; the page behind it doesn't scroll.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e) => e.key === "Escape" && setDrawerOpen(false);
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [drawerOpen]);

  // Load the subpages of the "German Notes" root page once, then group by level.
  useEffect(() => {
    if (!NOTION_PROXY_URL) return;
    let cancelled = false;
    fetchNotionChildPages(NOTION_ROOT_PAGE_ID, NOTION_PROXY_URL)
      .then((childPages) => {
        if (cancelled) return;
        const grouped = groupByLevel(childPages);
        setGroups(grouped);
        setLevel(Object.keys(grouped)[0] ?? null);
      })
      .catch((e) => !cancelled && setLoadError(e.message));
    return () => { cancelled = true; };
  }, []);

  const levels = groups ? Object.keys(groups) : [];
  const pages = level && groups ? groups[level] : [];
  const currentPage = pages[pageIdx] ?? null;

  if (!NOTION_PROXY_URL) {
    return (
      <div>
        <div style={{ fontSize: 13, color: MUTE, marginBottom: 18 }}>
          Live grammar notes from your Notion workspace — always up to date as you add more.
        </div>
        <SetupNotice />
      </div>
    );
  }

  if (loadError) {
    return (
      <div style={{ color: COLORS.dangerText, fontSize: 13, padding: "20px 0" }}>
        Failed to load notes: {loadError}
      </div>
    );
  }

  if (!groups) {
    return <div style={{ color: FAINT, fontSize: 13, padding: "20px 0" }}>Loading…</div>;
  }

  if (levels.length === 0) {
    return (
      <div style={{ color: FAINT, fontSize: 13, padding: "20px 0" }}>
        No note pages found in the German Notes page.
      </div>
    );
  }

  const pickPage = (i) => {
    setPageIdx(i);
    setDrawerOpen(false);
    // The chapter replaces the old one in place; start it at the top
    // instead of wherever the previous chapter was scrolled to.
    window.scrollTo({ top: 0 });
  };

  const chapterList = (
    <nav aria-label="Chapters">
      {/* Each level wears its colour from config/levels (A1 green, A2
          orange, B1 blue …), the same as the level chips everywhere else. */}
      {levels.length > 1 && (
        <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
          {levels.map((l) => {
            const on = level === l;
            const color = levelMeta(l).color;
            return (
              <button key={l} onClick={() => { setLevel(l); setPageIdx(0); window.scrollTo({ top: 0 }); }} aria-pressed={on}
                style={{
                  padding: "6px 12px", minHeight: 32, borderRadius: 10, border: `1.5px solid ${on ? color : COLORS.borderSoft}`,
                  background: on ? color + "18" : "transparent",
                  color: on ? color : MUTE, fontSize: 12.5, fontWeight: 700, cursor: "pointer",
                }}>
                {l}
              </button>
            );
          })}
        </div>
      )}
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 2 }}>
        {pages.map((p, i) => {
          const on = pageIdx === i;
          const { main, sub } = splitLabel(p.label);
          return (
            <li key={p.pageId}>
              <button onClick={() => pickPage(i)} aria-current={on ? "page" : undefined}
                style={{
                  display: "block", width: "100%", textAlign: "left", padding: "7px 10px", borderRadius: 8,
                  border: "none", borderLeft: `2px solid ${on ? COLORS.accent : "transparent"}`,
                  background: on ? COLORS.accent + "1f" : "transparent",
                  color: on ? COLORS.accentText : TXT, fontSize: 13, lineHeight: 1.35, cursor: "pointer",
                }}>
                <span style={{ fontWeight: on ? 700 : 500 }}>{main}</span>
                {sub && <span style={{ display: "block", fontSize: 11.5, color: on ? COLORS.accentText : FAINT, opacity: on ? 0.8 : 1, marginTop: 1 }}>{sub}</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );

  const current = currentPage ? splitLabel(currentPage.label) : null;

  return (
    <div className="dm-notes-layout">
      {/* Wide screens: a sticky sidebar beside the chapter. */}
      <aside className="dm-notes-sidebar">{chapterList}</aside>

      <div className="dm-notes-main">
        {/* Narrow screens: one compact bar that opens the chapter list,
            so the chapter itself is all that's on the page. */}
        <button className="dm-notes-toggle" onClick={() => setDrawerOpen(true)}
          aria-haspopup="dialog" aria-expanded={drawerOpen}>
          <span aria-hidden="true" style={{ fontSize: 16 }}>☰</span>
          <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {current ? current.main : "Chapters"}
          </span>
          <span style={{ marginLeft: "auto", color: FAINT, fontSize: 12, flexShrink: 0 }}>Chapters</span>
        </button>

        {currentPage ? (
          <NotionPage key={currentPage.pageId} pageId={currentPage.pageId} proxyUrl={NOTION_PROXY_URL} />
        ) : (
          <div style={{ color: FAINT, fontSize: 13, padding: "20px 0" }}>
            No pages for {level} yet. Add a "{level} …" subpage under the German Notes page in Notion.
          </div>
        )}
      </div>

      {drawerOpen && (
        <div className="dm-notes-drawer" role="dialog" aria-modal="true" aria-label="Chapters"
          onClick={() => setDrawerOpen(false)}>
          <div className="dm-notes-drawer-panel" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: TXT }}>Chapters</div>
              <button onClick={() => setDrawerOpen(false)} aria-label="Close"
                style={{ marginLeft: "auto", background: "transparent", border: `1px solid ${COLORS.borderSoft}`, borderRadius: 8, color: MUTE, padding: "4px 10px", fontSize: 14, cursor: "pointer" }}>
                ✕
              </button>
            </div>
            {chapterList}
          </div>
        </div>
      )}
    </div>
  );
}
