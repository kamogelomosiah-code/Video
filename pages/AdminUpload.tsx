import React, { useRef, useState } from 'react';
import { UploadCloud, DownloadCloud } from 'lucide-react';
import { store } from '../services/store';
import { MediaItem } from '../types';

const AdminBulkImport: React.FC = () => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [status, setStatus] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    // Download videos JSON export
    const handleDownload = () => {
        const mediaData = store.getMedia().filter(item => item.mediaType === 'video');
        const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(mediaData, null, 2))}`;
        const link = document.createElement('a');
        link.href = jsonString;
        link.download = 'videos-export.json';
        link.click();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatus(null);
        setLoading(true);
        const file = fileInputRef.current?.files?.[0];
        if (!file) {
            setStatus('Please select a JSON file.');
            setLoading(false);
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const content = event.target?.result;
                if (typeof content !== 'string') {
                    throw new Error("Invalid file content");
                }
                const itemsToImport = JSON.parse(content) as MediaItem[];
                
                // Basic validation
                if (!Array.isArray(itemsToImport) || itemsToImport.some(item => !item.id || !item.title)) {
                   throw new Error("Invalid JSON format. Expected an array of media items.");
                }

                store.importMedia(itemsToImport);
                setStatus(`${itemsToImport.length} videos imported successfully!`);
            } catch (err: any) {
                setStatus(err.message || 'Import failed: Invalid JSON file.');
            } finally {
                setLoading(false);
            }
        };
        reader.onerror = () => {
             setStatus('Failed to read the file.');
             setLoading(false);
        };

        reader.readAsText(file);
    };

    return (
        <div className="max-w-3xl mx-auto p-6 md:p-8 bg-zinc-900/50 rounded-2xl mt-4 border border-zinc-800">
            <div className="flex items-center mb-6">
                <DownloadCloud className="w-8 h-8 text-red-500 mr-4" />
                <div>
                    <h3 className="text-xl font-bold text-white">Bulk Import & Export</h3>
                    <p className="text-zinc-400 text-sm">Backup or restore video content using JSON files.</p>
                </div>
            </div>
            <div className="space-y-6">
                <div className="bg-zinc-950 rounded-xl p-6 border border-zinc-800">
                    <h4 className="font-semibold text-white mb-2">Export Video Data</h4>
                    <p className="text-sm text-zinc-500 mb-4">Download a JSON file containing all video records. This can be used as a backup.</p>
                    <button
                        onClick={handleDownload}
                        className="flex items-center bg-zinc-800 hover:bg-zinc-700 text-white px-5 py-2 rounded-lg font-semibold text-sm transition-all"
                        type="button"
                    >
                        <DownloadCloud className="w-4 h-4 mr-2" />
                        Download Videos JSON
                    </button>
                </div>

                 <form onSubmit={handleSubmit} className="bg-zinc-950 rounded-xl p-6 border border-zinc-800">
                    <h4 className="font-semibold text-white mb-2">Import Video Data</h4>
                    <p className="text-sm text-zinc-500 mb-4">Upload a JSON file to add multiple videos. Existing videos with the same ID will be updated.</p>
                    <input
                        type="file"
                        accept="application/json"
                        ref={fileInputRef}
                        className="mb-4 block w-full text-sm text-zinc-400 file:bg-zinc-800 file:text-zinc-200 file:rounded-lg file:border-0 file:px-4 file:py-2 file:mr-4 file:font-semibold file:hover:bg-zinc-700 cursor-pointer"
                    />
                    <button
                        type="submit"
                        className="flex items-center bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-bold shadow-lg shadow-red-700/20 transition-all text-sm"
                        disabled={loading}
                    >
                        <UploadCloud className="w-4 h-4 mr-2" />
                        {loading ? 'Importing...' : 'Upload & Import JSON'}
                    </button>
                </form>
            </div>
           
            {status && <div className={`mt-6 text-center rounded-xl py-3 px-4 text-sm font-medium ${status.includes('success') ? 'bg-green-900/40 text-green-400 border border-green-700/50' : 'bg-red-900/40 text-red-400 border border-red-700/50'}`}>{status}</div>}
        </div>
    );
};

export default AdminBulkImport;