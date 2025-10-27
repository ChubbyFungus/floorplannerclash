import React from 'react';

export type Mode = 'placement' | 'drawing' | 'texturing' | 'cabinetry';

interface ModeToggleProps {
  mode: Mode;
  setMode: (mode: Mode) => void;
  onFinishDrawing: () => void;
  onCancelDrawing: () => void;
  onUndoPoint: () => void;
  isDrawing: boolean;
}

const ModeToggle: React.FC<ModeToggleProps> = ({ mode, setMode, onFinishDrawing, onCancelDrawing, onUndoPoint, isDrawing }) => {

  const baseButtonClass = "px-4 py-2 text-sm font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-cyan-500";
  const activeClass = "bg-cyan-600 text-white";
  const inactiveClass = "bg-gray-700 text-gray-300 hover:bg-gray-600";
  const actionButtonClass = "bg-gray-600 hover:bg-gray-500 text-gray-200";
  const disabledButtonClass = "bg-gray-700 text-gray-500 cursor-not-allowed";

  return (
    <div className="absolute top-4 left-4 z-10 bg-gray-800 bg-opacity-70 backdrop-blur-sm p-2 rounded-lg shadow-lg flex items-center space-x-2">
      <div className="flex rounded-md">
        <button
          onClick={() => setMode('placement')}
          className={`${baseButtonClass} rounded-l-md ${mode === 'placement' ? activeClass : inactiveClass}`}
          disabled={isDrawing}
        >
          Placement
        </button>
        <button
          onClick={() => setMode('drawing')}
          className={`${baseButtonClass} ${mode === 'drawing' ? activeClass : inactiveClass}`}
        >
          Backsplash
        </button>
        <button
          onClick={() => setMode('cabinetry')}
          className={`${baseButtonClass} ${mode === 'cabinetry' ? activeClass : inactiveClass}`}
          disabled={isDrawing}
        >
          Cabinets
        </button>
        <button
          onClick={() => setMode('texturing')}
          className={`${baseButtonClass} rounded-r-md ${mode === 'texturing' ? activeClass : inactiveClass}`}
          disabled={isDrawing}
        >
          Texturing
        </button>
      </div>

      {mode === 'drawing' && isDrawing && (
        <div className="flex items-center space-x-2 border-l border-gray-600 pl-2">
           <button onClick={onUndoPoint} className={`${baseButtonClass} ${actionButtonClass}`}>Undo</button>
           <button onClick={onCancelDrawing} className={`${baseButtonClass} bg-red-700 hover:bg-red-600 text-white`}>Cancel</button>
           <button 
             onClick={onFinishDrawing} 
             className={`${baseButtonClass} ${isDrawing ? 'bg-green-600 hover:bg-green-500 text-white' : disabledButtonClass}`}
             disabled={!isDrawing}
           >
             Finish
           </button>
        </div>
      )}
    </div>
  );
};

export default ModeToggle;
