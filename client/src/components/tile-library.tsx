import { useState } from "react";
import { MdSearch } from "react-icons/md";
import { Input } from "@/components/ui/input";
import { TILE_DEFINITIONS } from "@/lib/workflow-types";
import { 
  MdMic, MdSubtitles, MdVolumeUp, MdContentCut, MdMovie, MdMusicNote,
  MdAutoAwesome, MdLanguage, MdCrop, MdImage, MdVisibility, MdVideoLibrary,
  MdYoutubeSearchedFor, MdSmartToy, MdDescription, MdUpload, MdMovieCreation
} from "react-icons/md";

export default function TileLibrary() {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredTiles = TILE_DEFINITIONS.filter(tile =>
    tile.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tile.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tile.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const groupedTiles = filteredTiles.reduce((acc, tile) => {
    if (!acc[tile.category]) {
      acc[tile.category] = [];
    }
    acc[tile.category].push(tile);
    return acc;
  }, {} as Record<string, typeof TILE_DEFINITIONS>);

  const onDragStart = (event: React.DragEvent, tile: typeof TILE_DEFINITIONS[0]) => {
    event.dataTransfer.setData("application/reactflow", JSON.stringify(tile));
    event.dataTransfer.effectAllowed = "move";
  };

  const getIcon = (iconName: string) => {
    const iconMap: Record<string, any> = {
      'Mic': MdMic,
      'Subtitles': MdSubtitles,
      'Volume2': MdVolumeUp,
      'Scissors': MdContentCut,
      'Film': MdMovie,
      'Music4': MdMusicNote,
      'Sparkles': MdAutoAwesome,
      'Languages': MdLanguage,
      'Crop': MdCrop,
      'Image': MdImage,
      'Eye': MdVisibility,
      'Video': MdVideoLibrary,
      'YouTube': MdYoutubeSearchedFor,
      'SmartToy': MdSmartToy,
      'Description': MdDescription,
      'Upload': MdUpload,
      'MovieCreation': MdMovieCreation,
    };
    
    const IconComponent = iconMap[iconName] || MdVideoLibrary;
    return <IconComponent className="w-4 h-4 text-white" />;
  };

  return (
    <div className="w-80 bg-google-canvas border-r border-gray-200 flex flex-col shadow-sm">
      <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-google-blue/5 to-gemini-green/5">
        <h2 className="text-lg font-google-sans font-medium text-google-text mb-1">Tile Library</h2>
        <p className="text-sm font-roboto text-google-text-secondary">Drag tiles to build your workflow</p>
        <div className="relative mt-3">
          <MdSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            type="text"
            placeholder="Search tiles..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 border-gray-300 focus:border-google-blue focus:ring-google-blue"
          />
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {Object.entries(groupedTiles).map(([category, tiles]) => (
          <div key={category}>
            <div className="tile-category pl-3 py-2 mb-4">
              <h3 className="font-medium text-google-text text-sm uppercase tracking-wide">
                {category}
              </h3>
            </div>
            <div className="space-y-3">
              {tiles.map((tile) => (
                <div
                  key={tile.id}
                  className={`${tile.color} rounded-google p-4 cursor-move hover:shadow-lg transition-all duration-200 border border-white/20 backdrop-blur-sm hover:scale-105`}
                  draggable
                  onDragStart={(e) => onDragStart(e, tile)}
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-white/20 rounded-google flex items-center justify-center backdrop-blur-sm">
                      {getIcon(tile.icon)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-google-sans font-medium text-white text-sm truncate">{tile.name}</h3>
                      <p className="text-white/80 text-xs mt-1 line-clamp-2 font-roboto">{tile.description}</p>
                    </div>
                  </div>
                  {tile.tags.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {tile.tags.slice(0, 2).map((tag, index) => (
                        <span
                          key={index}
                          className="inline-block bg-white/20 text-white text-xs px-2 py-0.5 rounded-google-sm font-roboto"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
