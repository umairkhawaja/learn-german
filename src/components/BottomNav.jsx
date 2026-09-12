// ── Mobile bottom tab bar (shown only on narrow screens) ──────
import { COLORS } from "../config/theme";
import { VIEWS } from "./Header";

export function BottomNav({ view, setView, backlogCount, dueCount }) {
  // `display` is deliberately NOT set inline below. An inline style beats a
  // stylesheet rule, so the inline `display: flex` this used to carry silently
  // defeated the "hide on wide screens" rule: the bottom bar was showing on
  // desktop underneath the header tabs, duplicating every tab. AppStyles owns
  // its visibility — none by default, flex under 640px.
  return (
    <nav className="dm-bottom-nav" aria-label="Sections" style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 30,
      background: "rgba(12,12,12,0.96)", backdropFilter: "blur(8px)",
      borderTop: "1px solid #1e1e1e",
      paddingBottom: "env(safe-area-inset-bottom)",
    }}>
      {VIEWS.map(({ id, label, short, icon }) => {
        const active = view === id;
        // The Mixed tab is where a due review actually gets done, so the due
        // badge belongs there; the Quiz tab keeps the backlog count, which is
        // the number that gates new words unlocking.
        const badge = id === "quiz" ? backlogCount : id === "mixed" ? dueCount : 0;
        return (
          <button key={id} onClick={() => setView(id)}
            aria-current={active ? "page" : undefined}
            aria-label={badge > 0 ? `${label} (${badge})` : label}
            style={{
              flex: 1, background: "transparent", border: "none", cursor: "pointer",
              // 46px of vertical padding + content keeps every tab above the
              // 44px minimum touch target on a phone.
              padding: "9px 1px 11px", minWidth: 0, minHeight: 46,
              display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
              color: active ? COLORS.txtStrong : "#5b626f", position: "relative",
            }}>
            <span aria-hidden="true" style={{ fontSize: 17, opacity: active ? 1 : 0.7 }}>{icon}</span>
            <span style={{ fontSize: 9.5, fontWeight: active ? 700 : 500, whiteSpace: "nowrap" }}>{short || label}</span>
            {active && <span style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 22, height: 2.5, background: "#a855f7", borderRadius: 999 }} />}
            {badge > 0 && (
              <span aria-hidden="true" style={{
                position: "absolute", top: 4, right: "50%", marginRight: -24, fontSize: 9,
                color: "#fff", background: id === "mixed" ? "#0284c7" : "#a855f7",
                borderRadius: 999, padding: "0px 4px", fontWeight: 700,
              }}>{badge > 99 ? "99+" : badge}</span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
