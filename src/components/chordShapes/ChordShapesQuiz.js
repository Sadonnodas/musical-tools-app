import React, { useState, useMemo } from 'react';
import QuizLayout from '../common/QuizLayout';
import FretboardDiagram from '../common/FretboardDiagram';
import InfoModal from '../common/InfoModal';
import { ChordShapesControls } from './ChordShapesControls';
import { useChordShapes } from './useChordShapes';
import { ROOT_NOTE_OPTIONS } from '../caged/cagedConstants';
import { CHORD_DEFINITIONS, DEFAULT_ALLOWED_QUALITIES, AXIS_MAP, CAGED_MAP, CAGED_QUALITY_MAP } from './chordShapesConstants';
import { useTools } from '../../context/ToolsContext';

const GROUPS = ['Triads', 'Seventh Chords', 'Extensions'];

const ChordShapesQuiz = ({ onProgressUpdate }) => {
    const { addLogEntry, savePreset, presetToLoad, clearPresetToLoad } = useTools();
    const [isControlsOpen, setIsControlsOpen] = useState(false);
    const [isInfoOpen, setIsInfoOpen] = useState(false);

    const [settings, setSettings] = useState({
        gameModes: { identify: true, construct: false, modify: false },
        showAxis: true,
        showCaged: false,
        autoAdvance: true,
        allowedQualities: DEFAULT_ALLOWED_QUALITIES,
    });

    React.useEffect(() => {
        if (presetToLoad?.gameId === 'chord-shapes') {
            setSettings(prev => ({ ...prev, ...presetToLoad.settings }));
            clearPresetToLoad();
        }
    }, [presetToLoad, clearPresetToLoad]);

    const quiz = useChordShapes(settings, onProgressUpdate);
    const {
        score, totalAsked, feedback, isAnswered,
        currentQuestion, userAnswer, setUserAnswer,
        draggingNote,
        checkAnswer, generateQuestion, history,
        handleNoteMouseDown, handleBoardMouseMove, handleBoardMouseUp, handleBoardClick,
    } = quiz;

    // ── Build scaffold (Axis + CAGED merged) ─────────────────────────────────
    const scaffoldData = useMemo(() => {
        if (!currentQuestion) return { byKey: new Map(), map: new Map() };

        const { showAxis, showCaged } = settings;
        // For modify mode use the target quality for CAGED; otherwise use chord quality
        const qualityForCaged = currentQuestion.mode === 'modify'
            ? (CAGED_QUALITY_MAP[currentQuestion.targetQuality] || 'major')
            : (CAGED_QUALITY_MAP[currentQuestion.quality] || 'major');

        const axisPositions = showAxis
            ? (AXIS_MAP[currentQuestion.rootString] || []).map(t => ({
                string: t.string, fret: currentQuestion.rootFret + t.offset, degree: t.degree,
              }))
            : [];

        const cagedPositions = showCaged
            ? (CAGED_MAP[qualityForCaged]?.[currentQuestion.rootString] || []).map(t => ({
                string: t.string, fret: currentQuestion.rootFret + t.offset, degree: t.degree,
              }))
            : [];

        const byKey = new Map();
        [...axisPositions, ...cagedPositions].forEach(t => {
            byKey.set(`${t.string}-${t.fret}`, t);
        });
        const map = new Map([...byKey.values()].map(t => [`${t.string}-${t.fret}`, t.degree]));
        return { byKey, map };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentQuestion, settings.showAxis, settings.showCaged]);

    // ── Build notes for diagram ───────────────────────────────────────────────
    const notesForDiagram = useMemo(() => {
        if (!currentQuestion) return [];
        const { byKey, map: scaffoldMap } = scaffoldData;

        const renderNote = (n, forceShowDegree = false) => {
            const onScaffold = scaffoldMap.has(`${n.string}-${n.fret}`);
            const showDegree = isAnswered || forceShowDegree || onScaffold;
            const isRoot = n.string === currentQuestion.rootString && n.fret === currentQuestion.rootFret;
            return {
                ...n,
                overrideColor: isRoot ? '#ef4444' : '#3b82f6',
                overrideLabel: isRoot ? 'R' : (showDegree ? n.degree : ''),
            };
        };

        let activeNotes = [];

        if (currentQuestion.mode === 'identify') {
            // Show chord, no degrees until answered
            activeNotes = currentQuestion.chordNotes.map(n => renderNote(n));

        } else if (currentQuestion.mode === 'construct') {
            if (isAnswered) {
                // Reveal the correct answer
                activeNotes = currentQuestion.chordNotes.map(n => renderNote(n, true));
            } else {
                activeNotes = (userAnswer.notes || []).map(n => {
                    const isRoot = n.string === currentQuestion.rootString && n.fret === currentQuestion.rootFret;
                    return { ...n, overrideColor: isRoot ? '#ef4444' : '#3b82f6', overrideLabel: isRoot ? 'R' : '' };
                });
            }

        } else if (currentQuestion.mode === 'modify') {
            if (isAnswered) {
                // Show the user's final notes with degrees revealed
                activeNotes = (userAnswer.notes || []).map(n => renderNote(n, true));
            } else {
                // Show user's working set (starts as the given chord, player modifies it)
                activeNotes = (userAnswer.notes || []).map(n => {
                    const isRoot = n.string === currentQuestion.rootString && n.fret === currentQuestion.rootFret;
                    const onScaffold = scaffoldMap.has(`${n.string}-${n.fret}`);
                    return {
                        ...n,
                        overrideColor: isRoot ? '#ef4444' : '#3b82f6',
                        overrideLabel: isRoot ? 'R' : (onScaffold ? n.degree : ''),
                    };
                });
            }
        }

        const occupied = new Set(activeNotes.map(n => `${n.string}-${n.fret}`));

        // Ghost scaffold — textOnly
        const scaffolding = [...byKey.values()]
            .filter(t => !occupied.has(`${t.string}-${t.fret}`))
            .map(t => ({
                string: t.string, fret: t.fret,
                overrideLabel: t.degree,
                overrideColor: 'rgba(255,255,255,0.45)',
                textOnly: true,
            }));

        return [...scaffolding, ...activeNotes];
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentQuestion, isAnswered, userAnswer, scaffoldData]);

    // ── Prompt text ───────────────────────────────────────────────────────────
    const promptText = () => {
        if (!currentQuestion) return null;
        const { mode, root, quality, rootStringName, startQuality, targetQuality } = currentQuestion;
        if (mode === 'identify') return <span>What chord is this?</span>;
        if (mode === 'construct') return (
            <span>Construct <span className="text-teal-300">{root} {quality}</span> — root on <span className="text-teal-300">{rootStringName}</span></span>
        );
        if (mode === 'modify') return (
            <span>This is <span className="text-teal-300">{root} {startQuality}</span> — change it to <span className="text-amber-400">{root} {targetQuality}</span></span>
        );
    };

    // ── Footer ────────────────────────────────────────────────────────────────
    const footerContent = isAnswered ? (
        <button onClick={generateQuestion} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 px-8 rounded-lg">
            Next Question
        </button>
    ) : (
        <button onClick={checkAnswer} className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-8 rounded-lg">
            Submit Answer
        </button>
    );

    const handleSavePreset = () => {
        const name = prompt('Enter a name for this preset:', 'Chord Shapes');
        if (name?.trim()) savePreset({ id: Date.now().toString(), name: name.trim(), gameId: 'chord-shapes', gameName: 'Chord Shapes', settings });
    };

    const activeQualities = CHORD_DEFINITIONS.filter(c => settings.allowedQualities[c.name]);
    const isModifyMode = currentQuestion?.mode === 'modify';
    const isConstructMode = currentQuestion?.mode === 'construct';

    return (
        <div className="flex flex-col md:flex-row items-start w-full gap-4">
            <QuizLayout
                title="Chord Shapes"
                score={score}
                totalAsked={totalAsked}
                history={history}
                onToggleControls={() => setIsControlsOpen(p => !p)}
                onShowInfo={() => setIsInfoOpen(true)}
                onLogProgress={() => addLogEntry({ game: 'Chord Shapes', date: new Date().toLocaleDateString(), remarks: `Score: ${score}/${totalAsked}` })}
                footerContent={footerContent}
            >
                <div className="text-center text-lg font-semibold text-gray-300 my-3">
                    {promptText()}
                </div>

                {isModifyMode && !isAnswered && (
                    <p className="text-center text-xs text-gray-500 mb-2">
                        Click to add/remove notes · Drag to move notes
                    </p>
                )}

                <FretboardDiagram
                    notesToDisplay={notesForDiagram}
                    showLabels={true}
                    startFret={0}
                    fretCount={12}
                    // Modify mode: full drag support
                    onNoteMouseDown={isModifyMode && !isAnswered ? handleNoteMouseDown : null}
                    onBoardMouseMove={isModifyMode && !isAnswered && draggingNote
                        ? (s, f) => handleBoardMouseMove(s, f) : null}
                    onBoardMouseUp={isModifyMode && !isAnswered && draggingNote
                        ? (s, f) => handleBoardMouseUp(s, f) : null}
                    // Click handler for construct + modify
                    onBoardClick={(!isAnswered && (isConstructMode || isModifyMode))
                        ? handleBoardClick : null}
                    draggingNote={draggingNote}
                />

                <div className={`my-3 min-h-[36px] flex justify-center items-center font-bold text-lg ${feedback.type === 'correct' ? 'text-green-400' : 'text-red-400'}`}>
                    {feedback.message}
                </div>

                {/* Identify mode answer UI */}
                {currentQuestion?.mode === 'identify' && !isAnswered && (
                    <div className="space-y-3 max-w-2xl mx-auto w-full">
                        <div className="grid grid-cols-6 md:grid-cols-12 gap-1">
                            {ROOT_NOTE_OPTIONS.map(note => (
                                <button key={note.value}
                                    onClick={() => setUserAnswer({ ...userAnswer, root: note.value })}
                                    className={`py-2 rounded font-bold text-xs transition-all ${userAnswer.root === note.value ? 'bg-indigo-600 ring-2 ring-indigo-300 text-white' : 'bg-teal-600 hover:bg-teal-500 text-gray-200'}`}>
                                    {note.display}
                                </button>
                            ))}
                        </div>
                        {GROUPS.map(group => {
                            const groupChords = activeQualities.filter(c => c.group === group);
                            if (groupChords.length === 0) return null;
                            return (
                                <div key={group}>
                                    <p className="text-xs text-gray-500 mb-1 font-semibold uppercase tracking-wider">{group}</p>
                                    <div className="flex flex-wrap gap-1">
                                        {groupChords.map(c => (
                                            <button key={c.name}
                                                onClick={() => setUserAnswer({ ...userAnswer, quality: c.name })}
                                                className={`py-2 px-3 rounded font-bold text-sm transition-all ${userAnswer.quality === c.name ? 'bg-indigo-600 ring-2 ring-indigo-300 text-white' : 'bg-teal-600 hover:bg-teal-500 text-gray-200'}`}>
                                                {c.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </QuizLayout>

            <div className={`hidden md:block bg-slate-700 rounded-lg transition-all duration-300 overflow-y-auto max-h-screen ${isControlsOpen ? 'w-80 p-4' : 'w-0 p-0 overflow-hidden'}`}>
                {isControlsOpen && (
                    <ChordShapesControls
                        settings={settings}
                        onSettingChange={(key, val) => setSettings(s => ({ ...s, [key]: val }))}
                        onSavePreset={handleSavePreset}
                    />
                )}
            </div>

            {isControlsOpen && (
                <div className="md:hidden fixed inset-0 z-50 flex justify-center items-start bg-black/60 pt-4 overflow-y-auto"
                    onClick={() => setIsControlsOpen(false)}>
                    <div className="w-11/12 max-w-sm bg-slate-800 rounded-2xl p-4" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold text-teal-300">Controls</h3>
                            <button onClick={() => setIsControlsOpen(false)} className="text-gray-400 text-2xl">&times;</button>
                        </div>
                        <ChordShapesControls
                            settings={settings}
                            onSettingChange={(key, val) => setSettings(s => ({ ...s, [key]: val }))}
                            onSavePreset={handleSavePreset}
                        />
                    </div>
                </div>
            )}

            <InfoModal isOpen={isInfoOpen} onClose={() => setIsInfoOpen(false)} title="Chord Shapes Guide">
                <div className="space-y-3 text-gray-300 text-sm">
                    <p>The <span className="text-red-400 font-bold">red note</span> is always the root.</p>
                    <p><strong className="text-teal-300">Identify:</strong> Figure out the root name and chord quality from the shape shown.</p>
                    <p><strong className="text-teal-300">Construct:</strong> Place all the notes of the given chord on the fretboard. Doublings are allowed.</p>
                    <p><strong className="text-teal-300">Modify:</strong> You're given a chord — change it into the target chord by clicking to add/remove notes or dragging notes to new positions.</p>
                    <p><strong className="text-teal-300">Axis / CAGED:</strong> Toggle these in Controls to show a reference overlay of scale degrees — useful when you get stuck.</p>
                </div>
            </InfoModal>
        </div>
    );
};

export default ChordShapesQuiz;