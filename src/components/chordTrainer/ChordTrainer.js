import React, { useState, useEffect, useRef } from 'react';
import { useTools } from '../../context/ToolsContext';
import { useChordTrainer } from './useChordTrainer';
import InfoModal from '../common/InfoModal';
import InfoButton from '../common/InfoButton';
import { ChordTrainerSetup } from './ChordTrainerSetup';
import { ChordTrainerControls } from './ChordTrainerControls';

// Map from standard chord-suffix → jazz chart symbol. The trainer always
// renders in jazz form; this map drives the substitution in ChordDisplay.
const JAZZ_SYMBOLS = { 'm': '-', 'maj7': '△7', 'm7': '-7', 'dim': '°', 'm7b5': 'ø7', '7': '7' };

// Per-mode set of awkward-to-type music symbols. `-` is the jazz minor
// indicator; `°` is the diminished triad on vii; `ø` is the half-diminished
// m7b5 in 7-chord mode; `△` is major-7. Sharps and flats are always useful
// for roots like Bb / F#. `7` lives in the 7-mode palette so mobile users
// don't have to flip to the numeric keyboard mid-chord.
// Order matches typing order so the palette reads left-to-right alongside
// the chord name: [root letter] [accidental] [quality] [extension] [alteration].
const PALETTE_SYMBOLS_TRIAD = ['♭', '♯', '-', '°'];
const PALETTE_SYMBOLS_7TH = ['♭', '♯', '-', '△', 'ø', '7', '♭5'];

const SymbolPalette = ({ use7thChords, disabled, onInsert }) => {
    const symbols = use7thChords ? PALETTE_SYMBOLS_7TH : PALETTE_SYMBOLS_TRIAD;
    return (
        <div className="flex items-center justify-center gap-2 mb-2" aria-label="Insert symbol">
            {symbols.map((sym) => (
                <button
                    key={sym}
                    type="button"
                    onClick={() => onInsert(sym)}
                    disabled={disabled}
                    // Tabindex -1 so Tab from the input still jumps to Submit,
                    // not through the palette. Click-only by design.
                    tabIndex={-1}
                    title={`Insert ${sym}`}
                    className="w-9 h-9 rounded-md bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed text-xl text-teal-300 font-semibold flex items-center justify-center"
                >
                    {sym}
                </button>
            ))}
        </div>
    );
};

const ChordDisplay = ({ chord }) => {
    if (!chord) return null;
    let displayName = chord;
    // Always render in jazz form: swap any standard suffix for its jazz glyph.
    const sortedSuffixes = Object.keys(JAZZ_SYMBOLS).sort((a, b) => b.length - a.length);
    for (const suffix of sortedSuffixes) {
        if (displayName.endsWith(suffix)) {
            displayName = displayName.slice(0, -suffix.length) + JAZZ_SYMBOLS[suffix];
            break;
        }
    }
    const match = displayName.match(/^([A-G])([#b]?)(.*)/);
    if (!match) { return <span>{displayName}</span>; }
    let [, root, accidental, quality] = match;
    if (accidental === '#') accidental = '♯';
    if (accidental === 'b') accidental = '♭';

    return (
        <span className="whitespace-nowrap inline-flex items-baseline">
            <span>{root}</span>
            <span className="relative" style={{ marginLeft: '0.1em', display: 'inline-block' }}>
                <span style={{ fontSize: '70%', marginLeft: accidental ? '0.25em' : '0' }}>
                    {quality || <span className="opacity-0">&nbsp;</span>}
                </span>
                <span className="absolute left-0" style={{ fontSize: '60%', bottom: '45%' }}>
                    {accidental}
                </span>
            </span>
        </span>
    );
};

const QuizScreen = ({ initialSettings, onLogSession, onGoToSetup, onProgressUpdate, isChallengeMode }) => {
    const [settings, setSettings] = useState(initialSettings);
    const {
        currentQuestion, userAnswer, setUserAnswer, feedback, score, history,
        reviewIndex, setReviewIndex, checkAnswer, generateNewQuestion, startReview, handleReviewNav
    } = useChordTrainer(settings, onProgressUpdate);

    const [isControlsOpen, setIsControlsOpen] = useState(false);
    const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
    const { savePreset } = useTools();
    const inputRef = useRef(null);
    const isReviewing = reviewIndex !== null;
    const wasCorrect = history.length > 0 ? history[history.length - 1].wasCorrect : true;

    useEffect(() => {
        if (!feedback && !isReviewing && inputRef.current) {
            inputRef.current.focus();
        }
    }, [currentQuestion, feedback, isReviewing]);
    
    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.key === 'Enter' && feedback && (!settings.autoAdvance || !wasCorrect)) {
                event.preventDefault();
                generateNewQuestion();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [feedback, settings.autoAdvance, wasCorrect, generateNewQuestion]);

    const handleSettingChange = (key, value) => setSettings(prev => ({...prev, [key]: value}));
    
    const handleSavePreset = () => {
        const name = prompt("Enter a name for your preset:", `CT - ${settings.selectedKeys.join(',')}`);
        if (name && name.trim() !== "") {
            savePreset({ id: Date.now().toString(), name: name.trim(), gameId: 'chord-trainer', gameName: 'Chord Trainer', settings });
            alert(`Preset "${name.trim()}" saved!`);
        }
    };
    
    const itemToDisplay = isReviewing ? history[reviewIndex] : { question: currentQuestion, userAnswer };
    
    const renderPrompt = () => {
        const q = itemToDisplay.question;
        if (!q || !q.prompt) return null;
        if (q.type === 'error') return <span className="text-red-400">{q.prompt.text}</span>;
        if (q.type === 'loading') return <span className="text-gray-400 italic">{q.prompt.text}</span>;
        
        // Split on `{key}` and `{chordType}` placeholders, styling each.
        // `text-highlight` (yellow) marks the musical key; teal marks the
        // chord-type word (triad/tetrad) so it stands out in hide-quality mode.
        let keyIndex = 0;
        const segments = q.prompt.text.split(/(\{key\}|\{chordType\})/);
        const questionTextParts = segments.map((segment, index) => {
            if (segment === '{key}' && q.prompt.keys && keyIndex < q.prompt.keys.length) {
                return <span key={index} className="text-highlight font-bold">{q.prompt.keys[keyIndex++]}</span>;
            }
            if (segment === '{chordType}' && q.prompt.chordType) {
                return <span key={index} className="text-indigo-300 font-bold">{q.prompt.chordType}</span>;
            }
            return <React.Fragment key={index}>{segment}</React.Fragment>;
        });

        const contentParts = q.prompt.content.split(' ');

        return (
            <div className="flex flex-col items-center text-center">
                <div className="text-3xl mb-4">{questionTextParts}</div>
                <div className="inline-flex flex-wrap justify-center items-center gap-2">
                    {contentParts.map((part, index) => (
                        <strong key={index} className="text-4xl font-bold text-teal-300 bg-slate-700/50 px-3 py-1 rounded-md">
                            <ChordDisplay chord={part} />
                        </strong>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col md:flex-row items-start w-full gap-4">
            <InfoModal isOpen={isInfoModalOpen} onClose={() => setIsInfoModalOpen(false)} title="Chord Trainer Guide">
                <div className="space-y-4 text-sm">
                    <div><h4 className="font-bold text-indigo-300 mb-1">Game Modes</h4><ul className="list-disc list-inside space-y-1"><li><b>Name Chord:</b> Given a key and a Roman numeral, name the chord.</li><li><b>Name Numeral:</b> Given a key and a chord, name the Roman numeral.</li><li><b>Progression:</b> Given a key and a numeral progression, name all the chords.</li><li><b>Transpose:</b> Given a chord progression in a starting key, transpose it to a new key, keeping the scale degrees (roman numerals) the same.</li></ul></div>
                    <div><h4 className="font-bold text-indigo-300 mt-2 mb-1">Chord Complexity</h4><p>Use the "Use 7th Chords" toggle to switch between triads (3-note chords) and tetrads (4-note chords). When active, you must provide the full 7th chord name (e.g., Cmaj7, Dm7).</p></div>
                    <div><h4 className="font-bold text-indigo-300 mt-2 mb-1">Roman Numerals</h4><p>Roman numerals represent scale degrees. Their case indicates quality: <b>I, IV</b> are major; <b>ii, iii, vi</b> are minor; <b>vii°</b> is diminished. In 7-chord mode the prompt shows the proper 7th quality (<b>Imaj7, iim7, V7, viiø7</b>, etc.) and you must answer with it.</p></div>
                    <div><h4 className="font-bold text-indigo-300 mt-2">Display & Input</h4><ul className="list-disc list-inside space-y-1"><li>Questions are displayed in <b>jazz chart notation</b> (A-7, C△7, Bø7). The parser accepts either form when you type, so <code>Am7</code>, <code>A-7</code>, and <code>Amin7</code> are all marked correct.</li><li>The symbol palette above the input has the jazz glyphs (<code>-</code> <code>°</code> <code>ø</code> <code>△</code>) so you don't have to hunt for them on the keyboard.</li><li><b>Hide Quality:</b> For a harder challenge, this strips the quality from the numerals (so you just see I, II, VI, etc.) and the prompt asks for the "triad" or "tetrad" — you have to recall the quality from theory.</li></ul></div>
                </div>
            </InfoModal>

            <div className="w-full flex-1 bg-slate-800 p-4 rounded-lg">
                <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-2"><h1 className="text-2xl font-bold text-indigo-300">Chord Trainer</h1><InfoButton onClick={() => setIsInfoModalOpen(true)} /></div>
                    <div className="flex items-center gap-2"><button onClick={() => onLogSession(score, history)} className="bg-green-600 hover:bg-green-500 text-white font-bold py-1 px-3 rounded-lg text-sm">Log</button><button onClick={() => setIsControlsOpen(p => !p)} className="p-2 rounded-md bg-slate-700 hover:bg-slate-600 text-sm font-semibold">Controls</button></div>
                </div>
                <div className="grid grid-cols-3 items-center mb-4 text-lg">
                    <span className="font-semibold justify-self-start">Score: {score} / {history.length}</span>
                    <div className="justify-self-center">{history.length > 0 && <button onClick={startReview} disabled={isReviewing} className="bg-gray-600 hover:bg-gray-500 text-sm py-1 px-3 rounded-lg">Review</button>}</div>
                    <label className="flex items-center gap-2 cursor-pointer font-semibold justify-self-end"><span>Auto-Advance</span><div className="relative inline-flex items-center"><input type="checkbox" checked={settings.autoAdvance} onChange={(e) => handleSettingChange('autoAdvance', e.target.checked)} className="sr-only peer" /><div className="w-11 h-6 bg-gray-500 rounded-full peer-checked:after:translate-x-full after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div></div></label>
                </div>
                
                <div className="w-full max-w-3xl mx-auto flex flex-col items-center">
                    <div className="w-full bg-slate-900/50 p-4 rounded-lg text-center min-h-[120px] flex justify-center items-center flex-wrap gap-x-2 mb-2">{renderPrompt()}</div>
                    
                    {currentQuestion && currentQuestion.reminder && !feedback && (
                        <div className="text-sm italic text-highlight bg-yellow-900/30 p-2 rounded-md my-2 w-full text-center">
                            {currentQuestion.reminder}
                        </div>
                    )}
                    
                    {isReviewing && itemToDisplay.question && itemToDisplay.question.type !== 'error' ? (
                        <div className="text-base my-4 min-h-[28px] flex flex-col items-center gap-1 w-full">
                            <div className={itemToDisplay.wasCorrect ? 'text-green-400' : 'text-red-400'}>
                                {itemToDisplay.wasCorrect ? '✓ Correct' : '✗ Incorrect'}
                                {' — you answered: '}
                                <span className="font-mono">{itemToDisplay.userAnswer || '(blank)'}</span>
                            </div>
                            <div className="text-gray-300">
                                Correct answer: <span className="font-mono text-teal-300">{itemToDisplay.question.answer}</span>
                            </div>
                        </div>
                    ) : (
                        <div className={`text-xl my-4 min-h-[28px] ${feedback.startsWith('Correct') ? 'text-green-400' : 'text-red-400'}`}>{feedback}</div>
                    )}
                    <form onSubmit={(e)=>{e.preventDefault(); checkAnswer(userAnswer, settings.autoAdvance)}} className="w-full max-w-sm flex flex-col items-center">
                        <SymbolPalette
                            use7thChords={settings.use7thChords}
                            disabled={!!feedback || isReviewing}
                            onInsert={(sym) => {
                                const el = inputRef.current;
                                const start = el?.selectionStart ?? userAnswer.length;
                                const end = el?.selectionEnd ?? userAnswer.length;
                                const next = userAnswer.slice(0, start) + sym + userAnswer.slice(end);
                                setUserAnswer(next);
                                // Restore caret right after the inserted glyph
                                requestAnimationFrame(() => {
                                    if (!el) return;
                                    el.focus();
                                    const pos = start + sym.length;
                                    el.setSelectionRange(pos, pos);
                                });
                            }}
                        />
                        <input ref={inputRef} type="text" value={isReviewing ? '' : userAnswer} onChange={(e) => setUserAnswer(e.target.value)} className="w-full text-center text-xl p-3 rounded-lg bg-slate-700" disabled={!!feedback || isReviewing} autoFocus />
                        <div className="h-20 mt-3 flex justify-center items-center gap-4">
                            {isReviewing ? (<div className="flex items-center gap-4"><button type="button" onClick={() => handleReviewNav(-1)} disabled={reviewIndex === 0} className="p-3 rounded-lg bg-slate-600">Prev</button><button type="button" onClick={() => setReviewIndex(null)} className="bg-purple-600 p-3 rounded-lg font-bold">Return</button><button type="button" onClick={() => handleReviewNav(1)} disabled={reviewIndex === history.length - 1} className="p-3 rounded-lg bg-slate-600">Next</button></div>) 
                            : (
                                <>
                                    {!onProgressUpdate && <button type="button" onClick={onGoToSetup} className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-lg">Menu</button>}
                                    {!feedback && <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-8 rounded-lg">Submit</button>}
                                    {feedback && (!settings.autoAdvance || !wasCorrect) && (
                                        <button type="button" onClick={generateNewQuestion} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 px-8 rounded-lg animate-pulse">Next Question</button>
                                    )}
                                </>
                            )}
                        </div>
                    </form>
                </div>
            </div>

            <div className={`hidden md:block bg-slate-700 rounded-lg transition-all duration-300 ${isControlsOpen ? 'w-96 p-4' : 'w-0 overflow-hidden'}`}>{isControlsOpen && <ChordTrainerControls settings={settings} onSettingChange={handleSettingChange} onSavePreset={handleSavePreset} />}</div>
            {isControlsOpen && (<div className="md:hidden fixed inset-0 z-50 flex justify-center items-center bg-black/60" onClick={() => setIsControlsOpen(false)}><div className="w-11/12 max-w-sm bg-slate-800 rounded-2xl p-4 max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}><div className="flex-grow overflow-y-auto pr-2"><ChordTrainerControls settings={settings} onSettingChange={handleSettingChange} onSavePreset={handleSavePreset} /></div></div></div>)}
        </div>
    );
};

const ChordTrainer = ({ onProgressUpdate, challengeSettings }) => {
    const { addLogEntry, clearPresetToLoad, presetToLoad } = useTools();
    const [screen, setScreen] = useState('setup');
    const [initialSettings, setInitialSettings] = useState(null);

    useEffect(() => {
        if (challengeSettings) {
            setInitialSettings(challengeSettings);
            setScreen('quiz');
        } else if (presetToLoad && presetToLoad.gameId === 'chord-trainer') {
            setInitialSettings(presetToLoad.settings);
            setScreen('quiz');
            clearPresetToLoad();
        }
    }, [challengeSettings, presetToLoad, clearPresetToLoad]);

    const handleStart = (settingsFromSetup) => {
        setInitialSettings({ ...settingsFromSetup, degreeToggles: { 'I': true, 'ii': true, 'iii': true, 'IV': true, 'V': true, 'vi': true, 'vii°': true }, autoAdvance: true, hideQuality: false, });
        setScreen('quiz');
    };
    const handleGoToSetup = () => { if (window.confirm("Are you sure you want to return to the menu? Your session will be lost.")) { setScreen('setup'); setInitialSettings(null); } };
    const handleLogSession = (score, history) => { const remarks = prompt("Enter any remarks for this session:", `Score: ${score}/${history.length}`); if (remarks !== null) { addLogEntry({ game: 'Chord Trainer', date: new Date().toLocaleDateString(), remarks }); alert("Session logged!"); } };

    if (screen === 'setup') { return <ChordTrainerSetup onStart={handleStart} />; }
    if (screen === 'quiz' && initialSettings) {
        return <QuizScreen key={JSON.stringify(initialSettings)} initialSettings={initialSettings} onLogSession={handleLogSession} onGoToSetup={handleGoToSetup} onProgressUpdate={onProgressUpdate} isChallengeMode={!!challengeSettings} />;
    }
    return null;
};

export default ChordTrainer;