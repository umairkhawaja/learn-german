/* ============================================================
   DEUTSCH MEISTER — modular CEFR vocabulary trainer
   ------------------------------------------------------------
   HOW TO EXTEND (no engine changes needed):
   • Add words   → edit public/data/{nouns,verbs,adj,gram,phrases,other}.json.
                   Fetched at runtime; no rebuild needed. Tag an entry with
                   lvl:"A2" to assign a level (no `lvl` → "A1").
   • Add a level → add one row to src/config/levels.js and tag data with
                   that code. The switcher, counts, filters, review and
                   stats all pick it up automatically.
   • Add a category → push one descriptor into src/config/categories.jsx
                   (key, colour, catOf, german, detail renderer, modes[])
                   and drop a public/data/<key>.json file. The quiz/browse/
                   stats engine is generic and needs no edits.

   This file is composition only. Logic lives in:
     config/   levels, categories, theme            (the extension cores)
     engine/   progress (+SRS), quiz, useDriveSync
     components/ Header, BottomNav, the five views, QuizRunner, ui, detail
   ============================================================ */
import { useState, useEffect, useMemo } from "react";
import { COLORS, FONT } from "./config/theme";
import { CATEGORIES } from "./config/categories";
import { loadDB } from "./data/db";
import { loadProgress } from "./engine/progress";
import { dueCount } from "./engine/quiz";
import { useDriveSync } from "./engine/useDriveSync";
import { Header } from "./components/Header";
import { BottomNav } from "./components/BottomNav";
import { QuizView } from "./components/QuizView";
import { ReviewView } from "./components/ReviewView";
import { BrowseView } from "./components/BrowseView";
import { CheatsheetView } from "./components/CheatsheetView";
import { StatsView } from "./components/StatsView";
import { NotesView } from "./NotesView";

export default function DeutschMeister() {
  const [db, setDb] = useState(null);
  const [progress, setProgress] = useState({});
  const [view, setView] = useState("quiz"); // quiz | review | browse | cheatsheet | notes | stats
  const [activeCat, setActiveCat] = useState(0);
  const [levelFilter, setLevelFilter] = useState("All");

  useEffect(() => { loadDB().then(setDb); }, []);
  useEffect(() => { loadProgress().then(setProgress); }, []);
  useEffect(() => { try { window.speechSynthesis.getVoices(); } catch { } }, []);

  const { driveStatus, setDriveStatus } = useDriveSync(progress, setProgress);

  const cat = CATEGORIES[activeCat];
  const due = useMemo(
    () => (db ? dueCount(db, CATEGORIES, progress, levelFilter) : 0),
    [db, progress, levelFilter]
  );

  if (!db) return <div style={{ minHeight: "100vh", background: COLORS.bg, color: "#4a4f59", fontFamily: FONT, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>Loading…</div>;

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, color: COLORS.txt, fontFamily: FONT }}>
      <style>{`
        @keyframes dmReveal { from { opacity:0; transform: translateY(4px); } to { opacity:1; transform:none; } }
        .dm-reveal { animation: dmReveal .18s ease; }
        .dm-opt:focus-visible { outline: 2px solid #60a5fa; outline-offset: 2px; }
        * { box-sizing: border-box; }
        ::selection { background:#3b82f655; }
        /* Bottom nav shows only on narrow screens; header tabs hide there. */
        .dm-bottom-nav { display: none; }
        @media (max-width: 640px) {
          .dm-top-tabs { display: none !important; }
          .dm-bottom-nav { display: flex !important; }
        }
      `}</style>

      <Header
        db={db} view={view} setView={setView}
        levelFilter={levelFilter} setLevelFilter={setLevelFilter}
        activeCat={activeCat} setActiveCat={setActiveCat}
        dueCount={due}
      />

      <div style={{ maxWidth: 680, margin: "0 auto", padding: "18px 16px 96px", width: "100%" }}>
        {view === "quiz" && <QuizView key={cat.id} cat={cat} progress={progress} setProgress={setProgress} levelFilter={levelFilter} db={db} />}
        {view === "review" && <ReviewView progress={progress} setProgress={setProgress} levelFilter={levelFilter} db={db} />}
        {view === "browse" && <BrowseView key={cat.id} cat={cat} progress={progress} setProgress={setProgress} levelFilter={levelFilter} db={db} />}
        {view === "cheatsheet" && <CheatsheetView />}
        {view === "notes" && <NotesView />}
        {view === "stats" && <StatsView progress={progress} setProgress={setProgress} levelFilter={levelFilter} driveStatus={driveStatus} setDriveStatus={setDriveStatus} db={db} />}
      </div>

      <BottomNav view={view} setView={setView} dueCount={due} />
    </div>
  );
}
