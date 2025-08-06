import React from 'react';
import { Film } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface BRollAsset {
  keyword: string;
  timestamp: number;
  duration: number;
  description: string;
  assetPath: string;
  assetType: 'image' | 'video';
}

interface BRollCardProps {
  assets: BRollAsset[];
  nodeId: string;
  onPreview?: (asset: BRollAsset) => void;
}

export function BRollCard({ assets, nodeId, onPreview }: BRollCardProps) {
  if (!assets || assets.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <Film className="h-4 w-4 text-indigo-600" />
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Generated B-Roll Assets</span>
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        {assets.map((asset, index) => (
          <Card 
            key={`${nodeId}-${index}`}
            className="overflow-hidden cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02] bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700"
            onClick={() => onPreview?.(asset)}
          >
            <div className="relative">
              {asset.assetType === 'image' ? (
                <img 
                  src={asset.assetPath}
                  alt={asset.description}
                  className="w-full h-32 object-cover"
                />
              ) : (
                <video 
                  src={asset.assetPath}
                  className="w-full h-32 object-cover"
                  muted
                  loop
                  playsInline
                  onMouseEnter={(e) => {
                    e.currentTarget.play().catch(err => {
                      console.log('Video play error:', err);
                    });
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.pause();
                    e.currentTarget.currentTime = 0;
                  }}
                />
              )}
              
              <div className="absolute top-2 right-2 px-2 py-1 rounded bg-black/70 backdrop-blur-sm">
                <span className="text-xs text-white font-medium">
                  {asset.assetType === 'image' ? 'IMG' : 'VID'}
                </span>
              </div>
              
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                <p className="text-xs text-white font-medium truncate">
                  "{asset.keyword}" at {asset.timestamp.toFixed(1)}s
                </p>
              </div>
            </div>
            
            <div className="p-2">
              <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
                {asset.description}
              </p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}