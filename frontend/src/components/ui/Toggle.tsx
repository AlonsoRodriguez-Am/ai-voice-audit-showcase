import React from 'react';
import { clsx } from 'clsx';

interface ToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  disabled?: boolean;
}

const Toggle: React.FC<ToggleProps> = ({ enabled, onChange, disabled = false }) => {
  return (
    <label className={clsx(
      "relative inline-flex items-center group",
      disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
    )}>
      <input
        type="checkbox"
        className="sr-only peer"
        checked={enabled}
        onChange={(e) => !disabled && onChange(e.target.checked)}
        disabled={disabled}
      />
      <div className={clsx(
        "w-11 h-6 bg-slate-200 rounded-full transition-all duration-300",
        "peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-500/20",
        "peer-checked:bg-indigo-600",
        "after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all after:shadow-sm",
        "peer-checked:after:translate-x-full peer-checked:after:border-white",
        "group-hover:after:scale-110"
      )}></div>
    </label>
  );
};

export default Toggle;
