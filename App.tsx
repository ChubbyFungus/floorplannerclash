import React, { useState, useCallback, useRef, useEffect } from 'react';
import ControlPanel from './components/ControlPanel';
import Canvas3D from './components/Canvas3D';
import Loader from './components/Loader';
import { getInitialDesign, askQuestion as askLlmQuestion } from './services/localLlmService';
import { buildFloorplanFromState } from './services/floorplanBuilder';
import { exportToGlb } from './services/exportService'; // New import
import type { ConversationTurn, Choice, StyleTemplate, RoomState, Cmd, Item, FloorplanObject, ObjectType } from './types';
import { Vector3 } from 'three';

type AppState = 'INITIAL' | 'AWAITING_STYLE_CHOICE' | 'GATHERING_INFO' | 'GENERATING' | 'DISPLAYING';

// Helper to create a default state
const createInitialRoomState = (styleTemplateId: string, params: Record<string, unknown> = {}): RoomState => ({
  id: `room-${Date.now()}`,
  version: '1.0',
  styleTemplateId,
  params,
  room: {
    widthIn: 144,
    depthIn: 168,
    heightIn: 96,
    wallThicknessIn: 4.5,
    openings: [],
  },
  items: [],
  seed: `seed-${Date.now()}`,
});

const App: React.FC = () => {
  const [description, setDescription] = useState<string>('A modern kitchen with an island');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);

  const [appState, setAppState] = useState<AppState>('INITIAL');
  const [conversation, setConversation] = useState<ConversationTurn[]>([]);
  const [currentChoices, setCurrentChoices] = useState<Choice[] | null>(null);
  
  const [roomState, setRoomState] = useState<RoomState | null>(null);

  const [isStateLoaded, setIsStateLoaded] = useState(false);
  const [showWorkTriangle, setShowWorkTriangle] = useState<boolean>(true);
  const styleTemplateCache = useRef<Record<string, StyleTemplate>>({});
  const initialDesignDetailsCache = useRef<any>({});

  useEffect(() => {
    fetch('./state.json')
      .then(response => response.json())
      .then(initialState => setDescription(initialState.description || ''))
      .catch(e => console.error("Could not load initial description.", e))
      .finally(() => setIsStateLoaded(true));
  }, []);

  const askNextQuestion = useCallback(async (currentRoomState: RoomState, styleTemplate: StyleTemplate) => {
    const nextParam = Object.keys(styleTemplate.properties).find(key => !(key in currentRoomState.params));

    if (!nextParam) {
      setAppState('GENERATING');
      setLoadingMessage('Building your 3D floor plan...');
      setIsLoading(true);
      try {
        const legacyPrompt = `A ${styleTemplate.style} ${currentRoomState.params.roomType} with a ${currentRoomState.params.primaryColor} and ${currentRoomState.params.accentColor} color scheme.`;
        const generatedPlan = await buildFloorplanFromState(currentRoomState);

        setAppState('DISPLAYING');
      } catch (e: any) {
        setError(e.message || "An unknown error occurred during final generation.");
        setAppState('GATHERING_INFO');
      } finally {
        setIsLoading(false);
        setLoadingMessage('');
      }
      return;
    }

    const question = styleTemplate.questions[nextParam as keyof typeof styleTemplate.questions];
    const choices = styleTemplate.constraints[nextParam as keyof typeof styleTemplate.constraints];
    const expectsFreeFormInput = !Array.isArray(choices);

    const modelResponse = await askLlmQuestion(question, expectsFreeFormInput ? [] : choices.map(c => ({ name: c, description: c, material: c })));
    
    const newModelTurn: ConversationTurn = { 
      role: 'model', 
      text: modelResponse.text, 
      choices: expectsFreeFormInput ? undefined : modelResponse.choices, 
      expectsFreeFormInput 
    };

    setConversation(prev => [...prev, newModelTurn]);
    setCurrentChoices(modelResponse.choices || null);
    setAppState('GATHERING_INFO');
  }, []);

  const processCommand = useCallback((cmd: Cmd) => {
    if (!roomState && cmd.t !== 'set_param') return; // Only set_param can happen before roomState is initialized

    let newRoomState: RoomState = roomState!;

    switch (cmd.t) {
      case 'set_param':
        newRoomState = {
            ...roomState!,
            params: {
                ...roomState!.params,
                [cmd.k]: cmd.v,
            }
        };
        break;
      case 'add_item':
        const newItem: Item = {
          id: `${cmd.sku}-${Date.now()}`,
          sku: cmd.sku,
          anchor: 'floor',
          x: cmd.at.x,
          y: cmd.at.y,
          rotDeg: cmd.rotDeg || 0,
          meta: {},
        };
        newRoomState = { ...roomState!, items: [...roomState!.items, newItem] };
        break;
      case 'move_item':
        newRoomState = {
          ...roomState!,
          items: roomState!.items.map(item => 
            item.id === cmd.id ? { ...item, x: cmd.to.x, y: cmd.to.y } : item
          ),
        };
        break;
      // Other commands like rotate, delete would go here
    }
    
    setRoomState(newRoomState);

    // Continue Q&A loop only if we are in that phase
    if (appState === 'GATHERING_INFO' && cmd.t === 'set_param') {
      const styleTemplate = styleTemplateCache.current[newRoomState.styleTemplateId];
      if (styleTemplate) {
          askNextQuestion(newRoomState, styleTemplate);
      }
    }
  }, [roomState, appState, askNextQuestion]);

  const handleResponse = useCallback(async (response: string) => {
    if (appState === 'AWAITING_STYLE_CHOICE') {
      // When in AWAITING_STYLE_CHOICE, the response is the chosen style name
      await handleStyleChoice(response, {}); // Pass an empty object for initialParams
      return;
    }

    if (!roomState || appState !== 'GATHERING_INFO') return;

    const styleTemplate = styleTemplateCache.current[roomState.styleTemplateId];
    if (!styleTemplate) return setError('Style template not found!');

    const nextParam = Object.keys(styleTemplate.properties).find(key => !(key in roomState.params));
    if (nextParam) {
      const userTurn: ConversationTurn = { role: 'user', text: response };
      setConversation(prev => [...prev, userTurn]);
      processCommand({ t: 'set_param', k: nextParam, v: response });
    }
  }, [appState, roomState, processCommand]);

  const handleStyleChoice = useCallback(async (style: string, initialParams: any) => {
    try {
      const response = await fetch(`./styles/${style.toLowerCase()}.json`);
      if (!response.ok) throw new Error(`Could not load style: ${style}`);
      const template: StyleTemplate = await response.json();
      styleTemplateCache.current[template.id] = template;

      const initialDesignDetails = initialDesignDetailsCache.current || {};
      const newState = createInitialRoomState(template.id || template.style, { ...initialDesignDetails, ...initialParams });
      setRoomState(newState);
      setConversation(prev => [...prev, { role: 'user', text: `Let's go with a ${style} style.`}]);
      await askNextQuestion(newState, template);

    } catch (e: any) {
      setError(e.message);
      setAppState('INITIAL');
    }
  }, [askNextQuestion]);

  const handleStartGeneration = useCallback(async () => {
    if (!description.trim()) return;



    setSelectedObjectId(null);
    setError(null);
    setCurrentChoices(null);
    
    const initialUserMessage: ConversationTurn = { role: 'user', text: description };
    setConversation([initialUserMessage]);
    setAppState('AWAITING_STYLE_CHOICE');
    setIsLoading(true);
    setLoadingMessage('Analyzing your request...');

    try {
      const initialDesign = await getInitialDesign(description); 
      const styleChoices = initialDesign.styleChoices.map(s => ({ name: s, description: `A ${s} style design.`, material: s }));
      
       const modelResponse: ConversationTurn = { role: 'model', text: 'What style would you like for your design?', choices: styleChoices };
       setConversation(prev => [...prev, modelResponse]);
      setCurrentChoices(styleChoices);

       // Store initial design details to be used when style is chosen
       initialDesignDetailsCache.current = {
         roomType: initialDesign.roomType,
         style: initialDesign.style,
         primaryColor: initialDesign.primaryColor,
         accentColor: initialDesign.accentColor,
       };

    } catch (e: any) {
        setError(e.message || "An unknown error occurred.");
        setAppState('INITIAL');
    } finally {
        setIsLoading(false);
        setLoadingMessage('');
    }
  }, [description]);

  const handleObjectChange = useCallback((updatedObject: FloorplanObject) => {
    if (!roomState) return;
    setRoomState(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.map(item =>
          item.id === updatedObject.id ? { ...item, x: updatedObject.position.x * 12, y: updatedObject.position.y * 12 } : item // Assuming x, y are in feet and need to be converted to inches
        ),
      };
    });
  }, [roomState]);

  const handleAddNewObject = useCallback((type: ObjectType) => {
    if (!roomState) return;

    const newItem: Item = {
      id: `${type}-${Date.now()}`,
      sku: type,
      anchor: 'floor',
      x: roomState.room.widthIn / 2, // Default to center of the room
      y: roomState.room.depthIn / 2, // Default to center of the room
      rotDeg: 0,
      meta: {},
    };

    setRoomState(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        items: [...prev.items, newItem],
      };
    });
  }, [roomState]);

  const handleExport = useCallback(async () => {
    if (!roomState) return;
    setIsLoading(true);
    setLoadingMessage('Exporting GLB...');
    try {
        const glbBuffer = await exportToGlb(roomState);
        console.log('GLB Exported:', glbBuffer);
        alert('GLB export initiated. Check console for buffer.');
    } catch (e: any) {
        setError(e.message || 'Failed to export GLB.');
    } finally {
        setIsLoading(false);
        setLoadingMessage('');
    }
  }, [roomState]);



  if (!isStateLoaded) {
    return <Loader message="Initializing app..." />;
  }

  return (
    <div className="flex h-screen bg-gray-900 text-gray-100 font-sans">
      {error && (
        <div 
            className="absolute top-4 right-4 bg-red-500 text-white p-4 rounded-lg shadow-lg z-50 animate-fade-in-down"
            onClick={() => setError(null)}
        >
          <strong>Error:</strong> {error}
        </div>
      )}
      
      {isLoading && <Loader message={loadingMessage} />}
      
      <main className="flex-1 relative">
        <Canvas3D
          roomState={roomState}
          selectedObjectId={selectedObjectId}
          onSelectObject={setSelectedObjectId}
          onObjectChange={handleObjectChange}
          appState={appState}
          choices={currentChoices}
          onChoiceMade={(choice) => handleResponse(choice.name)}
          showWorkTriangle={showWorkTriangle}
        />
      </main>
      <aside className="w-[450px] flex-shrink-0 shadow-2xl bg-gray-900 h-screen overflow-y-auto">
        <ControlPanel
          description={description}
          setDescription={setDescription}
          onGenerate={handleStartGeneration}
          isGenerating={isLoading}
          roomState={roomState}
          selectedObjectId={selectedObjectId}
          onDeselect={() => setSelectedObjectId(null)}
          appState={appState}
          conversation={conversation}
          onSendConversationMessage={handleResponse}
          onChoiceSelected={(choice) => handleResponse(choice.name)}
          showWorkTriangle={showWorkTriangle}
          onToggleWorkTriangle={() => setShowWorkTriangle(p => !p)}
          onModifyFloorplan={() => {}} // To be refactored
          onObjectChange={handleObjectChange}
          onAddNewObject={handleAddNewObject}
          onExport={handleExport} // New prop
        />
      </aside>
    </div>
  );
};

export default App;
