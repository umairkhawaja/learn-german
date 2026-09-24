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
      /* Four-column conjugation table on a small phone: tighter cells so
         "haben angefangen" fits without the table scrolling. */
      @media (max-width: 400px) {
        .dm-conj th, .dm-conj td { padding: 3px 5px !important; font-size: 12px; }
        /* Long participles (zurückgekommen) hyphenate rather than scroll. */
        .dm-conj td { -webkit-hyphens: auto; hyphens: auto; }
      }
      /* Notion pages bring their own widths (tables, code, callouts);
         hold them to the column and let long words break. */
      .dm-notion-wrap { max-width: 100%; overflow-x: hidden; }
      .dm-notion-wrap .notion { max-width: 100%; overflow-wrap: break-word; }
      .dm-notion-wrap .notion-page { width: 100%; max-width: 100%; padding: 0; }
      .dm-notion-wrap img, .dm-notion-wrap video, .dm-notion-wrap iframe { max-width: 100%; height: auto; }
      .dm-notion-wrap .notion-collection,
      .dm-notion-wrap pre, .dm-notion-wrap .notion-code {
        max-width: 100%; overflow-x: auto; overscroll-behavior-x: contain;
      }
      /* A <table> ignores overflow, so the wrapper above used to crop wide
         simple tables instead of scrolling them. Making the table a block
         turns it into its own scroller; its rows still lay out as a table. */
      .dm-notion-wrap .notion-simple-table {
        display: block; width: max-content; max-width: 100%;
        overflow-x: auto; overscroll-behavior-x: contain; -webkit-overflow-scrolling: touch;
      }
      /* Cells wrap at word boundaries so a table fits the column; it only
         scrolls when a single word is wider than its share. (A 90px floor
         per cell used to push every 4+ column table off a phone.) */
      .dm-notion-wrap .notion-simple-table td { min-width: 0; padding: 6px 8px; overflow-wrap: break-word; }
      @media (max-width: 640px) {
        .dm-notion-wrap .notion-simple-table { font-size: 13px; }
        .dm-notion-wrap .notion-simple-table td { padding: 5px 6px; }
      }
      /* Database table views are pinned to --notion-max-width (720px) and
         floated; let the collection scroll them instead of cropping. */
      .dm-notion-wrap .notion-table-view { float: none; }
      /* Column layouts only stack below a 640px *viewport*, but the notes
         column is narrower than that well above it, and .notion-row hides
         its overflow — so columns got cut off. Stack them by default. */
      .dm-notion-wrap .notion-row { flex-direction: column; overflow: visible; }
      .dm-notion-wrap .notion-row .notion-column { width: 100% !important; min-width: 0; }
      .dm-notion-wrap .notion-row .notion-spacer { display: none; }
      .dm-notion-wrap .notion-callout, .dm-notion-wrap .notion-callout-text { min-width: 0; max-width: 100%; }

      /* Notion's own dark theme is slate grey (#2f3437) with its own font
         and colour set, so notes looked like a different site. Map its
         variables onto the app's tokens (config/theme.js). */
      .dm-notion-wrap .notion.dark-mode, .dm-notion-wrap .dark-mode {
        --notion-font: ui-sans-serif, -apple-system, 'Segoe UI', Roboto, system-ui, sans-serif;
        --fg-color: #e2e8f0; --fg-color-0: #e2e8f0; --fg-color-1: #e2e8f0; --fg-color-2: #e2e8f0;
        --fg-color-3: #8b94a3; --fg-color-4: #8b94a3; --fg-color-5: #262626; --fg-color-6: #f1f5f9;
        --fg-color-icon: #8b94a3;
        --bg-color: transparent; --bg-color-0: #1a1a1a; --bg-color-1: #141414; --bg-color-2: #1f1f1f;
        --notion-red: #f87171; --notion-pink: #f472b6; --notion-blue: #60a5fa; --notion-purple: #c084fc;
        --notion-teal: #2dd4bf; --notion-green: #4ade80; --notion-yellow: #fbbf24; --notion-orange: #fb923c;
        --notion-brown: #d6a77a; --notion-gray: #8b94a3;
        --notion-red_background: #ef44441f; --notion-pink_background: #ec48991f; --notion-blue_background: #3b82f61f;
        --notion-purple_background: #a855f71f; --notion-teal_background: #14b8a61f; --notion-green_background: #22c55e1f;
        --notion-yellow_background: #eab3081f; --notion-orange_background: #f973161f; --notion-brown_background: #a162071f;
        --notion-gray_background: #1a1a1a;
        --notion-red_background_co: #ef444414; --notion-pink_background_co: #ec489914; --notion-blue_background_co: #3b82f614;
        --notion-purple_background_co: #a855f714; --notion-teal_background_co: #14b8a614; --notion-green_background_co: #22c55e14;
        --notion-yellow_background_co: #eab30814; --notion-orange_background_co: #f9731614; --notion-brown_background_co: #a1620714;
        --notion-gray_background_co: #141414;
      }
      .dm-notion-wrap .notion-app { min-height: 0; }
      .dm-notion-wrap .notion { font-size: 15px; }
      .dm-notion-wrap .notion-callout { border-color: #262626; border-radius: 10px; }

      /* ── Form controls ────────────────────────────────────────
         Native selects and inputs ignore the dark inline styles for their
         own dropdown and placeholder text on some platforms. */
      select, input, textarea, button { font-family: inherit; font-size: inherit; }
      select option { background: #141414; color: #e2e8f0; }
      input::placeholder, textarea::placeholder { color: #5b626f; }
      /* iOS Safari zooms the whole page in when a field under 16px gets
         focus, and leaves it zoomed — so every search box and filter select
         on a phone threw the layout sideways. */
      @media (hover: none) and (pointer: coarse) {
        input, select, textarea { font-size: 16px !important; }
      }

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

      /* ── Header ───────────────────────────────────────────────
         The sticky header held three rows of level chips and two of word
         types: about 255px of an 844px phone screen before any content. On
         a phone the chips go to one line each (code and count side by
         side) and the word types three to a row. */
      .dm-header-inner { padding: 14px 16px; }
      .dm-level-chip {
        padding: 9px 4px;
        display: flex; flex-direction: column; align-items: center; gap: 1px;
      }
      .dm-cat-tabs { display: grid; grid-template-columns: repeat(auto-fit, minmax(96px, 1fr)); gap: 6px; }
      .dm-cat-tab { padding: 8px 4px; display: flex; flex-direction: column; align-items: center; }
      @media (max-width: 640px) {
        .dm-header-inner { padding: 10px 16px; }
        .dm-hide-narrow { display: none; }
        .dm-level-chip { flex-direction: row; justify-content: center; align-items: baseline; gap: 6px; padding: 6px 4px; }
        .dm-level-label, .dm-level-words { display: none; }
        .dm-cat-tabs { grid-template-columns: repeat(3, 1fr); }
        .dm-cat-tab { flex-direction: row; justify-content: center; align-items: baseline; gap: 5px; padding: 7px 4px; white-space: nowrap; }
      }

      /* Keyboard shortcuts mean nothing on a touch screen with no keyboard. */
      @media (hover: none) and (pointer: coarse) { .dm-kbd-tip { display: none; } }

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
