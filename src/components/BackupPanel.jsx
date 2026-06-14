// ── Backup & restore + Google Drive sync panel ────────────────
import { useState, useEffect, useRef } from "react";
import { COLORS, TXT, MUTE, FAINT } from "../config/theme";
import { storage } from "../storage";
import { saveProgress } from "../engine/progress";
import { buildBackup, parseBackup, shareOrDownloadBackup, copyBackup } from "../backup";
import * as drive from "../driveSync";

export function BackupPanel({ progress, setProgress, driveStatus, setDriveStatus }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [msg, setMsg] = useState(null);
  const fileRef = useRef(null);

  const count = Object.keys(progress).length;
  const [lastBackup, setLastBackup] = useState(null);
  useEffect(() => { storage.get("dm-last-backup").then((r) => { if (r && r.value) setLastBackup(Number(r.value)); }).catch(() => { }); }, []);
  const markBackup = () => { const t = Date.now(); setLastBackup(t); storage.set("dm-last-backup", String(t)); };
  const daysSince = lastBackup ? Math.floor((Date.now() - lastBackup) / 86400000) : null;

  const download = async () => {
    try { const how = await shareOrDownloadBackup(progress); markBackup(); setMsg({ ok: true, t: how === "shared" ? "Backup shared." : "Backup file downloaded." }); }
    catch { setMsg({ ok: false, t: "Export blocked — use Copy instead." }); }
  };

  const copy = async () => {
    try { await copyBackup(progress); markBackup(); setMsg({ ok: true, t: "Copied to clipboard." }); }
    catch { setText(buildBackup(progress)); setOpen(true); setMsg({ ok: true, t: "Clipboard blocked — JSON shown below to copy manually." }); }
  };

  const doImport = (raw) => {
    try {
      const incoming = parseBackup(raw);
      const merged = { ...progress, ...incoming };
      setProgress(merged); saveProgress(merged);
      setMsg({ ok: true, t: `Restored ${Object.keys(incoming).length} words.` });
      setText("");
    } catch (e) { setMsg({ ok: false, t: (e && e.message === "empty") ? "No valid progress found in that data." : "That doesn't look like valid backup JSON." }); }
  };

  const onFile = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => doImport(String(r.result));
    r.onerror = () => setMsg({ ok: false, t: "Couldn't read that file." });
    r.readAsText(f);
    e.target.value = "";
  };

  // ── Google Drive sync ──
  // IMPORTANT: drive.connect() must be invoked synchronously, in the same
  // tick as the click event — no `await` before it — or iOS Safari treats
  // the resulting window.open() as not user-initiated and silently blocks
  // the popup (no error, just nothing happens).
  const driveConnect = () => {
    const connectPromise = drive.connect({ interactive: true }); // ← fires popup synchronously, first
    setDriveStatus((s) => ({ ...s, busy: true, error: null }));
    connectPromise
      .then(async (ok) => {
        if (!ok) { setDriveStatus((s) => ({ ...s, busy: false })); return; }
        const remote = await drive.pullProgress({ interactive: false });
        let merged = progress;
        if (remote) {
          merged = drive.mergeProgress(progress, remote);
          setProgress(merged);
          await saveProgress(merged);
        }
        await drive.pushProgress(merged, { interactive: false });
        setDriveStatus({ connected: true, busy: false, lastSync: Date.now(), error: null });
        setMsg({ ok: true, t: "Connected to Google Drive and synced." });
      })
      .catch((e) => {
        setDriveStatus((s) => ({ ...s, busy: false, error: e.message }));
        setMsg({ ok: false, t: e.message });
      });
  };

  const driveSyncNow = async () => {
    setDriveStatus((s) => ({ ...s, busy: true, error: null }));
    try {
      const remote = await drive.pullProgress({ interactive: false });
      const merged = remote ? drive.mergeProgress(progress, remote) : progress;
      if (remote) { setProgress(merged); await saveProgress(merged); }
      await drive.pushProgress(merged, { interactive: false });
      setDriveStatus({ connected: true, busy: false, lastSync: Date.now(), error: null });
      setMsg({ ok: true, t: "Synced with Google Drive." });
    } catch (e) {
      setDriveStatus((s) => ({ ...s, busy: false, connected: e.message.includes("reconnect") ? false : s.connected, error: e.message }));
      setMsg({ ok: false, t: e.message });
    }
  };

  const driveDisconnect = async () => {
    await drive.disconnect();
    setDriveStatus({ connected: false, busy: false, lastSync: null, error: null });
    setMsg({ ok: true, t: "Disconnected from Google Drive." });
  };

  return (
    <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 15, marginTop: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }} onClick={() => setOpen((v) => !v)}>
        <span style={{ fontWeight: 700, color: COLORS.txtStrong, fontSize: 14 }}>💾 Backup &amp; restore</span>
        <span style={{ color: FAINT, fontSize: 14, transform: open ? "rotate(90deg)" : "none", transition: "transform .15s" }}>›</span>
      </div>
      {!open && <div style={{ fontSize: 12.5, color: MUTE, marginTop: 3 }}>Export your progress to a file, or restore it on another device.</div>}
      {open && (
        <div className="dm-reveal" style={{ marginTop: 12 }}>
          <div style={{ fontSize: 12, color: FAINT, marginBottom: 8 }}>You have progress on <b style={{ color: TXT }}>{count}</b> words.</div>
          {count > 0 && daysSince !== null && (
            <div style={{ fontSize: 12, color: daysSince >= 7 ? COLORS.warn : MUTE, marginBottom: 10 }}>
              {daysSince === 0 ? "Backed up today." : `Last backup ${daysSince} day${daysSince === 1 ? "" : "s"} ago.${daysSince >= 7 ? " Consider exporting." : ""}`}
            </div>
          )}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
            <button onClick={download} style={{ flex: 1, minWidth: 130, background: COLORS.der, border: "none", borderRadius: 10, padding: "10px", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>⬇ Export file</button>
            <button onClick={copy} style={{ flex: 1, minWidth: 130, background: "#1a1a1a", border: `1px solid ${COLORS.borderSoft}`, borderRadius: 10, padding: "10px", color: TXT, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>⧉ Copy JSON</button>
          </div>
          <div style={{ fontSize: 12, color: FAINT, marginBottom: 6 }}>Restore from a backup:</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            <button onClick={() => fileRef.current && fileRef.current.click()} style={{ flex: 1, minWidth: 130, background: "#1a1a1a", border: `1px solid ${COLORS.borderSoft}`, borderRadius: 10, padding: "10px", color: TXT, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>⬆ Load file</button>
            <input ref={fileRef} type="file" accept="application/json,.json" onChange={onFile} style={{ display: "none" }} />
            <button onClick={() => text.trim() && doImport(text)} style={{ flex: 1, minWidth: 130, background: COLORS.success, border: "none", borderRadius: 10, padding: "10px", color: "#06240f", fontSize: 13, fontWeight: 700, cursor: text.trim() ? "pointer" : "not-allowed", opacity: text.trim() ? 1 : 0.5 }}>Restore pasted JSON</button>
          </div>
          <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="…or paste backup JSON here, then press Restore."
            style={{ width: "100%", minHeight: 70, background: COLORS.surfaceDeep, border: `1px solid ${COLORS.borderSoft}`, borderRadius: 10, padding: 10, color: TXT, fontSize: 12, fontFamily: "ui-monospace, monospace", resize: "vertical" }} />
          {msg && <div style={{ marginTop: 8, fontSize: 12.5, color: msg.ok ? COLORS.successText : COLORS.dangerText }}>{msg.ok ? "✓ " : "✗ "}{msg.t}</div>}
          <div style={{ marginTop: 8, fontSize: 11, color: "#3f4651", lineHeight: 1.5 }}>Restoring merges into your current progress; words missing from a backup stay at zero, so older backups still work after new words are added.</div>

          {/* Google Drive sync */}
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${COLORS.border}` }}>
            <div style={{ fontSize: 12, color: FAINT, marginBottom: 8 }}>☁️ Google Drive sync:</div>
            {!driveStatus.connected ? (
              <button onClick={driveConnect} disabled={driveStatus.busy}
                style={{ width: "100%", background: "#1a1a1a", border: `1px solid ${COLORS.borderSoft}`, borderRadius: 10, padding: "10px", color: TXT, fontSize: 13, fontWeight: 600, cursor: driveStatus.busy ? "default" : "pointer", opacity: driveStatus.busy ? 0.6 : 1 }}>
                {driveStatus.busy ? "Connecting…" : "Connect Google Drive"}
              </button>
            ) : (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button onClick={driveSyncNow} disabled={driveStatus.busy}
                  style={{ flex: 1, minWidth: 130, background: COLORS.der, border: "none", borderRadius: 10, padding: "10px", color: "#fff", fontSize: 13, fontWeight: 700, cursor: driveStatus.busy ? "default" : "pointer", opacity: driveStatus.busy ? 0.6 : 1 }}>
                  {driveStatus.busy ? "Syncing…" : "↻ Sync now"}
                </button>
                <button onClick={driveDisconnect}
                  style={{ flex: 1, minWidth: 130, background: "#1a1a1a", border: `1px solid ${COLORS.borderSoft}`, borderRadius: 10, padding: "10px", color: TXT, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  Disconnect
                </button>
              </div>
            )}
            <div style={{ fontSize: 11, color: "#3f4651", marginTop: 8, lineHeight: 1.5 }}>
              {driveStatus.connected
                ? `Auto-syncs in the background. ${driveStatus.lastSync ? `Last synced ${new Date(driveStatus.lastSync).toLocaleString()}.` : ""}`
                : "Stores progress in your Drive's hidden app folder (not visible in your normal Drive files) — syncs automatically across devices once connected."}
            </div>
            {driveStatus.error && <div style={{ marginTop: 6, fontSize: 12, color: COLORS.dangerText }}>✗ {driveStatus.error}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
