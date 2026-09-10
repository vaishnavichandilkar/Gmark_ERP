import React from 'react';
import { Clock, Sparkles } from 'lucide-react';

const ComingSoonMaster = ({ title = "Module" }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] bg-white border border-[#E5E7EB] rounded-[20px] shadow-sm p-8 text-center my-4">
      <div className="w-16 h-16 bg-[#073318]/10 text-[#073318] rounded-2xl flex items-center justify-center mb-5 animate-pulse">
        <Sparkles size={32} />
      </div>
      <h2 className="text-[24px] font-bold text-[#111827] mb-2">{title}</h2>
      <p className="text-[14px] text-[#6B7280] max-w-[420px] mb-6 leading-relaxed">
        This master module is currently under active development and will be available in the upcoming update.
      </p>
      <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-amber-50 text-amber-700 border border-amber-200/60 rounded-full text-[13px] font-semibold">
        <Clock size={16} />
        Coming Soon
      </span>
    </div>
  );
};

export default ComingSoonMaster;
