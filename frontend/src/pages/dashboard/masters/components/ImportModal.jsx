import React, { useState } from 'react';
import { Download, UploadCloud, X, AlertCircle, CheckCircle, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';

const downloadBase64Excel = (base64Data, filename) => {
    try {
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (e) {
        console.error('Error downloading file:', e);
        toast.error('Failed to download report file');
    }
};

const ImportModal = ({ isOpen, onClose, onImport, sampleFileName, sampleHeaders, onDownloadSample }) => {
    const { t } = useTranslation(['common', 'modules']);
    const [selectedFile, setSelectedFile] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [importResult, setImportResult] = useState(null);

    if (!isOpen) return null;

    const handleClose = () => {
        setSelectedFile(null);
        setImportResult(null);
        setIsSubmitting(false);
        onClose();
    };

    const handleDownloadSample = async () => {
        try {
            if (onDownloadSample) {
                await onDownloadSample();
                toast.success(t('common:sample_downloaded', 'Sample downloaded successfully'));
            } else {
                const worksheet = XLSX.utils.aoa_to_sheet([sampleHeaders]);
                const wscols = sampleHeaders.map(() => ({ wch: 20 }));
                worksheet['!cols'] = wscols;
                worksheet['!views'] = [{ state: 'frozen', xSplit: 1, ySplit: 1 }];

                const workbook = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(workbook, worksheet, 'Sample Data');

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
            const fileType = file.name.split('.').pop().toLowerCase();
            if (['xlsx', 'xls', 'csv'].includes(fileType)) {
                setSelectedFile(file);
                setImportResult(null);
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

        setIsSubmitting(true);
        try {
            const result = await onImport(formData);
            if (result && typeof result === 'object') {
                setImportResult(result);
                const summary = result.summary || (result.totalRows !== undefined ? {
                    totalRows: result.totalRows,
                    successful: result.successful,
                    failed: result.failed
                } : null);

                if (summary) {
                    const { totalRows, successful, failed } = summary;
                    if (failed === 0) {
                        toast.success(`Successfully imported all ${successful} record(s)!`);
                    } else if (successful > 0) {
                        toast.success(`Import completed: ${successful} successful, ${failed} failed.`);
                    } else {
                        toast.error(`Import failed: All ${failed} row(s) had errors.`);
                    }
                } else if (result.success !== false) {
                    toast.success(result.message || 'Import completed successfully');
                    handleClose();
                } else if (result.message) {
                    toast.error(result.message);
                }
            } else {
                toast.success('Import completed successfully');
                handleClose();
            }
        } catch (error) {
            console.error('Import error:', error);
            const msg = error.response?.data?.message || error.message || 'Import failed';
            const displayMsg = typeof msg === 'string' ? msg : Array.isArray(msg) ? msg.join(' | ') : 'Import failed';
            toast.error(displayMsg);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-[16px] shadow-2xl w-full max-w-lg mx-4 flex flex-col animate-in slide-in-from-top-4 duration-300 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-[#F3F4F6]">
                    <h2 className="text-[20px] font-bold text-[#111827]">{t('common:import_data', 'Import Data')}</h2>
                    <button 
                        onClick={handleClose}
                        className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-2 rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 flex flex-col items-center gap-6 max-h-[80vh] overflow-y-auto">
                    
                    {/* Download Sample Button */}
                    <button 
                        onClick={handleDownloadSample}
                        className="flex items-center gap-3 px-6 h-[44px] bg-[#E8F5E9] text-[#0A3622] rounded-[10px] text-[14px] font-bold hover:bg-[#C8E6C9] transition-all shadow-sm w-max"
                    >
                        <Download size={18} />
                        {t('common:download_sample', 'Download Sample Template')}
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

                    {/* Import Result Summary Card */}
                    {importResult && (importResult.summary || importResult.totalRows !== undefined) && (() => {
                        const summary = importResult.summary || {
                            totalRows: importResult.totalRows || 0,
                            successful: importResult.successful || 0,
                            failed: importResult.failed || 0
                        };
                        return (
                            <div className="w-full bg-slate-50 border border-slate-200 rounded-[12px] p-4 flex flex-col gap-3">
                                <h4 className="font-bold text-[15px] text-[#111827] flex items-center gap-2">
                                    <FileSpreadsheet size={18} className="text-[#073318]" />
                                    Import Summary Report
                                </h4>
                                <div className="grid grid-cols-3 gap-2 text-center text-xs font-bold uppercase">
                                    <div className="bg-white border rounded-lg p-2">
                                        <span className="text-gray-500 block text-[10px]">Total</span>
                                        <span className="text-sm text-gray-800">{summary.totalRows}</span>
                                    </div>
                                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2">
                                        <span className="text-emerald-600 block text-[10px]">Successful</span>
                                        <span className="text-sm text-emerald-700">{summary.successful}</span>
                                    </div>
                                    <div className="bg-rose-50 border border-rose-200 rounded-lg p-2">
                                        <span className="text-rose-600 block text-[10px]">Failed</span>
                                        <span className="text-sm text-rose-700">{summary.failed}</span>
                                    </div>
                                </div>

                                <div className="flex flex-col sm:flex-row gap-2 mt-2">
                                    {importResult.errorFile && summary.failed > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => downloadBase64Excel(importResult.errorFile, 'Error_Report.xlsx')}
                                            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-[13px] font-bold transition-all shadow-sm"
                                        >
                                            <AlertCircle size={15} /> Download Error Report
                                        </button>
                                    )}
                                    {importResult.successFile && summary.successful > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => downloadBase64Excel(importResult.successFile, 'Success_Report.xlsx')}
                                            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[13px] font-bold transition-all shadow-sm"
                                        >
                                            <CheckCircle size={15} /> Download Success Report
                                        </button>
                                    )}
                                </div>

                                {/* Show first few errors */}
                                {importResult.errors && importResult.errors.length > 0 && (
                                    <div className="max-h-[120px] overflow-y-auto bg-white border border-red-100 rounded-lg p-2.5 text-[12px] space-y-1">
                                        {importResult.errors.slice(0, 5).map((err, idx) => (
                                            <div key={idx} className="text-red-600 flex items-start gap-1.5">
                                                <span className="font-semibold whitespace-nowrap">Row {err.row || idx + 1}:</span>
                                                <span className="break-words">{err.error || (typeof err === 'string' ? err : 'Validation failed')}</span>
                                            </div>
                                        ))}
                                        {importResult.errors.length > 5 && (
                                            <p className="text-gray-400 text-[11px] italic pt-1">
                                                + {importResult.errors.length - 5} more errors (download Error Report Excel to see all).
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })()}

                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-[#F3F4F6] flex justify-center bg-gray-50 rounded-b-[16px]">
                    <button
                        onClick={handleSubmit}
                        disabled={!selectedFile || isSubmitting}
                        className="flex items-center justify-center gap-2 px-10 h-[44px] bg-[#073318] text-white rounded-[10px] text-[15px] font-bold hover:bg-[#04200f] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md"
                    >
                        <UploadCloud size={18} />
                        {isSubmitting ? 'Importing...' : t('common:submit', 'Submit')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ImportModal;
