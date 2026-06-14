// Speech adapter — German text-to-speech via the Web Speech API.
// Works in mobile Safari / installed PWAs (must be triggered by a tap).
let cachedVoice = null;
function germanVoice() {
  if (cachedVoice) return cachedVoice;
  try {
    const voices = window.speechSynthesis.getVoices() || [];
    cachedVoice = voices.find((v) => /de(-|_)?/i.test(v.lang)) || null;
  } catch {}
  return cachedVoice;
}
export function speak(text) {
  try {
    if (!("speechSynthesis" in window)) return;
    const clean = String(text).replace(/\s*\(.*?\)\s*/g, " ").replace(/\s*\/\s*/g, ", ").trim();
    const u = new SpeechSynthesisUtterance(clean);
    u.lang = "de-DE";
    u.rate = 0.9;
    const v = germanVoice();
    if (v) u.voice = v;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch {}
}
