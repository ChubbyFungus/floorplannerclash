import React, { useState, useCallback, useRef, useEffect } from 'react';
import ControlPanel from './components/ControlPanel';
import Canvas3D from './components/Canvas3D';
import Loader from './components/Loader';
import { generateFloorplan, startDesignChat, sendMessageInChat, generateStyleImage, modifyFloorplan, summarizeChoices } from './services/geminiService';
import type { Floorplan, FloorplanObject, ObjectType, ConversationTurn, Choice } from './types';
import type { Chat } from '@google/genai';
import { Vector3 } from 'three';

type AppState = 'INITIAL' | 'CONVERSATION' | 'CHOICE_PREVIEW' | 'GENERATING' | 'DISPLAYING';

const App: React.FC = () => {
  const [description, setDescription] = useState<string>('');
  const [floorplan, setFloorplan] = useState<Floorplan | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);

  const [appState, setAppState] = useState<AppState>('INITIAL');
  const [conversation, setConversation] = useState<ConversationTurn[]>([]);
  const [currentChoices, setCurrentChoices] = useState<Choice[] | null>(null);
  const [isGeneratingImages, setIsGeneratingImages] = useState<boolean>(false);
  const designChatRef = useRef<Chat | null>(null);
  const [designSummary, setDesignSummary] = useState<string | null>(null);
  const finalPromptRef = useRef<string | null>(null);
  const [isStateLoaded, setIsStateLoaded] = useState(false);
  const [showWorkTriangle, setShowWorkTriangle] = useState<boolean>(true);

  useEffect(() => {
    fetch('./state.json')
      .then(response => {
        if (!response.ok) {
          throw new Error(`Could not load state.json: ${response.statusText}`);
        }
        return response.json();
      })
      .then(initialState => {
        setDescription(initialState.description || '');
        // The default state.json has floorplan: null, so no special object hydration is needed.
        // If a user were to add a floorplan with objects to state.json, those objects'
        // position/rotation properties would need to be converted to Vector3 instances here.
        setFloorplan(initialState.floorplan || null);
        setAppState(initialState.appState || 'INITIAL');
        setConversation(initialState.conversation || []);
      })
      .catch(e => {
        console.error("Failed to load or parse state.json:", e);
        setError("Could not load initial state. Starting with a blank slate.");
      })
      .finally(() => {
        setIsStateLoaded(true);
      });
  }, []);
  
  const handleToggleWorkTriangle = useCallback(() => {
    setShowWorkTriangle(prev => !prev);
  }, []);

  const handleFinalPrompt = useCallback(async (text: string) => {
    const finalPrompt = text.replace('FINAL_PROMPT:', '').trim();
    finalPromptRef.current = finalPrompt;

    setAppState('GENERATING');
    setLoadingMessage('Finalizing design choices...');
    setIsLoading(true);
    setDesignSummary(null);

    try {
        const summary = await summarizeChoices(finalPrompt);
        setDesignSummary(summary);
        
        setLoadingMessage('Building your 3D floor plan...');
        const generatedPlan = await generateFloorplan(finalPrompt);
        setFloorplan(generatedPlan);
        setAppState('DISPLAYING');
    } catch (e: any) {
        setError(e.message || "An unknown error occurred during final generation.");
        setAppState('CONVERSATION'); 
    } finally {
        setIsLoading(false);
        setDesignSummary(null);
        finalPromptRef.current = null;
    }
  }, []);
  
  const processModelResponse = useCallback(async (responseText: string) => {
    let text = responseText;
    let choices: Choice[] | undefined = undefined;

    const choiceMarker = 'CHOICES:';
    if (responseText.includes(choiceMarker)) {
        const choiceMarkerIndex = responseText.indexOf(choiceMarker);
        text = responseText.substring(0, choiceMarkerIndex).trim();
        const potentialJsonString = responseText.substring(choiceMarkerIndex + choiceMarker.length);

        const jsonStartIndex = potentialJsonString.indexOf('[');
        const jsonEndIndex = potentialJsonString.lastIndexOf(']');

        if (jsonStartIndex !== -1 && jsonEndIndex > jsonStartIndex) {
            const jsonString = potentialJsonString.substring(jsonStartIndex, jsonEndIndex + 1);
            try {
                choices = JSON.parse(jsonString);
            } catch (e) {
                console.error("Failed to parse choices JSON", e, "Raw string:", jsonString);
                text = responseText; // Revert to full text if JSON is bad
            }
        }
    }

    const newModelMessage: ConversationTurn = { role: 'model', text };
    setConversation(prev => [...prev, newModelMessage]);

    if (choices && choices.every(c => c.material.startsWith('style_'))) {
        setAppState('CHOICE_PREVIEW');
        setIsGeneratingImages(true);
        setCurrentChoices(choices);

        try {
            const imagePromises = choices.map(choice => {
                const styleName = choice.material.replace('style_', '');
                return generateStyleImage(description, styleName);
            });
            const imageUrls = await Promise.all(imagePromises);
            const choicesWithImages = choices.map((choice, index) => ({
                ...choice,
                imageUrl: imageUrls[index],
            }));
            setCurrentChoices(choicesWithImages);
        } catch (e) {
            console.error("Failed to generate style images", e);
            setError("Sorry, I couldn't generate the inspirational images. Please choose based on the text.");
            setCurrentChoices(choices); // Show choices without images as a fallback
        } finally {
            setIsGeneratingImages(false);
        }
    } else if (choices) {
        setCurrentChoices(choices);
        setAppState('CHOICE_PREVIEW');
    }

    if (responseText.startsWith('FINAL_PROMPT:')) {
        await handleFinalPrompt(responseText);
    }
}, [handleFinalPrompt, description]);

  const handleStartGeneration = useCallback(async () => {
    if (!description.trim()) return;

    setFloorplan(null);
    setSelectedObjectId(null);
    setError(null);
    
    const initialUserMessage: ConversationTurn = { role: 'user', text: description };
    setConversation([initialUserMessage]);
    setAppState('CONVERSATION');
    setIsLoading(true);
    setLoadingMessage('Thinking...');

    try {
        designChatRef.current = startDesignChat();
        const responseText = await sendMessageInChat(designChatRef.current, description);
        await processModelResponse(responseText);
    } catch (e: any) {
        setError(e.message || "An unknown error occurred.");
        setAppState('INITIAL');
    } finally {
        setIsLoading(false);
        setLoadingMessage('');
    }
  }, [description, processModelResponse]);

  const handleSendMessage = useCallback(async (message: string) => {
    if (!designChatRef.current || !message.trim()) return;

    const newUserMessage: ConversationTurn = { role: 'user', text: message };
    setConversation(prev => [...prev, newUserMessage]);
    setIsLoading(true);
    setLoadingMessage('Thinking...');

    try {
        const responseText = await sendMessageInChat(designChatRef.current, message);
        await processModelResponse(responseText);
    } catch (e: any) {
        setError(e.message || "An unknown error occurred.");
    } finally {
        setIsLoading(false);
        setLoadingMessage('');
    }
  }, [processModelResponse]);

  const handleChoiceMade = useCallback((choice: Choice) => {
    setCurrentChoices(null);
    setAppState('CONVERSATION');
    handleSendMessage(choice.name);
  }, [handleSendMessage]);

  const handleSelectObject = (id: string | null) => {
    setSelectedObjectId(id);
  };

  const handleObjectChange = (updatedObject: FloorplanObject) => {
    if (floorplan) {
      const newObjects = floorplan.objects.map(obj => 
        obj.id === updatedObject.id ? updatedObject : obj
      );
      setFloorplan({ ...floorplan, objects: newObjects });
    }
  };

  const handleAddNewObject = (type: ObjectType) => {
    if (!floorplan) return;

    const newObject: FloorplanObject = {
        id: `${type}-${Date.now()}`,
        type,
        position: new Vector3(0, 1.5, -floorplan.room.dimensions.depth / 2),
        rotation: new Vector3(0, 0, 0),
        dimensions: { width: 2.5, height: 3, depth: 2 },
        color: '#ffffff',
        material: 'white_laminate',
        countertopMaterial: 'white_marble',
        countertopColor: '#ffffff'
    };

    switch (type) {
        case 'cabinet_wall':
            newObject.position.y = 5.5;
            break;
        case 'dishwasher':
            newObject.material = 'stainless_steel';
            newObject.dimensions.width = 2;
            break;
        case 'vent_hood':
            newObject.position.y = 6.5;
            newObject.material = 'stainless_steel';
            newObject.dimensions = { width: 2.5, height: 2.5, depth: 1.5 };
            break;
        case 'island':
            newObject.dimensions.depth = 3;
            newObject.position.z = 0; // Center it
            break;
        case 'toilet':
        case 'vanity':
        case 'shower':
        case 'bathtub':
            newObject.position.y = newObject.dimensions.height / 2;
            break;
        case 'window':
            newObject.dimensions = { width: 4, height: 3, depth: 0.2 };
            newObject.position.y = 4.5; // Center of window at 4.5ft high
            newObject.material = 'glass';
            break;
        case 'opening':
            newObject.dimensions = { width: 3, height: 7, depth: 0.2 };
            newObject.position.y = 3.5; // Center of opening at 3.5ft high
            newObject.material = 'none';
            break;
        case 'cooktop':
            newObject.dimensions = { width: 2.5, height: 0.1, depth: 2 };
            // Place it on top of a standard 3ft base cabinet
            newObject.position.y = 3 + (0.1 / 2); 
            newObject.material = 'black_glass'; // Not a real material but will fallback to color
            newObject.color = '#111111';
            break;
    }


    setFloorplan({
        ...floorplan,
        objects: [...floorplan.objects, newObject],
    });
    setSelectedObjectId(newObject.id);
  };

  const handleModifyFloorplan = useCallback(async (prompt: string) => {
    if (!floorplan) return;
    setIsLoading(true);
    setLoadingMessage("Updating your floor plan with AI...");
    setError(null);
    try {
        const newPlan = await modifyFloorplan(floorplan, prompt);
        setFloorplan(newPlan);
        setSelectedObjectId(null); // Deselect object after modification
    } catch (e: any) {
        setError(e.message || "An unknown error occurred during modification.");
    } finally {
        setIsLoading(false);
        setLoadingMessage('');
    }
  }, [floorplan]);


  const selectedObject = floorplan?.objects.find(obj => obj.id === selectedObjectId) || null;

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
      
      {(isLoading && appState === 'GENERATING') && <Loader message={loadingMessage} summary={designSummary} finalPrompt={finalPromptRef.current} />}
      
      <main className="flex-1 relative">
        <Canvas3D
          floorplan={floorplan}
          selectedObjectId={selectedObjectId}
          onSelectObject={handleSelectObject}
          onObjectChange={handleObjectChange}
          appState={appState}
          choices={currentChoices}
          onChoiceMade={handleChoiceMade}
          isGeneratingImages={isGeneratingImages}
          showWorkTriangle={showWorkTriangle}
        />
      </main>
      <aside className="w-[450px] flex-shrink-0 shadow-2xl bg-gray-900 h-screen overflow-y-auto">
        <ControlPanel
          description={description}
          setDescription={setDescription}
          onGenerate={handleStartGeneration}
          isGenerating={isLoading}
          floorplan={floorplan}
          selectedObject={selectedObject}
          onObjectChange={handleObjectChange}
          onDeselect={() => setSelectedObjectId(null)}
          onAddNewObject={handleAddNewObject}
          appState={appState}
          conversation={conversation}
          onSendConversationMessage={handleSendMessage}
          onChoiceSelected={handleChoiceMade}
          onModifyFloorplan={handleModifyFloorplan}
          showWorkTriangle={showWorkTriangle}
          onToggleWorkTriangle={handleToggleWorkTriangle}
        />
      </aside>
    </div>
  );
};

export default App;