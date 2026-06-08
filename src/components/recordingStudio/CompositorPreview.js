import React, { useEffect, useRef } from 'react';
import { useTools } from '../../context/ToolsContext';

// Re-parents the compositor's canvas into a visible wrapper for live preview.
// On unmount the canvas is moved BACK to the compositor's hidden host (not
// detached from the DOM entirely) so its RAF loop keeps running at full rate
// while recording continues without a visible preview. Chrome throttles RAF
// for fully-detached canvases — leaving the canvas off-DOM would freeze the
// recording mid-take on Windows / lower-end GPUs.
const CompositorPreview = ({ className = '' }) => {
    const { recorder } = useTools();
    const wrapRef = useRef(null);

    useEffect(() => {
        const compositor = recorder.getCompositor();
        const wrap = wrapRef.current;
        if (!compositor || !wrap) return undefined;
        const canvas = compositor.canvas;
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.objectFit = 'contain';
        canvas.style.transform = 'none';
        compositor.attachTo(wrap);
        return () => {
            // Return the canvas to its hidden host so RAF stays alive.
            try { compositor.detach(); } catch (_) {}
        };
    }, [recorder, recorder.phase, recorder.hasWebcamStream, recorder.hasScreenStream]);

    return (
        <div
            ref={wrapRef}
            className={`bg-black w-full aspect-video flex items-center justify-center overflow-hidden rounded-lg ${className}`}
        />
    );
};

export default CompositorPreview;
