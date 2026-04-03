import React, { useEffect } from 'react';
import { CheckCircle2, XCircle, X } from 'lucide-react';

const SuccessToast = ({ message, type = 'success', onClose }) => {
    useEffect(() => {
        const timer = setTimeout(onClose, 3000);
        return () => clearTimeout(timer);
    }, [onClose]);

    const isError = type === 'error';

    return (
        <div className="fixed bottom-6 right-6 z-[10000] animate-in fade-in slide-in-from-bottom-4 duration-300 pointer-events-none">
            <div className={`
                px-6 py-4 rounded-[16px] shadow-[0_20px_50px_rgba(0,0,0,0.2)] flex items-center gap-4 min-w-[320px] max-w-[400px] transition-all pointer-events-auto border
                ${isError 
                    ? 'bg-white text-red-600 border-red-100' 
                    : 'bg-[#073318] text-white border-[#062a14]'}
            `}>
                <div className={`
                    shrink-0 w-10 h-10 rounded-full flex items-center justify-center
                    ${isError ? 'bg-red-50' : 'bg-white/10'}
                `}>
                    {isError ? (
                        <XCircle size={20} />
                    ) : (
                        <CheckCircle2 size={20} />
                    )}
                </div>
                <div className="flex flex-col gap-0.5 flex-1 pr-2">
                    <p className={`text-[15px] font-bold tracking-tight ${isError ? 'text-red-700' : 'text-white'}`}>
                        {isError ? 'Error' : 'Success'}
                    </p>
                    <p className={`text-[13px] font-medium leading-relaxed ${isError ? 'text-red-500' : 'text-white/80'}`}>
                        {message}
                    </p>
                </div>
                <button 
                    onClick={onClose}
                    className={`shrink-0 rounded-full p-2 transition-colors ${isError ? 'hover:bg-red-50 text-red-400' : 'hover:bg-white/10 text-white/50'}`}
                >
                    <X size={16} />
                </button>
            </div>
        </div>
    );
};

export default SuccessToast;
