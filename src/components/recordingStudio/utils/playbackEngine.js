// Synchronized playback for a v2 take. Receives already-mounted media
// elements (the consumer renders them via React). Routes mic and tab audio
// through Web Audio gain nodes, keeps the followers within ~80 ms of the
// leader (the video element when present), and reports time / duration to
// the consumer via callbacks.
//
// IMPORTANT: AudioContext is shared across engine instances and never closed.
// `createMediaElementSource` may only be called once per element for the
// lifetime of that element — calling it again throws InvalidStateError. With
// React StrictMode double-running effects in dev, creating a fresh ctx per
// engine would bind the audio element to a context that the next cleanup
// closes, leaving the element's output orphaned to a closed graph and
// permanently silent. Sharing one ctx + caching the source per element via
// a WeakMap sidesteps the whole class of bug.

const SYNC_TOLERANCE_MS = 80;

let sharedAudioCtx = null;
const elementSources = new WeakMap();

const getSharedCtx = () => {
    if (!sharedAudioCtx) {
        sharedAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return sharedAudioCtx;
};

const getOrCreateMediaSource = (ctx, element) => {
    if (!element) return null;
    let src = elementSources.get(element);
    if (!src) {
        try {
            src = ctx.createMediaElementSource(element);
            elementSources.set(element, src);
        } catch (e) {
            console.warn('createMediaElementSource failed', e);
            return null;
        }
    }
    return src;
};

export const createPlaybackEngine = ({
    videoEl = null,
    micEl = null,
    tabEl = null,
    onTimeUpdate,
    onDurationChange,
    onPlay,
    onPause,
    onEnded,
}) => {
    const leader = videoEl || micEl || tabEl;
    if (!leader) {
        return {
            play: () => Promise.resolve(),
            pause: () => {},
            seek: () => {},
            setMicGain: () => {},
            setTabGain: () => {},
            getDuration: () => 0,
            getCurrentTime: () => 0,
            isPlaying: () => false,
            destroy: () => {},
        };
    }

    const ctx = getSharedCtx();
    const micGainNode = ctx.createGain();
    const tabGainNode = ctx.createGain();
    micGainNode.connect(ctx.destination);
    tabGainNode.connect(ctx.destination);

    // `createMediaElementSource` is deferred until the first play(). When it
    // runs at engine-creation time the audio elements often haven't decoded
    // any data yet — the source binds to a silent stream and stays silent
    // even after the element loads. By the time play() is called the user
    // has clicked the play button (so the element is fully loaded and we're
    // in a user-gesture context), and creating the source against a loaded
    // element produces a binding that works on the first frame.
    let micSrc = null;
    let tabSrc = null;
    let micConnected = false;
    let tabConnected = false;

    const ensureAudioRouting = () => {
        if (micEl && !micConnected) {
            micSrc = getOrCreateMediaSource(ctx, micEl);
            if (micSrc) { try { micSrc.connect(micGainNode); } catch (_) {} }
            micConnected = true;
        }
        if (tabEl && !tabConnected) {
            tabSrc = getOrCreateMediaSource(ctx, tabEl);
            if (tabSrc) { try { tabSrc.connect(tabGainNode); } catch (_) {} }
            tabConnected = true;
        }
    };

    // The video element doesn't need Web Audio routing since the composited
    // video has no audio track. Mute it just to be safe, explicitly disable
    // autoplay, and force a paused state. On some Chrome builds a muted
    // <video> with a freshly-set src + a programmatic currentTime nudge
    // can transition into the playing state without us calling .play() —
    // that's the "auto-plays without user click" bug the user observed,
    // which then prevents audio from being heard because the playback
    // started outside of any user-gesture context.
    if (videoEl) {
        videoEl.muted = true;
        try { videoEl.removeAttribute('autoplay'); } catch (_) {}
        try { videoEl.pause(); } catch (_) {}
    }
    [micEl, tabEl].forEach((el) => {
        if (!el) return;
        try { el.removeAttribute('autoplay'); } catch (_) {}
        try { el.pause(); } catch (_) {}
    });

    const followers = [micEl, tabEl, videoEl].filter((el) => el && el !== leader);
    const playables = [leader, ...followers];

    let knownDuration = 0;
    const probe = () => {
        playables.forEach((el) => {
            if (el && isFinite(el.duration) && el.duration > 0) {
                knownDuration = Math.max(knownDuration, el.duration);
            }
        });
        if (knownDuration > 0 && onDurationChange) onDurationChange(knownDuration);
    };
    leader.addEventListener('loadedmetadata', probe);
    leader.addEventListener('durationchange', probe);
    if (onTimeUpdate) leader.addEventListener('timeupdate', () => onTimeUpdate(leader.currentTime));
    if (onPlay) leader.addEventListener('play', onPlay);
    if (onPause) leader.addEventListener('pause', onPause);
    if (onEnded) leader.addEventListener('ended', onEnded);

    // Don't programmatically seek the video to paint a "first frame" any
    // more — that nudge was triggering autoplay in some browsers and
    // sitting outside the user-gesture window. The <video> element with
    // preload="metadata" shows its natural first frame on its own; if it
    // looks black initially, the user clicks Play and it kicks in.

    let driftInterval = null;
    const startDriftLoop = () => {
        if (driftInterval) return;
        driftInterval = setInterval(() => {
            const t = leader.currentTime;
            followers.forEach((el) => {
                if (el.paused) return;
                const diff = Math.abs(el.currentTime - t) * 1000;
                if (diff > SYNC_TOLERANCE_MS) {
                    try { el.currentTime = t; } catch (_) {}
                }
            });
        }, 250);
    };
    const stopDriftLoop = () => {
        if (driftInterval) clearInterval(driftInterval);
        driftInterval = null;
    };

    // Resolves once `el` has decoded enough data that its MediaElementSource
    // will produce real samples instead of silence. Falls back after `timeoutMs`
    // so a misbehaving element can't deadlock playback.
    const waitForReady = (el, timeoutMs = 1500) => {
        if (!el || el.readyState >= 3) return Promise.resolve();
        return new Promise((resolve) => {
            let done = false;
            const finish = () => {
                if (done) return;
                done = true;
                el.removeEventListener('canplay', finish);
                el.removeEventListener('canplaythrough', finish);
                el.removeEventListener('loadeddata', finish);
                resolve();
            };
            el.addEventListener('canplay', finish);
            el.addEventListener('canplaythrough', finish);
            el.addEventListener('loadeddata', finish);
            setTimeout(finish, timeoutMs);
        });
    };

    // Resolves when the element fires `seeked` for the most recent seek.
    // The MediaElementSource taps silence until the seek lands, so we wait
    // for that explicitly before starting playback. `currentTime = t` may not
    // fire `seeked` if it's already at `t`, so a no-op resolve is safe.
    const seekAndWait = (el, t, timeoutMs = 500) => {
        if (!el) return Promise.resolve();
        return new Promise((resolve) => {
            let done = false;
            const finish = () => {
                if (done) return;
                done = true;
                el.removeEventListener('seeked', finish);
                resolve();
            };
            el.addEventListener('seeked', finish, { once: true });
            try {
                if (Math.abs(el.currentTime - t) < 0.01) {
                    // Already there — nudge to force a seeked event.
                    el.currentTime = Math.max(0, t + 0.001);
                }
                el.currentTime = t;
            } catch (_) {
                finish();
                return;
            }
            setTimeout(finish, timeoutMs);
        });
    };

    const play = async () => {
        // Chrome's autoplay policy checks user-gesture state at the MOMENT
        // .play() is called, not when its promise resolves. By the time
        // we'd hit .play() after several awaits, the gesture context from
        // the click is gone and audio elements get silently rejected (the
        // user only heard sound after touching the timeline, which is its
        // own gesture). Call .play() synchronously here, before any await,
        // so the audio elements pick up the click's gesture cleanly.
        // ctx.resume() is also called synchronously for the same reason.
        const resumePromise = ctx.state === 'suspended' ? ctx.resume() : Promise.resolve();
        const playPromises = playables.map((el) => el.play().catch(() => {}));

        try { await resumePromise; } catch (_) {}
        // Now (out of gesture context, but post-resume) prepare the audio
        // routing and align positions. The sources tap into elements that
        // are actively playing, so the binding is live from the first
        // sample.
        await Promise.all([micEl, tabEl].map((el) => waitForReady(el)));
        ensureAudioRouting();
        const t = Math.max(0, leader.currentTime);
        await Promise.all([micEl, tabEl].map((el) => seekAndWait(el, t)));
        await Promise.all(playPromises);
        startDriftLoop();
    };
    const pause = () => {
        playables.forEach((el) => { try { el.pause(); } catch (_) {} });
        stopDriftLoop();
    };
    const seek = (t) => {
        const target = Math.max(0, Math.min(knownDuration || 1e6, t));
        playables.forEach((el) => { try { el.currentTime = target; } catch (_) {} });
    };

    const setMicGain = (v) => { micGainNode.gain.value = Math.max(0, v); };
    const setTabGain = (v) => { tabGainNode.gain.value = Math.max(0, v); };

    const destroy = () => {
        stopDriftLoop();
        // Pause all elements explicitly. Without this, an audio element
        // can keep playing through its MediaElementSource into a stale
        // graph, or — worse — restart on its own when a fresh take's
        // engine mounts new elements with overlapping refs.
        playables.forEach((el) => { try { el.pause(); } catch (_) {} });
        // Note: we do NOT call releaseMediaElement on the video/audio
        // elements here because they're owned by React (rendered in
        // ReviewPanel) and React will unmount them when key/currentTakeId
        // changes — that's what releases the WebMediaPlayer. Touching
        // their src here would race with React's controlled-element
        // lifecycle.
        // Disconnect the per-engine gain branch from the shared graph but
        // DON'T close the shared ctx and DON'T disconnect the cached
        // MediaElementSource (it stays bound to the element so the next
        // engine can reattach without throwing InvalidStateError).
        try { if (micSrc) micSrc.disconnect(micGainNode); } catch (_) {}
        try { if (tabSrc) tabSrc.disconnect(tabGainNode); } catch (_) {}
        try { micGainNode.disconnect(); } catch (_) {}
        try { tabGainNode.disconnect(); } catch (_) {}
    };

    // Run an immediate probe in case metadata is already available
    setTimeout(probe, 0);

    return {
        play, pause, seek,
        setMicGain, setTabGain,
        getDuration: () => knownDuration,
        getCurrentTime: () => leader.currentTime,
        isPlaying: () => !leader.paused,
        destroy,
    };
};
