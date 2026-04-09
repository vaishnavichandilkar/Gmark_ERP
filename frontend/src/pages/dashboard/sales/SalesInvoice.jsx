import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const SalesInvoice = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-[60vh] flex items-center justify-center p-6 font-outfit">
            <div className="max-w-2xl w-full text-center space-y-12 animate-in fade-in zoom-in duration-700">
                {/* Text Content */}
                <p className="text-[#111827] text-[20px] md:text-[24px] font-bold max-w-lg mx-auto leading-relaxed">
                    The Sales Invoice module is currently under development and will be available to you very soon.
                </p>

                {/* Action */}
                <button 
                    onClick={() => navigate('/seller/sales/order')}
                    className="inline-flex items-center gap-2 px-10 h-[56px] bg-[#073318] text-white rounded-[16px] font-bold text-[15px] uppercase transition-all hover:bg-[#052611] hover:scale-105 active:scale-95 shadow-xl shadow-emerald-100"
                >
                    <ArrowLeft size={20} />
                    Back to Sales Orders
                </button>
            </div>
        </div>
    );
};

export default SalesInvoice;
