import React from 'react';
import { NumberStepper } from '../common/NumberStepper';

export const IntervalGeneratorControls = ({
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
        <div className="flex items-center justify-between">
            <label htmlFor="num-intervals" className="font-semibold text-lg">Number of Intervals:</label>
            <input 
                type="number" 
                id="num-intervals" 
                value={settings.numIntervals} 
                onChange={(e) => onSettingChange('numIntervals', Math.max(1, parseInt(e.target.value, 10) || 1))} 
                className="w-24 p-2 rounded-md bg-slate-600 text-white text-center" 
                min="1" 
            />
        </div>
        
        <div className="pt-4 border-t border-slate-600">
            <span className="font-semibold text-lg">Include Qualities:</span>
            <div className="flex flex-col gap-3 mt-2">
                {Object.keys(settings.selectedQualities).map(quality => (
                    <label key={quality} className="flex items-center justify-between gap-2 cursor-pointer p-2 bg-slate-600 rounded-md">
                        <span className="font-semibold">{quality}</span>
                        <div className="relative inline-flex items-center cursor-pointer">
                            <input 
                                type="checkbox" 
                                checked={settings.selectedQualities[quality]} 
                                onChange={() => {
                                    const newQualities = {...settings.selectedQualities, [quality]: !settings.selectedQualities[quality]};
                                    onSettingChange('selectedQualities', newQualities);
                                }} 
                                className="sr-only peer" 
                            />
                            <div className="w-11 h-6 bg-gray-500 rounded-full peer peer-focus:ring-4 peer-focus:ring-blue-300 peer-checked:after:translate-x-full after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </div>
                    </label>
                ))}
            </div>
        </div>

        <div className="pt-4 border-t border-slate-600 space-y-4">
            <h3 className="font-semibold text-lg text-teal-300">Display Options</h3>
            <label className="flex items-center justify-between gap-2 cursor-pointer p-2 bg-slate-600 rounded-md">
                <span className="font-semibold">Use Shorthand (P4, m3)</span>
                <div className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={settings.useShorthand} onChange={() => onSettingChange('useShorthand', !settings.useShorthand)} className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-500 rounded-full peer peer-focus:ring-4 peer-focus:ring-blue-300 peer-checked:after:translate-x-full after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </div>
            </label>
            {settings.useShorthand && (
                <div>
                    <label className="font-semibold block mb-2 text-md">Display Mode:</label>
                    <div className="flex bg-slate-600 rounded-md p-1">
                        <button onClick={() => onSettingChange('displayMode', 'stacked')} className={`flex-1 rounded-md text-sm py-1 ${settings.displayMode === 'stacked' ? 'bg-blue-600 text-white' : 'text-gray-300'}`}>Stacked</button>
                        <button onClick={() => onSettingChange('displayMode', 'single-line')} className={`flex-1 rounded-md text-sm py-1 ${settings.displayMode === 'single-line' ? 'bg-blue-600 text-white' : 'text-gray-300'}`}>Single Line</button>
                    </div>
                </div>
            )}
        </div>

        <div className="pt-4 border-t border-slate-600 space-y-4">
            <h3 className="font-semibold text-lg text-teal-300">Automation</h3>
            <div className="flex items-center justify-between">
                <label htmlFor="auto-generate-int" className="font-semibold">Auto-Generate:</label>
                <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" id="auto-generate-int" checked={isAutoGenerateOn} onChange={onAutoGenerateToggle} className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-500 rounded-full peer peer-focus:ring-4 peer-focus:ring-blue-300 peer-checked:after:translate-x-full after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                </label>
            </div>
            <div className="flex items-center justify-between flex-wrap gap-y-2">
                <label htmlFor="auto-generate-interval-int" className={`font-semibold ${!isAutoGenerateOn && 'opacity-50'}`}>Generate every:</label>
                <div className="flex items-center gap-2">
                    <NumberStepper id="auto-generate-interval-int" value={autoGenerateInterval} onChange={onIntervalChange} min={1} disabled={!isAutoGenerateOn} />
                    <span className={`font-semibold ${!isAutoGenerateOn && 'opacity-50'}`}>clicks</span>
                </div>
            </div>
             <div className="flex items-center justify-between">
                <label htmlFor="countdown-clicks-int" className={`font-semibold ${!isAutoGenerateOn && 'opacity-50'}`}>Countdown:</label>
                <div className="flex items-center gap-2">
                    <input type="number" id="countdown-clicks-int" value={countdownClicks} onChange={(e) => onCountdownChange(Math.max(0, parseInt(e.target.value, 10)) || 0)} className={`w-24 p-2 rounded-md bg-slate-600 text-white text-center ${!isAutoGenerateOn && 'opacity-50'}`} min="0" max="7" disabled={!isAutoGenerateOn} />
                     <span className={`font-semibold ${!isAutoGenerateOn && 'opacity-50'}`}>clicks</span>
                </div>
            </div>
        </div>
        <div className="border-t border-slate-600 pt-4 mt-4">
            <button onClick={onSavePreset} className="w-full py-2 rounded-lg font-bold bg-indigo-600 hover:bg-indigo-500 text-white">
                Save Preset
            </button>
        </div>
    </div>
);