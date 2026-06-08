// Recording-studio orchestration hook. Owns acquired media streams,
// compositor, audio mixer, multi-recorder, and the studio state machine.
// Phase: 'idle' | 'setup' | 'recording' | 'paused' | 'review'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createCompositor } from '../components/recordingStudio/utils/streamCompositor';
import { createAudioMixer } from '../components/recordingStudio/utils/audioMixer';
import { createMultiRecorder } from '../components/recordingStudio/utils/recorderEngine';
import { detectCapabilities } from '../components/recordingStudio/utils/featureSupport';
import { listTakes, saveTake, deleteTake as deleteTakeFromDb, getTake } from '../components/recordingStudio/utils/takesStorage';

// Each preset includes the canvas dimensions, the bitrate to encode at, and
// the corresponding video-track constraint to ask the webcam for. Bitrates
// chosen so 1080p / 1440p look noticeably better than the previous 4 Mbps
// default — practice videos compress well, but action against busy screen
// captures benefits from headroom.
const RESOLUTION_PRESETS = {
    '720p':  { width: 1280, height: 720,  videoBps: 4_000_000 },
    '1080p': { width: 1920, height: 1080, videoBps: 8_000_000 },
    '1440p': { width: 2560, height: 1440, videoBps: 14_000_000 },
};

const stopStream = (stream) => {
    if (!stream) return;
    try { stream.getTracks().forEach((t) => t.stop()); } catch (_) {}
};

export const useRecorderLogic = () => {
    const [phase, setPhase] = useState('idle');
    const [studioOpen, setStudioOpen] = useState(false);
    const [error, setError] = useState(null);

    // Sources & settings. Screen capture is OFF by default — most practice
    // videos don't need it, and triggering the browser's screen-share dialog
    // unprompted is intimidating to non-technical students. They flip it on
    // when their challenge requires proof of work.
    const [includeWebcam, setIncludeWebcam] = useState(true);
    const [includeScreen, setIncludeScreen] = useState(false);
    const [includeAudio, setIncludeAudio] = useState(true);
    const [resolution, setResolution] = useState('720p');
    const [pip, setPip] = useState({ anchor: 'tl', xPct: 0.05, yPct: 0.05, widthPct: 0.32 });
    // Single mirror toggle. When on, the canvas itself mirrors the webcam,
    // so what the user sees in preview is exactly what gets recorded.
    const [mirrorWebcam, setMirrorWebcam] = useState(true);
    const [autoStopMin, setAutoStopMin] = useState(0); // 0 = off
    const [includeTabAudio, setIncludeTabAudio] = useState(true);
    const [filenamePrefix, setFilenamePrefix] = useState('practice');
    // When on, after acquiring the screen-capture stream we crop it to the
    // app's `<main>` content area using the Region/Element Capture API.
    // Two wins: the active tool fills the recording (so e.g. Note Generator
    // output is big and legible in the final PiP), and the floating live
    // preview gets cropped out so it doesn't end up recursively in the
    // recording. Falls back to whole-tab capture when the API is missing.
    const [cropScreenCapture, setCropScreenCapture] = useState(true);
    const [micGain, setMicGain] = useState(1);
    const [systemGain, setSystemGain] = useState(1);
    // When true (default for music): disable browser-level echo cancellation,
    // noise suppression and AGC, all of which mangle sustained guitar notes.
    const [rawMicMode, setRawMicMode] = useState(true);
    const [limiterEnabled, setLimiterEnabled] = useState(true);

    // Device picks
    const [videoDevices, setVideoDevices] = useState([]);
    const [audioDevices, setAudioDevices] = useState([]);
    const [videoDeviceId, setVideoDeviceId] = useState('');
    const [audioDeviceId, setAudioDeviceId] = useState('');

    // Live state
    const [elapsedMs, setElapsedMs] = useState(0);
    const [recordedSize, setRecordedSize] = useState(0);
    const [markers, setMarkers] = useState([]); // ms offsets
    const [micLevel, setMicLevel] = useState({ level: 0, peak: 0 });
    const [hasScreenStream, setHasScreenStream] = useState(false);
    const [hasWebcamStream, setHasWebcamStream] = useState(false);
    const [mixerReady, setMixerReady] = useState(false);

    // Takes list
    const [takes, setTakes] = useState([]);
    const [currentTakeId, setCurrentTakeId] = useState(null);

    // Refs to keep instances out of React state
    const webcamStreamRef = useRef(null);
    const micStreamRef = useRef(null);
    const screenStreamRef = useRef(null);
    // Records which deviceId was actually used to acquire the current stream,
    // so we know when the user picked a different device and we must re-acquire.
    const acquiredVideoDeviceIdRef = useRef(null);
    const acquiredAudioDeviceIdRef = useRef(null);
    const compositorRef = useRef(null);
    const audioMixerRef = useRef(null);
    const recorderRef = useRef(null);
    const elapsedTickerRef = useRef(null);
    const micMeterRafRef = useRef(null);
    const autoStopTimeoutRef = useRef(null);
    const stopRequestedRef = useRef(false);

    const capabilities = useMemo(() => detectCapabilities(), []);

    // ---- takes ----
    const refreshTakes = useCallback(async () => {
        try {
            const list = await listTakes();
            setTakes(list);
        } catch (e) {
            console.warn('Failed to load takes', e);
        }
    }, []);

    useEffect(() => {
        refreshTakes();
    }, [refreshTakes]);

    const deleteTake = useCallback(async (id) => {
        await deleteTakeFromDb(id);
        await refreshTakes();
        if (currentTakeId === id) setCurrentTakeId(null);
    }, [refreshTakes, currentTakeId]);

    const loadTakeForReview = useCallback(async (id) => {
        const take = await getTake(id);
        if (!take) return;
        setCurrentTakeId(id);
        setPhase('review');
    }, []);

    // ---- device enumeration ----
    const refreshDevices = useCallback(async () => {
        if (!capabilities.userMedia) return;
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            setVideoDevices(devices.filter((d) => d.kind === 'videoinput'));
            setAudioDevices(devices.filter((d) => d.kind === 'audioinput'));
        } catch (e) {
            console.warn('enumerateDevices failed', e);
        }
    }, [capabilities.userMedia]);

    // ---- preview setup ----
    // Acquire (or re-acquire) the webcam + mic streams. We track which deviceId
    // was actually used so we can detect when the user picked a different
    // device and must re-acquire. When a previously-selected deviceId is no
    // longer available (e.g. iPhone disconnected), we fall back to the system
    // default so the studio doesn't dead-end on OverconstrainedError.
    const ensureWebcamStream = useCallback(async () => {
        if (!capabilities.userMedia) throw new Error('Camera/mic API not available in this browser.');

        const wantVideo = includeWebcam;
        const wantAudio = includeAudio;
        const videoIdChanged = (acquiredVideoDeviceIdRef.current ?? '') !== (videoDeviceId ?? '');
        const audioIdChanged = (acquiredAudioDeviceIdRef.current ?? '') !== (audioDeviceId ?? '');

        const haveVideo = !!webcamStreamRef.current && webcamStreamRef.current.getVideoTracks().some((t) => t.readyState === 'live');
        const haveAudio = !!micStreamRef.current && micStreamRef.current.getAudioTracks().some((t) => t.readyState === 'live');

        const needVideo = wantVideo && (!haveVideo || videoIdChanged);
        const needAudio = wantAudio && (!haveAudio || audioIdChanged);

        if (!needVideo && !needAudio) {
            // Tear down anything that's no longer wanted
            if (!wantVideo && webcamStreamRef.current) {
                stopStream(webcamStreamRef.current);
                webcamStreamRef.current = null;
                acquiredVideoDeviceIdRef.current = null;
                setHasWebcamStream(false);
                compositorRef.current?.setWebcamStream(null);
            }
            if (!wantAudio && micStreamRef.current) {
                stopStream(micStreamRef.current);
                micStreamRef.current = null;
                acquiredAudioDeviceIdRef.current = null;
                audioMixerRef.current?.setMicStream(null);
            }
            return;
        }

        const buildAudioConstraint = (useDeviceIds) => {
            if (!needAudio) return false;
            const base = rawMicMode
                ? { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
                : {};
            if (useDeviceIds && audioDeviceId) {
                return { ...base, deviceId: { exact: audioDeviceId } };
            }
            // When no specific deviceId AND no processing flags, plain `true` is
            // the most compatible value. Otherwise pass the constraints object.
            return rawMicMode ? base : true;
        };

        // Ask the webcam for a resolution matching (or exceeding) the chosen
        // canvas size. `ideal` lets the browser pick the closest available;
        // older webcams just give us their max and we upscale to fit.
        const target = RESOLUTION_PRESETS[resolution] || RESOLUTION_PRESETS['1080p'];
        const buildVideoConstraint = (useDeviceIds) => {
            if (!needVideo) return false;
            const base = {
                width: { ideal: target.width },
                height: { ideal: target.height },
                frameRate: { ideal: 30 },
            };
            if (useDeviceIds && videoDeviceId) base.deviceId = { exact: videoDeviceId };
            return base;
        };

        const buildConstraints = (useDeviceIds) => ({
            video: buildVideoConstraint(useDeviceIds),
            audio: buildAudioConstraint(useDeviceIds),
        });

        let stream;
        try {
            stream = await navigator.mediaDevices.getUserMedia(buildConstraints(true));
        } catch (e) {
            // OverconstrainedError / NotFoundError — likely the saved deviceId
            // points at a device that's no longer connected. Retry with the
            // system default and reset the dropdown back to "Default".
            if (e && (e.name === 'OverconstrainedError' || e.name === 'NotFoundError' || e.name === 'NotReadableError')) {
                if (videoDeviceId) setVideoDeviceId('');
                if (audioDeviceId) setAudioDeviceId('');
                stream = await navigator.mediaDevices.getUserMedia(buildConstraints(false));
            } else {
                throw e;
            }
        }

        const videoTracks = stream.getVideoTracks();
        const audioTracks = stream.getAudioTracks();

        if (needVideo && videoTracks.length > 0) {
            stopStream(webcamStreamRef.current);
            webcamStreamRef.current = new MediaStream(videoTracks);
            const settings = videoTracks[0].getSettings ? videoTracks[0].getSettings() : {};
            acquiredVideoDeviceIdRef.current = settings.deviceId || videoDeviceId || '';
            setHasWebcamStream(true);
            // Re-acquire on track-end (sleep/wake or device disconnect)
            videoTracks[0].addEventListener('ended', () => {
                webcamStreamRef.current = null;
                acquiredVideoDeviceIdRef.current = null;
                setHasWebcamStream(false);
                compositorRef.current?.setWebcamStream(null);
            });
        }
        if (needAudio && audioTracks.length > 0) {
            stopStream(micStreamRef.current);
            micStreamRef.current = new MediaStream(audioTracks);
            const settings = audioTracks[0].getSettings ? audioTracks[0].getSettings() : {};
            acquiredAudioDeviceIdRef.current = settings.deviceId || audioDeviceId || '';
            audioTracks[0].addEventListener('ended', () => {
                micStreamRef.current = null;
                acquiredAudioDeviceIdRef.current = null;
                audioMixerRef.current?.setMicStream(null);
            });
        }
        await refreshDevices();
    }, [capabilities.userMedia, includeWebcam, includeAudio, videoDeviceId, audioDeviceId, rawMicMode, resolution, refreshDevices, setVideoDeviceId, setAudioDeviceId]);

    const pickScreenSource = useCallback(async () => {
        if (!capabilities.displayMedia) throw new Error('Screen capture is not supported in this browser. Use Chrome or Edge on a desktop.');
        const stream = await navigator.mediaDevices.getDisplayMedia({
            video: { frameRate: 30 },
            audio: includeTabAudio,
        });

        // Try to crop the stream to just the app's main content area. Only
        // works for "This Tab" captures on browsers that support Region
        // Capture (Chrome / Edge 104+) or Element Capture (Chrome 132+).
        // Silently falls back to whole-tab capture on unsupported browsers
        // or when the user picked Entire Screen / Window.
        if (cropScreenCapture) {
            const target = document.getElementById('app-main-content');
            const track = stream.getVideoTracks()[0];
            if (target && track) {
                try {
                    if (window.RestrictionTarget && window.RestrictionTarget.fromElement && track.restrictTo) {
                        const rt = await window.RestrictionTarget.fromElement(target);
                        await track.restrictTo(rt);
                    } else if (window.CropTarget && window.CropTarget.fromElement && track.cropTo) {
                        const ct = await window.CropTarget.fromElement(target);
                        await track.cropTo(ct);
                    }
                } catch (e) {
                    // Most often this means the user picked something other
                    // than "This Tab" — that's fine, we just get the whole
                    // capture as the fallback.
                    console.warn('Region/Element Capture failed; recording whole capture instead.', e);
                }
            }
        }
        // Browser may end the stream (user clicked "Stop sharing") — handle it.
        stream.getVideoTracks()[0]?.addEventListener('ended', () => {
            screenStreamRef.current = null;
            setHasScreenStream(false);
            if (compositorRef.current) compositorRef.current.setScreenStream(null);
            if (audioMixerRef.current) audioMixerRef.current.setSystemStream(null);
        });
        stopStream(screenStreamRef.current);
        screenStreamRef.current = stream;
        setHasScreenStream(true);
        if (compositorRef.current) compositorRef.current.setScreenStream(stream);
        if (audioMixerRef.current) audioMixerRef.current.setSystemStream(stream);
        // If user asked for tab audio but the picker didn't include any audio
        // track, they probably forgot to tick "Share tab audio" in the dialog.
        if (includeTabAudio && stream.getAudioTracks().length === 0) {
            setError('No tab audio was shared. To capture the metronome / drone, click "Pick screen / window" again, choose "This Tab", and tick "Share tab audio" in the dialog.');
        } else {
            setError(null);
        }
    }, [capabilities.displayMedia, includeTabAudio, cropScreenCapture]);

    const ensureCompositor = useCallback(() => {
        if (compositorRef.current) return compositorRef.current;
        const { width, height } = RESOLUTION_PRESETS[resolution] || RESOLUTION_PRESETS['720p'];
        compositorRef.current = createCompositor({
            width,
            height,
            includeWebcam,
            includeScreen,
            webcamStream: webcamStreamRef.current,
            screenStream: screenStreamRef.current,
            pip,
            showWebcamMirrored: mirrorWebcam,
        });
        compositorRef.current.start();
        return compositorRef.current;
    }, [resolution, includeWebcam, includeScreen, pip, mirrorWebcam]);

    const ensureAudioMixer = useCallback(() => {
        if (audioMixerRef.current) return audioMixerRef.current;
        audioMixerRef.current = createAudioMixer({
            micStream: micStreamRef.current,
            systemStream: screenStreamRef.current,
            micGain,
            systemGain,
            limiterEnabled,
        });
        setMixerReady(true);
        return audioMixerRef.current;
    }, [micGain, systemGain, limiterEnabled]);

    // Push gain/limiter changes to the mixer live
    useEffect(() => { audioMixerRef.current?.setMicGain(micGain); }, [micGain]);
    useEffect(() => { audioMixerRef.current?.setSystemGain(systemGain); }, [systemGain]);
    useEffect(() => { audioMixerRef.current?.setLimiterEnabled(limiterEnabled); }, [limiterEnabled]);

    // Re-acquire mic when rawMicMode toggles so the new constraints take effect
    useEffect(() => {
        if (!micStreamRef.current) return;
        // Throw away the current mic stream so ensureWebcamStream re-acquires
        // with the updated processing flags on next preview.
        stopStream(micStreamRef.current);
        micStreamRef.current = null;
        acquiredAudioDeviceIdRef.current = null;
        audioMixerRef.current?.setMicStream(null);
        if (studioOpen) {
            ensureWebcamStream()
                .then(() => audioMixerRef.current?.setMicStream(micStreamRef.current))
                .catch((e) => setError(e.message || String(e)));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rawMicMode]);

    // Mic meter loop. Tied to mixerReady so it actually starts after the
    // mixer is created (mixer creation happens inside startPreview, which
    // is async — we can't rely on it being present at first render).
    useEffect(() => {
        if (!mixerReady || !audioMixerRef.current) return undefined;
        let stopped = false;
        const tick = () => {
            if (stopped || !audioMixerRef.current) return;
            setMicLevel(audioMixerRef.current.getMicLevel());
            micMeterRafRef.current = requestAnimationFrame(tick);
        };
        micMeterRafRef.current = requestAnimationFrame(tick);
        return () => {
            stopped = true;
            if (micMeterRafRef.current) cancelAnimationFrame(micMeterRafRef.current);
        };
    }, [mixerReady]);

    // Push setting changes to compositor live
    useEffect(() => { compositorRef.current?.setIncludeWebcam(includeWebcam); }, [includeWebcam]);
    useEffect(() => { compositorRef.current?.setIncludeScreen(includeScreen); }, [includeScreen]);
    useEffect(() => { compositorRef.current?.setPip(pip); }, [pip]);
    useEffect(() => { compositorRef.current?.setMirrored(mirrorWebcam); }, [mirrorWebcam]);

    // ---- studio open/close ----
    const openStudio = useCallback(async () => {
        setError(null);
        setStudioOpen(true);
        if (phase === 'idle') setPhase('setup');
        try {
            await refreshDevices();
        } catch (_) { /* ignore */ }
    }, [phase, refreshDevices]);

    // Release webcam/mic/screen streams + the compositor + the audio mixer.
    // Keeps any persisted takes intact. Used when closing the studio outside
    // of an active recording — without this the camera light stays on after
    // the user clicks Cancel, with no way to release short of closing the tab.
    const releasePreviewStreams = useCallback(() => {
        compositorRef.current?.dispose();
        compositorRef.current = null;
        audioMixerRef.current?.dispose();
        audioMixerRef.current = null;
        setMixerReady(false);
        stopStream(webcamStreamRef.current); webcamStreamRef.current = null;
        stopStream(micStreamRef.current); micStreamRef.current = null;
        stopStream(screenStreamRef.current); screenStreamRef.current = null;
        acquiredVideoDeviceIdRef.current = null;
        acquiredAudioDeviceIdRef.current = null;
        setHasWebcamStream(false);
        setHasScreenStream(false);
        setMicLevel({ level: 0, peak: 0 });
    }, []);

    const closeStudio = useCallback(() => {
        setStudioOpen(false);
        // Don't tear down an active recording — recording continues with the
        // floating control bar. Otherwise release the camera/mic/screen so the
        // device indicator turns off.
        const isRecording = phase === 'recording' || phase === 'paused' || phase === 'countdown';
        if (!isRecording) {
            releasePreviewStreams();
            setPhase('idle');
        }
    }, [phase, releasePreviewStreams]);

    // Force a fresh acquisition: stop existing webcam+mic streams, then call
    // the standard ensure path. Used by the "Reload preview" button.
    const reacquireStreams = useCallback(async () => {
        stopStream(webcamStreamRef.current); webcamStreamRef.current = null;
        stopStream(micStreamRef.current); micStreamRef.current = null;
        acquiredVideoDeviceIdRef.current = null;
        acquiredAudioDeviceIdRef.current = null;
        setHasWebcamStream(false);
        compositorRef.current?.setWebcamStream(null);
        audioMixerRef.current?.setMicStream(null);
        try {
            await ensureWebcamStream();
            compositorRef.current?.setWebcamStream(webcamStreamRef.current);
            audioMixerRef.current?.setMicStream(micStreamRef.current);
        } catch (e) {
            setError(e.message || String(e));
        }
    }, [ensureWebcamStream]);

    // ---- preview ----
    const startPreview = useCallback(async () => {
        setError(null);
        try {
            await ensureWebcamStream();
            ensureCompositor();
            ensureAudioMixer();
            // wire current refs into compositor/mixer in case they were created earlier
            if (compositorRef.current) {
                compositorRef.current.setWebcamStream(webcamStreamRef.current);
                compositorRef.current.setScreenStream(screenStreamRef.current);
            }
            if (audioMixerRef.current) {
                audioMixerRef.current.setMicStream(micStreamRef.current);
                audioMixerRef.current.setSystemStream(screenStreamRef.current);
            }
        } catch (e) {
            setError(e.message || String(e));
        }
    }, [ensureWebcamStream, ensureCompositor, ensureAudioMixer]);

    // ---- recording flow ----
    const tickElapsed = useCallback(() => {
        if (!recorderRef.current) return;
        setElapsedMs(recorderRef.current.elapsedMs());
        setRecordedSize(recorderRef.current.totalSize());
    }, []);

    const stopRecording = useCallback(async () => {
        if (!recorderRef.current) return;
        stopRequestedRef.current = true;
        if (autoStopTimeoutRef.current) {
            clearTimeout(autoStopTimeoutRef.current);
            autoStopTimeoutRef.current = null;
        }
        if (elapsedTickerRef.current) {
            clearInterval(elapsedTickerRef.current);
            elapsedTickerRef.current = null;
        }
        let result;
        try {
            result = await recorderRef.current.stop();
        } catch (e) {
            setError(e.message || String(e));
            setPhase('setup');
            return;
        }

        recorderRef.current = null;

        // We deliberately don't patch the WebM duration metadata. On multi-
        // stream recordings that patching has been observed to corrupt the
        // per-stream timing such that ffmpeg stretches frames (half-speed)
        // and `-ss` lands wrong (trim not applied). Instead, we save the
        // real recording duration on the take and drive the review UI from
        // it; ffmpeg derives content duration from the actual frames.

        const takeId = `take_${Date.now()}`;
        // v2 take: composited video + separate mic/tab audio blobs. PiP layout
        // is baked into the video at record time. Mic-vs-tab balance is left
        // adjustable at export.
        const take = {
            version: 2,
            id: takeId,
            createdAt: Date.now(),
            durationMs: elapsedMs,
            videoMime: result.videoMime,
            audioMime: result.audioMime,
            videoBlob: result.videoBlob || null,
            micBlob: result.micBlob || null,
            tabBlob: result.tabBlob || null,
            filenamePrefix,
            resolution,
            includeWebcam,
            includeScreen,
            includeAudio,
            markers: [...markers],
        };
        try {
            await saveTake(take);
            await refreshTakes();
            setCurrentTakeId(takeId);
        } catch (e) {
            console.warn('Failed to persist take, keeping in memory only', e);
            setCurrentTakeId(takeId);
            setTakes((prev) => [take, ...prev]);
        }

        setPhase('review');
    }, [elapsedMs, filenamePrefix, resolution, includeWebcam, includeScreen, includeAudio, markers, refreshTakes]);

    const startRecording = useCallback(async () => {
        setError(null);
        try {
            await ensureWebcamStream();
            const compositor = ensureCompositor();
            const mixer = ensureAudioMixer();
            compositor.setWebcamStream(webcamStreamRef.current);
            compositor.setScreenStream(screenStreamRef.current);
            mixer.setMicStream(includeAudio ? micStreamRef.current : null);
            mixer.setSystemStream(includeAudio ? screenStreamRef.current : null);

            // Give the source <video> elements time to actually have decoded
            // frames after we (re-)set their srcObjects, then force one final
            // synchronous compositor draw so the first frame on the canvas-
            // captured stream is the just-drawn webcam/screen state rather
            // than a stale or blank canvas.
            await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
            try { compositor.drawFrame(); } catch (_) {}

            const videoForRec = compositor.outputStream;
            const micForRec = (includeAudio && micStreamRef.current) ? mixer.micOutputStream : null;
            const tabForRec = (includeAudio && screenStreamRef.current && screenStreamRef.current.getAudioTracks().length > 0)
                ? mixer.tabOutputStream
                : null;

            if (!videoForRec) {
                throw new Error('Nothing to record. Enable the webcam or pick a screen / window first.');
            }

            const preset = RESOLUTION_PRESETS[resolution] || RESOLUTION_PRESETS['1080p'];
            recorderRef.current = createMultiRecorder({
                videoStream: videoForRec,
                micAudioStream: micForRec,
                tabAudioStream: tabForRec,
                videoBitsPerSecond: preset.videoBps,
                onError: (e) => setError(e.message || String(e)),
            });

            stopRequestedRef.current = false;
            setMarkers([]);
            setElapsedMs(0);
            setRecordedSize(0);
            setPhase('recording');
            elapsedTickerRef.current = setInterval(tickElapsed, 250);
            if (autoStopMin > 0) {
                autoStopTimeoutRef.current = setTimeout(() => {
                    stopRecording();
                }, autoStopMin * 60 * 1000);
            }
        } catch (e) {
            setError(e.message || String(e));
            setPhase('setup');
        }
    }, [ensureWebcamStream, ensureCompositor, ensureAudioMixer, includeAudio, autoStopMin, resolution, tickElapsed, stopRecording]);

    const pauseRecording = useCallback(() => {
        if (!recorderRef.current) return;
        recorderRef.current.pause();
        setPhase('paused');
    }, []);

    const resumeRecording = useCallback(() => {
        if (!recorderRef.current) return;
        recorderRef.current.resume();
        setPhase('recording');
    }, []);

    const dropMarker = useCallback(() => {
        if (!recorderRef.current) return;
        const ms = recorderRef.current.elapsedMs();
        setMarkers((prev) => [...prev, ms]);
    }, []);

    const startNewTake = useCallback(() => {
        setCurrentTakeId(null);
        setPhase('setup');
    }, []);

    // Jump from setup directly to the review screen without recording. The
    // review screen handles `currentTakeId === null` by showing only the
    // takes list, so users can browse old recordings.
    const viewSavedTakes = useCallback(() => {
        setPhase('review');
    }, []);

    const teardown = useCallback(() => {
        if (recorderRef.current) {
            try { recorderRef.current.stop().catch(() => {}); } catch (_) {}
            recorderRef.current = null;
        }
        if (elapsedTickerRef.current) {
            clearInterval(elapsedTickerRef.current);
            elapsedTickerRef.current = null;
        }
        if (autoStopTimeoutRef.current) {
            clearTimeout(autoStopTimeoutRef.current);
            autoStopTimeoutRef.current = null;
        }
        compositorRef.current?.dispose();
        compositorRef.current = null;
        audioMixerRef.current?.dispose();
        audioMixerRef.current = null;
        setMixerReady(false);
        stopStream(webcamStreamRef.current); webcamStreamRef.current = null;
        stopStream(micStreamRef.current); micStreamRef.current = null;
        stopStream(screenStreamRef.current); screenStreamRef.current = null;
        setHasWebcamStream(false);
        setHasScreenStream(false);
        setMicLevel({ level: 0, peak: 0 });
        setElapsedMs(0);
        setRecordedSize(0);
        setMarkers([]);
        setPhase('idle');
    }, []);

    // Tab-close warning while recording
    useEffect(() => {
        const isLive = phase === 'recording' || phase === 'paused';
        if (!isLive) return undefined;
        const handler = (e) => {
            e.preventDefault();
            e.returnValue = '';
            return '';
        };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [phase]);

    // After a sleep/wake cycle the OS often kills MediaStream tracks. When the
    // tab becomes visible again and the studio is in setup, re-acquire so the
    // preview comes back automatically instead of staying black.
    useEffect(() => {
        if (!studioOpen) return undefined;
        const onVisible = () => {
            if (document.visibilityState !== 'visible') return;
            if (phase !== 'setup') return;
            const videoTrack = webcamStreamRef.current?.getVideoTracks()[0];
            const audioTrack = micStreamRef.current?.getAudioTracks()[0];
            const videoDead = includeWebcam && (!videoTrack || videoTrack.readyState === 'ended');
            const audioDead = includeAudio && (!audioTrack || audioTrack.readyState === 'ended');
            if (videoDead || audioDead) {
                if (videoDead) {
                    stopStream(webcamStreamRef.current);
                    webcamStreamRef.current = null;
                    acquiredVideoDeviceIdRef.current = null;
                    setHasWebcamStream(false);
                }
                if (audioDead) {
                    stopStream(micStreamRef.current);
                    micStreamRef.current = null;
                    acquiredAudioDeviceIdRef.current = null;
                }
                ensureWebcamStream().catch((e) => setError(e.message || String(e)));
            }
        };
        document.addEventListener('visibilitychange', onVisible);
        return () => document.removeEventListener('visibilitychange', onVisible);
    }, [studioOpen, phase, includeWebcam, includeAudio, ensureWebcamStream]);

    return {
        // capabilities
        capabilities,

        // state
        phase, studioOpen, error,
        elapsedMs, recordedSize, markers, micLevel,
        hasWebcamStream, hasScreenStream,

        // settings
        includeWebcam, setIncludeWebcam,
        includeScreen, setIncludeScreen,
        includeAudio, setIncludeAudio,
        includeTabAudio, setIncludeTabAudio,
        cropScreenCapture, setCropScreenCapture,
        resolution, setResolution,
        pip, setPip,
        mirrorWebcam, setMirrorWebcam,
        autoStopMin, setAutoStopMin,
        filenamePrefix, setFilenamePrefix,
        micGain, setMicGain,
        systemGain, setSystemGain,
        rawMicMode, setRawMicMode,
        limiterEnabled, setLimiterEnabled,

        // devices
        videoDevices, audioDevices,
        videoDeviceId, setVideoDeviceId,
        audioDeviceId, setAudioDeviceId,
        refreshDevices,

        // takes
        takes, currentTakeId, refreshTakes, deleteTake, loadTakeForReview, setCurrentTakeId,

        // refs (for component preview embedding)
        getCompositor: () => compositorRef.current,

        // actions
        openStudio, closeStudio,
        startPreview, reacquireStreams, pickScreenSource,
        startRecording, stopRecording, pauseRecording, resumeRecording,
        dropMarker, startNewTake, viewSavedTakes, teardown,

        // exposed for review panel
        setError,
    };
};

export const recordingResolutions = RESOLUTION_PRESETS;
