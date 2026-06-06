import React from 'react';

// ... UI Constants ...
const keysSharpOrder = ['C', 'G', 'D', 'A', 'E', 'B', 'F#'];
const keysFlatOrder = ['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb'];
const gameModes = [ {id: 1, label: "Name Chord"}, {id: 4, label: "Name Numeral"}, {id: 2, label: "Progression"}, {id: 3, label: "Transpose"} ];
// Proper diatonic 7th-chord qualities in major keys: I and IV are maj7, V is
// dominant 7, ii/iii/vi are m7, and vii is half-diminished (ø7), NOT just `7`
// or fully-dim `°7`. Previous labels ii7/iii7/vi7 implied dominant — wrong.
const scaleDegreeNames = { triads: ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'], sevenths: ['Imaj7', 'iim7', 'iiim7', 'IVmaj7', 'V7', 'vim7', 'viiø7'] };

const WeightSliders = ({ weights, onWeightChange, use7thChords }) => {
    const degreeNames = use7thChords ? scaleDegreeNames.sevenths : scaleDegreeNames.triads;
    return (
        <div>
            <h4 className="font-semibold text-lg text-teal-300 mb-2">Chord Weights</h4>
            {weights.map((weight, index) => (
                <div key={index} className="flex items-center gap-3 mt-1">
                    <label className="w-8 font-mono text-right text-sm">{degreeNames[index]}</label>
                    <input type="range" min="0" max="10" value={weight} onChange={(e) => onWeightChange(index, Number(e.target.value))} className="flex-1 h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer" />
                    <span className="w-4 text-left text-sm">{weight}</span>
                </div>
            ))}
        </div>
    );
};

export const ChordTrainerControls = ({ settings, onSettingChange, onSavePreset }) => {
    
    const handleKeySelection = (key) => { const newKeys = settings.selectedKeys.includes(key) ? settings.selectedKeys.filter(k => k !== key) : [...settings.selectedKeys, key]; onSettingChange('selectedKeys', newKeys); };
    const handleModeSelection = (modeId) => { const newModes = settings.selectedModes.includes(modeId) ? settings.selectedModes.filter(m => m !== modeId) : [...settings.selectedModes, modeId]; onSettingChange('selectedModes', newModes); };
    const handleDegreeToggle = (degree) => { onSettingChange('degreeToggles', {...settings.degreeToggles, [degree]: !settings.degreeToggles[degree]}); };
    const handleWeightChange = (index, value) => { const newWeights = settings.majorWeights.map((w, i) => i === index ? value : w); onSettingChange('majorWeights', newWeights); };

    return (
        <div className="space-y-4">
            <div><h4 className="font-semibold text-lg text-teal-300 mb-2">Keys</h4><div className="space-y-2"><div>{keysSharpOrder.map(key => (<button key={key} onClick={() => handleKeySelection(key)} className={`px-3 py-1 mr-1 mb-1 text-sm rounded-full font-semibold ${settings.selectedKeys.includes(key) ? 'bg-blue-600 text-white' : 'bg-slate-600'}`}>{key}</button>))}</div><div>{keysFlatOrder.map(key => (<button key={key} onClick={() => handleKeySelection(key)} className={`px-3 py-1 mr-1 mb-1 text-sm rounded-full font-semibold ${settings.selectedKeys.includes(key) ? 'bg-blue-600 text-white' : 'bg-slate-600'}`}>{key}</button>))}</div></div></div>
            <div><h4 className="font-semibold text-lg text-teal-300 mb-2">Game Modes</h4><div className="grid grid-cols-2 gap-2">{gameModes.map(mode => (<button key={mode.id} onClick={() => handleModeSelection(mode.id)} className={`p-2 text-sm rounded-md font-semibold ${settings.selectedModes.includes(mode.id) ? 'bg-blue-600 text-white' : 'bg-slate-600'}`}>{mode.label}</button>))}</div></div>
            <label className="flex items-center justify-between p-2 rounded-md bg-slate-600 cursor-pointer"><span className="font-semibold">Use 7th Chords</span><div className="relative inline-flex items-center cursor-pointer"><input type="checkbox" checked={settings.use7thChords} onChange={(e) => onSettingChange('use7thChords', e.target.checked)} className="sr-only peer" /><div className="w-11 h-6 bg-gray-500 rounded-full peer-checked:after:translate-x-full after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 peer-checked:bg-blue-600"></div></div></label>
            <label
                className="flex items-center justify-between p-2 rounded-md bg-slate-600 cursor-pointer"
                title="Strips the quality from the displayed numerals (vi becomes VI, vii° becomes VII) and asks for the triad or tetrad chord by degree alone. Forces you to recall the quality from theory."
            >
                <span className="font-semibold">Hide Quality (Challenge)</span>
                <div className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={!!settings.hideQuality} onChange={(e) => onSettingChange('hideQuality', e.target.checked)} className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-500 rounded-full peer-checked:after:translate-x-full after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 peer-checked:bg-blue-600"></div>
                </div>
            </label>
            <div><h4 className="font-semibold text-lg text-teal-300 mb-2">Scale Degrees</h4><div className="grid grid-cols-4 gap-2">{Object.keys(settings.degreeToggles).map((degree, i) => (<button key={degree} onClick={() => handleDegreeToggle(degree)} className={`p-2 text-sm rounded-md font-mono ${settings.degreeToggles[degree] ? 'bg-blue-600 text-white' : 'bg-slate-600'}`}>{settings.use7thChords ? scaleDegreeNames.sevenths[i] : scaleDegreeNames.triads[i]}</button>))}</div></div>
            
            <div className="border-t border-slate-600 pt-4 mt-4">
                 <details>
                    <summary className="text-lg font-bold text-teal-300 cursor-pointer hover:text-teal-200">Advanced Options</summary>
                    <div className="mt-2 p-3 bg-slate-800/50 rounded-lg space-y-4">
                        <div><h4 className="font-semibold text-lg text-teal-300 mb-2">Generation Method</h4><div className="flex bg-slate-600 rounded-md p-1 mt-1"><button onClick={() => onSettingChange('generationMethod', 'weighted')} className={`flex-1 text-sm rounded-md py-1 ${settings.generationMethod === 'weighted' ? 'bg-blue-600 text-white' : 'text-gray-300'}`}>Weighted</button><button onClick={() => onSettingChange('generationMethod', 'random')} className={`flex-1 text-sm rounded-md py-1 ${settings.generationMethod === 'random' ? 'bg-blue-600 text-white' : 'text-gray-300'}`}>Random</button></div></div>
                        <WeightSliders weights={settings.majorWeights} onWeightChange={handleWeightChange} use7thChords={settings.use7thChords} />
                    </div>
                </details>
            </div>
            <div className="border-t border-slate-600 pt-4 mt-4">
                 <button onClick={onSavePreset} className="w-full py-2 rounded-lg font-bold bg-indigo-600 hover:bg-indigo-500 text-white">Save Preset</button>
            </div>
        </div>
    );
};