import React, { useState } from 'react';
import { X, Download, Upload, CloudUpload } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const ImportModal = ({ isOpen, onClose, onImport, title }) => {
    const { t } = useTranslation(['common', 'modules']);
    const [fileName, setFileName] = useState('');

    if (!isOpen) return null;

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            setFileName(e.target.files[0].name);
        } else {
            setFileName('');
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-[999] flex items-center justify-center p-4 backdrop-blur-[2px] animate-in fade-in duration-200">
            <div className="bg-white rounded-[16px] w-full max-w-[500px] shadow-2xl overflow-hidden animate-in scale-95 duration-200">
                {/* Header matching design */}
                <div className="px-6 py-5 flex items-center justify-between border-b border-gray-50">
                    <h3 className="text-[17px] font-bold text-[#111827]">{title || t('common:import_data', 'Import Data')}</h3>
                    <button 
                        onClick={onClose}
                        className="p-1.5 hover:bg-gray-100 rounded-full transition-colors text-gray-400"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="p-8 flex flex-col items-center gap-8">
                    {/* Centered Download Sample */}
                    <div className="w-full flex justify-center">
                        <button className="flex items-center gap-2 bg-[#A7C0B8]/20 hover:bg-[#A7C0B8]/30 text-[#073318] px-8 py-3 rounded-[8px] text-[14px] font-bold transition-all">
                            <Download size={18} />
                            {t('common:download_sample', 'Download Sample')}
                        </button>
                    </div>

                    {/* Centered Upload File Label */}
                    <div className="w-full text-center">
                        <span className="text-[14px] font-bold text-[#4B5563]">{t('common:upload_file', 'Upload File')}</span>
                    </div>

                    {/* Select File Row */}
                    <div className="w-full flex items-center gap-4 px-2">
                        <span className="text-[13px] font-medium text-[#6B7280] whitespace-nowrap">{t('common:select_file', 'Select File')}</span>
                        <div className="flex-1">
                            <label className="flex items-center w-full h-[44px] border border-dashed border-[#E5E7EB] rounded-[8px] overflow-hidden cursor-pointer hover:border-[#014A36] transition-all bg-white">
                                <input 
                                    type="file" 
                                    className="hidden" 
                                    onChange={handleFileChange}
                                    accept=".xlsx,.xls,.csv"
                                />
                                <div className="flex items-center w-full h-full">
                                    <div className="h-full px-4 flex items-center bg-transparent border-r border-[#E5E7EB] text-[13px] font-bold text-[#4B5563]">
                                        {t('modules:chooseFile')}
                                    </div>
                                    <div className="px-4 text-[13px] text-[#9CA3AF] truncate italic">
                                        {fileName || t('modules:noFileChosen')}
                                    </div>
                                </div>
                            </label>
                        </div>
                    </div>

                    {/* Centered Submit Button */}
                    <div className="w-full flex justify-center mt-2">
                        <button
                            onClick={() => {
                                if (fileName) {
                                    onImport(fileName);
                                    onClose();
                                }
                            }}
                            className={`flex items-center justify-center gap-2 w-[160px] h-[40px] rounded-[8px] text-[14px] font-bold transition-all shadow-sm
                                ${fileName 
                                    ? 'bg-[#A7C0B8] text-white hover:bg-[#8eb0a4]' 
                                    : 'bg-[#A7C0B8] opacity-60 text-white cursor-not-allowed'}`}
                        >
                            <CloudUpload size={18} />
                            {t('common:submit', 'Submit')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ImportModal;
