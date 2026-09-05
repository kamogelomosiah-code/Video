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
                const parsedData = JSON.parse(content) as any[];
                
                if (!Array.isArray(parsedData)) {
                   throw new Error("Invalid JSON format. Expected an array of objects.");
                }

                // Map the simplified JSON format to full MediaItem schema
                const itemsToImport: MediaItem[] = parsedData.map(item => ({
                    id: item.id || `imported-${Math.random().toString(36).substr(2, 9)}`,
                    userId: item.userId || 'admin-user',
                    title: item.title || 'Untitled',
                    description: item.description || '',
                    thumbnailUrl: item.imageUrl || item.thumbnailUrl || '',
                    sourceUrl: item.videoUrl || item.sourceUrl || '',
                    redirectUrl: item.videoUrl || item.redirectUrl || '', // Treat imported videoUrl as a redirect if needed
                    mediaType: item.mediaType || 'video',
                    duration: item.duration || '00:00',
                    views: item.views || 0,
                    creatorName: item.creatorName || 'Imported Content',
                    creatorAvatar: item.creatorAvatar || '',
                    tags: item.tags || [],
                    isPremium: item.isPremium || false,
                    uploadedAt: item.uploadedAt || new Date().toISOString()
                }));

                // Basic validation
                if (itemsToImport.some(item => !item.title)) {
                   throw new Error("Invalid JSON format. Missing title field.");
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
        <div className="max-w-3xl mx-auto p-6 md:p-8 bg-[#111]/50 rounded-2xl mt-4 border border-zinc-800">
            <div className="flex items-center mb-6">
                <DownloadCloud className="w-8 h-8 text-yellow-400 mr-4" />
                <div>
                    <h3 className="text-xl font-bold text-white">Bulk Import & Export</h3>
                    <p className="text-zinc-400 text-sm">Backup or restore video content using JSON files.</p>
                </div>
            </div>
            <div className="space-y-6">
                <div className="bg-black rounded-xl p-6 border border-zinc-800">
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

                 <form onSubmit={handleSubmit} className="bg-black rounded-xl p-6 border border-zinc-800">
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
                        className="flex items-center bg-yellow-500 hover:bg-yellow-600 text-white px-6 py-2 rounded-lg font-bold shadow-lg shadow-yellow-600/20 transition-all text-sm"
                        disabled={loading}
                    >
                        <UploadCloud className="w-4 h-4 mr-2" />
                        {loading ? 'Importing...' : 'Upload & Import JSON'}
                    </button>
                </form>
            </div>
           
            {status && <div className={`mt-6 text-center rounded-xl py-3 px-4 text-sm font-medium ${status.includes('success') ? 'bg-green-900/40 text-green-400 border border-green-700/50' : 'bg-red-900/40 text-yellow-300 border border-yellow-600/50'}`}>{status}</div>}
        </div>
    );
};

export default AdminBulkImport;