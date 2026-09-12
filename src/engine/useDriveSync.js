// ── Google Drive auto-sync hook ───────────────────────────────
// Owns driveStatus and the background pull-on-load / push-on-hide
// effects. Pull+merge once the local progress has loaded (when already
// connected); push when the tab is hidden or the page unloads.
// `progressLoaded` gates both directions: merging against the initial {}
// loses the local side, and pushing {} would clobber the remote backup.
import { useState, useEffect, useRef, useCallback } from "react";
import * as drive from "../driveSync";
import { saveProgress } from "./progress";

export function useDriveSync(progress, setProgress, progressLoaded) {
  const progressRef = useRef(progress);
  progressRef.current = progress;
  const loadedRef = useRef(progressLoaded);
  loadedRef.current = progressLoaded;
  const [driveStatus, setDriveStatus] = useState({ connected: false, busy: false, lastSync: null, error: null });

  // Google Identity Services has to be loaded *before* the Connect button is
  // tapped, because iOS Safari only allows the OAuth popup from a click
  // handler with no awaits before it.
  //
  // It used to be fetched on every launch. Drive is no longer the sync
  // channel — cloud sync is, and Drive is kept only to import an old snapshot
  // once — so an app that advertises itself as offline-first was making a
  // third-party request at startup for a feature most sessions never touch.
  // It now loads in exactly the two cases that need it: this device is already
  // connected to Drive, or the Backup panel (which holds the Connect button)
  // has been opened.
  const preloadGis = useCallback(() => drive.preloadGis().catch(() => { }), []);

  // Pull + merge silently once the local progress is in, if already connected.
  useEffect(() => {
    if (!progressLoaded) return;
    drive.isConnected().then((connected) => {
      setDriveStatus((s) => ({ ...s, connected }));
      if (!connected) return;
      preloadGis();
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
  }, [setProgress, progressLoaded, preloadGis]);

  // Push when the tab is hidden or unloaded.
  useEffect(() => {
    const pushIfConnected = (keepalive) => {
      if (!driveStatus.connected || !loadedRef.current) return;
      drive.pushProgress(progressRef.current, { interactive: false, keepalive }).catch(() => { });
    };
    // Tab-hide: page still alive, normal request completes for any size. Real
    // unload: keepalive is the only option and is best-effort (large blobs may
    // still be dropped — the next open re-pushes via the load effect).
    const onVisibility = () => { if (document.visibilityState === "hidden") pushIfConnected(false); };
    const onUnload = () => pushIfConnected(true);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("beforeunload", onUnload);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("beforeunload", onUnload);
    };
  }, [driveStatus.connected]);

  return { driveStatus, setDriveStatus, preloadGis };
}
