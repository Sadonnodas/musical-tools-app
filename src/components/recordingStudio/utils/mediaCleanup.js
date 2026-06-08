// Properly release a HTML media element so its underlying WebMediaPlayer
// is torn down. Setting srcObject or src to null is NOT enough — Chrome
// holds the player alive until the element explicitly loads an empty
// source. There's a hard ceiling of ~75 live players per page; without
// this helper the recording studio leaks players on every record →
// review cycle and after enough takes the player limit is reached,
// causing silent failures (black previews, MediaRecorder won't start).
//
// Reference: https://crbug.com/1144736
export const releaseMediaElement = (el) => {
    if (!el) return;
    try { el.pause(); } catch (_) {}
    try { el.srcObject = null; } catch (_) {}
    try { el.removeAttribute('src'); } catch (_) {}
    try { el.load(); } catch (_) {}
};
