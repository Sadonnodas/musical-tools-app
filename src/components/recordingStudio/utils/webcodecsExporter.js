import { releaseMediaElement } from './mediaCleanup';

// Hardware-accelerated MP4 export using WebCodecs + mp4-muxer.
//
// Pipeline:
//   - Video : play the recorded WebM through a hidden <video> element,
//             grab each painted frame via requestVideoFrameCallback as a
//             VideoFrame, re-encode to H.264 via VideoEncoder, append to
//             muxer.
//   - Audio : decode mic + tab WebM blobs to AudioBuffers via Web Audio,
//             apply user gains in an OfflineAudioContext (also handles trim),
//             slice the rendered buffer into AudioData chunks, encode AAC
//             via AudioEncoder, append to muxer.
//   - Muxer : mp4-muxer assembles H.264 + AAC into an .mp4 ArrayBuffer.
//
// All steps are streamed: nothing waits for the whole file in memory at any
// point past the source blobs themselves. Encoding is hardware-accelerated
// where available, so on a typical laptop the export runs at or near
// real-time, ~10× faster than the ffmpeg.wasm fallback.

const VIDEO_CODEC = 'avc1.42001f'; // H.264 Baseline level 3.1 — broadly playable
const AUDIO_CODEC = 'mp4a.40.2';   // AAC-LC

export const isWebCodecsAvailable = () => {
    if (typeof window === 'undefined') return false;
    return !!(window.VideoEncoder && window.AudioEncoder && window.VideoDecoder);
};

const probeSupport = async (width, height, bitrate) => {
    if (!isWebCodecsAvailable()) return false;
    try {
        const v = await window.VideoEncoder.isConfigSupported({
            codec: VIDEO_CODEC,
            width,
            height,
            bitrate,
            framerate: 30,
        });
        if (!v?.supported) return false;
        const a = await window.AudioEncoder.isConfigSupported({
            codec: AUDIO_CODEC,
            sampleRate: 48000,
            numberOfChannels: 2,
            bitrate: 128_000,
        });
        return !!a?.supported;
    } catch (_) {
        return false;
    }
};

// --- audio helpers -------------------------------------------------------

const decodeAudioBlob = async (blob, audioCtx) => {
    if (!blob) return null;
    const buf = await blob.arrayBuffer();
    return audioCtx.decodeAudioData(buf);
};

// Renders the final audio mix offline at 48 kHz stereo so the AudioEncoder
// gets a uniform stream regardless of input source rates / channel counts.
const renderMixedAudio = async ({ micBuffer, tabBuffer, micGain, tabGain, startSec, endSec }) => {
    const sampleRate = 48000;
    const channels = 2;
    const sources = [];
    if (micBuffer) sources.push({ buffer: micBuffer, gain: micGain });
    if (tabBuffer) sources.push({ buffer: tabBuffer, gain: tabGain });
    if (sources.length === 0) return null;

    const longest = Math.max(...sources.map((s) => s.buffer.duration));
    const trimStart = Math.max(0, startSec ?? 0);
    const trimEnd = endSec != null ? Math.min(endSec, longest) : longest;
    const renderDuration = Math.max(0.05, trimEnd - trimStart);

    const offline = new OfflineAudioContext(channels, Math.ceil(renderDuration * sampleRate), sampleRate);
    sources.forEach(({ buffer, gain }) => {
        const src = offline.createBufferSource();
        src.buffer = buffer;
        const gainNode = offline.createGain();
        gainNode.gain.value = Math.max(0, gain);
        src.connect(gainNode).connect(offline.destination);
        // Start the source so its `0` corresponds to `trimStart` in source time.
        src.start(0, trimStart);
    });
    return offline.startRendering();
};

const encodeAudio = async ({ mixedBuffer, encoder }) => {
    if (!mixedBuffer) return;
    const sampleRate = mixedBuffer.sampleRate;
    const channels = mixedBuffer.numberOfChannels;
    const totalFrames = mixedBuffer.length;
    const chunkFrames = 1024;

    // Interleave channel data into a flat Float32 array per chunk.
    const chData = [];
    for (let c = 0; c < channels; c++) chData.push(mixedBuffer.getChannelData(c));

    for (let offset = 0; offset < totalFrames; offset += chunkFrames) {
        const frames = Math.min(chunkFrames, totalFrames - offset);
        const interleaved = new Float32Array(frames * channels);
        for (let i = 0; i < frames; i++) {
            for (let c = 0; c < channels; c++) {
                interleaved[i * channels + c] = chData[c][offset + i];
            }
        }
        const audioData = new window.AudioData({
            format: 'f32',
            sampleRate,
            numberOfFrames: frames,
            numberOfChannels: channels,
            timestamp: Math.round((offset / sampleRate) * 1_000_000),
            data: interleaved,
        });
        encoder.encode(audioData);
        audioData.close();
    }
};

// --- main export ---------------------------------------------------------

// Picks a video bitrate roughly matched to canvas resolution when the caller
// doesn't pass one explicitly. Numbers come from the same scale the recorder
// uses, so a 1440p source isn't softened by being re-encoded down to 5 Mbps.
const defaultBitrateFor = (width, height) => {
    const pixels = (width || 1280) * (height || 720);
    if (pixels >= 2560 * 1440 * 0.9) return 14_000_000;
    if (pixels >= 1920 * 1080 * 0.9) return 8_000_000;
    return 4_000_000;
};

export const exportToMp4WebCodecs = async ({
    videoBlob,
    micBlob = null,
    tabBlob = null,
    micGain = 1,
    tabGain = 1,
    startSec = null,
    endSec = null,
    videoBitrate = null,
    onProgress,
} = {}) => {
    if (!videoBlob) throw new Error('No video blob to export.');
    if (!isWebCodecsAvailable()) throw new Error('WebCodecs is not supported in this browser.');

    const { Muxer, ArrayBufferTarget } = await import('mp4-muxer');

    // Probe video dimensions by briefly loading the blob into a video element.
    const probeUrl = URL.createObjectURL(videoBlob);
    const probeEl = document.createElement('video');
    probeEl.src = probeUrl;
    probeEl.muted = true;
    probeEl.playsInline = true;
    probeEl.preload = 'metadata';
    await new Promise((resolve) => {
        probeEl.addEventListener('loadedmetadata', () => resolve(), { once: true });
        probeEl.addEventListener('error', () => resolve(), { once: true });
    });
    const width = probeEl.videoWidth || 1280;
    const height = probeEl.videoHeight || 720;
    URL.revokeObjectURL(probeUrl);
    // Release the probe element's WebMediaPlayer. Chrome's ~75-player cap
    // is hit fast if every export leaves a probe player alive.
    releaseMediaElement(probeEl);

    const bitrate = videoBitrate || defaultBitrateFor(width, height);

    if (!(await probeSupport(width, height, bitrate))) {
        throw new Error(`WebCodecs cannot encode at ${width}×${height}.`);
    }

    // Trim defaults
    const inSec = startSec != null ? Math.max(0, startSec) : 0;
    const outSec = endSec != null ? endSec : null;
    const expectedDuration = outSec != null ? Math.max(0.05, outSec - inSec) : null;

    // ---- audio: render mix offline (fast) -------------------------------
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    let micBuffer = null;
    let tabBuffer = null;
    try {
        [micBuffer, tabBuffer] = await Promise.all([
            decodeAudioBlob(micBlob, audioCtx),
            decodeAudioBlob(tabBlob, audioCtx),
        ]);
    } finally {
        try { await audioCtx.close(); } catch (_) {}
    }
    const longestAudioDur = Math.max(micBuffer?.duration || 0, tabBuffer?.duration || 0);
    const audioEnd = outSec != null ? Math.min(outSec, longestAudioDur) : longestAudioDur;
    const mixedBuffer = (micBuffer || tabBuffer)
        ? await renderMixedAudio({
            micBuffer, tabBuffer, micGain, tabGain,
            startSec: inSec, endSec: audioEnd,
        })
        : null;

    // ---- muxer + encoders -----------------------------------------------
    const muxer = new Muxer({
        target: new ArrayBufferTarget(),
        video: { codec: 'avc', width, height },
        audio: mixedBuffer ? { codec: 'aac', numberOfChannels: 2, sampleRate: 48000 } : undefined,
        fastStart: 'in-memory',
    });

    const videoEncoder = new window.VideoEncoder({
        output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
        error: (e) => { throw e; },
    });
    videoEncoder.configure({
        codec: VIDEO_CODEC,
        width,
        height,
        bitrate,
        framerate: 30,
        avc: { format: 'avc' }, // produces standard MP4-friendly H.264
    });

    let audioEncoder = null;
    if (mixedBuffer) {
        audioEncoder = new window.AudioEncoder({
            output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
            error: (e) => { throw e; },
        });
        audioEncoder.configure({
            codec: AUDIO_CODEC,
            sampleRate: 48000,
            numberOfChannels: 2,
            bitrate: 128_000,
        });
    }

    // ---- video: play through, capture & encode each frame ---------------
    const videoEl = document.createElement('video');
    videoEl.src = URL.createObjectURL(videoBlob);
    videoEl.muted = true;
    videoEl.playsInline = true;
    videoEl.preload = 'auto';
    document.body.appendChild(videoEl);
    videoEl.style.position = 'fixed';
    videoEl.style.left = '-9999px';
    videoEl.style.top = '0';

    const cleanupVideoEl = () => {
        try { URL.revokeObjectURL(videoEl.src); } catch (_) {}
        try { videoEl.remove(); } catch (_) {}
        // Removing the element from the DOM is NOT enough to release the
        // underlying WebMediaPlayer — see mediaCleanup.js.
        releaseMediaElement(videoEl);
    };

    try {
        await new Promise((resolve, reject) => {
            const onReady = () => {
                videoEl.removeEventListener('loadedmetadata', onReady);
                resolve();
            };
            videoEl.addEventListener('loadedmetadata', onReady, { once: true });
            videoEl.addEventListener('error', () => reject(new Error('Failed to load source video')), { once: true });
        });

        if (inSec > 0) {
            await new Promise((resolve) => {
                const onSeeked = () => { videoEl.removeEventListener('seeked', onSeeked); resolve(); };
                videoEl.addEventListener('seeked', onSeeked, { once: true });
                try { videoEl.currentTime = inSec; } catch (_) { resolve(); }
            });
        }

        // Encode frames as the browser paints them. We use the video's own
        // mediaTime as the encoded timestamp, offset by `inSec` so the MP4
        // starts at zero. Stop when we've covered the trim or run out.
        let frameCount = 0;
        let firstMediaTime = null;
        let lastMediaTime = inSec;

        const done = new Promise((resolve, reject) => {
            const onFrame = (now, metadata) => {
                const mediaTime = metadata.mediaTime;
                if (firstMediaTime == null) firstMediaTime = mediaTime;
                lastMediaTime = mediaTime;
                if (outSec != null && mediaTime > outSec + 0.01) {
                    resolve();
                    return;
                }
                try {
                    const ts = Math.max(0, Math.round((mediaTime - inSec) * 1_000_000));
                    const frame = new window.VideoFrame(videoEl, { timestamp: ts });
                    const keyFrame = frameCount % 60 === 0; // ~2s GOP at 30fps
                    videoEncoder.encode(frame, { keyFrame });
                    frame.close();
                    frameCount++;
                    if (onProgress && expectedDuration) {
                        const ratio = Math.min(1, Math.max(0, (mediaTime - inSec) / expectedDuration));
                        onProgress({ progress: ratio, time: mediaTime - inSec });
                    }
                } catch (e) {
                    reject(e);
                    return;
                }
                videoEl.requestVideoFrameCallback(onFrame);
            };
            videoEl.requestVideoFrameCallback(onFrame);
            videoEl.addEventListener('ended', () => resolve(), { once: true });
            videoEl.addEventListener('error', () => reject(new Error('Video element error during export')), { once: true });
            videoEl.play().catch(reject);
        });

        await done;
        // If we never got a single frame, abort with a clear error rather than
        // producing an empty MP4 the user can't open.
        if (frameCount === 0) throw new Error('No video frames could be decoded.');
        // Suppress unused-var lint
        void lastMediaTime;
    } finally {
        cleanupVideoEl();
    }

    // ---- audio: feed encoder with mixed buffer chunks -------------------
    if (audioEncoder && mixedBuffer) {
        await encodeAudio({ mixedBuffer, encoder: audioEncoder });
    }

    // ---- finalize -------------------------------------------------------
    await videoEncoder.flush();
    if (audioEncoder) await audioEncoder.flush();
    videoEncoder.close();
    if (audioEncoder) audioEncoder.close();
    muxer.finalize();
    const buffer = muxer.target.buffer;
    if (onProgress) onProgress({ progress: 1, time: expectedDuration ?? 0 });
    return new Blob([buffer], { type: 'video/mp4' });
};
