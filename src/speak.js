// Speech adapter — German text-to-speech via the Web Speech API.
//
// Desktop Chrome is forgiving; iOS Safari and the installed PWA are not, and
// that is where playback broke. Each guard below answers one WebKit/Chrome
// failure mode that ends in silence with no error:
//   - cancel() immediately followed by speak() drops the new utterance, so we
//     only cancel when something is actually queued, and speak a tick later;
//   - after the PWA is backgrounded the engine can sit "paused", so resume();
//   - a SpeechSynthesisVoice object goes stale when the voice list reloads
//     (voiceschanged), so the voice is looked up fresh by voiceURI each time;
//   - an utterance with no live reference can be garbage-collected mid-speech,
//     so the current one is kept in module scope;
//   - the ring/silent switch mutes Web Audio's default "ambient" session, so we
//     ask for the "playback" audio session where the browser supports it;
//   - if the chosen voice errors or never starts, retry once with only the
//     language set and let the platform pick its default German voice.
const synth = typeof window !== "undefined" ? window.speechSynthesis : null;
// Novelty voices on Apple platforms; real German voices are preferred over them.
const NOVELTY = /grandma|grandpa|rocko|shelley|sandy|reed|eddy|flo|bad news|bells|boing|bubbles|cellos|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox|albert|fred|junior|kathy|ralph/i;
let voiceURI = null;
let current = null;

function pickVoice() {
  if (!synth) return null;
  const voices = synth.getVoices() || [];
  if (voiceURI) {
    const v = voices.find((x) => x.voiceURI === voiceURI);
    if (v) return v;
  }
  const german = voices.filter((v) => /^de([-_]|$)/i.test(v.lang));
  const rank = (v) => (/^de[-_]DE$/i.test(v.lang) ? 0 : 4) + (NOVELTY.test(v.name) ? 2 : 0) + (v.localService ? 0 : 1);
  const best = german.sort((a, b) => rank(a) - rank(b))[0] || null;
  voiceURI = best?.voiceURI ?? null;
  return best;
}
if (synth && "onvoiceschanged" in synth) {
  synth.addEventListener?.("voiceschanged", () => { voiceURI = null; });
}

function utter(text, withVoice) {
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "de-DE";
  u.rate = 0.9;
  if (withVoice) { const v = pickVoice(); if (v) u.voice = v; }
  return u;
}

function say(text, withVoice) {
  const u = utter(text, withVoice);
  current = u;
  let started = false;
  u.onstart = () => { started = true; };
  u.onerror = (e) => {
    if (!withVoice || current !== u || e.error === "interrupted" || e.error === "canceled") return;
    voiceURI = null;
    say(text, false);
  };
  synth.speak(u);
  if (withVoice) {
    // Stuck engine: nothing started after a while — clear it and try the default voice.
    setTimeout(() => {
      if (current === u && !started && !synth.speaking) { synth.cancel(); say(text, false); }
    }, 1500);
  }
}

export function speak(text) {
  try {
    if (!synth || typeof SpeechSynthesisUtterance === "undefined") return;
    const clean = String(text).replace(/\s*\(.*?\)\s*/g, " ").replace(/\s*\/\s*/g, ", ").trim();
    if (!clean) return;
    try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch {}
    if (synth.paused) synth.resume();
    if (synth.speaking || synth.pending) {
      current = null;
      synth.cancel();
      setTimeout(() => say(clean, true), 60);
    } else {
      say(clean, true);
    }
  } catch {}
}
