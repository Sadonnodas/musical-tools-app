// Composites a webcam stream and a screen-capture stream onto a single canvas
// at a target resolution and framerate. Returns a MediaStream from the canvas
// plus controls for live PiP layout updates.

const DEFAULT_FPS = 30;

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

export const createCompositor = ({
    width,
    height,
    fps = DEFAULT_FPS,
    includeWebcam = true,
    includeScreen = true,
    webcamStream = null,
    screenStream = null,
    pip = { anchor: 'br', xPct: 0.65, yPct: 0.65, widthPct: 0.32 },
    showWebcamMirrored = false,
}) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { alpha: false });

    const webcamVideo = document.createElement('video');
    webcamVideo.muted = true;
    webcamVideo.playsInline = true;
    webcamVideo.autoplay = true;

    const screenVideo = document.createElement('video');
    screenVideo.muted = true;
    screenVideo.playsInline = true;
    screenVideo.autoplay = true;

    const state = {
        includeWebcam,
        includeScreen,
        pip: { ...pip },
        showWebcamMirrored,
        running: false,
        rafId: null,
    };

    const activeWebcam = () => webcamVideo;
    const activeScreen = () => screenVideo;

    const setStream = async (kind, stream) => {
        const el = kind === 'webcam' ? webcamVideo : screenVideo;
        // No-op when the stream hasn't actually changed. Setting srcObject
        // to the same MediaStream still triggers a reload — videoWidth drops
        // to 0 momentarily and drawFrame paints the "No video sources"
        // placeholder until the element redecodes metadata. That placeholder
        // ends up as the first recorded frame if MediaRecorder starts in
        // that gap.
        if (el.srcObject === stream) return;
        el.srcObject = stream || null;
        if (stream) {
            try { await el.play(); } catch (_) { /* ignore autoplay race */ }
        }
    };

    const setIncludeWebcam = (v) => { state.includeWebcam = !!v; };
    const setIncludeScreen = (v) => { state.includeScreen = !!v; };
    const setPip = (next) => { state.pip = { ...state.pip, ...next }; };
    const setMirrored = (v) => { state.showWebcamMirrored = !!v; };

    // Compute the screen capture rect in canvas coordinates, given current pip
    // settings. xPct/yPct represent the top-left corner of the PiP rect when
    // the anchor is 'free'; for corner anchors we override to that corner.
    const computePipRect = () => {
        const { anchor, xPct, yPct, widthPct } = state.pip;
        const w = Math.round(canvas.width * clamp(widthPct, 0.1, 1));
        const screenEl = activeScreen();
        const srcW = (screenEl && screenEl.videoWidth) ? screenEl.videoWidth : 16;
        const srcH = (screenEl && screenEl.videoHeight) ? screenEl.videoHeight : 9;
        const h = Math.round(w * (srcH / srcW));

        let x;
        let y;
        const margin = Math.round(canvas.width * 0.015);
        switch (anchor) {
            case 'tl': x = margin; y = margin; break;
            case 'tr': x = canvas.width - w - margin; y = margin; break;
            case 'bl': x = margin; y = canvas.height - h - margin; break;
            case 'br': x = canvas.width - w - margin; y = canvas.height - h - margin; break;
            case 'free':
            default:
                x = Math.round(canvas.width * clamp(xPct, 0, 1 - widthPct));
                y = Math.round(canvas.height * clamp(yPct, 0, 1 - (h / canvas.height)));
                break;
        }
        return { x, y, w, h };
    };

    const drawCoverFit = (videoEl) => {
        if (!videoEl || !videoEl.videoWidth) return;
        const cW = canvas.width;
        const cH = canvas.height;
        const vW = videoEl.videoWidth;
        const vH = videoEl.videoHeight;
        // cover-fit: scale so video fills canvas, cropping the overflow
        const scale = Math.max(cW / vW, cH / vH);
        const drawW = vW * scale;
        const drawH = vH * scale;
        const dx = (cW - drawW) / 2;
        const dy = (cH - drawH) / 2;
        if (state.showWebcamMirrored) {
            ctx.save();
            ctx.translate(cW, 0);
            ctx.scale(-1, 1);
            ctx.drawImage(videoEl, cW - dx - drawW, dy, drawW, drawH);
            ctx.restore();
        } else {
            ctx.drawImage(videoEl, dx, dy, drawW, drawH);
        }
    };

    const drawScreenPip = () => {
        const screenEl = activeScreen();
        if (!screenEl || !screenEl.videoWidth) return;
        const { x, y, w, h } = computePipRect();
        // subtle border to make the PiP readable over busy backgrounds
        ctx.fillStyle = '#000';
        ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
        ctx.drawImage(screenEl, x, y, w, h);
    };

    const drawScreenFull = () => {
        const screenEl = activeScreen();
        if (!screenEl || !screenEl.videoWidth) return;
        const cW = canvas.width;
        const cH = canvas.height;
        const vW = screenEl.videoWidth;
        const vH = screenEl.videoHeight;
        const scale = Math.min(cW / vW, cH / vH);
        const drawW = vW * scale;
        const drawH = vH * scale;
        const dx = (cW - drawW) / 2;
        const dy = (cH - drawH) / 2;
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, cW, cH);
        ctx.drawImage(screenEl, dx, dy, drawW, drawH);
    };

    const drawFrame = () => {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const webcamEl = activeWebcam();
        const screenEl = activeScreen();
        const haveWebcam = !!(webcamEl && webcamEl.videoWidth);
        const haveScreen = !!(screenEl && screenEl.videoWidth);

        if (state.includeWebcam && haveWebcam) {
            drawCoverFit(webcamEl);
            if (state.includeScreen && haveScreen) {
                drawScreenPip();
            }
        } else if (state.includeScreen && haveScreen) {
            // No webcam: show screen full-frame (letterboxed) rather than tiny PiP
            drawScreenFull();
        } else {
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#94a3b8';
            ctx.font = `${Math.round(canvas.height / 18)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText('No video sources', canvas.width / 2, canvas.height / 2);
        }
    };

    const start = () => {
        if (state.running) return;
        state.running = true;
        const tick = () => {
            if (!state.running) return;
            drawFrame();
            state.rafId = requestAnimationFrame(tick);
        };
        state.rafId = requestAnimationFrame(tick);
    };

    const stop = () => {
        state.running = false;
        if (state.rafId) cancelAnimationFrame(state.rafId);
        state.rafId = null;
    };

    // Chrome on Windows aggressively throttles requestAnimationFrame for
    // canvases that aren't in the rendered DOM tree — after a few seconds
    // RAF drops to ~0 fps and `canvas.captureStream()` stops emitting
    // frames, so the recorded video freezes even though the underlying
    // webcam/screen streams keep producing frames. Workaround: keep the
    // canvas attached to a tiny, hidden-but-rendered host in document.body
    // at all times. The CompositorPreview component re-parents the canvas
    // into a visible wrapper for display and returns it here on unmount.
    const hiddenHost = document.createElement('div');
    hiddenHost.style.cssText = [
        'position:fixed',
        'left:0',
        'top:0',
        'width:1px',
        'height:1px',
        'overflow:hidden',
        'pointer-events:none',
        'opacity:0.01',
        'z-index:-1',
    ].join(';');
    hiddenHost.setAttribute('aria-hidden', 'true');
    document.body.appendChild(hiddenHost);
    hiddenHost.appendChild(canvas);

    const attachTo = (parent) => {
        if (!parent || canvas.parentElement === parent) return;
        parent.appendChild(canvas);
    };
    const detach = () => {
        if (canvas.parentElement !== hiddenHost) {
            hiddenHost.appendChild(canvas);
        }
    };

    const dispose = () => {
        stop();
        webcamVideo.srcObject = null;
        screenVideo.srcObject = null;
        try { canvas.remove(); } catch (_) {}
        try { hiddenHost.remove(); } catch (_) {}
    };

    // wire initial streams
    setStream('webcam', webcamStream);
    setStream('screen', screenStream);

    const outputStream = canvas.captureStream(fps);

    return {
        canvas,
        outputStream,
        // Synchronously redraws the current frame. Used right before
        // MediaRecorder.start() so the first captured frame is up to date
        // instead of whatever stale (often black) state the canvas held.
        drawFrame,
        setWebcamStream: (s) => setStream('webcam', s),
        setScreenStream: (s) => setStream('screen', s),
        setIncludeWebcam,
        setIncludeScreen,
        setPip,
        setMirrored,
        getPipRect: computePipRect,
        getState: () => ({ ...state, pip: { ...state.pip } }),
        attachTo,
        detach,
        start,
        stop,
        dispose,
    };
};
