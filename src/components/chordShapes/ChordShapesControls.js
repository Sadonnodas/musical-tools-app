import React from 'react';
import { CHORD_DEFINITIONS } from './chordShapesConstants';

const GROUPS = ['Triads', 'Seventh Chords', 'Extensions'];

const Toggle = ({ label, checked, onChange }) => (
    <label className="flex items-center justify-between gap-2 cursor-pointer p-2 bg-slate-600 rounded-md hover:bg-slate-500 transition-colors">
        <span className="font-semibold text-sm text-gray-200">{label}</span>
        <div className="relative inline-flex items-center">
            <input type="checkbox" checked={checked} onChange={onChange} className="sr-only peer" />
            <div className="w-9 h-5 bg-gray-500 rounded-full peer-checked:bg-blue-600 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all" />
        </div>
    </label>
);

export const ChordShapesControls = ({ settings, onSettingChange, onSavePreset }) => {
    const toggleQuality = (name) => {
        onSettingChange('allowedQualities', {
            ...settings.allowedQualities,
            [name]: !settings.allowedQualities[name],
        });
    };

    const toggleGroup = (group) => {
        const groupChords = CHORD_DEFINITIONS.filter(c => c.group === group);
        const allOn = groupChords.every(c => settings.allowedQualities[c.name]);
        const updates = Object.fromEntries(groupChords.map(c => [c.name, !allOn]));
        onSettingChange('allowedQualities', { ...settings.allowedQualities, ...updates });
    };

    return (
        <div className="space-y-5">
            {/* Game Modes */}
            <div>
                <h3 className="text-lg font-bold text-teal-300 mb-2">Game Modes</h3>
                <Toggle label="Identify" checked={settings.gameModes.identify}
                    onChange={() => onSettingChange('gameModes', { ...settings.gameModes, identify: !settings.gameModes.identify })} />
                <div className="mt-2">
                <Toggle label="Construct" checked={settings.gameModes.construct}
                    onChange={() => onSettingChange('gameModes', { ...settings.gameModes, construct: !settings.gameModes.construct })} />
                </div>
                <div className="mt-2">
                <Toggle label="Modify" checked={!!settings.gameModes.modify}
                    onChange={() => onSettingChange('gameModes', { ...settings.gameModes, modify: !settings.gameModes.modify })} />
                </div>
            </div>

            {/* Reference System */}
            <div>
                <h3 className="text-lg font-bold text-teal-300 mb-2">Reference System</h3>
                <div className="space-y-2">
                    {[
                        { key: 'showAxis', label: 'Axis', desc: 'Vertical degree line at root fret' },
                        { key: 'showCaged', label: 'CAGED', desc: 'Major/minor barre chord template' },
                    ].map(({ key, label, desc }) => (
                        <button
                            key={key}
                            onClick={() => onSettingChange(key, !settings[key])}
                            className={`w-full flex items-center justify-between p-3 rounded-lg border-2 transition-all ${
                                settings[key]
                                    ? 'bg-indigo-600/20 border-indigo-500 text-white'
                                    : 'bg-slate-800 border-slate-600 text-gray-400 hover:border-slate-500'
                            }`}
                        >
                            <div className="text-left">
                                <div className="font-bold">{label}</div>
                                <div className="text-xs opacity-70">{desc}</div>
                            </div>
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                settings[key] ? 'border-indigo-400 bg-indigo-500' : 'border-gray-500'
                            }`}>
                                {settings[key] && <div className="w-2 h-2 rounded-full bg-white" />}
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Chord Selection by group */}
            {GROUPS.map(group => {
                const groupChords = CHORD_DEFINITIONS.filter(c => c.group === group);
                const allOn = groupChords.every(c => settings.allowedQualities[c.name]);
                const someOn = groupChords.some(c => settings.allowedQualities[c.name]);
                return (
                    <div key={group}>
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-lg font-bold text-teal-300">{group}</h3>
                            <button onClick={() => toggleGroup(group)}
                                className={`text-xs px-2 py-1 rounded font-bold transition-all ${allOn ? 'bg-slate-600 text-gray-300' : someOn ? 'bg-blue-700 text-white' : 'bg-blue-600 text-white'}`}>
                                {allOn ? 'None' : 'All'}
                            </button>
                        </div>
                        <div className="space-y-1">
                            {groupChords.map(c => (
                                <Toggle key={c.name} label={c.name}
                                    checked={!!settings.allowedQualities[c.name]}
                                    onChange={() => toggleQuality(c.name)} />
                            ))}
                        </div>
                    </div>
                );
            })}

            {/* Auto-Advance */}
            <div>
                <h3 className="text-lg font-bold text-teal-300 mb-2">Settings</h3>
                <Toggle label="Auto-Advance" checked={settings.autoAdvance}
                    onChange={() => onSettingChange('autoAdvance', !settings.autoAdvance)} />
            </div>

            {onSavePreset && (
                <div className="border-t border-slate-600 pt-4">
                    <button onClick={onSavePreset}
                        className="w-full py-2 rounded-lg font-bold bg-indigo-600 hover:bg-indigo-500 text-white">
                        Save Preset
                    </button>
                </div>
            )}
        </div>
    );
};