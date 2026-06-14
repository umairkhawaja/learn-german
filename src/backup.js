// Backup adapter — export/import of learning progress.
// Keeps the { app, version, progress } JSON format so existing backups restore.
export function sanitizeProgress(obj) {
  const out = {};
  if (!obj || typeof obj !== "object") return out;
  for (const [k, v] of Object.entries(obj)) {
    if (!v || typeof v !== "object") continue;
    const mastery = Math.max(0, Math.min(5, parseInt(v.mastery, 10) || 0));
    const correct = Math.max(0, parseInt(v.correct, 10) || 0);
    const total = Math.max(0, parseInt(v.total, 10) || 0);
    out[k] = { mastery, correct, total };
  }
  return out;
}
export function buildBackup(progress) {
  return JSON.stringify({ app: "DeutschMeister", version: 2, exportedAt: new Date().toISOString(), progress }, null, 2);
}
export function parseBackup(raw) {
  const data = JSON.parse(raw);
  const incoming = sanitizeProgress(data.progress || data);
  if (!Object.keys(incoming).length) throw new Error("empty");
  return incoming;
}
function filename() {
  return `deutschmeister-progress-${new Date().toISOString().slice(0, 10)}.json`;
}
// Uses the Web Share API on iOS ("Save to Files" / AirDrop) and falls back to a download.
export async function shareOrDownloadBackup(progress) {
  const json = buildBackup(progress);
  const name = filename();
  try {
    if (navigator.canShare) {
      const file = new File([json], name, { type: "application/json" });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "Deutsch Meister backup" });
        return "shared";
      }
    }
  } catch {}
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  return "downloaded";
}
export async function copyBackup(progress) {
  await navigator.clipboard.writeText(buildBackup(progress));
}
