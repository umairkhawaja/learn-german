// ── Mobile bottom tab bar (shown only on narrow screens) ──────
import { COLORS } from "../config/theme";
import { VIEWS } from "./Header";

export function BottomNav({ view, setView, dueCount }) {
  return (
    <div className="dm-bottom-nav" style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 30,
      background: "rgba(12,12,12,0.96)", backdropFilter: "blur(8px)",
      borderTop: "1px solid #1e1e1e", display: "flex",
      paddingBottom: "env(safe-area-inset-bottom)",
    }}>
      {VIEWS.map(({ id, label, icon }) => {
        const active = view === id;
        return (
          <button key={id} onClick={() => setView(id)}
            style={{
              flex: 1, background: "transparent", border: "none", cursor: "pointer",
              padding: "8px 2px 9px", display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
              color: active ? COLORS.txtStrong : "#5b626f", position: "relative",
            }}>
            <span style={{ fontSize: 17, opacity: active ? 1 : 0.7 }}>{icon}</span>
            <span style={{ fontSize: 9.5, fontWeight: active ? 700 : 500 }}>{label}</span>
            {active && <span style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 22, height: 2.5, background: "#a855f7", borderRadius: 999 }} />}
            {id === "review" && dueCount > 0 && (
              <span style={{ position: "absolute", top: 4, right: "50%", marginRight: -22, fontSize: 9, color: "#fff", background: "#a855f7", borderRadius: 999, padding: "0px 4px", fontWeight: 700 }}>{dueCount}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
