import { useState, useEffect, useCallback, useMemo } from "react";
import { NotionRenderer } from "react-notion-x";
import "react-notion-x/src/styles.css";
import { NOTION_PAGES, NOTION_PROXY_URL } from "./notesConfig";
import { fetchNotionPage } from "./notionClient";

const TXT = "#e2e8f0";
const MUTE = "#8b94a3";
const FAINT = "#5b626f";

const LEVELS = Object.keys(NOTION_PAGES).filter((l) => NOTION_PAGES[l].length > 0);

function SetupNotice() {
  return (
    <div style={{ background: "#141414", border: "1px solid #2a2a2a", borderRadius: 12, padding: 20, maxWidth: 560 }}>
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
          <code style={{ color: "#22c55e" }}>VITE_NOTION_PROXY_URL=https://notion-proxy.YOUR.workers.dev</code>
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
      <div style={{ color: "#fca5a5", fontSize: 13, padding: "20px 0" }}>
        Failed to load page: {error}
      </div>
    );
  }

  return (
    <div>
      {pageStack.length > 1 && (
        <button onClick={popPage}
          style={{ marginBottom: 14, background: "transparent", border: "1px solid #2a2a2a", borderRadius: 8, padding: "6px 14px", color: MUTE, fontSize: 13, cursor: "pointer" }}>
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
  const [level, setLevel] = useState(LEVELS[0] ?? null);
  const [pageIdx, setPageIdx] = useState(0);

  const pages = level ? NOTION_PAGES[level] : [];
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

  return (
    <div>
      {/* Level tabs */}
      {LEVELS.length > 1 && (
        <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
          {LEVELS.map((l) => (
            <button key={l} onClick={() => { setLevel(l); setPageIdx(0); }}
              style={{
                padding: "6px 14px", borderRadius: 8, border: `1px solid ${level === l ? "#3b82f6" : "#2a2a2a"}`,
                background: level === l ? "#3b82f622" : "transparent",
                color: level === l ? "#60a5fa" : MUTE, fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}>
              {l}
            </button>
          ))}
        </div>
      )}

      {/* Page selector within a level */}
      {pages.length > 1 && (
        <div style={{ display: "flex", gap: 6, marginBottom: 18, flexWrap: "wrap" }}>
          {pages.map((p, i) => (
            <button key={p.pageId} onClick={() => setPageIdx(i)}
              style={{
                padding: "6px 12px", borderRadius: 8, border: `1px solid ${pageIdx === i ? "#22c55e" : "#2a2a2a"}`,
                background: pageIdx === i ? "#22c55e18" : "transparent",
                color: pageIdx === i ? "#4ade80" : MUTE, fontSize: 12.5, cursor: "pointer",
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
          No pages configured for {level} yet. Add them to <code>src/notesConfig.js</code>.
        </div>
      )}
    </div>
  );
}
