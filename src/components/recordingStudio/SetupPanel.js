import React, { useEffect, useState } from 'react';
import { useTools } from '../../context/ToolsContext';
import CompositorPreview from './CompositorPreview';
import PipDraggableOverlay from './PipDraggableOverlay';

const ANCHOR_BUTTONS = [
    { id: 'tl', label: '↖' },
    { id: 'tr', label: '↗' },
    { id: 'bl', label: '↙' },
    { id: 'br', label: '↘' },
    { id: 'free', label: 'Drag' },
];

const Field = ({ label, children, hint }) => (
    <label className="flex flex-col gap-1 text-sm">
        <span className="text-gray-300 font-semibold">{label}</span>
        {children}
        {hint ? <span className="text-xs text-gray-400">{hint}</span> : null}
    </label>
);

const StepCard = ({ step, title, children }) => (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 flex flex-col gap-2">
        <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-teal-600 text-white text-xs font-bold">{step}</span>
            <span className="text-sm font-semibold text-gray-200">{title}</span>
        </div>
        {children}
    </div>
);

const SetupPanel = ({ onClose }) => {
    const { recorder } = useTools();
    const [showAdvanced, setShowAdvanced] = useState(false);
    const {
        capabilities,
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
        videoDevices, audioDevices,
        videoDeviceId, setVideoDeviceId,
        audioDeviceId, setAudioDeviceId,
        micGain, setMicGain,
        systemGain, setSystemGain,
        rawMicMode, setRawMicMode,
        limiterEnabled, setLimiterEnabled,
        startPreview, reacquireStreams, pickScreenSource,
        startRecording,
        viewSavedTakes,
        takes,
        hasWebcamStream, hasScreenStream,
        micLevel,
        error,
    } = recorder;

    useEffect(() => {
        startPreview();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        startPreview();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [videoDeviceId, audioDeviceId, includeWebcam, includeAudio]);

    const canStart = (includeWebcam && hasWebcamStream) || (includeScreen && hasScreenStream);
    const screenBtnLabel = hasScreenStream ? 'Pick a different screen / window' : 'Pick screen / window…';

    const renderMeter = () => {
        const levelPct = Math.min(100, (micLevel.level || 0) * 100);
        const peakPct = Math.min(100, (micLevel.peak || 0) * 100);
        const colorFor = (p) => {
            if (p >= 90) return 'bg-red-500';
            if (p >= 75) return 'bg-amber-400';
            if (p >= 40) return 'bg-emerald-400';
            return 'bg-slate-500';
        };
        return (
            <div className="max-w-2xl mx-auto w-full">
                <div className="flex justify-between text-xs text-gray-300 mb-1">
                    <span>Mic level</span>
                    <span className="text-gray-400">aim peaks at the green zone</span>
                </div>
                <div className="relative h-3 bg-slate-700 rounded overflow-hidden">
                    <div className="absolute inset-y-0 bg-emerald-900/40" style={{ left: '40%', width: '35%' }} />
                    <div className="absolute inset-y-0 bg-amber-900/40" style={{ left: '75%', width: '15%' }} />
                    <div className="absolute inset-y-0 bg-red-900/40" style={{ left: '90%', width: '10%' }} />
                    <div className={`absolute inset-y-0 left-0 ${colorFor(levelPct)}`} style={{ width: `${levelPct}%` }} />
                    {peakPct > 1 && (
                        <div
                            className="absolute inset-y-0 w-0.5"
                            style={{
                                left: `calc(${peakPct}% - 1px)`,
                                background: peakPct >= 90 ? '#ef4444' : peakPct >= 75 ? '#fbbf24' : '#34d399',
                            }}
                        />
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-teal-300">Recording Studio</h2>
                <div className="flex items-center gap-3">
                    <button
                        onClick={viewSavedTakes}
                        className="text-sm px-3 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-white"
                        title="Open the review screen to play, trim and export takes you've already recorded."
                    >
                        Saved takes{takes && takes.length > 0 ? ` (${takes.length})` : ''}
                    </button>
                    <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl font-bold leading-none">&times;</button>
                </div>
            </div>

            {!capabilities.userMedia && (
                <div className="bg-red-900/40 border border-red-700 text-red-200 p-3 rounded text-sm">
                    Your browser doesn't support camera/microphone access. Try Chrome, Edge or Firefox on a desktop.
                </div>
            )}
            {error && (
                <div className="bg-red-900/40 border border-red-700 text-red-200 p-3 rounded text-sm">
                    {error}
                </div>
            )}

            {/* Compact preview — bounded so the 3-column controls stay in view */}
            <div className="max-w-2xl mx-auto w-full relative">
                <CompositorPreview />
                {pip.anchor === 'free' && includeWebcam && includeScreen && <PipDraggableOverlay enabled />}
            </div>
            {includeAudio && renderMeter()}

            {/* 3 step columns — video / audio / screen */}
            <div className="grid md:grid-cols-3 gap-3">
                {/* 1. Camera */}
                <StepCard step={1} title="Camera">
                    <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={includeWebcam} onChange={(e) => setIncludeWebcam(e.target.checked)} />
                        Include webcam
                    </label>
                    {includeWebcam && (
                        <>
                            <select
                                value={videoDeviceId}
                                onChange={(e) => setVideoDeviceId(e.target.value)}
                                className="bg-slate-700 text-gray-200 rounded p-2 text-sm"
                            >
                                <option value="">Default camera</option>
                                {videoDevices.map((d) => (
                                    <option key={d.deviceId} value={d.deviceId}>
                                        {d.label || `Camera ${d.deviceId.slice(0, 6)}`}
                                    </option>
                                ))}
                            </select>
                            <select
                                value={resolution}
                                onChange={(e) => setResolution(e.target.value)}
                                className="bg-slate-700 text-gray-200 rounded p-2 text-sm"
                                title="720p is plenty for fretboard work and lighter on the laptop. 1440p only helps with an external camera that supports it — built-in laptop cameras top out at 1080p, so picking 1440p just upscales and softens the image."
                            >
                                <option value="720p">720p (recommended)</option>
                                <option value="1080p">1080p</option>
                                <option value="1440p">1440p (external cam only)</option>
                            </select>
                            <div className="flex items-center justify-between gap-2">
                                <label className="flex items-center gap-2 text-xs text-gray-300">
                                    <input type="checkbox" checked={mirrorWebcam} onChange={(e) => setMirrorWebcam(e.target.checked)} />
                                    Mirror
                                </label>
                                <button
                                    type="button"
                                    onClick={() => reacquireStreams()}
                                    title="If the preview goes black (e.g. after closing your laptop), click here to reconnect."
                                    className="bg-slate-700 hover:bg-slate-600 text-white text-xs px-2 py-1 rounded"
                                >
                                    Reload
                                </button>
                            </div>
                        </>
                    )}
                </StepCard>

                {/* 2. Microphone */}
                <StepCard step={2} title="Microphone">
                    <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={includeAudio} onChange={(e) => setIncludeAudio(e.target.checked)} />
                        Include microphone
                    </label>
                    {includeAudio && (
                        <select
                            value={audioDeviceId}
                            onChange={(e) => setAudioDeviceId(e.target.value)}
                            className="bg-slate-700 text-gray-200 rounded p-2 text-sm"
                        >
                            <option value="">Default microphone</option>
                            {audioDevices.map((d) => (
                                <option key={d.deviceId} value={d.deviceId}>
                                    {d.label || `Mic ${d.deviceId.slice(0, 6)}`}
                                </option>
                            ))}
                        </select>
                    )}
                    {includeAudio && (
                        <p className="text-[11px] text-gray-500">
                            Use the meter above the boxes to check your level. You can re-balance mic vs. app audio after recording too.
                        </p>
                    )}
                </StepCard>

                {/* 3. App screen + PiP placement */}
                <StepCard step={3} title="App screen">
                    <label className="flex items-center gap-2 text-sm" title={!capabilities.displayMedia ? 'Not supported in this browser' : ''}>
                        <input
                            type="checkbox"
                            checked={includeScreen}
                            onChange={(e) => setIncludeScreen(e.target.checked)}
                            disabled={!capabilities.displayMedia}
                        />
                        Show app screen <span className="text-xs text-gray-400 font-normal">(for proof-of-work)</span>
                    </label>

                    {!capabilities.displayMedia && (
                        <p className="text-[11px] text-amber-300">
                            Screen recording isn't supported here. {capabilities.mobile ? 'Mobile browsers don\'t support it.' : 'Try Chrome / Edge.'}
                        </p>
                    )}

                    {includeScreen && capabilities.displayMedia && (
                        <>
                            <button
                                type="button"
                                onClick={() => pickScreenSource().catch(() => {})}
                                className="bg-indigo-600 hover:bg-indigo-500 text-white rounded p-2 text-sm font-semibold"
                            >
                                {screenBtnLabel}
                            </button>
                            <p className="text-[11px] text-gray-400">
                                {cropScreenCapture
                                    ? <>Chrome will ask to confirm sharing this tab. Tick <span className="font-semibold">"Share tab audio"</span> so the metronome / drone are captured too.</>
                                    : <>In Chrome's dialog: pick <span className="font-semibold">"This Tab"</span> and tick <span className="font-semibold">"Share tab audio"</span>. The current tab isn't shown in the Tab list by default — use the <span className="font-semibold">Window</span> tab to find it.</>}
                            </p>
                            <label className="flex items-start gap-2 text-[11px] text-gray-200">
                                <input
                                    type="checkbox"
                                    checked={cropScreenCapture}
                                    onChange={(e) => setCropScreenCapture(e.target.checked)}
                                    className="mt-0.5"
                                />
                                <span>
                                    <span className="font-semibold">Zoom into the practice tool</span> — crop the recording to just the active tool (Note Generator, quiz, etc.) so the content is bigger and more legible in the final video. Also hides the live preview from being captured. Pick a new screen / window after toggling this.
                                </span>
                            </label>

                            {includeWebcam && (
                                <div className="border-t border-slate-700 pt-2 mt-1 flex flex-col gap-2">
                                    <span className="text-xs font-semibold text-gray-300">Where to place the screen</span>
                                    <div className="flex gap-1 flex-wrap">
                                        {ANCHOR_BUTTONS.map((b) => (
                                            <button
                                                key={b.id}
                                                type="button"
                                                onClick={() => setPip({ ...pip, anchor: b.id })}
                                                className={`px-2 py-1 rounded text-xs ${pip.anchor === b.id ? 'bg-teal-600 text-white' : 'bg-slate-700 text-gray-200 hover:bg-slate-600'}`}
                                                title={b.id === 'free' ? 'Drag the box on the preview to place it freely' : ''}
                                            >
                                                {b.label}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="flex items-center gap-2 text-[11px]">
                                        <span className="text-gray-300 w-8">Size</span>
                                        <input
                                            type="range" min={0.15} max={0.5} step={0.01}
                                            value={pip.widthPct}
                                            onChange={(e) => setPip({ ...pip, widthPct: parseFloat(e.target.value) })}
                                            className="flex-1"
                                        />
                                        <span className="font-mono text-gray-200 w-9 text-right">{Math.round(pip.widthPct * 100)}%</span>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </StepCard>
            </div>

            {/* Advanced — collapsed by default */}
            <div className="bg-slate-900/40 border border-slate-700 rounded-lg">
                <button
                    type="button"
                    onClick={() => setShowAdvanced((v) => !v)}
                    className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-slate-800 flex items-center justify-between rounded-lg"
                >
                    <span>Advanced settings</span>
                    <span className={`transition-transform ${showAdvanced ? 'rotate-180' : ''}`}>▼</span>
                </button>
                {showAdvanced && (
                    <div className="p-3 pt-0 flex flex-col gap-3">
                        {includeAudio && (
                            <div className="flex flex-col gap-2 border-t border-slate-700 pt-3">
                                <span className="text-sm font-semibold text-gray-300">Audio levels</span>
                                <p className="text-xs text-gray-400">
                                    Defaults work for most cases. You can also re-balance mic and app audio after recording.
                                </p>
                                <label className="flex flex-col gap-1 text-xs">
                                    <div className="flex justify-between">
                                        <span className="text-gray-300">Mic gain</span>
                                        <span className="font-mono text-gray-200">{Math.round(micGain * 100)}%</span>
                                    </div>
                                    <input
                                        type="range" min={0} max={2} step={0.05}
                                        value={micGain}
                                        onChange={(e) => setMicGain(parseFloat(e.target.value))}
                                    />
                                </label>
                                <label className="flex flex-col gap-1 text-xs">
                                    <div className="flex justify-between">
                                        <span className="text-gray-300">App audio gain</span>
                                        <span className="font-mono text-gray-200">{Math.round(systemGain * 100)}%</span>
                                    </div>
                                    <input
                                        type="range" min={0} max={2} step={0.05}
                                        value={systemGain}
                                        onChange={(e) => setSystemGain(parseFloat(e.target.value))}
                                    />
                                </label>
                                <button
                                    type="button"
                                    onClick={() => { setMicGain(1); setSystemGain(1); }}
                                    className="self-start text-xs text-teal-300 hover:text-teal-200"
                                >
                                    Reset to 100%
                                </button>
                                <label className="flex items-start gap-2 text-xs text-gray-200 mt-2">
                                    <input
                                        type="checkbox" checked={rawMicMode}
                                        onChange={(e) => setRawMicMode(e.target.checked)} className="mt-0.5"
                                    />
                                    <span>
                                        <span className="font-semibold">Music mode</span> — disable browser noise suppression / echo cancel / auto-gain. Recommended for guitar.
                                    </span>
                                </label>
                                <label className="flex items-start gap-2 text-xs text-gray-200">
                                    <input
                                        type="checkbox" checked={limiterEnabled}
                                        onChange={(e) => setLimiterEnabled(e.target.checked)} className="mt-0.5"
                                    />
                                    <span>
                                        <span className="font-semibold">Soft limiter</span> — catches peaks before they clip.
                                    </span>
                                </label>
                                {includeScreen && (
                                    <label className="flex items-start gap-2 text-xs text-gray-200">
                                        <input
                                            type="checkbox" checked={includeTabAudio}
                                            onChange={(e) => setIncludeTabAudio(e.target.checked)} className="mt-0.5"
                                        />
                                        <span>Capture tab/system audio (metronome, drone). Chrome/Edge only.</span>
                                    </label>
                                )}
                            </div>
                        )}

                        <div className="border-t border-slate-700 pt-3">
                            <Field label="Auto-stop after">
                                <select value={autoStopMin} onChange={(e) => setAutoStopMin(parseInt(e.target.value, 10))} className="bg-slate-700 text-gray-200 rounded p-2">
                                    <option value={0}>Off</option>
                                    <option value={1}>1 minute</option>
                                    <option value={3}>3 minutes</option>
                                    <option value={5}>5 minutes</option>
                                    <option value={10}>10 minutes</option>
                                    <option value={20}>20 minutes</option>
                                </select>
                            </Field>
                        </div>

                        <Field label="Filename prefix" hint="The download will be named <prefix>_YYYY-MM-DD.mp4">
                            <input
                                type="text" value={filenamePrefix}
                                onChange={(e) => setFilenamePrefix(e.target.value.replace(/[^a-zA-Z0-9_-]/g, '_'))}
                                className="bg-slate-700 text-gray-200 rounded p-2"
                            />
                        </Field>
                    </div>
                )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-700">
                <button onClick={onClose} className="px-4 py-2 rounded bg-slate-700 hover:bg-slate-600 text-white">
                    Cancel
                </button>
                <button
                    onClick={() => startRecording()}
                    disabled={!canStart}
                    className="px-6 py-3 rounded-lg bg-red-600 hover:bg-red-500 disabled:bg-slate-700 disabled:text-gray-500 text-white font-bold flex items-center gap-2 text-lg"
                >
                    <span className="w-3 h-3 rounded-full bg-white" /> Start recording
                </button>
            </div>
        </div>
    );
};

export default SetupPanel;
