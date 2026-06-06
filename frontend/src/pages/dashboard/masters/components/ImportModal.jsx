import React, { useState } from 'react';
import { Download, UploadCloud, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';

const ImportModal = ({ isOpen, onClose, onImport, sampleFileName, sampleHeaders, onDownloadSample }) => {
    const { t } = useTranslation(['common', 'modules']);
    const [selectedFile, setSelectedFile] = useState(null);

    if (!isOpen) return null;

    const handleDownloadSample = async () => {
        try {
            if (onDownloadSample) {
                await onDownloadSample();
                toast.success(t('common:sample_downloaded', 'Sample downloaded successfully'));
            } else {
                // Create a worksheet with just the headers
                const worksheet = XLSX.utils.aoa_to_sheet([sampleHeaders]);
                
                // Set column widths for better readability
                const wscols = sampleHeaders.map(() => ({ wch: 20 }));
                worksheet['!cols'] = wscols;

                // Freeze first row
                worksheet['!views'] = [{ state: 'frozen', ySplit: 1 }];

                // Create a workbook and append the worksheet
                const workbook = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(workbook, worksheet, 'Sample Data');

                // Generate and download the file
                XLSX.writeFile(workbook, sampleFileName || 'Sample_File.xlsx');
                toast.success(t('common:sample_downloaded', 'Sample downloaded successfully'));
            }
        } catch (error) {
            console.error('Download sample error:', error);
            toast.error(t('common:error_downloading_sample', 'Error downloading sample file'));
        }
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            // Check file type (optional but good practice)
            const fileType = file.name.split('.').pop().toLowerCase();
            if (['xlsx', 'xls', 'csv'].includes(fileType)) {
                setSelectedFile(file);
            } else {
                toast.error(t('common:invalid_file_type', 'Please select a valid Excel or CSV file.'));
                e.target.value = null;
            }
        }
    };

    const handleSubmit = async () => {
        if (!selectedFile) {
            toast.error(t('common:please_select_file', 'Please select a file to upload.'));
            return;
        }

        const formData = new FormData();
        formData.append('file', selectedFile);

        // Call the parent's onImport which returns a promise
        try {
            await onImport(formData);
            setSelectedFile(null); // Reset on success
            onClose(); // Close modal on success
        } catch (error) {
            // Error is handled by the parent
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-[16px] shadow-2xl w-full max-w-lg mx-4 flex flex-col animate-in slide-in-from-top-4 duration-300">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-[#F3F4F6]">
                    <h2 className="text-[20px] font-bold text-[#111827]">{t('common:import_data', 'Import Data')}</h2>
                    <button 
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-2 rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-8 flex flex-col items-center gap-8">
                    
                    {/* Download Sample Button */}
                    <button 
                        onClick={handleDownloadSample}
                        className="flex items-center gap-3 px-6 h-[48px] bg-[#E8F5E9] text-[#0A3622] rounded-[10px] text-[15px] font-bold hover:bg-[#C8E6C9] transition-all shadow-sm w-max"
                    >
                        <Download size={20} />
                        {t('common:download_sample', 'Download Sample')}
                    </button>

                    <div className="w-full h-px bg-[#F3F4F6]" />

                    {/* Upload Section */}
                    <div className="w-full flex flex-col gap-4">
                        <h3 className="text-center font-bold text-[#4B5563]">{t('common:upload_file', 'Upload File')}</h3>
                        
                        <div className="flex flex-col sm:flex-row items-center gap-4 w-full justify-center">
                            <span className="text-[14px] font-medium text-[#6B7280]">{t('common:select_file', 'Select File')}</span>
                            <div className="relative flex items-center w-full max-w-[280px]">
                                <input 
                                    type="file" 
                                    id="modal-import-file"
                                    accept=".xlsx, .xls, .csv" 
                                    className="hidden" 
                                    onChange={handleFileChange}
                                />
                                <div className="flex items-center w-full border border-dashed border-[#D1D5DB] rounded-[8px] bg-[#F9FAFB] overflow-hidden group hover:border-[#0A3622] transition-colors cursor-pointer" onClick={() => document.getElementById('modal-import-file').click()}>
                                    <div className="bg-[#F3F4F6] px-4 h-[42px] flex items-center justify-center border-r border-dashed border-[#D1D5DB] group-hover:border-[#0A3622] transition-colors">
                                        <span className="text-[13px] font-bold text-[#4B5563] whitespace-nowrap">{t('modules:chooseFile')}</span>
                                    </div>
                                    <div className="flex-1 px-4 truncate text-[13px] text-[#6B7280]">
                                        {selectedFile ? selectedFile.name : t('modules:noFileChosen')}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-[#F3F4F6] flex justify-center bg-gray-50 rounded-b-[16px]">
                    <button
                        onClick={handleSubmit}
                        disabled={!selectedFile}
                        className="flex items-center justify-center gap-2 px-10 h-[44px] bg-[#073318] text-white rounded-[10px] text-[15px] font-bold hover:bg-[#04200f] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md"
                    >
                        <UploadCloud size={18} />
                        {t('common:submit', 'Submit')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ImportModal;
