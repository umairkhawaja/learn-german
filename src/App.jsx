/* ============================================================
   DEUTSCH MEISTER — modular CEFR vocabulary trainer
   ------------------------------------------------------------
   HOW TO EXTEND (no engine changes needed):
   • Add words   → edit public/data/{nouns,verbs,adj,gram,phrases,other}.json.
                   Fetched at runtime; no rebuild needed. Tag an entry with
                   lvl:"A2" to assign a level (no `lvl` → "A1").
                   Run `npm run data:check` afterwards — the validator holds
                   the invariants the engine relies on (one category per
                   headword, complete example sentences, real comparatives).
   • Add a level → add one row to src/config/levels.js and tag data with
                   that code. The switcher, counts, filters and
                   stats all pick it up automatically.
   • Add a category → push one descriptor into src/config/categories.jsx
                   (key, colour, catOf, german, detail renderer, modes[])
                   and drop a public/data/<key>.json file. The quiz/browse/
                   stats engine is generic and needs no edits.

   This file is composition only. Logic lives in:
     config/   levels, categories, theme            (the extension cores)
     engine/   progress (+SRS), quiz, activity, useDriveSync
     components/ Header, BottomNav, the views, QuizRunner, ui, detail
   ============================================================ */
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { COLORS, FONT } from "./config/theme";
import { CATEGORIES } from "./config/categories";
import { loadDB } from "./data/db";
import { loadProgress } from "./engine/progress";
import { reviewCounts } from "./engine/quiz";
import {
  loadActivity, saveActivity, addAnswers, loadGoal, saveGoal, DEFAULT_GOAL,
} from "./engine/activity";
import { useDriveSync } from "./engine/useDriveSync";
import { useCloudSync } from "./engine/useCloudSync";
import { Header } from "./components/Header";
import { BottomNav } from "./components/BottomNav";
import { MixedView } from "./components/MixedView";
import { QuizView } from "./components/QuizView";
import { ChunksView } from "./components/ChunksView";
import { BrowseView } from "./components/BrowseView";
import { CheatsheetView } from "./components/CheatsheetView";
import { StatsView } from "./components/StatsView";
import { NotesView } from "./NotesView";
import { AppStyles } from "./components/AppStyles";

const Splash = ({ children }) => (
  <div style={{
    minHeight: "100vh", background: COLORS.bg, color: "#4a4f59", fontFamily: FONT,
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 14, padding: 24, textAlign: "center",
  }}>{children}</div>
);

export default function DeutschMeister() {
  const [db, setDb] = useState(null);
  const [dbError, setDbError] = useState(null);
  const [progress, setProgress] = useState({});
  // Drive sync must not pull-merge (or push) until the local progress has
  // been read from IndexedDB, or it races against loadProgress: a merge
  // against the initial {} can be overwritten by the later local setProgress,
  // and a push of {} would clobber the remote backup.
  const [progressLoaded, setProgressLoaded] = useState(false);
  const [activity, setActivity] = useState({ days: {} });
  const [goal, setGoal] = useState(DEFAULT_GOAL);
  // Mixed is the landing view: a 40-card deck drawn across nouns, verbs,
  // adjectives and grammar, so practice starts on the whole level instead
  // of the top of whichever category tab happens to be open.
  const [view, setView] = useState("mixed"); // mixed | quiz | chunks | browse | cheatsheet | notes | stats
  const [activeCat, setActiveCat] = useState(0);
  const [levelFilter, setLevelFilter] = useState("All");

  const fetchDB = useCallback(() => {
    setDbError(null);
    loadDB().then(setDb).catch((e) => setDbError(e.message || String(e)));
  }, []);

  // Before this, a failed data fetch left the app on "Loading…" forever with
  // nothing said and nothing to do — the offline-first case the PWA is most
  // likely to hit on a first, uncached launch.
  useEffect(() => { fetchDB(); }, [fetchDB]);
  useEffect(() => { loadProgress().then((p) => { setProgress(p); setProgressLoaded(true); }); }, []);
  useEffect(() => { loadActivity().then(setActivity); loadGoal().then(setGoal); }, []);
  useEffect(() => { try { window.speechSynthesis.getVoices(); } catch { } }, []);

  // Every grading surface (Mixed, Quiz, Chunks) calls this so the day tally
  // and the streak count practice wherever it happens.
  const activityRef = useRef(activity);
  activityRef.current = activity;
  const recordAnswer = useCallback((n = 1) => {
    const next = addAnswers(activityRef.current, n);
    setActivity(next);
    saveActivity(next);
  }, []);

  const changeGoal = useCallback((g) => { setGoal(g); saveGoal(g); }, []);

  // Primary sync channel: durable Cloudflare KV store (baked-in key, no login,
  // survives IndexedDB eviction). Drive sync is kept below only for a one-time
  // import of the old snapshot to seed the cloud store.
  const { cloudStatus, setCloudStatus } = useCloudSync(progress, setProgress, progressLoaded);
  const { driveStatus, setDriveStatus, preloadGis } = useDriveSync(progress, setProgress, progressLoaded);

  const cat = CATEGORIES[activeCat];
  const { backlog, due } = useMemo(
    () => (db ? reviewCounts(db, CATEGORIES, progress, levelFilter) : { backlog: 0, due: 0 }),
    [db, progress, levelFilter]
  );

  if (dbError) {
    return (
      <Splash>
        <div>
          <div style={{ fontSize: 34, marginBottom: 10 }}>📡</div>
          <div style={{ color: COLORS.txtStrong, fontSize: 16, fontWeight: 700, marginBottom: 6 }}>
            Couldn’t load the word lists
          </div>
          <div style={{ maxWidth: 320, lineHeight: 1.6, marginBottom: 16 }}>
            The vocabulary files didn’t load. If this is the first time you’ve opened the app,
            you need to be online once so it can cache them.
          </div>
          <button onClick={fetchDB} style={{
            background: COLORS.der, border: "none", borderRadius: 10, padding: "11px 22px",
            color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer",
          }}>Try again</button>
          <div style={{ marginTop: 14, fontSize: 11, color: COLORS.ghost }}>{dbError}</div>
        </div>
      </Splash>
    );
  }

  if (!db) return <Splash>Loading…</Splash>;

  const shared = { progress, setProgress, recordAnswer };

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, color: COLORS.txt, fontFamily: FONT }}>
      <AppStyles />

      <Header
        db={db} view={view} setView={setView}
        levelFilter={levelFilter} setLevelFilter={setLevelFilter}
        activeCat={activeCat} setActiveCat={setActiveCat}
        backlogCount={backlog} dueCount={due}
        activity={activity} goal={goal}
      />

      {/* The Spickzettel brings its own 960px layout and scrolls inside its
          own frame, so it renders full-bleed instead of in the column. */}
      {view === "cheatsheet" ? (
        <CheatsheetView />
      ) : (
        <main style={{ maxWidth: 680, margin: "0 auto", padding: "18px 16px 96px", width: "100%" }}>
          {view === "mixed" && <MixedView db={db} {...shared} levelFilter={levelFilter} />}
          {view === "quiz" && <QuizView key={cat.id} cat={cat} {...shared} levelFilter={levelFilter} db={db} />}
          {view === "chunks" && <ChunksView {...shared} />}
          {view === "browse" && <BrowseView key={cat.id} cat={cat} progress={progress} setProgress={setProgress} levelFilter={levelFilter} db={db} />}
          {view === "notes" && <NotesView />}
          {view === "stats" && (
            <StatsView
              progress={progress} setProgress={setProgress} levelFilter={levelFilter}
              driveStatus={driveStatus} setDriveStatus={setDriveStatus}
              cloudStatus={cloudStatus} setCloudStatus={setCloudStatus} preloadGis={preloadGis}
              db={db} activity={activity} goal={goal} setGoal={changeGoal} dueCount={due}
            />
          )}
        </main>
      )}

      <BottomNav view={view} setView={setView} backlogCount={backlog} dueCount={due} />
    </div>
  );
}
