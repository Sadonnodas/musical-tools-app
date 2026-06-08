import { useState, useCallback, useEffect, useRef } from 'react';
import { CHORD_DEFINITIONS, AXIS_MAP, CAGED_MAP, CAGED_QUALITY_MAP, INTERVAL_MAP } from './chordShapesConstants';
import { fretboardModel } from '../../utils/fretboardUtils';
import { getWeightedEnharmonicName } from '../../utils/musicTheory';

const DOUBLING_PRIORITY = ['1', '5', 'b3', '3', '4', '2'];

// Build a valid chord voicing for a given chordType, rootString, rootFret
// Returns array of notes or null if no valid voicing found within attempts
const buildVoicing = (chordType, rootString, rootFret, templateHint) => {
    const rootNoteInfo = fretboardModel[6 - rootString][rootFret];
    if (!rootNoteInfo) return null;

    const chordNotes = [];
    const usedStrings = new Set();
    chordNotes.push({ string: rootString, fret: rootFret, isRoot: true, label: rootNoteInfo.note, degree: '1' });
    usedStrings.add(rootString);

    const shuffle = arr => [...arr].sort(() => Math.random() - 0.5);

    const findCandidates = (semitones) => {
        const candidates = [];
        for (let s = 1; s <= 6; s++) {
            if (usedStrings.has(s)) continue;
            for (let f = rootFret - 2; f <= rootFret + 4; f++) {
                if (f < 0 || f > 15) continue;
                const note = fretboardModel[6 - s]?.[f];
                if (note && (note.midi - rootNoteInfo.midi + 24) % 12 === semitones % 12) {
                    const isTemplateString = templateHint.some(t => t.string === s);
                    candidates.push({ s, f, note, isTemplateString });
                }
            }
        }
        return candidates;
    };

    // Pass 1: required intervals
    for (const deg of chordType.intervals) {
        if (deg === '1') continue;
        const semitones = INTERVAL_MAP[deg];
        if (semitones === undefined) continue;
        const all = findCandidates(semitones);
        if (all.length === 0) return null;
        const pick = [...shuffle(all.filter(c => c.isTemplateString)), ...shuffle(all.filter(c => !c.isTemplateString))][0];
        chordNotes.push({ string: pick.s, fret: pick.f, isRoot: false, label: pick.note.note, degree: deg });
        usedStrings.add(pick.s);
    }

    // Pass 2: doublings
    const doublingOrder = DOUBLING_PRIORITY.filter(d => chordType.intervals.includes(d));
    for (const deg of doublingOrder) {
        if (usedStrings.size === 6) break;
        const semitones = INTERVAL_MAP[deg];
        if (semitones === undefined) continue;
        const candidates = findCandidates(semitones);
        if (candidates.length === 0) continue;
        const pick = [...shuffle(candidates.filter(c => c.isTemplateString)), ...shuffle(candidates.filter(c => !c.isTemplateString))][0];
        if (!pick) continue;
        const allFrets = [...chordNotes.map(n => n.fret), pick.f];
        if (Math.max(...allFrets) - Math.min(...allFrets) > 4) continue;
        chordNotes.push({ string: pick.s, fret: pick.f, isRoot: deg === '1', label: pick.note.note, degree: deg });
        usedStrings.add(pick.s);
    }

    const frets = chordNotes.map(n => n.fret);
    if (Math.max(...frets) - Math.min(...frets) > 4) return null;
    if (chordNotes.length < 3) return null;
    return chordNotes;
};

export const useChordShapes = (settings, onUpdateProgress) => {
    const [score, setScore] = useState(0);
    const [totalAsked, setTotalAsked] = useState(0);
    const [feedback, setFeedback] = useState({ message: '', type: '' });
    const [isAnswered, setIsAnswered] = useState(false);
    const [currentQuestion, setCurrentQuestion] = useState(null);
    const [userAnswer, setUserAnswer] = useState({});
    const [history, setHistory] = useState([]);
    const [draggingNote, setDraggingNote] = useState(null);
    const timeoutRef = useRef(null);
    const dragStartRef = useRef(null);

    const generateQuestion = useCallback(() => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);

        const activeModes = Object.keys(settings.gameModes).filter(m => settings.gameModes[m]);
        const activeTypes = CHORD_DEFINITIONS.filter(c => settings.allowedQualities[c.name]);
        if (activeModes.length === 0 || activeTypes.length === 0) return;

        const mode = activeModes[Math.floor(Math.random() * activeModes.length)];

        let question = null;
        let attempts = 0;

        while (!question && attempts < 50) {
            attempts++;
            const rootString = [6, 5, 4][Math.floor(Math.random() * 3)];
            const rootFret = Math.floor(Math.random() * 10) + 2;
            const rootNoteInfo = fretboardModel[6 - rootString][rootFret];
            const rootName = getWeightedEnharmonicName(rootNoteInfo.note);
            const cagedQuality = CAGED_QUALITY_MAP['Major'] || 'major'; // template hint only for voicing
            const templateHint = CAGED_MAP[cagedQuality]?.[rootString] || [];

            if (mode === 'modify') {
                // Pick two different chord types for start → target
                const shuffledTypes = [...activeTypes].sort(() => Math.random() - 0.5);
                if (shuffledTypes.length < 2) continue;
                const startType = shuffledTypes[0];
                const targetType = shuffledTypes[1];

                const startNotes = buildVoicing(startType, rootString, rootFret, templateHint);
                if (!startNotes) continue;

                const cagedQualityScaffold = CAGED_QUALITY_MAP[startType.name] || 'major';
                question = {
                    mode: 'modify',
                    root: rootName,
                    rootString,
                    rootFret,
                    startQuality: startType.name,
                    targetQuality: targetType.name,
                    chordNotes: startNotes,
                    scaffolding: (CAGED_MAP[cagedQualityScaffold]?.[rootString] || []).map(t => ({
                        string: t.string, fret: rootFret + t.offset, degree: t.degree,
                    })),
                    targetIntervals: targetType.intervals,
                    answer: { root: rootName, quality: targetType.name },
                };
            } else {
                const chordType = activeTypes[Math.floor(Math.random() * activeTypes.length)];
                const chordNotes = buildVoicing(chordType, rootString, rootFret, templateHint);
                if (!chordNotes) continue;

                const cagedQualityScaffold = CAGED_QUALITY_MAP[chordType.name] || 'major';
                const stringNames = { 6: 'Low E', 5: 'A string', 4: 'D string' };
                question = {
                    mode,
                    root: rootName,
                    quality: chordType.name,
                    rootString,
                    rootStringName: stringNames[rootString],
                    rootFret,
                    chordNotes,
                    scaffolding: (CAGED_MAP[cagedQualityScaffold]?.[rootString] || []).map(t => ({
                        string: t.string, fret: rootFret + t.offset, degree: t.degree,
                    })),
                    targetIntervals: chordType.intervals,
                    answer: { root: rootName, quality: chordType.name },
                };
            }
        }

        if (!question) return;

        setCurrentQuestion(question);
        setIsAnswered(false);
        setFeedback({ message: '', type: '' });
        setDraggingNote(null);

        if (question.mode === 'identify') {
            setUserAnswer({ root: null, quality: null });
        } else if (question.mode === 'construct') {
            setUserAnswer({ notes: [] });
        } else if (question.mode === 'modify') {
            // Start with the given chord notes as the user's working set
            setUserAnswer({ notes: question.chordNotes.map(n => ({ ...n })) });
        }
    }, [settings.gameModes, settings.allowedQualities]);

    useEffect(() => { generateQuestion(); }, [generateQuestion]);

    // ── Drag handlers for Modify mode ────────────────────────────────────────
    const handleNoteMouseDown = useCallback((note, event) => {
        if (isAnswered || currentQuestion?.mode !== 'modify') return;
        event.preventDefault();
        dragStartRef.current = { note, startX: event.clientX, startY: event.clientY, moved: false };
        setDraggingNote({ ...note });
    }, [isAnswered, currentQuestion]);

    const handleBoardMouseMove = useCallback((string, fret) => {
        if (!draggingNote || isAnswered) return;
        setDraggingNote(prev => ({ ...prev, previewString: string, previewFret: fret }));
    }, [draggingNote, isAnswered]);

    const handleBoardMouseUp = useCallback((string, fret) => {
        if (!draggingNote || isAnswered) return;
        const src = draggingNote;
        setUserAnswer(prev => {
            const notes = (prev.notes || []).filter(
                n => !(n.string === src.string && n.fret === src.fret)
            );
            const alreadyOccupied = notes.some(n => n.string === string && n.fret === fret);
            if (alreadyOccupied) {
                // Drop back to original position if target occupied
                return { notes: [...notes, { ...src }] };
            }
            const noteInfo = fretboardModel[6 - string]?.[fret];
            return {
                notes: [...notes, {
                    ...src,
                    string, fret,
                    label: noteInfo?.note || src.label,
                    midi: noteInfo?.midi || src.midi,
                }],
            };
        });
        setDraggingNote(null);
    }, [draggingNote, isAnswered]);

    const handleBoardClick = useCallback((string, fret) => {
        if (isAnswered || !currentQuestion) return;
        const mode = currentQuestion.mode;
        if (mode === 'construct' || mode === 'modify') {
            setUserAnswer(prev => {
                const notes = prev.notes || [];
                const exists = notes.some(n => n.string === string && n.fret === fret);
                if (exists) {
                    // Don't allow removing the root in modify mode
                    if (mode === 'modify' && string === currentQuestion.rootString && fret === currentQuestion.rootFret) return prev;
                    return { notes: notes.filter(n => !(n.string === string && n.fret === fret)) };
                }
                const noteInfo = fretboardModel[6 - string]?.[fret];
                return { notes: [...notes, { string, fret, label: noteInfo?.note || '', midi: noteInfo?.midi || 0 }] };
            });
        }
    }, [isAnswered, currentQuestion]);

    const checkAnswer = useCallback(() => {
        if (isAnswered || !currentQuestion) return;
        let isCorrect = false;

        if (currentQuestion.mode === 'identify') {
            isCorrect = userAnswer.root === currentQuestion.root && userAnswer.quality === currentQuestion.quality;
        } else {
            // construct + modify: all target intervals must be present, doublings OK
            const userNotes = userAnswer.notes || [];
            if (userNotes.length === 0) return;
            const rootMidi = fretboardModel[6 - currentQuestion.rootString][currentQuestion.rootFret].midi;
            const userIntervals = new Set(
                userNotes.map(n => (fretboardModel[6 - n.string]?.[n.fret]?.midi - rootMidi + 120) % 12)
            );
            isCorrect = currentQuestion.targetIntervals.every(
                deg => userIntervals.has((INTERVAL_MAP[deg] || 0) % 12)
            );
        }

        const qualityLabel = currentQuestion.mode === 'modify'
            ? `${currentQuestion.root} ${currentQuestion.targetQuality}`
            : `${currentQuestion.root} ${currentQuestion.quality}`;

        if (isCorrect) {
            setScore(s => s + 1);
            setFeedback({ message: 'Correct!', type: 'correct' });
            if (settings.autoAdvance) timeoutRef.current = setTimeout(generateQuestion, 2000);
        } else {
            setFeedback({ message: `Incorrect. The answer was ${qualityLabel}.`, type: 'incorrect' });
        }

        setTotalAsked(t => t + 1);
        setHistory(prev => [...prev, { question: currentQuestion, userAnswer, wasCorrect: isCorrect }]);
        setIsAnswered(true);
        if (onUpdateProgress) onUpdateProgress({ wasCorrect: isCorrect });
    }, [userAnswer, currentQuestion, isAnswered, settings.autoAdvance, generateQuestion, onUpdateProgress]);

    return {
        score, totalAsked, feedback, isAnswered,
        currentQuestion, userAnswer, setUserAnswer,
        draggingNote,
        checkAnswer, generateQuestion, history,
        handleNoteMouseDown, handleBoardMouseMove, handleBoardMouseUp, handleBoardClick,
    };
};