import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTools } from '../../context/ToolsContext';
import { getTake, deleteTake as deleteTakeFromDb, saveTake } from './utils/takesStorage';
import { exportComposed, isLoaded as ffmpegLoaded, preload as preloadFfmpeg } from './utils/ffmpegLoader';
import { exportToMp4WebCodecs, isWebCodecsAvailable } from './utils/webcodecsExporter';
import { isMp4Mime } from './utils/recorderEngine';
import { createPlaybackEngine } from './utils/playbackEngine';
import { recordingResolutions } from '../../context/useRecorderLogic';

const formatTime = (s) => {
    if (!isFinite(s) || s < 0) s = 0;
    const total = Math.floor(s);
    const m = Math.floor(total / 60);
    const sec = total % 60;
    const ms = Math.floor((s - total) * 100);
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
};

const todayStamp = () => {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const ReviewPanel = ({ onClose }) => {
    const { recorder } = useTools();
    const { currentTakeId, takes, refreshTakes, setCurrentTakeId, startNewTake, viewSavedTakes, filenamePrefix } = recorder;
    // viewSavedTakes is used elsewhere as "go to review"; here we want the
    // inverse — a way to navigate back to setup without closing the studio.
    // It's just a phase flip; reuse `startNewTake` since it does exactly that.
    void viewSavedTakes;
    const backToSetup = startNewTake;

    const [take, setTake] = useState(null);
    // URLs are stored together so a take change triggers exactly ONE re-render.
    // If we used three separate setStates, React 18 wouldn't batch them after
    // the `await` in the loader, the playback-engine effect would fire three
    // times, and after the first run `createMediaElementSource` is permanently
    // bound to the audio element — subsequent runs throw `InvalidStateError`
    // and the audio element ends up orphaned to a closed AudioContext.
    const [urls, setUrls] = useState({ video: null, mic: null, tab: null });
    const videoUrl = urls.video;
    const micUrl = urls.mic;
    const tabUrl = urls.tab;

    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [playing, setPlaying] = useState(false);
    const [inSec, setInSec] = useState(0);
    const [outSec, setOutSec] = useState(0);
    const [micGain, setMicGain] = useState(1);
    const [tabGain, setTabGain] = useState(1);
    const [exportBusy, setExportBusy] = useState(false);
    const [exportLabel, setExportLabel] = useState('');
    const [exportProgress, setExportProgress] = useState(0);
    const [exportError, setExportError] = useState(null);

    const videoRef = useRef(null);
    const micRef = useRef(null);
    const tabRef = useRef(null);
    const engineRef = useRef(null);
    const blobUrlsRef = useRef([]);

    // Effect 1: when the selected take changes, load it and set blob URLs.
    // The URL state changes drive the JSX to render the <video>/<audio>
    // elements with their srcs.
    useEffect(() => {
        let cancelled = false;
        // Revoke any old blob URLs from the previous take
        blobUrlsRef.current.forEach((u) => { try { URL.revokeObjectURL(u); } catch (_) {} });
        blobUrlsRef.current = [];
        setUrls({ video: null, mic: null, tab: null });
        setTake(null);
        setDuration(0);
        setCurrentTime(0);
        setPlaying(false);
        setInSec(0);
        setOutSec(0);
        setExportError(null);

        if (!currentTakeId) return undefined;
        (async () => {
            const t = await getTake(currentTakeId).catch(() => null);
            if (cancelled || !t) return;
            const mkUrl = (b) => {
                if (!b) return null;
                const u = URL.createObjectURL(b);
                blobUrlsRef.current.push(u);
                return u;
            };
            const isV2 = t.version === 2;
            // Single batched state update so the playback-engine effect
            // fires once with all three URLs simultaneously available.
            setUrls({
                video: mkUrl(isV2 ? t.videoBlob : t.blob),
                mic: mkUrl(isV2 ? t.micBlob : null),
                tab: mkUrl(isV2 ? t.tabBlob : null),
            });
            setTake(t);
            setMicGain(1);
            setTabGain(1);
            const dur = (t.durationMs || 0) / 1000;
            if (dur > 0) {
                setDuration(dur);
                setOutSec(dur);
            }
        })();
        return () => { cancelled = true; };
    }, [currentTakeId]);

    // Effect 2: once URLs are set, React has rendered the media elements and
    // their refs are populated — wire up the playback engine. Tear it down
    // when the URLs change again or on unmount.
    useEffect(() => {
        if (!videoUrl && !micUrl && !tabUrl) return undefined;
        const engine = createPlaybackEngine({
            videoEl: videoRef.current,
            micEl: micRef.current,
            tabEl: tabRef.current,
            onTimeUpdate: (cur) => setCurrentTime(cur),
            // Duration is sourced from take.durationMs (set above). We don't
            // trust the engine's duration probing because canvas-captured
            // WebMs report Infinity here.
            onDurationChange: () => {},
            onPlay: () => setPlaying(true),
            onPause: () => setPlaying(false),
            onEnded: () => setPlaying(false),
        });
        engineRef.current = engine;
        return () => {
            try { engine.destroy(); } catch (_) {}
            engineRef.current = null;
        };
    }, [videoUrl, micUrl, tabUrl]);

    useEffect(() => { engineRef.current?.setMicGain(micGain); }, [micGain]);
    useEffect(() => { engineRef.current?.setTabGain(tabGain); }, [tabGain]);

    const seek = (s) => engineRef.current?.seek(s);

    const togglePlay = () => {
        const e = engineRef.current;
        if (!e) return;
        if (e.isPlaying()) e.pause();
        else {
            if (currentTime >= outSec - 0.05 || currentTime < inSec) e.seek(inSec);
            e.play();
        }
    };

    useEffect(() => {
        const e = engineRef.current;
        if (!e || !playing) return undefined;
        const id = setInterval(() => {
            if (e.getCurrentTime() >= outSec) e.pause();
        }, 100);
        return () => clearInterval(id);
    }, [playing, outSec]);

    const filenameBase = useMemo(() => {
        // If the take has a custom name, use that — the rename feature lets the
        // student tag a take with the exercise name and download it directly.
        if (take?.name) {
            const safe = take.name.replace(/[^a-zA-Z0-9_ -]/g, '_').replace(/\s+/g, '_');
            if (safe.length > 0) return safe;
        }
        const prefix = (take?.filenamePrefix || filenamePrefix || 'practice').replace(/[^a-zA-Z0-9_-]/g, '_');
        return `${prefix}_${todayStamp()}`;
    }, [take, filenamePrefix]);

    const downloadBlob = (blob, name) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    };

    const exportAs = async (format) => {
        if (!take) return;
        setExportBusy(true);
        setExportError(null);
        setExportProgress(0);
        try {
            const isV2 = take.version === 2;
            if (!isV2) {
                if (format === 'mp4' && !isMp4Mime(take.mime)) {
                    setExportLabel(ffmpegLoaded() ? 'Encoding MP4…' : 'Loading encoder (~25 MB, first time only)…');
                    if (!ffmpegLoaded()) {
                        await preloadFfmpeg(({ progress }) => setExportProgress(progress));
                    }
                    setExportLabel('Encoding MP4…');
                    const blob = await exportComposed({
                        v1Blob: take.blob,
                        startSec: inSec,
                        endSec: outSec,
                        outputFormat: 'mp4',
                        onProgress: ({ progress }) => setExportProgress(progress),
                    });
                    downloadBlob(blob, `${filenameBase}.mp4`);
                } else {
                    downloadBlob(take.blob, `${filenameBase}.${isMp4Mime(take.mime) ? 'mp4' : 'webm'}`);
                }
                return;
            }

            // Try WebCodecs first — hardware-accelerated, no big download,
            // typically real-time-or-faster. Fall back to ffmpeg.wasm for
            // browsers without WebCodecs or codec support.
            let blob = null;
            // Match export bitrate to the recording resolution so a 1080p or
            // 1440p capture isn't softened by a 5 Mbps re-encode.
            const sourceBps = recordingResolutions[take.resolution]?.videoBps || null;
            if (format === 'mp4' && isWebCodecsAvailable()) {
                try {
                    setExportLabel('Encoding MP4…');
                    blob = await exportToMp4WebCodecs({
                        videoBlob: take.videoBlob,
                        micBlob: take.micBlob,
                        tabBlob: take.tabBlob,
                        micGain,
                        tabGain,
                        startSec: inSec,
                        endSec: outSec,
                        videoBitrate: sourceBps,
                        onProgress: ({ progress }) => setExportProgress(progress),
                    });
                } catch (e) {
                    console.warn('WebCodecs export failed, falling back to ffmpeg.wasm:', e);
                    blob = null;
                }
            }
            if (!blob) {
                setExportLabel(ffmpegLoaded() ? 'Encoding…' : 'Loading encoder (~25 MB, first time only)…');
                if (!ffmpegLoaded()) {
                    await preloadFfmpeg(({ progress }) => setExportProgress(progress));
                }
                setExportLabel(format === 'mp4' ? 'Rendering MP4…' : 'Rendering WebM…');
                blob = await exportComposed({
                    videoBlob: take.videoBlob,
                    micBlob: take.micBlob,
                    tabBlob: take.tabBlob,
                    videoMime: take.videoMime,
                    audioMime: take.audioMime,
                    outputFormat: format,
                    micGain,
                    tabGain,
                    startSec: inSec,
                    endSec: outSec,
                    onProgress: ({ progress }) => setExportProgress(progress),
                });
            }
            downloadBlob(blob, `${filenameBase}.${format === 'mp4' ? 'mp4' : 'webm'}`);
        } catch (e) {
            console.error(e);
            setExportError(e.message || String(e));
        } finally {
            setExportBusy(false);
            setExportLabel('');
            setExportProgress(0);
        }
    };

    const onDeleteTake = async (id) => {
        if (!window.confirm('Delete this take? This cannot be undone.')) return;
        await deleteTakeFromDb(id);
        await refreshTakes();
        if (currentTakeId === id) setCurrentTakeId(null);
    };

    // Inline rename: track which take row is being edited and its draft value.
    const [editingTakeId, setEditingTakeId] = useState(null);
    const [editingValue, setEditingValue] = useState('');
    const editInputRef = useRef(null);

    const startEditingName = (t) => {
        setEditingTakeId(t.id);
        setEditingValue(t.name || '');
    };
    const cancelEditingName = () => {
        setEditingTakeId(null);
        setEditingValue('');
    };
    const commitEditingName = async () => {
        const id = editingTakeId;
        if (!id) return;
        const next = editingValue.trim();
        cancelEditingName();
        const t = await getTake(id).catch(() => null);
        if (!t) return;
        // No-op if unchanged
        if ((t.name || '') === next) return;
        await saveTake({ ...t, name: next || undefined });
        await refreshTakes();
    };

    useEffect(() => {
        if (editingTakeId && editInputRef.current) {
            editInputRef.current.focus();
            editInputRef.current.select();
        }
    }, [editingTakeId]);

    const markersSec = useMemo(() => (take?.markers || []).map((ms) => ms / 1000), [take]);
    const isV2 = take?.version === 2;
    const hasMicTrack = isV2 ? !!take?.micBlob : false;
    const hasTabTrack = isV2 ? !!take?.tabBlob : false;

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-teal-300">Review &amp; Export</h2>
                <div className="flex items-center gap-3">
                    <button
                        onClick={backToSetup}
                        className="text-sm px-3 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-white"
                        title="Back to the setup screen to record a new take."
                    >
                        ← Back to setup
                    </button>
                    <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl font-bold leading-none">&times;</button>
                </div>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                    {take ? (
                        <>
                            <div className="bg-black w-full aspect-video flex items-center justify-center overflow-hidden rounded-lg">
                                {videoUrl ? (
                                    <video
                                        key={`v-${currentTakeId}`}
                                        ref={videoRef}
                                        src={videoUrl}
                                        muted
                                        playsInline
                                        autoPlay={false}
                                        preload="metadata"
                                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                    />
                                ) : (
                                    <span className="text-gray-500 text-sm">No video in this take</span>
                                )}
                            </div>
                            {/* Audio elements live offscreen. They need to be in the DOM
                                for some browsers to play them; Web Audio handles the
                                actual output via gain nodes. */}
                            <div style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
                                {micUrl && <audio key={`m-${currentTakeId}`} ref={micRef} src={micUrl} preload="auto" />}
                                {tabUrl && <audio key={`t-${currentTakeId}`} ref={tabRef} src={tabUrl} preload="auto" />}
                            </div>

                            <div className="flex items-center gap-2 mt-2">
                                <button onClick={togglePlay} className="px-3 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-white text-sm w-12">
                                    {playing ? '❚❚' : '►'}
                                </button>
                                <span className="font-mono text-xs text-gray-300 w-32">
                                    {formatTime(currentTime)} / {formatTime(duration)}
                                </span>
                                <input
                                    type="range"
                                    min={0}
                                    max={duration || 0}
                                    step={0.05}
                                    value={currentTime}
                                    onChange={(e) => seek(parseFloat(e.target.value))}
                                    className="flex-1"
                                />
                            </div>

                            <div className="mt-3 bg-slate-800 border border-slate-700 rounded p-3">
                                <div className="text-sm text-gray-300 mb-2">
                                    Trim — set the start (in) and end (out) of the clip you want to export.
                                </div>
                                <div className="relative h-6 bg-slate-700 rounded">
                                    <div
                                        className="absolute h-full bg-teal-700/40"
                                        style={{
                                            left: `${duration > 0 ? (inSec / duration) * 100 : 0}%`,
                                            width: `${duration > 0 ? Math.max(0, ((outSec - inSec) / duration) * 100) : 0}%`,
                                        }}
                                    />
                                    <div
                                        className="absolute top-0 bottom-0 w-0.5 bg-white"
                                        style={{ left: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                                    />
                                    {markersSec.map((m, i) => (
                                        <div
                                            key={i}
                                            title={`Marker @ ${formatTime(m)} (click to seek)`}
                                            onClick={() => seek(m)}
                                            className="absolute top-0 bottom-0 w-1 bg-amber-400 cursor-pointer"
                                            style={{ left: `${duration > 0 ? (m / duration) * 100 : 0}%` }}
                                        />
                                    ))}
                                </div>
                                <div className="grid grid-cols-2 gap-3 mt-3 text-sm">
                                    <label className="flex items-center gap-2">
                                        <span className="text-gray-300 w-10">In</span>
                                        <input
                                            type="range"
                                            min={0}
                                            max={duration}
                                            step={0.05}
                                            value={inSec}
                                            onChange={(e) => {
                                                const v = parseFloat(e.target.value);
                                                setInSec(Math.min(v, outSec - 0.1));
                                                seek(v);
                                            }}
                                            className="flex-1"
                                        />
                                        <span className="font-mono text-gray-200 w-20 text-right">{formatTime(inSec)}</span>
                                    </label>
                                    <label className="flex items-center gap-2">
                                        <span className="text-gray-300 w-10">Out</span>
                                        <input
                                            type="range"
                                            min={0}
                                            max={duration}
                                            step={0.05}
                                            value={outSec}
                                            onChange={(e) => {
                                                const v = parseFloat(e.target.value);
                                                setOutSec(Math.max(v, inSec + 0.1));
                                                seek(v);
                                            }}
                                            className="flex-1"
                                        />
                                        <span className="font-mono text-gray-200 w-20 text-right">{formatTime(outSec)}</span>
                                    </label>
                                </div>
                                <div className="flex flex-wrap gap-2 mt-3">
                                    <button onClick={() => setInSec(currentTime)} className="px-3 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-white text-sm">Set In here</button>
                                    <button onClick={() => setOutSec(currentTime)} className="px-3 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-white text-sm">Set Out here</button>
                                    <button onClick={() => { setInSec(0); setOutSec(duration); }} className="px-3 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-white text-sm">Reset trim</button>
                                </div>
                            </div>

                            {(hasMicTrack || hasTabTrack) && (
                                <div className="mt-3 bg-slate-800 border border-slate-700 rounded p-3">
                                    <div className="text-sm font-semibold text-gray-200 mb-2">Audio balance</div>
                                    {hasMicTrack && (
                                        <label className="flex items-center gap-2 text-xs mb-2">
                                            <span className="text-gray-300 w-28">Mic</span>
                                            <input
                                                type="range"
                                                min={0}
                                                max={2}
                                                step={0.05}
                                                value={micGain}
                                                onChange={(e) => setMicGain(parseFloat(e.target.value))}
                                                className="flex-1"
                                            />
                                            <span className="font-mono text-gray-200 w-12 text-right">{Math.round(micGain * 100)}%</span>
                                        </label>
                                    )}
                                    {hasTabTrack && (
                                        <label className="flex items-center gap-2 text-xs">
                                            <span className="text-gray-300 w-28">App audio</span>
                                            <input
                                                type="range"
                                                min={0}
                                                max={2}
                                                step={0.05}
                                                value={tabGain}
                                                onChange={(e) => setTabGain(parseFloat(e.target.value))}
                                                className="flex-1"
                                            />
                                            <span className="font-mono text-gray-200 w-12 text-right">{Math.round(tabGain * 100)}%</span>
                                        </label>
                                    )}
                                    <button onClick={() => { setMicGain(1); setTabGain(1); }} className="mt-2 text-xs text-teal-300 hover:text-teal-200">Reset to 100%</button>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="bg-slate-800 border border-slate-700 rounded p-6 text-center text-gray-400">
                            Pick a take from the list to review it, or record a new one.
                        </div>
                    )}
                </div>

                <div className="flex flex-col gap-3">
                    <div className="bg-slate-800 border border-slate-700 rounded p-3">
                        <div className="text-sm font-semibold text-gray-200 mb-2">Export</div>
                        <button
                            onClick={() => exportAs('mp4')}
                            disabled={!take || exportBusy}
                            className="w-full px-4 py-2 rounded bg-teal-600 hover:bg-teal-500 disabled:bg-slate-700 disabled:text-gray-500 text-white font-bold mb-2"
                        >
                            Download MP4
                        </button>
                        {!isV2 && take && (
                            <button
                                onClick={() => exportAs('original')}
                                disabled={!take || exportBusy}
                                className="w-full px-4 py-2 rounded bg-slate-700 hover:bg-slate-600 disabled:text-gray-500 text-white text-sm"
                            >
                                Download {isMp4Mime(take?.mime) ? 'MP4 (no re-encode)' : 'WebM (no re-encode)'}
                            </button>
                        )}
                        {exportBusy && (
                            <div className="mt-3 text-xs text-gray-300">
                                {exportLabel}
                                <div className="h-1.5 bg-slate-700 rounded mt-1 overflow-hidden">
                                    <div className="h-full bg-teal-400" style={{ width: `${Math.round((exportProgress || 0) * 100)}%` }} />
                                </div>
                            </div>
                        )}
                        {exportError && <div className="mt-2 text-xs text-red-300">{exportError}</div>}
                    </div>

                    <div className="bg-slate-800 border border-slate-700 rounded p-3">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-semibold text-gray-200">Saved takes</span>
                            <button onClick={startNewTake} className="text-xs px-2 py-1 rounded bg-red-600 hover:bg-red-500 text-white">+ New take</button>
                        </div>
                        <ul className="flex flex-col gap-2 max-h-72 overflow-auto">
                            {takes.length === 0 && <li className="text-xs text-gray-400">No takes yet.</li>}
                            {takes.map((t) => {
                                const date = new Date(t.createdAt);
                                const totalSize = t.version === 2
                                    ? ['videoBlob', 'micBlob', 'tabBlob'].reduce((s, k) => s + (t[k]?.size || 0), 0)
                                    : (t.blob?.size || 0);
                                const sizeMB = totalSize / (1024 * 1024);
                                const displayName = t.name || date.toLocaleString();
                                const isEditing = editingTakeId === t.id;
                                return (
                                    <li
                                        key={t.id}
                                        className={`p-2 rounded border ${currentTakeId === t.id ? 'bg-slate-700 border-teal-500' : 'bg-slate-900 border-slate-700'}`}
                                    >
                                        {isEditing ? (
                                            <input
                                                ref={editInputRef}
                                                type="text"
                                                value={editingValue}
                                                onChange={(e) => setEditingValue(e.target.value)}
                                                onBlur={commitEditingName}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') { e.preventDefault(); commitEditingName(); }
                                                    else if (e.key === 'Escape') { e.preventDefault(); cancelEditingName(); }
                                                }}
                                                placeholder={date.toLocaleString()}
                                                className="w-full bg-slate-900 border border-teal-500 rounded px-1 py-0.5 text-sm text-white font-mono"
                                            />
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => setCurrentTakeId(t.id)}
                                                className="w-full text-left"
                                            >
                                                <div
                                                    className="text-sm text-white font-mono truncate hover:bg-slate-800 rounded px-1 -mx-1 cursor-text"
                                                    title="Click the name on the right to rename"
                                                    onClick={(e) => {
                                                        // If user clicks the name a second time while the take is
                                                        // already selected, enter rename mode.
                                                        if (currentTakeId === t.id) {
                                                            e.stopPropagation();
                                                            startEditingName(t);
                                                        }
                                                    }}
                                                >
                                                    {displayName}
                                                </div>
                                                <div className="text-[11px] text-gray-400">
                                                    {t.name ? `${date.toLocaleString()} · ` : ''}
                                                    {Math.round((t.durationMs || 0) / 1000)}s · {sizeMB.toFixed(1)} MB
                                                </div>
                                            </button>
                                        )}
                                        <div className="flex gap-3 mt-1 text-[11px]">
                                            <button onClick={() => startEditingName(t)} className="text-teal-300 hover:text-teal-200">Rename</button>
                                            <button onClick={() => onDeleteTake(t.id)} className="text-red-300 hover:text-red-200">Delete</button>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ReviewPanel;
