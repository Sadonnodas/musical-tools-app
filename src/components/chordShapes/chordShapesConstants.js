// src/components/chordShapes/chordShapesConstants.js

// ── AXIS SCAFFOLD ─────────────────────────────────────────────────────────────
export const AXIS_MAP = {
    6: [
        { string: 6, degree: '1',  offset: 0 },
        { string: 5, degree: '4',  offset: 0 },
        { string: 4, degree: 'b7', offset: 0 },
        { string: 3, degree: 'b3', offset: 0 },
        { string: 2, degree: '5',  offset: 0 },
        { string: 1, degree: '1',  offset: 0 },
    ],
    5: [
        { string: 5, degree: '1',  offset: 0 },
        { string: 4, degree: '4',  offset: 0 },
        { string: 3, degree: 'b7', offset: 0 },
        { string: 2, degree: '2',  offset: 0 },
        { string: 1, degree: '5',  offset: 0 },
    ],
    4: [
        { string: 4, degree: '1',  offset: 0 },
        { string: 3, degree: '4',  offset: 0 },
        { string: 2, degree: '6',  offset: 0 },
        { string: 1, degree: '2',  offset: 0 },
    ],
};

// ── CAGED SCAFFOLD (major & minor per root string) ────────────────────────────
export const CAGED_MAP = {
    major: {
        6: [
            { string: 6, degree: '1',  offset: 0 },
            { string: 5, degree: '5',  offset: 2 },
            { string: 4, degree: '1',  offset: 2 },
            { string: 3, degree: '3',  offset: 1 },
            { string: 2, degree: '5',  offset: 0 },
            { string: 1, degree: '1',  offset: 0 },
        ],
        5: [
            { string: 5, degree: '1',  offset: 0 },
            { string: 4, degree: '5',  offset: 2 },
            { string: 3, degree: '1',  offset: 2 },
            { string: 2, degree: '3',  offset: 2 },
            { string: 1, degree: '5',  offset: 0 },
        ],
        4: [
            { string: 4, degree: '1',  offset: 0 },
            { string: 3, degree: '5',  offset: 2 },
            { string: 2, degree: '1',  offset: 3 },
            { string: 1, degree: '3',  offset: 2 },
        ],
    },
    minor: {
        6: [
            { string: 6, degree: '1',  offset: 0 },
            { string: 5, degree: '5',  offset: 2 },
            { string: 4, degree: '1',  offset: 2 },
            { string: 3, degree: 'b3', offset: 0 },
            { string: 2, degree: '5',  offset: 0 },
            { string: 1, degree: '1',  offset: 0 },
        ],
        5: [
            { string: 5, degree: '1',  offset: 0 },
            { string: 4, degree: '5',  offset: 2 },
            { string: 3, degree: '1',  offset: 2 },
            { string: 2, degree: 'b3', offset: 1 },
            { string: 1, degree: '5',  offset: 0 },
        ],
        4: [
            { string: 4, degree: '1',  offset: 0 },
            { string: 3, degree: '5',  offset: 2 },
            { string: 2, degree: '1',  offset: 3 },
            { string: 1, degree: 'b3', offset: 1 },
        ],
    },
};

// ── INTERVAL → SEMITONES ──────────────────────────────────────────────────────
export const INTERVAL_MAP = {
    '1': 0, 'b2': 1, '2': 2, 'b3': 3, '3': 4, '4': 5,
    '#4': 6, 'b5': 6, '5': 7, '#5': 8, 'b6': 8, '6': 9,
    'bb7': 9, 'b7': 10, '7': 11,
    'b9': 1, '9': 2, '#9': 3, '11': 5, '#11': 6, 'b13': 8, '13': 9,
};

// ── CAGED QUALITY: which shape family to use as scaffold ─────────────────────
export const CAGED_QUALITY_MAP = {
    'Major': 'major', 'Major 7': 'major', 'Major 9': 'major',
    'Add9': 'major', 'Augmented': 'major', 'Sus2': 'major',
    'Sus4': 'major', '7sus4': 'major', 'Dominant 7': 'major',
    '9': 'major', '11': 'major', '13': 'major', 'Major 7#5': 'major',
    'Minor': 'minor', 'Minor 7': 'minor', 'Minor 9': 'minor',
    'Minor 11': 'minor', 'Minor 7b5': 'minor',
    'Diminished': 'minor', 'Diminished 7': 'minor',
};

// ── FULL CHORD DEFINITIONS ────────────────────────────────────────────────────
export const CHORD_DEFINITIONS = [
    // Triads
    { name: 'Major',        intervals: ['1', '3',  '5'],              group: 'Triads' },
    { name: 'Minor',        intervals: ['1', 'b3', '5'],              group: 'Triads' },
    { name: 'Augmented',    intervals: ['1', '3',  '#5'],             group: 'Triads' },
    { name: 'Diminished',   intervals: ['1', 'b3', 'b5'],             group: 'Triads' },
    { name: 'Sus2',         intervals: ['1', '2',  '5'],              group: 'Triads' },
    { name: 'Sus4',         intervals: ['1', '4',  '5'],              group: 'Triads' },
    // Seventh Chords
    { name: 'Major 7',      intervals: ['1', '3',  '5',  '7'],        group: 'Seventh Chords' },
    { name: 'Minor 7',      intervals: ['1', 'b3', '5',  'b7'],       group: 'Seventh Chords' },
    { name: 'Dominant 7',   intervals: ['1', '3',  '5',  'b7'],       group: 'Seventh Chords' },
    { name: 'Minor 7b5',    intervals: ['1', 'b3', 'b5', 'b7'],       group: 'Seventh Chords' },
    { name: 'Diminished 7', intervals: ['1', 'b3', 'b5', 'bb7'],      group: 'Seventh Chords' },
    { name: 'Major 7#5',    intervals: ['1', '3',  '#5', '7'],        group: 'Seventh Chords' },
    // Extensions
    { name: '9',            intervals: ['1', '3',  '5',  'b7', '9'],  group: 'Extensions' },
    { name: 'Major 9',      intervals: ['1', '3',  '5',  '7',  '9'],  group: 'Extensions' },
    { name: 'Minor 9',      intervals: ['1', 'b3', '5',  'b7', '9'],  group: 'Extensions' },
    { name: 'Add9',         intervals: ['1', '3',  '5',  '9'],        group: 'Extensions' },
    { name: '11',           intervals: ['1', '5',  'b7', '9',  '11'], group: 'Extensions' },
    { name: 'Minor 11',     intervals: ['1', 'b3', '5',  'b7', '11'], group: 'Extensions' },
    { name: '13',           intervals: ['1', '3',  '5',  'b7', '13'], group: 'Extensions' },
    { name: '7sus4',        intervals: ['1', '4',  '5',  'b7'],       group: 'Extensions' },
];

// Default: triads + 7ths on, extensions off
export const DEFAULT_ALLOWED_QUALITIES = Object.fromEntries(
    CHORD_DEFINITIONS.map(c => [c.name, c.group !== 'Extensions'])
);