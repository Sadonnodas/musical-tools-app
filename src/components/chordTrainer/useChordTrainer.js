import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import React from 'react'; // Add this import for JSX

// Core Data
const chordData = {
    'C': { triads: { chords: ['C', 'Dm', 'Em', 'F', 'G', 'Am', 'Bdim'], numerals: ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'] }, sevenths: { chords: ['Cmaj7', 'Dm7', 'Em7', 'Fmaj7', 'G7', 'Am7', 'Bm7b5'], numerals: ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'] } },
    'G': { triads: { chords: ['G', 'Am', 'Bm', 'C', 'D', 'Em', 'F#dim'], numerals: ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'] }, sevenths: { chords: ['Gmaj7', 'Am7', 'Bm7', 'Cmaj7', 'D7', 'Em7', 'F#m7b5'], numerals: ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'] } },
    'D': { triads: { chords: ['D', 'Em', 'F#m', 'G', 'A', 'Bm', 'C#dim'], numerals: ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'] }, sevenths: { chords: ['Dmaj7', 'Em7', 'F#m7', 'Gmaj7', 'A7', 'Bm7', 'C#m7b5'], numerals: ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'] } },
    'A': { triads: { chords: ['A', 'Bm', 'C#m', 'D', 'E', 'F#m', 'G#dim'], numerals: ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'] }, sevenths: { chords: ['Amaj7', 'Bm7', 'C#m7', 'Dmaj7', 'E7', 'F#m7', 'G#m7b5'], numerals: ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'] } },
    'E': { triads: { chords: ['E', 'F#m', 'G#m', 'A', 'B', 'C#m', 'D#dim'], numerals: ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'] }, sevenths: { chords: ['Emaj7', 'F#m7', 'G#m7', 'Amaj7', 'B7', 'C#m7', 'D#m7b5'], numerals: ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'] } },
    'B': { triads: { chords: ['B', 'C#m', 'D#m', 'E', 'F#', 'G#m', 'A#dim'], numerals: ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'] }, sevenths: { chords: ['Bmaj7', 'C#m7', 'D#m7', 'Emaj7', 'F#7', 'G#m7', 'A#m7b5'], numerals: ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'] } },
    'F#': { triads: { chords: ['F#', 'G#m', 'A#m', 'B', 'C#', 'D#m', 'E#dim'], numerals: ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'] }, sevenths: { chords: ['F#maj7', 'G#m7', 'A#m7', 'Bmaj7', 'C#7', 'D#m7', 'E#m7b5'], numerals: ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'] } },
    'Gb': { triads: { chords: ['Gb', 'Abm', 'Bbm', 'Cb', 'Db', 'Ebm', 'Fdim'], numerals: ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'] }, sevenths: { chords: ['Gbmaj7', 'Abm7', 'Bbm7', 'Cbmaj7', 'Db7', 'Ebm7', 'Fm7b5'], numerals: ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'] } },
    'Db': { triads: { chords: ['Db', 'Ebm', 'Fm', 'Gb', 'Ab', 'Bbm', 'Cdim'], numerals: ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'] }, sevenths: { chords: ['Dbmaj7', 'Ebm7', 'Fm7', 'Gbmaj7', 'Ab7', 'Bbm7', 'Cm7b5'], numerals: ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'] } },
    'Ab': { triads: { chords: ['Ab', 'Bbm', 'Cm', 'Db', 'Eb', 'Fm', 'Gdim'], numerals: ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'] }, sevenths: { chords: ['Abmaj7', 'Bbm7', 'Cm7', 'Dbmaj7', 'Eb7', 'Fm7', 'Gm7b5'], numerals: ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'] } },
    'Eb': { triads: { chords: ['Eb', 'Fm', 'Gm', 'Ab', 'Bb', 'Cm', 'Ddim'], numerals: ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'] }, sevenths: { chords: ['Ebmaj7', 'Fm7', 'Gm7', 'Abmaj7', 'Bb7', 'Cm7', 'Dm7b5'], numerals: ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'] } },
    'Bb': { triads: { chords: ['Bb', 'Cm', 'Dm', 'Eb', 'F', 'Gm', 'Adim'], numerals: ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'] }, sevenths: { chords: ['Bbmaj7', 'Cm7', 'Dm7', 'Ebmaj7', 'F7', 'Gm7', 'Am7b5'], numerals: ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'] } },
    'F': { triads: { chords: ['F', 'Gm', 'Am', 'Bb', 'C', 'Dm', 'Edim'], numerals: ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'] }, sevenths: { chords: ['Fmaj7', 'Gm7', 'Am7', 'Bbmaj7', 'C7', 'Dm7', 'Em7b5'], numerals: ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'] } },
};

const COMMON_PATTERNS = {
    'Major': [
        ['I', 'V', 'vi', 'IV'], ['I', 'IV', 'V', 'IV'], ['vi', 'IV', 'I', 'V'], ['I', 'vi', 'ii', 'V'],
        ['I', 'iii', 'vi', 'IV'], ['ii', 'V', 'I', 'vi'], ['I', 'V', 'ii', 'IV'],
        ['vi', 'ii', 'V', 'I'], ['I', 'IV', 'vi', 'V'], ['iii', 'vi', 'IV', 'V']
    ],
    'Minor': [
        ['i', 'VI', 'III', 'VII'], ['i', 'iv', 'v', 'iv'], ['i', 'iv', 'VII', 'III'],
        ['ii°', 'v', 'i', 'VI'], ['i', 'VII', 'VI', 'V'], ['i', 'iv', 'V', 'i'],
        ['iv', 'i', 'VII', 'III'], ['i', 'VI', 'iv', 'V'], ['v', 'VI', 'III', 'VII'], ['i', 'III', 'VII', 'iv']
    ]
};

// Normalize a chord-trainer answer for comparison. The goal: every form a
// student might reasonably type ends up in the same canonical shape as the
// data, which uses ASCII (#/b/dim/maj7/m7b5).
//
// Rules applied in order:
//   1. Lowercase.
//   2. Strip parens around modifiers so `m7(b5)` ≡ `m7b5`.
//   3. Unicode accidentals (♯ ♭) → ASCII (# b).
//   4. `ø` with optional trailing 7 → `m7b5` (canonical half-dim).
//   5. `△` with optional trailing 7 → `maj7` (canonical major-7).
//   6. `°` → `dim` (canonical diminished triad).
//   7. Jazz dash for minor at chord root: A-7 → Am7, Bb- → Bbm.
//   8. Jazz dash for minor on lowercase roman numerals: vii-7b5 → viim7b5.
//      Only fires when followed by a digit or `b` so progression-separator
//      dashes (like `C - F - G`) aren't accidentally swallowed.
//   9. Spelled-out `min` → `m`.
//  10. Collapse commas and whitespace to a single space (NOT dashes — those
//      are kept as glue inside chord names).
//
// The 7-mode answers are kept STRICT — students must write the proper
// quality (Imaj7, V7, viiø7 etc.). No silent acceptance of `V` for `V7` or
// `vii°` for `viiø7`: type of 7 matters for theory teaching.
const normalizeAnswer = (str) => {
    if (typeof str !== 'string') return '';
    return str
        .toLowerCase()
        .replace(/\(([^)]*)\)/g, '$1')
        .replace(/♯/g, '#')
        .replace(/♭/g, 'b')
        .replace(/ø7?/g, 'm7b5')
        .replace(/[△Δ]7?/g, 'maj7')
        .replace(/°/g, 'dim')
        .replace(/([a-g][#b]?)-/g, '$1m')
        .replace(/(i{1,3}|iv|vi{0,2}|v)-(?=\d|b)/g, '$1m')
        // Lowercase roman numeral followed directly by `7b5` implies the
        // half-dim quality (the b5 forces it) — accept `vii7b5` ≡ `viim7b5`.
        .replace(/(i{1,3}|iv|vi{0,2}|v)7b5/g, '$1m7b5')
        .replace(/min/g, 'm')
        .replace(/[,\s]+/g, ' ')
        .trim();
};

// A "seed" captures the random choices that identify a question: which key,
// which mode, which degree (modes 1/4), which progression pattern (modes 2/3),
// which target key (mode 3). Splitting seed from settings means toggling a
// display-only setting (notation style, hide-quality) just rebuilds the same
// question's display — it doesn't roll a new random question.
const pickSeed = (settings) => {
    const { selectedKeys, selectedModes, majorWeights, degreeToggles, generationMethod } = settings;
    if (selectedKeys.length === 0 || selectedModes.length === 0) return null;

    const availableDegreeIndexes = Object.keys(degreeToggles)
        .map((deg, i) => degreeToggles[deg] ? i : -1)
        .filter((i) => i !== -1);
    if (availableDegreeIndexes.length === 0) return null;

    // Mode 3 (transpose) needs at least two keys; drop it from the pool if
    // only one key is selected so we don't infinite-recurse trying to pick a
    // target key.
    const usableModes = selectedModes.filter((m) => m !== 3 || selectedKeys.length >= 2);
    if (usableModes.length === 0) return null;

    const key = selectedKeys[Math.floor(Math.random() * selectedKeys.length)];
    const mode = usableModes[Math.floor(Math.random() * usableModes.length)];

    let selectionPool = [];
    if (generationMethod === 'random') {
        selectionPool = availableDegreeIndexes;
    } else {
        availableDegreeIndexes.forEach((index) => {
            for (let i = 0; i < majorWeights[index]; i++) selectionPool.push(index);
        });
    }
    if (selectionPool.length === 0) return null;

    const seed = {
        key,
        mode,
        degreeIndex: selectionPool[Math.floor(Math.random() * selectionPool.length)],
    };
    if (mode === 2 || mode === 3) {
        const basePatterns = COMMON_PATTERNS['Major'];
        seed.basePattern = basePatterns[Math.floor(Math.random() * basePatterns.length)];
    }
    if (mode === 3) {
        const otherKeys = selectedKeys.filter((k) => k !== key);
        seed.keyTo = otherKeys[Math.floor(Math.random() * otherKeys.length)];
    }
    return seed;
};

// A seed is still usable if the user hasn't disabled the things it points at.
// If they unchecked the current key, mode, or degree the seed is dropped and
// a fresh one is rolled.
const isSeedValid = (seed, settings) => {
    if (!seed || !settings) return false;
    if (!settings.selectedKeys.includes(seed.key)) return false;
    if (!settings.selectedModes.includes(seed.mode)) return false;
    if (seed.mode === 3 && (!seed.keyTo || !settings.selectedKeys.includes(seed.keyTo))) return false;
    if (seed.mode === 1 || seed.mode === 4) {
        const degree = Object.keys(settings.degreeToggles)[seed.degreeIndex];
        if (!settings.degreeToggles[degree]) return false;
    }
    return true;
};

// Convert a chord name (or space-separated progression) from standard to
// jazz form, e.g. `Cmaj7 Am7 Bm7b5` → `C△7 A-7 Bø7`. Used to render the
// canonical correct-answer text in whichever notation the question is
// being displayed in. Mirrors the JAZZ_SYMBOLS map used by ChordDisplay.
const STANDARD_TO_JAZZ = { m7b5: 'ø7', maj7: '△7', m7: '-7', dim: '°', m: '-' };
const STANDARD_TO_JAZZ_KEYS = Object.keys(STANDARD_TO_JAZZ).sort((a, b) => b.length - a.length);
const chordToJazz = (chord) => {
    for (const suf of STANDARD_TO_JAZZ_KEYS) {
        if (chord.endsWith(suf)) return chord.slice(0, -suf.length) + STANDARD_TO_JAZZ[suf];
    }
    return chord;
};
const progressionToJazz = (progression) => progression.split(' ').map(chordToJazz).join(' ');

// Pure builder: turn (seed + settings) into the visible question object.
// Notation in prompts and stored answers is always jazz chart form
// (Am → A-, Cmaj7 → C△7, Bm7b5 → Bø7). The parser still accepts standard
// (Am, Cmaj7, Bm7b5) on the input side — only the display is fixed.
const buildQuestionFromSeed = (seed, settings) => {
    const { use7thChords, hideQuality } = settings;
    const { key, mode, degreeIndex, basePattern, keyTo } = seed;
    const keyData = use7thChords ? chordData[key].sevenths : chordData[key].triads;

    const neutralizeNumeral = (numeral) => numeral.toUpperCase().replace('°', '').replace('ø', '');
    // In 7th-chord mode the numerals array still stores `V` / `vi` / `vii°`,
    // but the actual chords are 7th-chords with specific qualities. The
    // proper roman-numeral form for each diatonic 7th in a major key is:
    //   I → Imaj7,  ii → iim7,  iii → iiim7,  IV → IVmaj7,
    //   V → V7,     vi → vim7,  vii° → viiø7  (half-diminished, jazz form)
    // Lowercase = m7, ° = ø7 (half-dim, jazz), uppercase = maj7 except V
    // (uniquely dominant in major) which is just 7. The progressionToJazz
    // pass below converts the m7/maj7 suffixes to their jazz glyphs.
    const display7th = (numeral) => {
        if (!use7thChords) return numeral;
        const base = numeral.replace('°', '');
        if (numeral.includes('°')) return base + 'ø7';
        if (base === base.toUpperCase()) return base + (base === 'V' ? '7' : 'maj7');
        return base + 'm7';
    };

    // When hideQuality is on the prompt shows bare degrees (I, II, VI, …) and
    // the prompt text says "triad" / "tetrad" so the student knows what kind
    // of chord to give — quality is no longer carried by the numeral.
    const chordWord = use7thChords ? 'tetrad' : 'triad';

    let prompt = {}, answer = '';
    if (mode === 1) {
        const numeral = hideQuality
            ? neutralizeNumeral(keyData.numerals[degreeIndex])
            : display7th(keyData.numerals[degreeIndex]);
        const text = hideQuality
            ? "In {key}, what is the {chordType} chord for:"
            : "In {key}, what is the chord for:";
        prompt = { text, keys: [key], chordType: chordWord, content: numeral };
        answer = keyData.chords[degreeIndex];
    } else if (mode === 4) {
        prompt = { text: "In {key}, what is the numeral for:", keys: [key], content: keyData.chords[degreeIndex] };
        // display7th produces jazz form for vii (ø7) and standard for others
        // (Imaj7, iim7, V7); the progressionToJazz pass below finishes the
        // conversion (maj7 → △7, m7 → -7) so the stored answer matches the
        // prompt's notation.
        answer = display7th(keyData.numerals[degreeIndex]);
    } else {
        const p_indexes = basePattern.map((n) => keyData.numerals.findIndex((kn) => kn.toLowerCase().replace('°','') === n.toLowerCase().replace('°','')));
        const progressionNumerals = p_indexes.map((idx) => keyData.numerals[idx]);
        if (mode === 2) {
            const displayNumerals = hideQuality
                ? progressionNumerals.map(neutralizeNumeral)
                : progressionNumerals.map(display7th);
            const text = hideQuality
                ? "In {key}, what are the {chordType} chords for:"
                : "In {key}, what are the chords for:";
            prompt = { text, keys: [key], chordType: chordWord, content: displayNumerals.join(' ') };
            answer = p_indexes.map((idx) => keyData.chords[idx]).join(' ');
        } else {
            const keyToData = use7thChords ? chordData[keyTo].sevenths : chordData[keyTo].triads;
            prompt = { text: "Transpose from {key} to {key}:", keys: [key, keyTo], content: p_indexes.map((idx) => keyData.chords[idx]).join(' ') };
            answer = progressionNumerals.map((numeral) => {
                const numeralIndex = keyData.numerals.indexOf(numeral);
                return keyToData.chords[numeralIndex];
            }).join(' ');
        }
    }

    // The canonical stored chord names use standard suffixes (Cmaj7, Am7,
    // Bm7b5, iim7, etc.). Convert to jazz so the displayed "Correct answer"
    // matches the prompt's notation. Normalization at compare time still
    // accepts both forms. The map is one-directional (standard → jazz) so
    // anything already in jazz form (e.g. `viiø7` from display7th) passes
    // through untouched.
    answer = progressionToJazz(answer);

    // Reminder text uses `•` between examples (clearly a list marker students
    // won't mistake for required syntax) and `(or X)` for alternates.
    let baseMessage = '';
    switch (mode) {
        case 1:
        case 2:
        case 3:
            baseMessage = use7thChords
                ? "7-chord mode. Forms: Cmaj7 (or C△7) • Am7 (or A-7) • Bm7b5 (or B-7b5 or Bø7). Symbol buttons below."
                : "Triad mode. Forms: C • Am (or A-) • Bdim (or B°). Symbol buttons below.";
            break;
        case 4:
            baseMessage = use7thChords
                ? "Examples: Imaj7 (or I△7) • iim7 (or ii-7 or iimin7) • V7 • viiø7 (or viim7b5 or vii-7b5 or vii7b5)."
                : "Roman numeral with quality. Examples: I • ii • IV • vi • vii°. Case matters.";
            break;
        default:
            break;
    }
    // Questions always render in jazz notation; the parser still accepts
    // standard (Am, Cmaj7, Bm7b5) on the input side, so no extra note needed.
    const reminder = baseMessage;

    return { prompt, answer, key, mode, reminder, seed };
};

export const useChordTrainer = (settings, onProgressUpdate) => {
    const [questionSeed, setQuestionSeed] = useState(null);
    const [userAnswer, setUserAnswer] = useState('');
    const [feedback, setFeedback] = useState('');
    const [score, setScore] = useState(0);
    const [history, setHistory] = useState([]);
    const [reviewIndex, setReviewIndex] = useState(null);
    const autoAdvanceTimeout = useRef(null);

    // Derived. Toggling a display-only setting (notation style, hide-quality)
    // re-runs this with the same seed → same question, new display.
    const currentQuestion = useMemo(() => {
        if (!settings) return null;
        if (settings.selectedKeys.length === 0 || settings.selectedModes.length === 0) {
            return { type: 'error', prompt: { text: 'Please select keys and game modes to begin.' } };
        }
        const availableDegreeIndexes = Object.keys(settings.degreeToggles || {})
            .map((deg, i) => settings.degreeToggles[deg] ? i : -1)
            .filter((i) => i !== -1);
        if (availableDegreeIndexes.length === 0) {
            return { type: 'error', prompt: { text: 'Please enable at least one scale degree in Controls.' } };
        }
        if (!questionSeed || !isSeedValid(questionSeed, settings)) {
            // The pick-fresh effect below will populate a new seed; show a
            // brief placeholder so we don't render undefined.
            return { type: 'loading', prompt: { text: 'Loading…' } };
        }
        return buildQuestionFromSeed(questionSeed, settings);
    }, [settings, questionSeed]);

    // Explicit "next question" — rolls a fresh seed and clears the input.
    const generateNewQuestion = useCallback(() => {
        clearTimeout(autoAdvanceTimeout.current);
        setReviewIndex(null);
        setUserAnswer('');
        setFeedback('');
        if (!settings) return;
        const seed = pickSeed(settings);
        if (seed) setQuestionSeed(seed);
    }, [settings]);

    // Pick a seed on initial load, and whenever the current seed gets
    // invalidated by a settings change (e.g. user disables the current key).
    // Display-only toggles never reach this branch because the seed stays valid.
    useEffect(() => {
        if (!settings || settings.selectedKeys.length === 0 || settings.selectedModes.length === 0) return;
        if (!questionSeed || !isSeedValid(questionSeed, settings)) {
            const seed = pickSeed(settings);
            if (seed) {
                setQuestionSeed(seed);
                setUserAnswer('');
                setFeedback('');
            }
        }
    }, [settings, questionSeed]);

    // Settings-change side effect: clear stale feedback so a student toggling
    // any setting isn't left staring at an outdated "Incorrect. The answer
    // was: X" message. The prompt rebuilds via useMemo; this just makes sure
    // they can re-submit cleanly. We deliberately keep userAnswer so their
    // typed text isn't wiped.
    const isFirstSettingsRender = useRef(true);
    useEffect(() => {
        if (isFirstSettingsRender.current) {
            isFirstSettingsRender.current = false;
            return;
        }
        clearTimeout(autoAdvanceTimeout.current);
        setFeedback('');
    }, [settings]);

    const checkAnswer = useCallback((answer, autoAdvance) => {
        if (feedback || !currentQuestion || currentQuestion.type === 'error' || currentQuestion.type === 'loading') return;

        const isCorrect = normalizeAnswer(answer) === normalizeAnswer(currentQuestion.answer);
        
        const newScore = isCorrect ? score + 1 : score;
        const newTotalAsked = history.length + 1;

        if (isCorrect) { 
            setScore(newScore); 
            setFeedback('Correct!');
        } else { 
            setFeedback(`Incorrect. The answer was: ${currentQuestion.answer}`); 
        }
        
        setHistory(prev => [...prev, { question: currentQuestion, userAnswer: answer, wasCorrect: isCorrect }]);
        
        if(onProgressUpdate) {
            onProgressUpdate({ wasCorrect: isCorrect, score: newScore, totalAsked: newTotalAsked });
        }

        if (autoAdvance && isCorrect) {
            autoAdvanceTimeout.current = setTimeout(generateNewQuestion, 1500);
        }
    }, [feedback, currentQuestion, generateNewQuestion, score, history.length, onProgressUpdate]);
    
    const handleReviewNav = (direction) => setReviewIndex(prev => { const newIndex = prev + direction; if (newIndex >= 0 && newIndex < history.length) return newIndex; return prev; });
    const startReview = () => history.length > 0 && setReviewIndex(history.length - 1);

    return {
        currentQuestion, userAnswer, setUserAnswer, feedback, score, history, reviewIndex, setReviewIndex,
        checkAnswer, generateNewQuestion, startReview, handleReviewNav
    };
};