// ── Cloud auto-sync hook ──────────────────────────────────────
// Primary progress-sync channel: a Cloudflare Worker + KV store reached with a
// baked-in secret key (see ../cloudSync). No login, and it survives IndexedDB
// eviction — which is what was making mastered words reappear.
//
// On load (once local progress is read): pull the cloud snapshot, merge it with
// local, save, and push the merged result back. This is what "initialise the
// state from the latest snapshot" looks like in practice — the cloud copy wins
// back anything eviction wiped locally, and any local-only gains are preserved.
// On tab-hide / unload: push local progress up.
//
// `progressLoaded` gates both directions so we never merge against the initial
// {} (which would lose local) or push {} (which would clobber the store).
import { useState, useEffect, useRef } from "react";
import * as cloud from "../cloudSync";
import { saveProgress } from "./progress";

export function useCloudSync(progress, setProgress, progressLoaded) {
  const progressRef = useRef(progress);
  progressRef.current = progress;
  const loadedRef = useRef(progressLoaded);
  loadedRef.current = progressLoaded;
  const [cloudStatus, setCloudStatus] = useState({
    configured: cloud.isConfigured(),
    busy: false,
    lastSync: null,
    error: null,
  });

  // Pull + merge once local progress is in.
  useEffect(() => {
    if (!progressLoaded || !cloud.isConfigured()) return;
    (async () => {
      try {
        setCloudStatus((s) => ({ ...s, busy: true }));
        const remote = await cloud.pullProgress();
        if (remote) {
          const merged = cloud.mergeProgress(progressRef.current, remote);
          setProgress(merged);
          await saveProgress(merged);
          // Reflect any local-only gains back to the store.
          await cloud.pushProgress(merged).catch(() => {});
        } else if (Object.keys(progressRef.current).length) {
          // Store empty (first run) — seed it with whatever we have locally.
          await cloud.pushProgress(progressRef.current).catch(() => {});
        }
        setCloudStatus((s) => ({ ...s, busy: false, lastSync: Date.now(), error: null }));
      } catch (e) {
        setCloudStatus((s) => ({ ...s, busy: false, error: e.message }));
      }
    })();
  }, [setProgress, progressLoaded]);

  // Push when the tab is hidden or unloaded.
  useEffect(() => {
    const push = (keepalive) => {
      if (!cloud.isConfigured() || !loadedRef.current) return;
      cloud.pushProgress(progressRef.current, { keepalive }).catch(() => {});
    };
    // Tab-hide: the page is still alive, so a normal request completes even for
    // a large blob. Real unload: keepalive is the only way it survives (and it's
    // best-effort — the load effect re-pushes on next open).
    const onVisibility = () => { if (document.visibilityState === "hidden") push(false); };
    const onUnload = () => push(true);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("beforeunload", onUnload);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("beforeunload", onUnload);
    };
  }, []);

  return { cloudStatus, setCloudStatus };
}
