// ── Google Drive auto-sync hook ───────────────────────────────
// Owns driveStatus and the background pull-on-load / push-on-hide
// effects. Pull+merge once the local progress has loaded (when already
// connected); push when the tab is hidden or the page unloads.
// `progressLoaded` gates both directions: merging against the initial {}
// loses the local side, and pushing {} would clobber the remote backup.
import { useState, useEffect, useRef } from "react";
import * as drive from "../driveSync";
import { saveProgress } from "./progress";

export function useDriveSync(progress, setProgress, progressLoaded) {
  const progressRef = useRef(progress);
  progressRef.current = progress;
  const loadedRef = useRef(progressLoaded);
  loadedRef.current = progressLoaded;
  const [driveStatus, setDriveStatus] = useState({ connected: false, busy: false, lastSync: null, error: null });

  // Preload Google Identity Services so the Connect button can call
  // requestAccessToken() synchronously on click (required on iOS Safari).
  useEffect(() => { drive.preloadGis().catch(() => { }); }, []);

  // Pull + merge silently once the local progress is in, if already connected.
  useEffect(() => {
    if (!progressLoaded) return;
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
  }, [setProgress, progressLoaded]);

  // Push when the tab is hidden or unloaded.
  useEffect(() => {
    const pushIfConnected = () => {
      if (!driveStatus.connected || !loadedRef.current) return;
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
