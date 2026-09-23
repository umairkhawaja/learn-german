// ── Drills view: Kasus & Satzbau ──────────────────────────────
// Three drills for the two things vocabulary practice does not train:
//
//   • Kasus-Drill — article + adjective + noun declined through every case,
//     gender, number and determiner, alone or after a preposition. Every
//     answer is computed by engine/kasus from the standard declension tables
//     and the app's own nouns; a weak-spot grid shows which case × gender
//     cells keep going wrong and drills them first.
//   • Echte Sätze — spot the case of a phrase in a real sentence from the
//     Universal Dependencies German PUD treebank, whose hand-checked
//     annotation is the answer key (see scripts/build-exercises.mjs).
//   • Satzbau — rebuild a sentence from its scrambled words: the app's own
//     example sentences plus the short PUD ones.
//
// All three write into the shared progress map (kasus:*, kasusecht:*,
// satzbau:*), so they ride along with backup and cloud sync.
import { useState } from "react";
import { COLORS, MUTE } from "../config/theme";
import { KasusDrill } from "./KasusDrill";
import { KasusEcht } from "./KasusEcht";
import { SatzbauDrill } from "./SatzbauDrill";
import { DRILL_ACCENT } from "./drillKit";

const TABS = [
  { id: "kasus", label: "Kasus-Drill" },
  { id: "echt", label: "Echte Sätze" },
  { id: "satz", label: "Satzbau" },
];

// Remembered across tab switches (the view unmounts), not across reloads.
let lastTab = "kasus";

export function DrillsView({ db, progress, setProgress, recordAnswer, levelFilter }) {
  const [tab, setTabState] = useState(lastTab);
  const setTab = (t) => { lastTab = t; setTabState(t); };
  const shared = { progress, setProgress, recordAnswer, levelFilter };

  return (
    <div>
      <div role="tablist" aria-label="Drill" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, marginBottom: 14 }}>
        {TABS.map((t) => {
          const on = tab === t.id;
          return (
            <button key={t.id} role="tab" aria-selected={on} onClick={() => setTab(t.id)}
              style={{
                minWidth: 0, padding: "9px 4px", borderRadius: 10, cursor: "pointer", fontSize: 13, fontWeight: 700,
                border: `1.5px solid ${on ? DRILL_ACCENT : COLORS.borderSoft}`,
                background: on ? DRILL_ACCENT + "1f" : COLORS.surfaceAlt, color: on ? "#fda4af" : MUTE,
              }}>
              {t.label}
            </button>
          );
        })}
      </div>
      {tab === "kasus" && <KasusDrill db={db} {...shared} />}
      {tab === "echt" && <KasusEcht {...shared} />}
      {tab === "satz" && <SatzbauDrill {...shared} />}
    </div>
  );
}
