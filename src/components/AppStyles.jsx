// ── Global stylesheet ─────────────────────────────────────────
// Lifted out of App.jsx so the composition file stays composition. Everything
// here is either a cross-cutting rule (focus, motion, overflow) or a fix that
// needs a real selector rather than an inline style.

export function AppStyles() {
  return (
    <style>{`
      @keyframes dmReveal { from { opacity:0; transform: translateY(4px); } to { opacity:1; transform:none; } }
      .dm-reveal { animation: dmReveal .18s ease; }
      * { box-sizing: border-box; }
      ::selection { background:#3b82f655; }

      /* ── Focus ────────────────────────────────────────────────
         Inline styles cannot express :focus-visible, so keyboard users had a
         visible ring on quiz options and nowhere else — including the level
         chips, the category tabs and the whole bottom nav. One rule covers
         every control. */
      :focus-visible {
        outline: 2px solid #60a5fa;
        outline-offset: 2px;
        border-radius: 6px;
      }
      /* Pointer users keep the clean look: no ring on a plain click. */
      :focus:not(:focus-visible) { outline: none; }

      /* ── Motion ───────────────────────────────────────────────
         Card reveals and every width/colour transition are decoration. A
         learner who has asked their system for less motion gets the state
         change without the animation. */
      @media (prefers-reduced-motion: reduce) {
        *, *::before, *::after {
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.01ms !important;
          scroll-behavior: auto !important;
        }
      }

      /* ── No sideways scrolling on a phone ──────────────────────
         German compounds ("Geschwindigkeitsbegrenzung"), conjugation
         tables and embedded Notion pages are all wider than a phone
         screen. Each is handled at its source below; overflow-x: clip
         is the backstop that keeps a stray one from widening the page.
         clip, not hidden: hidden makes the element a scroll container,
         which breaks the sticky header. */
      html, body { max-width: 100%; overflow-x: clip; }
      body { overflow-wrap: break-word; }
      /* Anything genuinely wider than the screen scrolls inside its own
         frame, and keeps that swipe to itself. */
      .dm-scroll-x {
        max-width: 100%; overflow-x: auto;
        overscroll-behavior-x: contain; -webkit-overflow-scrolling: touch;
      }
      /* Notion pages bring their own widths (tables, code, callouts);
         hold them to the column and let long words break. */
      .dm-notion-wrap { max-width: 100%; overflow-x: hidden; }
      .dm-notion-wrap .notion { max-width: 100%; overflow-wrap: break-word; }
      .dm-notion-wrap .notion-page { width: 100%; max-width: 100%; padding: 0; }
      .dm-notion-wrap img, .dm-notion-wrap video, .dm-notion-wrap iframe { max-width: 100%; height: auto; }
      .dm-notion-wrap .notion-table,
      .dm-notion-wrap .notion-simple-table,
      .dm-notion-wrap .notion-collection,
      .dm-notion-wrap .notion-collection-view,
      .dm-notion-wrap pre, .dm-notion-wrap .notion-code {
        max-width: 100%; overflow-x: auto; overscroll-behavior-x: contain;
      }

      /* ── Form controls ────────────────────────────────────────
         Native selects and inputs ignore the dark inline styles for their
         own dropdown and placeholder text on some platforms. */
      select, input, textarea, button { font-family: inherit; font-size: inherit; }
      select option { background: #141414; color: #e2e8f0; }
      input::placeholder, textarea::placeholder { color: #4a4f59; }

      /* ── Grade bar ────────────────────────────────────────────
         A revealed card can be long — a noun shows its declension table, a
         verb its full conjugation — so the two grading buttons ended up well
         below the fold and every card needed a scroll before it could be
         answered. Sticking them to the bottom of the viewport keeps the
         answer one tap away however long the card back is. */
      .dm-grade-bar {
        position: sticky;
        bottom: 8px;
        z-index: 10;
        padding: 8px 0 2px;
        background: linear-gradient(to top, #0a0a0a 55%, #0a0a0aee 80%, transparent);
      }
      @media (max-width: 640px) {
        /* Clear the fixed bottom nav (and the home indicator under it). */
        .dm-grade-bar { bottom: calc(env(safe-area-inset-bottom) + 62px); }
      }

      /* Bottom nav shows only on narrow screens; header tabs hide there.
         BottomNav sets no inline display precisely so these rules win. */
      .dm-bottom-nav { display: none; }
      @media (max-width: 640px) {
        .dm-top-tabs { display: none !important; }
        .dm-bottom-nav { display: flex; }
      }
    `}</style>
  );
}
