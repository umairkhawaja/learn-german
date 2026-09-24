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

  return (
    <div>
      {/* Level tabs */}
      {/* Each level wears its colour from config/levels (A1 green, A2
          orange, B1 blue …), the same as the level chips everywhere else;
          these used to be blue whatever the level. */}
      {levels.length > 1 && (
        <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
          {levels.map((l) => {
            const on = level === l;
            const color = levelMeta(l).color;
            return (
              <button key={l} onClick={() => { setLevel(l); setPageIdx(0); }} aria-pressed={on}
                style={{
                  padding: "7px 14px", minHeight: 34, borderRadius: 10, border: `1.5px solid ${on ? color : COLORS.borderSoft}`,
                  background: on ? color + "18" : "transparent",
                  color: on ? color : MUTE, fontSize: 13, fontWeight: 700, cursor: "pointer",
                }}>
                {l}
              </button>
            );
          })}
        </div>
      )}

      {/* Page selector within a level */}
      {pages.length > 1 && (
        <div style={{ display: "flex", gap: 6, marginBottom: 18, flexWrap: "wrap" }}>
          {pages.map((p, i) => (
            <button key={p.pageId} onClick={() => setPageIdx(i)}
              aria-pressed={pageIdx === i}
              style={{
                padding: "7px 12px", minHeight: 34, maxWidth: "100%", textAlign: "left", borderRadius: 10,
                border: `1px solid ${pageIdx === i ? COLORS.accent : COLORS.borderSoft}`,
                background: pageIdx === i ? COLORS.accent + "1f" : "transparent",
                color: pageIdx === i ? COLORS.accentText : MUTE, fontSize: 12.5, cursor: "pointer",
              }}>
              {p.label}
            </button>
          ))}
        </div>
      )}

      {currentPage ? (
        <NotionPage key={currentPage.pageId} pageId={currentPage.pageId} proxyUrl={NOTION_PROXY_URL} />
      ) : (
        <div style={{ color: FAINT, fontSize: 13, padding: "20px 0" }}>
          No pages for {level} yet. Add a "{level} …" subpage under the German Notes page in Notion.
        </div>
      )}
    </div>
  );
}
