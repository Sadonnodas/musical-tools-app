import React, { useEffect } from 'react';
import { ToolsProvider, useTools } from './context/ToolsContext';

import Welcome from './components/Welcome';
import IntervalsQuiz from './components/intervalsQuiz/IntervalsQuiz';
import NoteGenerator from './components/noteGenerator/NoteGenerator';
import ChordTrainer from './components/chordTrainer/ChordTrainer';
import GlobalTools from './components/globalTools/GlobalTools';
import IntervalFretboardQuiz from './components/intervalFretboardQuiz/IntervalFretboardQuiz';
import DiagramMaker from './components/diagramMaker/DiagramMaker';
import ChordProgressionGenerator from './components/chordProgressionGenerator/ChordProgressionGenerator';
import IntervalGenerator from './components/intervalGenerator/IntervalGenerator';
import TriadQuiz from './components/triadQuiz/TriadQuiz';
import CAGEDSystemQuiz from './components/caged/CAGEDSystemQuiz';
import FretboardTriads from './components/fretboardTriads/FretboardTriads';
import IntervalEarTrainer from './components/earTraining/IntervalEarTrainer';
import MelodicEarTrainer from './components/earTraining/MelodicEarTrainer';
import ChordEarTrainer from './components/earTraining/chordRecognition/ChordEarTrainer';
import ProgressionEarTrainer from './components/earTraining/progressionRecognition/ProgressionEarTrainer';
import RoutinesPage from './components/routines/RoutinesPage'; // UPDATED
import RoutineRunner from './components/routines/RoutineRunner'; // UPDATED
import ScoreboardPage from './components/routines/ScoreboardPage'; // UPDATED
import PresetsManagerPage from './components/presets/PresetsManagerPage';
import MusicCircles from './components/musicCircles/MusicCircles';
import RhythmTool from './components/rhythmTool/RhythmTool';
import PentatonicQuiz from './components/pentatonic/PentatonicQuiz';
import ChordShapesQuiz from './components/chordShapes/ChordShapesQuiz';
import ScaleDegreeQuiz from './components/scaleDegreeQuiz/ScaleDegreeQuiz';
import RecordingStudio from './components/recordingStudio/RecordingStudio';

// The main UI component is now stateless and driven entirely by the context.
const AppContent = () => {
  const { 
    activeTab, 
    navigate, // This is the navigation function from the context
    openCategory, 
    handleCategoryClick,
    activeTool,
    activeRoutine, // RENAMED
    presetToLoad,
    lastRoutineResultId // RENAMED
  } = useTools();

const showMusicCircles = process.env.REACT_APP_SHOW_MUSIC_CIRCLES === 'true';
const showChordShapes = process.env.REACT_APP_SHOW_CHORD_SHAPES === 'true';

// Effects to automatically switch tabs
  useEffect(() => {
    // This "!activeRoutine" check is the key fix.
    // It stops the app from trying to navigate when a preset is loaded during a routine.
    if (presetToLoad && !activeRoutine) {
      navigate(presetToLoad.gameId);
    }
  }, [presetToLoad, navigate, activeRoutine]);
  useEffect(() => {
    if (lastRoutineResultId) { // RENAMED
      navigate('scoreboard');
    }
  }, [lastRoutineResultId, navigate]); // RENAMED
  
  const toolCategories = [
    {
  name: 'Generators',
  tools: [
    { id: 'note-generator', name: 'Note Generator' },
    { id: 'interval-generator', name: 'Interval Generator' },
    { id: 'chord-progression-generator', name: 'Chord Progression Generator' },
    { id: 'diagram-maker', name: 'Diagram Maker' },
    ...(showMusicCircles ? [{ id: 'music-circles', name: 'Music Circles' }] : []),
  ],
},
    {
      name: 'Theory',
      tools: [
        { id: 'intervals-quiz', name: 'Interval Practice' }, { id: 'triad-quiz', name: 'Triad & Tetrads Quiz' }, { id: 'chord-trainer', name: 'Chord Trainer' },{ id: 'rhythm-trainer', name: 'Rhythm Trainer' },
      ],
    },
    {
      name: 'Fretboard',
      tools: [
        { id: 'interval-fretboard-quiz', name: 'Fretboard Intervals' }, { id: 'caged-system-quiz', name: 'CAGED System Quiz' },
        { id: 'fretboard-triads', name: 'Fretboard Triads' },
        { id: 'pentatonic-shapes-quiz', name: 'Pentatonic Shapes' },
        //{ id: 'chord-shapes-quiz', name: 'Chord Shapes' },//
        { id: 'scale-degree-quiz', name: 'Scale Degree Quiz' },
      ],
    },
    {
  name: 'Ear Training',
  tools: [
    { id: 'interval-ear-trainer', name: 'Interval Recognition' },
    { id: 'melodic-ear-trainer', name: 'Melodic Recognition' },
    { id: 'chord-ear-trainer', name: 'Chord Recognition' },
    { id: 'progression-ear-trainer', name: 'Progression Recognition' },
  ],
},
    {
      name: 'Presets & Routines', // RENAMED
      tools: [
        { id: 'presets-manager', name: 'Preset Manager' }, { id: 'routines-hub', name: 'Routine Hub' }, { id: 'scoreboard', name: 'Scoreboard' }, // RENAMED
      ],
    },
  ];

  return (
    <div className={`min-h-screen bg-slate-900 font-inter text-gray-200 p-4 pb-32 md:p-6 transition-all duration-300 ${activeTool === 'log' || activeTool === 'presets' ? 'md:pl-96' : 'md:pl-72'}`}>
      <div className="hidden md:block fixed top-5 left-0 z-50 px-5">
        <a href="https://www.willmetzacademy.com/library" target="_blank" rel="noopener noreferrer">
          <img src={`${process.env.PUBLIC_URL}/WillMetz2.png`} alt="Will Metz Academy Logo" className="h-16 lg:h-20 xl:h-24 w-auto"/>
        </a>
      </div>

      <GlobalTools />
      <RecordingStudio />

      <header className="w-full max-w-5xl mx-auto bg-slate-800 shadow-lg rounded-xl p-6 mb-8 text-center">
        <h1 className="text-3xl md:text-5xl font-extrabold text-teal-400 leading-tight">Musical Practice Tools</h1>
        <p className="text-md md:text-lg text-gray-300">Your comprehensive companion for musical growth!</p>
      </header>
      
      <nav className="w-full max-w-5xl mx-auto bg-slate-800 shadow-md rounded-xl p-4 md:p-6 mb-8">
        <div className="flex flex-col md:flex-row justify-around gap-y-4 md:gap-x-6 flex-wrap">
            <div className="flex-1 text-center min-w-[150px]">
                 <button onClick={() => navigate('welcome')} className={`px-6 py-3 rounded-lg text-lg font-bold transition-all w-full ${activeTab === 'welcome' ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-700 text-blue-300 hover:bg-slate-600'}`}>Welcome</button>
            </div>
            {toolCategories.map(category => (
                <div key={category.name} className="flex-1 flex flex-col items-center gap-2 min-w-[150px]">
                    <button onClick={() => handleCategoryClick(category.name)} className="w-full bg-slate-700 hover:bg-slate-600 rounded-lg p-3 flex justify-between items-center">
                        <h3 className="text-lg font-bold text-teal-300">{category.name}</h3>
                        <span className={`transform transition-transform duration-300 ${openCategory === category.name ? 'rotate-180' : ''}`}>▼</span>
                    </button>
                    {openCategory === category.name && (
                        <div className="w-full flex flex-col items-center gap-2 bg-slate-900/50 p-2 rounded-b-lg animate-fade-in-down">
                           {category.tools.map(tool => (
                                <button key={tool.id} onClick={() => navigate(tool.id)} className={`w-full px-4 py-2 rounded-full text-md font-medium ${activeTab === tool.id ? 'bg-blue-600 text-white' : 'text-blue-300 hover:bg-slate-700'}`}>{tool.name}</button>
                            ))}
                        </div>
                    )}
                </div>
            ))}
        </div>
      </nav>

      <main id="app-main-content" className="w-full max-w-5xl mx-auto bg-slate-800 shadow-2xl rounded-xl p-4 md:p-8 flex-grow">
          {activeRoutine ? <RoutineRunner /> : ( // RENAMED
              <>
                  {activeTab === 'welcome' && <Welcome />}
                  {activeTab === 'chord-trainer' && <ChordTrainer />}
                  {activeTab === 'intervals-quiz' && <IntervalsQuiz />}
                  {activeTab === 'note-generator' && <NoteGenerator />}
                  {activeTab === 'interval-fretboard-quiz' && <IntervalFretboardQuiz />}
                  {activeTab === 'diagram-maker' && <DiagramMaker />}
                  {showMusicCircles && activeTab === 'music-circles' && <MusicCircles />}
                  {activeTab === 'chord-progression-generator' && <ChordProgressionGenerator />}
                  {activeTab === 'interval-generator' && <IntervalGenerator />}
                  {activeTab === 'triad-quiz' && <TriadQuiz />}
                  {activeTab === 'caged-system-quiz' && <CAGEDSystemQuiz />}
                  {activeTab === 'fretboard-triads' && <FretboardTriads />}
                  {activeTab === 'interval-ear-trainer' && <IntervalEarTrainer />}
                  {activeTab === 'melodic-ear-trainer' && <MelodicEarTrainer />}
                  {activeTab === 'chord-ear-trainer' && <ChordEarTrainer />}
                  {activeTab === 'progression-ear-trainer' && <ProgressionEarTrainer />}
                  {activeTab === 'routines-hub' && <RoutinesPage />} 
                  {activeTab === 'scoreboard' && <ScoreboardPage />}
                  {activeTab === 'presets-manager' && <PresetsManagerPage />}
                  {activeTab === 'rhythm-trainer' && <RhythmTool />}
                  {activeTab === 'pentatonic-shapes-quiz' && <PentatonicQuiz />}
                  {activeTab === 'scale-degree-quiz' && <ScaleDegreeQuiz />}
                  {showChordShapes && activeTab === 'chord-shapes-quiz' && <ChordShapesQuiz />}
              </>
          )}
      </main>

      <footer className="w-full max-w-5xl mx-auto text-center mt-8 text-gray-400 text-sm">
        <p>&copy; 2025 Toon's Musical Practice Tools. All rights reserved.</p>
      </footer>
    </div>
  );
}

function App() {
  return (
    <ToolsProvider>
      <AppContent />
    </ToolsProvider>
  );
}

export default App;