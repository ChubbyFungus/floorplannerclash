import React, { useState, useRef, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { Floorplan, FloorplanObject, ObjectType, ConversationTurn, Choice } from '../types';

interface ConversationViewProps {
    conversation: ConversationTurn[];
    onSendMessage: (message: string) => void;
    isReceiving: boolean;
    appState: 'INITIAL' | 'CONVERSATION' | 'CHOICE_PREVIEW' | 'GENERATING' | 'DISPLAYING';
}

const ConversationView: React.FC<ConversationViewProps> = ({ conversation, onSendMessage, isReceiving, appState }) => {
    const [input, setInput] = useState('');
    const endOfMessagesRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [conversation]);

    const handleSend = () => {
        if (input.trim()) {
            onSendMessage(input);
            setInput('');
        }
    };
    
    const isChoiceMode = appState === 'CHOICE_PREVIEW';

    return (
        <div className="flex flex-col h-full bg-gray-800 rounded-lg p-4">
            <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                {conversation.map((turn, index) => (
                    <div key={index}>
                        <div className={`flex ${turn.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-xs lg:max-w-sm px-4 py-2 rounded-lg break-words ${turn.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-200'}`}>
                               <p className="text-sm">{turn.text}</p>
                            </div>
                        </div>
                    </div>
                ))}
                {isReceiving && appState !== 'GENERATING' && (
                     <div className="flex justify-start">
                        <div className="max-w-xs lg:max-w-sm px-4 py-2 rounded-lg bg-gray-700 text-gray-200">
                           <div className="flex items-center space-x-1">
                                <span className="h-2 w-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                <span className="h-2 w-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                <span className="h-2 w-2 bg-gray-400 rounded-full animate-bounce"></span>
                           </div>
                        </div>
                    </div>
                )}
                <div ref={endOfMessagesRef} />
            </div>
            <div className="mt-4 flex items-center gap-2">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && !isReceiving && !isChoiceMode && handleSend()}
                    placeholder={isReceiving ? "Waiting for response..." : isChoiceMode ? "Select an option in the 3D view" : "Type your answer..."}
                    disabled={isReceiving || isChoiceMode}
                    className="flex-grow bg-gray-700 border-gray-600 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 p-3 text-white placeholder-gray-500 disabled:cursor-not-allowed disabled:opacity-50"
                />
                <button
                    onClick={handleSend}
                    disabled={isReceiving || !input.trim() || isChoiceMode}
                    className="py-3 px-5 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-medium disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors"
                >
                    Send
                </button>
            </div>
        </div>
    );
};


interface ControlPanelProps {
  description: string;
  setDescription: (value: string) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  floorplan: Floorplan | null;
  selectedObject: FloorplanObject | null;
  onObjectChange: (updatedObject: FloorplanObject) => void;
  onDeselect: () => void;
  onAddNewObject: (type: ObjectType) => void;
  appState: 'INITIAL' | 'CONVERSATION' | 'CHOICE_PREVIEW' | 'GENERATING' | 'DISPLAYING';
  conversation: ConversationTurn[];
  onSendConversationMessage: (message: string) => void;
  onChoiceSelected: (choice: Choice) => void;
  onModifyFloorplan: (prompt: string) => void;
  showWorkTriangle: boolean;
  onToggleWorkTriangle: () => void;
}

const AVAILABLE_MATERIALS = [
    { id: 'white_laminate', name: 'White Laminate' },
    { id: 'light_wood', name: 'Light Wood' },
    { id: 'dark_wood', name: 'Dark Wood' },
    { id: 'stainless_steel', name: 'Stainless Steel' },
    { id: 'white_marble', name: 'White Marble' },
    { id: 'black_granite', name: 'Black Granite' },
    { id: 'white_porcelain', name: 'White Porcelain' },
];

const AVAILABLE_OBJECTS: { id: ObjectType, name: string }[] = [
    { id: 'refrigerator', name: 'Refrigerator' },
    { id: 'oven', name: 'Oven' },
    { id: 'sink', name: 'Sink' },
    { id: 'dishwasher', name: 'Dishwasher' },
    { id: 'cooktop', name: 'Cooktop' },
    { id: 'vent_hood', name: 'Vent Hood' },
    { id: 'cabinet_base', name: 'Base Cabinet' },
    { id: 'cabinet_wall', name: 'Wall Cabinet' },
    { id: 'island', name: 'Island' },
    { id: 'toilet', name: 'Toilet' },
    { id: 'vanity', name: 'Vanity' },
    { id: 'shower', name: 'Shower' },
    { id: 'bathtub', name: 'Bathtub' },
    { id: 'window', name: 'Window' },
    { id: 'opening', name: 'Opening' },
];

const WorkTriangleAnalysis: React.FC<{
    floorplan: Floorplan;
    showIn3D: boolean;
    onToggleShowIn3D: () => void;
}> = ({ floorplan, showIn3D, onToggleShowIn3D }) => {
    const analysis = useMemo(() => {
        if (floorplan.room.type !== 'kitchen') return null;

        const sink = floorplan.objects.find(o => o.type === 'sink');
        const refrigerator = floorplan.objects.find(o => o.type === 'refrigerator');
        const cooktop = floorplan.objects.find(o => o.type === 'cooktop') || floorplan.objects.find(o => o.type === 'oven');

        if (!sink || !refrigerator || !cooktop) {
            return {
                isValid: false,
                message: "Missing one or more key appliances (sink, refrigerator, cooktop/oven) to calculate.",
                legs: [],
                total: 0
            };
        }

        const p1 = new THREE.Vector2(sink.position.x, sink.position.z);
        const p2 = new THREE.Vector2(refrigerator.position.x, refrigerator.position.z);
        const p3 = new THREE.Vector2(cooktop.position.x, cooktop.position.z);
        
        const distA = p1.distanceTo(p2);
        const distB = p2.distanceTo(p3);
        const distC = p3.distanceTo(p1);
        const total = distA + distB + distC;

        const legs = [
            { name: "Sink ↔ Fridge", dist: distA },
            { name: "Fridge ↔ Cooktop", dist: distB },
            { name: "Cooktop ↔ Sink", dist: distC },
        ];
        
        const isTotalValid = total > 0 && total <= 26;

        return {
            isValid: isTotalValid,
            message: null,
            legs,
            total,
            isTotalValid,
        };
    }, [floorplan]);

    if (!analysis) return null;

    const StatusIcon: React.FC<{isValid: boolean}> = ({ isValid }) => (
        <span className={`font-bold text-lg ${isValid ? 'text-green-400' : 'text-red-400'}`}>
            {isValid ? '✓' : '✗'}
        </span>
    );
    
    return (
        <div className="p-4 bg-gray-800 rounded-lg">
            <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-blue-400">Work Triangle</h3>
                <div className="flex items-center space-x-2">
                     <span className="text-sm text-gray-400">Show in 3D</span>
                     <button
                        onClick={onToggleShowIn3D}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${showIn3D ? 'bg-blue-600' : 'bg-gray-600'}`}
                        aria-label="Toggle work triangle visibility"
                     >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${showIn3D ? 'translate-x-6' : 'translate-x-1'}`} />
                     </button>
                </div>
            </div>

            {analysis.message ? (
                <p className="text-sm text-gray-400 mt-3">{analysis.message}</p>
            ) : (
                 <ul className="text-sm text-gray-300 mt-3 space-y-2">
                    {analysis.legs.map(leg => (
                         <li key={leg.name} className="flex justify-between items-center">
                             <span>{leg.name}:</span>
                             <span className="font-mono">
                                {leg.dist.toFixed(1)} ft
                            </span>
                         </li>
                    ))}
                    <li className="flex justify-between items-center border-t border-gray-700 pt-2 mt-2">
                         <span className="font-bold">Total Distance:</span>
                         <span className="flex items-center gap-2 font-bold font-mono">
                            {analysis.total.toFixed(1)} ft
                            <StatusIcon isValid={analysis.isTotalValid} />
                        </span>
                    </li>
                    <li className="text-xs text-gray-500 pt-2">
                        Guideline: Total distance should be ≤ 26 ft for efficiency.
                    </li>
                 </ul>
            )}
        </div>
    );
};

const AIModifyPanel: React.FC<{
    onModify: (prompt: string) => void;
    isGenerating: boolean;
}> = ({ onModify, isGenerating }) => {
    const [prompt, setPrompt] = useState('');

    const handleModify = () => {
        if (prompt.trim()) {
            onModify(prompt);
            setPrompt('');
        }
    };

    return (
        <div className="p-4 bg-gray-800 rounded-lg mt-6">
            <h3 className="text-xl font-bold text-blue-400 mb-2">Modify with AI</h3>
            <p className="text-sm text-gray-400 mb-3">Describe a change, and the AI will update the plan.</p>
            <textarea
                rows={3}
                className="w-full bg-gray-700 border-gray-600 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 p-3 text-white placeholder-gray-500"
                placeholder="e.g., 'Make all the cabinets dark wood' or 'add a window on the back wall'"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                disabled={isGenerating}
            />
            <button
                onClick={handleModify}
                disabled={isGenerating || !prompt.trim()}
                className="w-full mt-2 flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors"
            >
                {isGenerating ? 'Applying...' : 'Apply Change'}
            </button>
        </div>
    );
};

const EditPanel: React.FC<{
    selectedObject: FloorplanObject;
    onObjectChange: (updatedObject: FloorplanObject) => void;
    onDeselect: () => void;
}> = ({ selectedObject, onObjectChange, onDeselect }) => {
    
    const handleDimensionChange = (e: React.ChangeEvent<HTMLInputElement>, dimension: keyof FloorplanObject['dimensions']) => {
        const newDimensions = {
            ...selectedObject.dimensions,
            [dimension]: parseFloat(e.target.value) || 0
        };
        onObjectChange({ ...selectedObject, dimensions: newDimensions });
    };

    const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onObjectChange({ ...selectedObject, color: e.target.value });
    };

    const handleCountertopMaterialChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        onObjectChange({ ...selectedObject, countertopMaterial: e.target.value });
    };
    
    const handleMaterialChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        onObjectChange({ ...selectedObject, material: e.target.value });
    };

    const hasCountertop = selectedObject.type === 'cabinet_base' || selectedObject.type === 'island' || selectedObject.type === 'sink' || selectedObject.type === 'vanity';


    return (
        <div className="p-4 bg-gray-800 rounded-lg animate-fade-in">
            <div className="flex justify-between items-center mb-4">
                 <h3 className="text-xl font-bold text-blue-400 capitalize">{selectedObject.type.replace(/_/g, ' ')}</h3>
                 <button onClick={onDeselect} className="text-gray-400 hover:text-white transition">&times;</button>
            </div>
           
            <div className="space-y-4">
                 <div>
                    <label className="block text-sm font-medium text-gray-400">Main Material</label>
                    <select
                        value={selectedObject.material}
                        onChange={handleMaterialChange}
                        className="mt-1 w-full bg-gray-700 border-gray-600 rounded-md shadow-sm p-2 text-white focus:ring-blue-500 focus:border-blue-500"
                    >
                        <option value={selectedObject.material} disabled hidden>{selectedObject.material.replace(/_/g, ' ')}</option>
                        {AVAILABLE_MATERIALS.map(mat => (
                            <option key={mat.id} value={mat.id}>{mat.name}</option>
                        ))}
                    </select>
                </div>
                 {hasCountertop && (
                    <div>
                        <label className="block text-sm font-medium text-gray-400">Countertop Material</label>
                        <select
                            value={selectedObject.countertopMaterial || 'white_marble'}
                            onChange={handleCountertopMaterialChange}
                            className="mt-1 w-full bg-gray-700 border-gray-600 rounded-md shadow-sm p-2 text-white focus:ring-blue-500 focus:border-blue-500"
                        >
                            {AVAILABLE_MATERIALS.map(mat => (
                                <option key={mat.id} value={mat.id}>{mat.name}</option>
                            ))}
                        </select>
                    </div>
                )}
                <div>
                    <label className="block text-sm font-medium text-gray-400">Color Fallback</label>
                    <div className="flex items-center mt-1">
                        <input type="color" value={selectedObject.color} onChange={handleColorChange} className="p-1 h-10 w-14 block bg-gray-700 border-gray-600 rounded-md" />
                        <input type="text" value={selectedObject.color} onChange={handleColorChange} className="ml-2 w-full bg-gray-700 border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-2" />
                    </div>
                </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-400">Dimensions (ft)</label>
                    <div className="grid grid-cols-3 gap-2 mt-1">
                        <input type="number" step="0.1" value={selectedObject.dimensions.width} onChange={(e) => handleDimensionChange(e, 'width')} placeholder="W" className="w-full bg-gray-700 border-gray-600 rounded-md shadow-sm p-2"/>
                        <input type="number" step="0.1" value={selectedObject.dimensions.height} onChange={(e) => handleDimensionChange(e, 'height')} placeholder="H" className="w-full bg-gray-700 border-gray-600 rounded-md shadow-sm p-2"/>
                        <input type="number" step="0.1" value={selectedObject.dimensions.depth} onChange={(e) => handleDimensionChange(e, 'depth')} placeholder="D" className="w-full bg-gray-700 border-gray-600 rounded-md shadow-sm p-2"/>
                    </div>
                </div>
            </div>
             <p className="text-xs text-gray-500 mt-4">Use the gizmo in the 3D view to move the object.</p>
        </div>
    );
};

const ControlPanel: React.FC<ControlPanelProps> = ({ 
    description, setDescription, onGenerate, isGenerating, floorplan, 
    selectedObject, onObjectChange, onDeselect, onAddNewObject, 
    appState, conversation, onSendConversationMessage, onModifyFloorplan,
    showWorkTriangle, onToggleWorkTriangle
}) => {
  
  const showInitialView = appState === 'INITIAL';
  const showConversationView = appState === 'CONVERSATION' || appState === 'GENERATING' || appState === 'CHOICE_PREVIEW';
  const showEditTools = appState === 'DISPLAYING';

  return (
    <div className="w-full max-w-sm flex-shrink-0 p-6 bg-gray-900 overflow-y-auto flex flex-col h-screen">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-white">
          {showInitialView && 'AI Floor Plan'}
          {showConversationView && 'Design Assistant'}
          {showEditTools && 'Edit Plan'}
        </h1>
        <p className="text-gray-400 mt-1">
          {showInitialView && 'Describe your room to start.'}
          {showConversationView && 'Let\'s perfect the details.'}
          {showEditTools && 'Modify your design.'}
        </p>
      </div>

      {showInitialView && (
        <>
          <div className="space-y-2 mt-6">
            <label htmlFor="description" className="block text-sm font-medium text-gray-300">Room Description</label>
            <textarea
              id="description"
              rows={6}
              className="w-full bg-gray-800 border-gray-700 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 p-3 text-white placeholder-gray-500"
              placeholder="e.g., A modern 10x12 ft L-shaped kitchen with white cabinets, a stainless steel fridge, and a center island..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isGenerating}
            />
          </div>
          
          <div className="flex items-center gap-2 mt-4">
            <button
              onClick={onGenerate}
              disabled={isGenerating || !description.trim()}
              className="flex-grow flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors"
            >
              Start Design
            </button>
            <button
                onClick={() => setDescription('14x18 L shaped kitchen with high end materials and appliances. Large center Island black white and grey color scheme rangetop on island with vent overhead')}
                title="Load Dev Preset"
                className="flex-shrink-0 py-3 px-4 bg-yellow-500 hover:bg-yellow-600 rounded-md shadow-sm text-white font-medium text-sm transition-colors"
            >
                Dev
            </button>
          </div>
        </>
      )}

      {showConversationView && (
        <div className="flex-1 min-h-0 mt-6">
          <ConversationView
            conversation={conversation}
            onSendMessage={onSendConversationMessage}
            isReceiving={isGenerating}
            appState={appState}
          />
        </div>
      )}

      {showEditTools && (
        <>
            {floorplan?.room.type === 'kitchen' && (
                <WorkTriangleAnalysis
                    floorplan={floorplan}
                    showIn3D={showWorkTriangle}
                    onToggleShowIn3D={onToggleWorkTriangle}
                />
            )}
            <AIModifyPanel onModify={onModifyFloorplan} isGenerating={isGenerating} />
            
            <div className="border-t border-gray-700 my-6"></div>
            
            {selectedObject ? (
                <EditPanel selectedObject={selectedObject} onObjectChange={onObjectChange} onDeselect={onDeselect} />
            ) : (
                <div className="space-y-3">
                    <h3 className="text-xl font-bold text-white text-center">Object Library</h3>
                    <div className="grid grid-cols-2 gap-2">
                        {AVAILABLE_OBJECTS.map(obj => (
                            <button
                                key={obj.id}
                                onClick={() => onAddNewObject(obj.id)}
                                disabled={!floorplan}
                                className="p-2 text-sm bg-gray-700 hover:bg-gray-600 rounded-md disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors"
                            >
                                {obj.name}
                            </button>
                        ))}
                    </div>
                    <div className="p-4 text-center text-gray-500 mt-4">
                        <p>Select an object in the 3D view to edit its properties.</p>
                    </div>
                </div>
            )}
        </>
      )}
    </div>
  );
};

export default ControlPanel;