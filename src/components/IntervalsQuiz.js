import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTools } from '../context/ToolsContext';

const IntervalsQuiz = () => {
    const { bpm, addLogEntry } = useTools();
    const [screen, setScreen] = useState('menu');
    const [feedback, setFeedback] = useState({ message: '', type: '' });
    const [score, setScore] = useState(0);
    const [totalQuestions, setTotalQuestions] = useState(0);
    const [answerChecked, setAnswerChecked] = useState(false);
    const [currentQuestion, setCurrentQuestion] = useState(null);
    const [userAnswer, setUserAnswer] = useState('');
    const [rootNoteType, setRootNoteType] = useState('natural');
    const [autoAdvance, setAutoAdvance] = useState(false);
    const answerInputRef = useRef(null);
    const lastQuestionRef = useRef(null);
    const timeoutRef = useRef(null);

    const intervalData = React.useMemo(() => ({
        "2nd": [{ name: 'Minor 2nd', quality: 'Minor', semitones: 1 }, { name: 'Major 2nd', quality: 'Major', semitones: 2 }],
        "3rd": [{ name: 'Minor 3rd', quality: 'Minor', semitones: 3 }, { name: 'Major 3rd', quality: 'Major', semitones: 4 }],
        "4th": [{ name: 'Perfect 4th', quality: 'Perfect', semitones: 5 }, { name: 'Augmented 4th (Tritone)', quality: 'Augmented', semitones: 6 }],
        "5th": [{ name: 'Diminished 5th (Tritone)', quality: 'Diminished', semitones: 6 }, { name: 'Perfect 5th', quality: 'Perfect', semitones: 7 }],
        "6th": [{ name: 'Minor 6th', quality: 'Minor', semitones: 8 }, { name: 'Major 6th', quality: 'Major', semitones: 9 }],
        "7th": [{ name: 'Minor 7th', quality: 'Minor', semitones: 10 }, { name: 'Major 7th', quality: 'Major', semitones: 11 }],
        "Unison/Octave": [{ name: 'Perfect Unison', quality: 'Perfect', semitones: 0 }, { name: 'Perfect Octave', quality: 'Perfect', semitones: 12 }]
    }), []);

    const allIntervalNames = React.useMemo(() => Object.values(intervalData).flat().map(i => i.name), [intervalData]);
    const [selectedIntervals, setSelectedIntervals] = useState(() => {
        const initialState = {};
        allIntervalNames.forEach(name => { initialState[name] = false; });
        initialState['Major 3rd'] = true;
        return initialState;
    });

    const generateNewQuestion = useCallback(() => {
        clearTimeout(timeoutRef.current);
        const naturalNotes = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
        const chromaticKeys = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb'];
        const naturalNoteData = { 'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11 };
        const notesByNumber = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
        const allIntervalsFlat = Object.values(intervalData).flat();
        const activeIntervals = allIntervalsFlat.filter(i => selectedIntervals[i.name]);
        if (activeIntervals.length === 0) return;
        let question;
        do {
            const rootNotePool = rootNoteType === 'natural' ? naturalNotes : chromaticKeys;
            const rootNote = rootNotePool[Math.floor(Math.random() * rootNotePool.length)];
            const chosenInterval = activeIntervals[Math.floor(Math.random() * activeIntervals.length)];
            const rootNoteLetter = rootNote.charAt(0);
            const rootAccidentalStr = rootNote.substring(1);
            let rootAccidentalVal = 0;
            if (rootAccidentalStr.includes('#')) rootAccidentalVal = rootAccidentalStr.length;
            if (rootAccidentalStr.includes('b')) rootAccidentalVal = -rootAccidentalStr.length;
            const intervalNumber = parseInt(chosenInterval.name.match(/\d+/)?.[0] || (chosenInterval.name.includes('Unison') ? 1 : 8), 10);
            const rootIndex = notesByNumber.indexOf(rootNoteLetter);
            const targetIndex = (rootIndex + intervalNumber - 1) % 7;
            const targetLetter = notesByNumber[targetIndex];
            const rootMidi = naturalNoteData[rootNoteLetter] + rootAccidentalVal;
            let targetNaturalMidi = naturalNoteData[targetLetter];
            if (targetIndex < rootIndex || intervalNumber === 8) targetNaturalMidi += 12;
            const requiredMidi = rootMidi + chosenInterval.semitones;
            const accidentalValue = requiredMidi - targetNaturalMidi;
            let accidental = '';
            if (accidentalValue === 1) accidental = '#'; else if (accidentalValue === 2) accidental = '##'; else if (accidentalValue === -1) accidental = 'b'; else if (accidentalValue === -2) accidental = 'bb';
            const targetNote = targetLetter + accidental;
            question = { rootNote, intervalName: chosenInterval.name, correctAnswer: targetNote };
        } while (lastQuestionRef.current && JSON.stringify(question) === JSON.stringify(lastQuestionRef.current));
        lastQuestionRef.current = question;
        setCurrentQuestion(question);
        setFeedback({ message: '', type: '' });
        setUserAnswer('');
        setAnswerChecked(false);
        setTotalQuestions(prev => prev + 1);
    }, [selectedIntervals, intervalData, rootNoteType]);

    const startQuiz = () => { setScore(0); setTotalQuestions(-1); setScreen('quiz'); };
    useEffect(() => { if (screen === 'quiz' && totalQuestions === -1) generateNewQuestion(); }, [screen, totalQuestions, generateNewQuestion]);
    useEffect(() => { if (screen === 'quiz' && !answerChecked && answerInputRef.current) answerInputRef.current.focus(); }, [currentQuestion, screen, answerChecked]);

    const checkAnswer = useCallback(() => {
        if (answerChecked || !currentQuestion) return;
        const normalize = (note) => note.trim().toUpperCase().replace(/SHARP/g, '#').replace(/FLAT/g, 'B');
        const isCorrect = normalize(userAnswer) === normalize(currentQuestion.correctAnswer);
        if (isCorrect) {
            setFeedback({ message: 'Correct!', type: 'correct' });
            setScore(prev => prev + 1);
        } else {
            setFeedback({ message: `Incorrect. The answer was ${currentQuestion.correctAnswer}.`, type: 'incorrect' });
        }
        setAnswerChecked(true);
        if (autoAdvance) {
            timeoutRef.current = setTimeout(generateNewQuestion, 1500);
        }
    }, [answerChecked, userAnswer, currentQuestion, autoAdvance, generateNewQuestion]);

    useEffect(() => {
        const handleKeyDown = (event) => { 
            if (event.key === 'Enter') { 
                if (answerChecked && !autoAdvance) {
                    generateNewQuestion();
                } else if (!answerChecked) {
                    checkAnswer();
                }
            } 
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [answerChecked, checkAnswer, generateNewQuestion, autoAdvance]);

    const handleLogProgress = () => {
        const remarks = prompt("Enter any remarks for this session:", `Score: ${score}/${totalQuestions}`);
        if (remarks !== null) { addLogEntry({ game: 'Interval Practice', bpm, date: new Date().toLocaleDateString(), remarks: remarks || "No remarks." }); alert("Session logged!"); }
    };

    const handleSelectionChange = (name) => setSelectedIntervals(prev => ({ ...prev, [name]: !prev[name] }));
    const handleQuickSelect = (quality) => { const newState = { ...selectedIntervals }; Object.values(intervalData).flat().forEach(i => { if (i.quality === quality) newState[i.name] = true; }); setSelectedIntervals(newState); };
    const handleSelectAll = (select) => { const newState = {}; allIntervalNames.forEach(name => { newState[name] = select; }); setSelectedIntervals(newState); };

    if (screen === 'menu') {
        return (
            <div className="flex flex-col items-center bg-slate-800 p-4 md:p-8 rounded-lg w-full max-w-3xl mx-auto">
                <h1 className="text-3xl font-extrabold mb-6 text-indigo-300">Interval Practice</h1>
                <h2 className="text-2xl font-bold mb-4 text-blue-200">Select Intervals to Practice</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 w-full mb-6">
                    {Object.entries(intervalData).map(([groupName, intervals]) => (
                        <div key={groupName}><h3 className="font-bold text-lg text-teal-300 mb-2 border-b border-slate-600 pb-1">{groupName}s</h3><div className="flex flex-col gap-2">{intervals.map(interval => (<label key={interval.name} className="flex items-center text-gray-200 cursor-pointer"><input type="checkbox" checked={!!selectedIntervals[interval.name]} onChange={() => handleSelectionChange(interval.name)} className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 mr-3" />{interval.name.replace(' (Tritone)', '')}</label>))}</div></div>
                    ))}
                </div>
                 <div className="flex flex-wrap justify-center gap-4 mb-6">
                    <button onClick={() => handleQuickSelect('Major')} className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded-lg">Select Major</button>
                    <button onClick={() => handleQuickSelect('Minor')} className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded-lg">Select Minor</button>
                    <button onClick={() => handleQuickSelect('Perfect')} className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded-lg">Select Perfect</button>
                    <button onClick={() => handleSelectAll(true)} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg">Select All</button>
                    <button onClick={() => handleSelectAll(false)} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg">Deselect All</button>
                </div>
                <div className="w-full border-t border-slate-600 pt-6 mt-2">
                    <h2 className="text-2xl font-bold mb-4 text-blue-200">Options</h2>
                    <div className="flex flex-col md:flex-row justify-center items-center gap-4 md:gap-8">
                        <div className="flex items-center gap-4">
                            <span className="font-semibold text-lg">Root Notes:</span>
                            <div className="flex gap-4">
                                <label className="flex items-center gap-2 cursor-pointer text-lg"><input type="radio" name="rootType" value="natural" checked={rootNoteType === 'natural'} onChange={() => setRootNoteType('natural')} />Natural</label>
                                <label className="flex items-center gap-2 cursor-pointer text-lg"><input type="radio" name="rootType" value="chromatic" checked={rootNoteType === 'chromatic'} onChange={() => setRootNoteType('chromatic')} />Chromatic</label>
                            </div>
                        </div>
                        {/* --- FIX: "Auto-Advance" toggle was moved from here --- */}
                    </div>
                </div>
                <button onClick={startQuiz} disabled={!Object.values(selectedIntervals).some(v => v)} className="w-full mt-8 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg text-xl disabled:bg-gray-500 disabled:cursor-not-allowed">Start Quiz</button>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center bg-slate-800 p-4 md:p-8 rounded-lg w-full max-w-md mx-auto">
            <h1 className="text-3xl font-extrabold mb-2 text-indigo-300">Interval Practice</h1>
            {/* --- FIX: "Auto-Advance" toggle moved here for better UX --- */}
            <div className="w-full grid grid-cols-2 items-center mb-4 text-sm">
                <div className="flex justify-start">
                    <label htmlFor="auto-advance-quiz" className="flex items-center gap-2 cursor-pointer font-semibold">
                        <input type="checkbox" id="auto-advance-quiz" checked={autoAdvance} onChange={() => setAutoAdvance(p => !p)} className="sr-only peer" />
                        <div className="relative w-9 h-5 bg-gray-500 rounded-full peer peer-focus:ring-2 peer-focus:ring-blue-300 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                        <span>Auto-Advance</span>
                    </label>
                </div>
                <div className="text-xl text-gray-300 text-right">Score: {score} / {totalQuestions}</div>
            </div>
            
            {currentQuestion && (<><div className="text-5xl font-bold text-teal-300 mb-4">{currentQuestion.rootNote}</div><div className="text-2xl font-semibold text-gray-400 mb-6">What is the {currentQuestion.intervalName} above?</div></>)}
            <input ref={answerInputRef} type="text" value={userAnswer} onChange={(e) => setUserAnswer(e.target.value)} className="w-full text-center text-2xl p-3 rounded-lg bg-slate-700 text-white border-2 border-slate-600 focus:border-blue-500 focus:outline-none mb-4" placeholder="e.g., E, Bb" disabled={answerChecked} />
            <div className={`text-lg font-bold my-4 min-h-[28px] ${feedback.type === 'correct' ? 'text-green-400' : 'text-red-400'}`}>{feedback.message || <>&nbsp;</>}</div>
            
            {!autoAdvance && (
                <div className="text-center text-gray-400 mb-4 min-h-[24px] animate-pulse">
                    {!answerChecked ? "Press Enter to Submit" : "Press Enter for Next Question"}
                </div>
            )}

            {!autoAdvance ? (
                <div className="w-full flex gap-4">
                    <button onClick={checkAnswer} disabled={answerChecked} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg disabled:bg-gray-500">Submit</button>
                </div>
            ) : (
                <div className="h-[52px]"></div> // Placeholder to prevent layout shift
            )}

            <div className="w-full flex justify-between items-center mt-4">
                 <button onClick={() => setScreen('menu')} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg">Back to Menu</button>
                 <button onClick={handleLogProgress} className="bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-4 rounded-lg">Log Session</button>
            </div>
        </div>
    );
};

export default IntervalsQuiz;