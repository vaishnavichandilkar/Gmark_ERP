import React, { useState, useRef, useEffect } from 'react';
import { Info } from 'lucide-react';

const SimpleTooltip = ({ message, className = "" }) => {
    const [isVisible, setIsVisible] = useState(false);
    const tooltipRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (tooltipRef.current && !tooltipRef.current.contains(event.target)) {
                setIsVisible(false);
            }
        };

        if (isVisible) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isVisible]);

    return (
        <div className={`relative inline-flex items-center ${className}`} ref={tooltipRef}>
            <button
                type="button"
                className="text-gray-400 hover:text-emerald-600 transition-colors focus:outline-none p-0.5"
                onMouseEnter={() => setIsVisible(true)}
                onMouseLeave={() => setIsVisible(false)}
                onClick={() => setIsVisible(!isVisible)}
            >
                <Info size={14} />
            </button>

            {isVisible && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-900 text-white text-[11px] font-medium rounded-lg shadow-xl whitespace-nowrap z-[150] animate-in fade-in zoom-in-95 slide-in-from-bottom-2">
                    {message}
                    {/* Arrow */}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-x-4 border-x-transparent border-t-4 border-t-gray-900" />
                </div>
            )}

            <style jsx>{`
                .animate-in { animation: fadeIn 200ms ease-out forwards; }
                @keyframes fadeIn {
                    from { opacity: 0; transform: translate(-50%, 8px) scale(0.95); }
                    to { opacity: 1; transform: translate(-50%, 0) scale(1); }
                }
            `}</style>
        </div>
    );
};

export default SimpleTooltip;
