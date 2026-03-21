import React, { useState, useRef, useEffect } from 'react';

/**
 * CustomSelect - A premium styled dropdown that replaces native <select>
 * matches the application dark theme and WOW aesthetics.
 */
const CustomSelect = ({ label, options, value, onChange, placeholder = "Select option", required = false, className = "" }) => {
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
        <div className={`relative ${className}`} ref={containerRef}>
            {label && (
                <label className="flex items-end h-8 text-[11px] font-black text-text-muted uppercase tracking-[0.2em] mb-2.5 ml-1">
                    {label}
                </label>
            )}
            
            {/* Trigger Button */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full bg-surface border ${isOpen ? 'border-primary' : 'border-white/10'} rounded-2xl px-6 py-3.5 text-white text-left transition-all font-bold flex justify-between items-center group active:scale-[0.98]`}
            >
                <span className={!currentOption ? 'text-text-muted/50 font-medium' : ''}>{displayValue}</span>
                <span className={`material-icons-round transition-transform duration-300 ${isOpen ? 'rotate-180 text-primary' : 'text-text-muted group-hover:text-white'}`}>
                    expand_more
                </span>
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute z-[1100] mt-2 w-full bg-surfaceHighlight border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-fade-in-up py-2 max-h-60 overflow-y-auto custom-scrollbar">
                    {options.length === 0 ? (
                        <div className="px-6 py-3 text-text-muted text-sm italic">No options available</div>
                    ) : (
                        options.map((opt) => (
                            <button
                                key={opt.value}
                                type="button"
                                onClick={() => handleSelect(opt.value)}
                                className={`w-full px-6 py-3 text-left transition-all flex items-center justify-between group
                                    ${String(opt.value) === String(value) 
                                        ? 'bg-primary/10 text-primary font-bold' 
                                        : 'text-text-muted hover:bg-white/5 hover:text-white font-medium'}`}
                            >
                                <span>{opt.label}</span>
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
