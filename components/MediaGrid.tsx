import React from 'react';
import { MediaItem } from '../types';
import { Play, Lock, Clock } from 'lucide-react';

interface MediaGridProps {
  items: MediaItem[];
  onItemClick: (id: string) => void;
}

const MediaGrid: React.FC<MediaGridProps> = ({ items, onItemClick }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {items.map((item) => (
        <div 
          key={item.id} 
          onClick={() => onItemClick(item.id)}
          className="group relative bg-black rounded-2xl overflow-hidden border border-zinc-900 hover:border-red-600/50 transition-all duration-300 hover:shadow-2xl hover:shadow-red-600/10 cursor-pointer"
        >
          <div className="relative aspect-video overflow-hidden">
            <img 
              src={item.thumbnailUrl} 
              alt={item.title} 
              className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700"
            />
            
            {/* Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-60 group-hover:opacity-40 transition-opacity" />
            
            {/* Premium Lock or Duration */}
            <div className="absolute top-3 right-3 flex items-center space-x-2">
              {item.isPremium && (
                <div className="bg-amber-500/20 backdrop-blur-md border border-amber-500/50 text-amber-500 px-2 py-1 rounded-md text-xs font-bold uppercase tracking-wider flex items-center">
                  <Lock className="w-3 h-3 mr-1" />
                  Premium
                </div>
              )}
              <div className="bg-black/60 backdrop-blur-md px-2 py-1 rounded-md text-xs font-mono text-white">
                {item.duration || '12:45'}
              </div>
            </div>

            {/* Play Button Overlay */}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 transform scale-75 group-hover:scale-100">
               <div className="w-14 h-14 bg-red-600 rounded-full flex items-center justify-center shadow-lg shadow-red-600/40">
                 <Play className="w-6 h-6 text-white ml-1" fill="currentColor" />
               </div>
            </div>
          </div>

          <div className="p-4">
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-semibold text-zinc-200 line-clamp-1 group-hover:text-red-500 transition-colors">
                {item.title}
              </h3>
            </div>
            
            <div className="flex items-center justify-between text-xs text-zinc-500 mb-3">
              <span className="flex items-center">
                <Clock className="w-3 h-3 mr-1" />
                {item.uploadedAt}
              </span>
              <span>{item.views.toLocaleString()} views</span>
            </div>

            <div className="flex items-center pt-3 border-t border-zinc-800/50">
              <img 
                src={item.creatorAvatar} 
                alt={item.creatorName} 
                className="w-6 h-6 rounded-full object-cover mr-2"
              />
              <span className="text-sm text-zinc-400 group-hover:text-zinc-200 transition-colors">
                {item.creatorName}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default MediaGrid;