import React, { useState, useRef, useEffect } from 'react';

/**
 * CustomSelect - A premium styled dropdown that replaces native <select>
 * matches the application dark theme and WOW aesthetics.
 */
const CustomSelect = ({ label, options, value, onChange, placeholder = "Select option", required = false, disabled = false, className = "" }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);

    // Find current label
    const currentOption = options.find(opt => String(opt.value) === String(value));
    const displayValue = currentOption ? currentOption.label : placeholder;

    // Close when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (val) => {
        onChange({ target: { value: val } });
        setIsOpen(false);
    };

    return (
        <div className={`relative ${className} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${isOpen ? 'z-[100]' : ''}`} ref={containerRef}>
            {label && (
                <label className="flex items-end h-8 text-[11px] font-black text-text-muted uppercase tracking-[0.2em] mb-2.5 ml-1">
                    {label}
                </label>
            )}
            
            {/* Trigger Button */}
            <button
                type="button"
                disabled={disabled}
                onClick={() => !disabled && setIsOpen(!isOpen)}
                className={`w-full bg-surface border ${isOpen ? 'border-primary' : 'border-white/10'} rounded-[1rem] px-5 py-3 text-white text-left transition-all font-bold flex justify-between items-center group ${!disabled ? 'active:scale-[0.98]' : 'cursor-not-allowed'}`}
            >
                <span className={!currentOption ? 'text-white/60 font-semibold' : 'text-white'}>{displayValue}</span>
                <span className={`material-icons-round transition-transform duration-300 ${isOpen ? 'rotate-180 text-primary' : 'text-white/50 group-hover:text-white'}`}>
                    expand_more
                </span>
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute z-[1100] mt-1.5 w-full bg-surfaceHighlight border border-white/10 rounded-[1rem] shadow-2xl overflow-hidden animate-fade-in-up py-1.5 max-h-48 overflow-y-auto custom-scrollbar">
                    {options.length === 0 ? (
                        <div className="px-5 py-2.5 text-white/50 text-sm italic">No options available</div>
                    ) : (
                        options.map((opt) => (
                            <button
                                key={opt.value}
                                type="button"
                                onClick={() => handleSelect(opt.value)}
                                className={`w-full px-5 py-2.5 text-left transition-all flex items-center justify-between group
                                    ${String(opt.value) === String(value) 
                                        ? 'bg-primary/20 text-primary font-black' 
                                        : 'text-white/90 hover:bg-white/10 hover:text-white font-semibold'}`}
                            >
                                <span className="text-[13px] tracking-wide">{opt.label}</span>
                                {String(opt.value) === String(value) && (
                                    <span className="material-icons-round text-sm">check</span>
                                )}
                            </button>
                        ))
                    )}
                </div>
            )}
            
            {/* Hidden native input for form compatibility if needed */}
            <input type="hidden" required={required} value={value || ''} />
        </div>
    );
};

export default CustomSelect;
