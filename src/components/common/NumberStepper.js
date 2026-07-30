import React from 'react';

// A number input with -/+ buttons, so the value can be changed on touch devices
// without relying on text selection inside the field (which is unreliable on iOS).
export const NumberStepper = ({
    id,
    value,
    onChange,
    min = 0,
    max = Infinity,
    step = 1,
    disabled = false,
    inputClassName = 'w-14 p-2 rounded-md bg-slate-600 text-white text-center'
}) => {
    const commit = (next) => onChange(Math.min(max, Math.max(min, next)));

    const buttonClass = 'w-10 h-10 flex-shrink-0 rounded-md bg-slate-700 text-white text-xl font-bold leading-none select-none disabled:opacity-40';

    return (
        <div className={`flex items-center gap-1 ${disabled ? 'opacity-50' : ''}`}>
            <button
                type="button"
                aria-label="Decrease"
                disabled={disabled || value <= min}
                onClick={() => commit(value - step)}
                className={buttonClass}
            >
                &minus;
            </button>
            <input
                type="number"
                inputMode="numeric"
                id={id}
                value={value}
                disabled={disabled}
                min={min}
                max={max === Infinity ? undefined : max}
                onFocus={(e) => e.target.select()}
                onChange={(e) => {
                    const parsed = parseInt(e.target.value, 10);
                    if (!Number.isNaN(parsed)) commit(parsed);
                }}
                className={inputClassName}
            />
            <button
                type="button"
                aria-label="Increase"
                disabled={disabled || value >= max}
                onClick={() => commit(value + step)}
                className={buttonClass}
            >
                +
            </button>
        </div>
    );
};
