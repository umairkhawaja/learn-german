// ── Google Drive auto-sync hook ───────────────────────────────
// Owns driveStatus and the background pull-on-load / push-on-hide
// effects. Pull+merge on mount when already connected; push when the
// tab is hidden or the page unloads. Behaviour is identical to the
// original inline effects — just lifted out of App for clarity.
import { useState, useEffect, useRef } from "react";
import * as drive from "../driveSync";
import { saveProgress } from "./progress";

export function useDriveSync(progress, setProgress) {
  const progressRef = useRef(progress);
  progressRef.current = progress;
  const [driveStatus, setDriveStatus] = useState({ connected: false, busy: false, lastSync: null, error: null });

  // Preload Google Identity Services so the Connect button can call
  // requestAccessToken() synchronously on click (required on iOS Safari).
  useEffect(() => { drive.preloadGis().catch(() => { }); }, []);

  // Pull + merge silently on load if already connected.
  useEffect(() => {
    drive.isConnected().then((connected) => {
      setDriveStatus((s) => ({ ...s, connected }));
      if (!connected) return;
      (async () => {
        try {
          setDriveStatus((s) => ({ ...s, busy: true }));
          const remote = await drive.pullProgress({ interactive: false });
          if (remote) {
            const merged = drive.mergeProgress(progressRef.current, remote);
            setProgress(merged);
            await saveProgress(merged);
          }
          setDriveStatus((s) => ({ ...s, busy: false, lastSync: Date.now(), error: null }));
        } catch (e) {
          setDriveStatus((s) => ({ ...s, busy: false, error: e.message }));
        }
      })();
    });
  }, [setProgress]);

  // Push when the tab is hidden or unloaded.
  useEffect(() => {
    const pushIfConnected = () => {
      if (!driveStatus.connected) return;
      drive.pushProgress(progressRef.current, { interactive: false }).catch(() => { });
    };
    const onVisibility = () => { if (document.visibilityState === "hidden") pushIfConnected(); };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("beforeunload", pushIfConnected);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("beforeunload", pushIfConnected);
    };
  }, [driveStatus.connected]);

  return { driveStatus, setDriveStatus };
}
