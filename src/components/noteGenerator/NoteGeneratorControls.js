import React from 'react';
import { NumberStepper } from '../common/NumberStepper';

export const NoteGeneratorControls = ({
    settings,
    onSettingChange,
    isAutoGenerateOn,
    onAutoGenerateToggle,
    autoGenerateInterval,
    onIntervalChange,
    countdownClicks,
    onCountdownChange,
    onSavePreset
}) => (
    <div className="flex flex-col gap-4">
        <div>
            <div className="flex items-center justify-between">
                <label htmlFor="num-notes" className="font-semibold text-lg">Number of Notes:</label>
                <input 
                    type="number" 
                    id="num-notes" 
                    value={settings.numNotes} 
                    onChange={(e) => onSettingChange('numNotes', Math.max(1, parseInt(e.target.value, 10) || 1))} 
                    className="w-24 p-2 rounded-md bg-slate-600 text-white text-center" 
                    min="1" 
                />
            </div>
        </div>

        <div>
            <h4 className="font-semibold text-lg">Note Type:</h4>
            <div className="flex bg-slate-600 rounded-md p-1 mt-1">
                <label className={`flex-1 rounded-md py-1 text-center cursor-pointer ${settings.noteType === 'natural' ? 'bg-blue-600 text-white' : 'text-gray-300'}`}>
                    <input type="radio" name="noteType" value="natural" checked={settings.noteType === 'natural'} onChange={() => onSettingChange('noteType', 'natural')} className="sr-only"/>
                    Natural
                </label>
                <label className={`flex-1 rounded-md py-1 text-center cursor-pointer ${settings.noteType === 'chromatic' ? 'bg-blue-600 text-white' : 'text-gray-300'}`}>
                    <input type="radio" name="noteType" value="chromatic" checked={settings.noteType === 'chromatic'} onChange={() => onSettingChange('noteType', 'chromatic')} className="sr-only"/>
                    Chromatic
                </label>
            </div>
        </div>

        <label className="flex items-center justify-between gap-2 cursor-pointer p-2 bg-slate-600 rounded-md">
            <span className="font-semibold text-lg">Avoid Repeats</span>
            <div className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={settings.avoidRepeats} onChange={() => onSettingChange('avoidRepeats', !settings.avoidRepeats)} className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-500 rounded-full peer-checked:after:translate-x-full after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </div>
        </label>
        
        <div className="pt-4 border-t border-slate-600 space-y-2">
            <h4 className="font-semibold text-lg">Display Mode</h4>
            <div className="flex bg-slate-600 rounded-md p-1">
                <button onClick={() => onSettingChange('displayMode', 'flow')} className={`flex-1 rounded-md text-sm py-1 ${settings.displayMode === 'flow' ? 'bg-blue-600 text-white' : 'text-gray-300'}`}>Flow</button>
                <button onClick={() => onSettingChange('displayMode', 'measure')} className={`flex-1 rounded-md text-sm py-1 ${settings.displayMode === 'measure' ? 'bg-blue-600 text-white' : 'text-gray-300'}`}>Measures</button>
            </div>

            {settings.displayMode === 'measure' && (
                <div className="pl-2 pt-2 space-y-2 animate-fade-in-down border-l-2 border-slate-600">
                    <div className="flex items-center justify-between">
                        <label htmlFor="notes-per-bar" className="font-semibold text-md">Notes per Bar:</label>
                        <input 
                            type="number" 
                            id="notes-per-bar" 
                            value={settings.notesPerBar} 
                            onChange={(e) => onSettingChange('notesPerBar', Math.max(1, parseInt(e.target.value, 10) || 1))} 
                            className="w-20 p-1 rounded-md bg-slate-800 text-white text-center" 
                            min="1" 
                        />
                    </div>
                    <div className="flex items-center justify-between">
                        <label htmlFor="bars-per-line" className="font-semibold text-md">Bars per Line:</label>
                        <input 
                            type="number" 
                            id="bars-per-line" 
                            value={settings.barsPerLine} 
                            onChange={(e) => onSettingChange('barsPerLine', Math.max(1, parseInt(e.target.value, 10) || 1))} 
                            className="w-20 p-1 rounded-md bg-slate-800 text-white text-center" 
                            min="1" 
                        />
                    </div>
                </div>
            )}

             {settings.displayMode === 'flow' && (
                <div className="pl-2 pt-2 space-y-2 animate-fade-in-down border-l-2 border-slate-600">
                    <div className="flex items-center justify-between">
                        <label htmlFor="barline-freq" className="font-semibold text-md">Barline Every:</label>
                         <div className="flex items-center gap-2">
                            <input 
                                type="number" 
                                id="barline-freq" 
                                value={settings.barlineFrequency} 
                                onChange={(e) => onSettingChange('barlineFrequency', Math.max(0, parseInt(e.target.value, 10)) || 0)} 
                                className="w-20 p-1 rounded-md bg-slate-800 text-white text-center" 
                                min="0" 
                            />
                             <span className="font-semibold text-md">notes</span>
                        </div>
                    </div>
                     <p className="text-xs text-gray-400 italic">Set to 0 to disable barlines.</p>
                </div>
            )}
        </div>
        
        <div className="pt-4 border-t border-slate-600 space-y-4">
            <div className="flex items-center justify-between">
                <label htmlFor="auto-generate" className="font-semibold text-lg text-teal-300">Auto-Generate:</label>
                <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" id="auto-generate" checked={isAutoGenerateOn} onChange={onAutoGenerateToggle} className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-500 rounded-full peer-checked:after:translate-x-full after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                </label>
            </div>
             <div className="flex items-center justify-between flex-wrap gap-y-2">
                <label htmlFor="auto-generate-interval" className={`font-semibold text-lg ${!isAutoGenerateOn && 'opacity-50'}`}>Every:</label>
                <div className="flex items-center gap-2">
                    <NumberStepper
                        id="auto-generate-interval"
                        value={autoGenerateInterval}
                        onChange={onIntervalChange}
                        min={1}
                        disabled={!isAutoGenerateOn}
                    />
                    <span className={`font-semibold text-lg ${!isAutoGenerateOn && 'opacity-50'}`}>clicks</span>
                </div>
            </div>
            <div className="flex items-center justify-between">
                <label htmlFor="countdown-clicks" className={`font-semibold text-lg ${!isAutoGenerateOn && 'opacity-50'}`}>Countdown:</label>
                <div className="flex items-center gap-2"><input type="number" id="countdown-clicks" value={countdownClicks} onChange={(e) => onCountdownChange(Math.max(0, parseInt(e.target.value, 10)) || 0)} className={`w-24 p-2 rounded-md bg-slate-600 text-white text-center ${!isAutoGenerateOn && 'opacity-50'}`} min="0" max="7" disabled={!isAutoGenerateOn} /><span className={`font-semibold text-lg ${!isAutoGenerateOn && 'opacity-50'}`}>clicks</span></div>
            </div>
        </div>
        <div className="border-t border-slate-600 pt-4 mt-4">
            <button onClick={onSavePreset} className="w-full py-2 rounded-lg font-bold bg-indigo-600 hover:bg-indigo-500 text-white">
                Save Preset
            </button>
        </div>
    </div>
);