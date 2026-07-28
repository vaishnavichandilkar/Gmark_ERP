import React from 'react';
import { AlertOctagon, RotateCw, Home } from 'lucide-react';

export const ErrorBoundaryFallback = ({ error, resetError }) => {
    return (
        <div className="min-h-screen w-screen flex items-center justify-center bg-[#F8FAF0] px-6 font-['Plus_Jakarta_Sans']">
            <div className="max-w-md w-full bg-white rounded-3xl border border-gray-200/80 p-8 shadow-[0_20px_50px_rgba(7,51,24,0.05)] text-center space-y-6">
                <div className="mx-auto h-16 w-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center">
                    <AlertOctagon size={32} />
                </div>
                <div className="space-y-2">
                    <h1 className="text-2xl font-bold text-gray-955 tracking-tight">System Interruption</h1>
                    <p className="text-[14px] text-gray-500 font-medium leading-relaxed">
                        Something went wrong while rendering this section. You can try refreshing the page or navigating back home.
                    </p>
                </div>
                {error && (
                    <div className="p-4 bg-gray-50 border border-gray-100 rounded-2xl text-left">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Diagnostic Log</p>
                        <p className="text-[13px] font-mono text-red-600 font-medium break-words leading-relaxed">
                            {error.message || String(error)}
                        </p>
                    </div>
                )}
                <div className="flex gap-4">
                    <button
                        onClick={resetError || (() => window.location.reload())}
                        className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-[#073318] hover:bg-[#062a14] active:scale-[0.98] transition-all text-white text-[14px] font-bold rounded-2xl shadow-lg shadow-[#073318]/15 cursor-pointer"
                    >
                        <RotateCw size={16} />
                        Reload Page
                    </button>
                    <button
                        onClick={() => window.location.href = '/'}
                        className="flex items-center justify-center p-3.5 bg-gray-50 border border-gray-200 hover:bg-gray-100 text-gray-700 rounded-2xl transition-colors cursor-pointer"
                        title="Go Home"
                    >
                        <Home size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ErrorBoundaryFallback;
