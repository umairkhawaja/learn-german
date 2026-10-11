// Speech adapter — German text-to-speech via the Web Speech API.
//
// Desktop Chrome is forgiving; iOS Safari and the installed PWA are not. Each
// guard below answers a failure mode that ends in silence with no error:
//   - iOS only lets speech start inside the tap that asked for it, so speak()
//     runs synchronously in the click handler — never from a timer;
//   - iOS routes speech through the "ambient" audio session, which the
//     ring/silent switch mutes. Playing a tiny silent clip from an <audio>
//     element in the same tap moves the page to the "playback" session, so
//     speech is heard with the switch on silent;
//   - after the PWA is backgrounded the engine can sit "paused", so resume();
//   - on iOS an explicitly assigned voice (an enhanced voice that is not
//     downloaded, or a stale voice object) can be silent, so there only the
//     language is set and the system's German voice is used;
//   - an utterance with no live reference can be garbage-collected mid-speech,
//     so the current one is kept in module scope;
//   - if nothing has started or finished after a while, the engine is stuck:
//     cancel and retry once with only the language set.
const synth = typeof window !== "undefined" ? window.speechSynthesis : null;
const IOS = typeof navigator !== "undefined" && (
  /iP(hone|ad|od)/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
);
// Novelty voices on Apple platforms; real German voices are preferred over them.
const NOVELTY = /grandma|grandpa|rocko|shelley|sandy|reed|eddy|flo|bad news|bells|boing|bubbles|cellos|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox|albert|fred|junior|kathy|ralph/i;
let current = null;

function pickVoice() {
  const voices = synth.getVoices() || [];
  const german = voices.filter((v) => /^de([-_]|$)/i.test(v.lang));
  const rank = (v) => (/^de[-_]DE$/i.test(v.lang) ? 0 : 4) + (NOVELTY.test(v.name) ? 2 : 0) + (v.localService ? 0 : 1);
  return german.sort((a, b) => rank(a) - rank(b))[0] || null;
}

// 0.1s of silent 8 kHz mono PCM, built once.
let silence = null;
function unlockAudio() {
  if (!IOS || typeof Audio === "undefined") return;
  try {
    if (!silence) {
      const n = 800, buf = new ArrayBuffer(44 + n * 2), d = new DataView(buf);
      const str = (o, s) => { for (let i = 0; i < s.length; i++) d.setUint8(o + i, s.charCodeAt(i)); };
      str(0, "RIFF"); d.setUint32(4, 36 + n * 2, true); str(8, "WAVE");
      str(12, "fmt "); d.setUint32(16, 16, true); d.setUint16(20, 1, true); d.setUint16(22, 1, true);
      d.setUint32(24, 8000, true); d.setUint32(28, 16000, true); d.setUint16(32, 2, true); d.setUint16(34, 16, true);
      str(36, "data"); d.setUint32(40, n * 2, true);
      silence = new Audio(URL.createObjectURL(new Blob([buf], { type: "audio/wav" })));
      silence.setAttribute("playsinline", "");
    }
    silence.currentTime = 0;
    const p = silence.play();
    if (p && p.catch) p.catch(() => {});
  } catch {}
}

function say(text, withVoice) {
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "de-DE";
  u.rate = 0.9;
  if (withVoice) { const v = pickVoice(); if (v) u.voice = v; }
  current = u;
  let alive = false;
  u.onstart = u.onend = () => { alive = true; };
  u.onerror = (e) => {
    alive = true;
    if (!withVoice || current !== u || e.error === "interrupted" || e.error === "canceled" || e.error === "not-allowed") return;
    say(text, false);
  };
  synth.speak(u);
  if (withVoice) {
    setTimeout(() => {
      if (current === u && !alive) { synth.cancel(); say(text, false); }
    }, 2000);
  }
}

export function speak(text) {
  try {
    if (!synth || typeof SpeechSynthesisUtterance === "undefined") return;
    const clean = String(text).replace(/\s*\(.*?\)\s*/g, " ").replace(/\s*\/\s*/g, ", ").trim();
    if (!clean) return;
    unlockAudio();
    current = null;
    if (synth.speaking || synth.pending) synth.cancel();
    if (synth.paused) synth.resume();
    say(clean, !IOS);
  } catch {}
}
