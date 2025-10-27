import React from 'react';
import { SurfaceType, TextureOption } from '../types';

interface TextureSelectorProps {
  editingSurface: SurfaceType | null;
  textureLibrary: { [key in SurfaceType]: TextureOption[] };
  currentTextures: { [key in SurfaceType]: string };
  onSelect: (surface: SurfaceType, textureId: string) => void;
  onClose: () => void;
}

const TextureSelector: React.FC<TextureSelectorProps> = ({ editingSurface, textureLibrary, currentTextures, onSelect, onClose }) => {
  const title = editingSurface ? `Editing ${editingSurface.charAt(0).toUpperCase() + editingSurface.slice(1)}` : 'Select a Surface';

  return (
    <div className="absolute top-4 right-4 z-20 w-64 bg-gray-800 bg-opacity-80 backdrop-blur-md rounded-lg shadow-2xl text-white">
      <div className="p-3 border-b border-gray-700 flex justify-between items-center">
        <h3 className="font-bold">{title}</h3>
        {editingSurface && (
            <button onClick={onClose} className="text-gray-400 hover:text-white">&times;</button>
        )}
      </div>
      <div className="p-3 max-h-96 overflow-y-auto">
        {editingSurface ? (
          <div className="grid grid-cols-2 gap-2">
            {textureLibrary[editingSurface].map(texture => (
              <div 
                key={texture.id}
                onClick={() => onSelect(editingSurface, texture.id)}
                className={`cursor-pointer rounded-md overflow-hidden border-2 ${currentTextures[editingSurface] === texture.id ? 'border-cyan-400' : 'border-transparent'} hover:border-cyan-400 transition-all`}
              >
                <img src={texture.src} alt={texture.name} className="w-full h-20 object-cover" />
                <p className="text-xs text-center bg-gray-900 bg-opacity-50 p-1 truncate">{texture.name}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400">Click on the floor, a countertop, or a backsplash to see material options.</p>
        )}
      </div>
    </div>
  );
};

export default TextureSelector;