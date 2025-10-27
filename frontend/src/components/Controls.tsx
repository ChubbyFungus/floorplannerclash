import React, { useState, useEffect, useRef } from 'react';
import { RoomType } from '../types';

// Web Speech API type declarations
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

interface ControlsProps {
  onCommand: (command: string) => void;
  loading: boolean;
  roomType: RoomType;
  onRoomChange: (roomType: RoomType) => void;
  disabled?: boolean;
}

const Controls: React.FC<ControlsProps> = ({ onCommand, loading, roomType, onRoomChange, disabled }) => {
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  // FIX: A local variable `SpeechRecognition` was shadowing the global `SpeechRecognition` type.
  // The variable is renamed below to `SpeechRecognitionApi` to resolve the type conflict.
  const recognitionRef = useRef<any>(null);

  const SpeechRecognitionApi = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  const isSpeechSupported = !!SpeechRecognitionApi;

  useEffect(() => {
    if (!isSpeechSupported) return;

    const recognition = new SpeechRecognitionApi();
    recognition.continuous = false;
    recognition.lang = 'en-US';
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
    };

    recognition.onresult = (event) => {
      const transcript = event.results[event.results.length - 1][0].transcript.trim();
      onCommand(transcript);
    };

    recognitionRef.current = recognition;
  }, [isSpeechSupported, onCommand]);

  const handleListen = () => {
    if (loading || disabled) return;

    const recognition = recognitionRef.current;
    if (recognition) {
      if (isListening) {
        recognition.stop();
      } else {
        recognition.start();
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !loading && !disabled) {
      onCommand(input);
      setInput('');
    }
  };

  const roomButtonClasses = (type: RoomType) =>
    `px-4 py-2 rounded-md transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-cyan-400 ${
      roomType === type ? 'bg-cyan-500 text-white' : 'bg-gray-600 hover:bg-gray-500'
    }`;

  const iconButtonClass = "p-3 bg-gray-700 text-gray-300 rounded-md hover:bg-gray-600 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors duration-300 flex items-center justify-center";
  const listeningClass = "text-cyan-400 ring-2 ring-cyan-400";


  return (
    <div className="w-full max-w-2xl mx-auto p-4 rounded-lg bg-gray-800 bg-opacity-70 backdrop-blur-sm shadow-lg">
      <div className="flex justify-center space-x-4 mb-4">
        <button onClick={() => onRoomChange(RoomType.Kitchen)} className={roomButtonClasses(RoomType.Kitchen)} disabled={disabled || isListening}>
          Kitchen
        </button>
        <button onClick={() => onRoomChange(RoomType.Bathroom)} className={roomButtonClasses(RoomType.Bathroom)} disabled={disabled || isListening}>
          Bathroom
        </button>
      </div>
      <form onSubmit={handleSubmit} className="flex space-x-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={disabled ? "Switch to Placement mode to use controls" : isListening ? "Listening..." : `e.g., "Add a cabinet against the back wall"`}
          className="flex-1 p-3 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 text-white placeholder-gray-400 disabled:opacity-50"
          disabled={loading || disabled || isListening}
        />
        {isSpeechSupported && (
            <button
                type="button"
                onClick={handleListen}
                disabled={loading || disabled}
                className={`${iconButtonClass} ${isListening ? listeningClass : ''}`}
                aria-label={isListening ? 'Stop listening' : 'Start listening'}
            >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
            </button>
        )}
        <button
          type="submit"
          disabled={loading || disabled || isListening}
          className="px-6 py-3 bg-cyan-600 text-white rounded-md font-semibold hover:bg-cyan-500 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors duration-300 flex items-center justify-center"
        >
          {loading ? (
            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            'Send'
          )}
        </button>
      </form>
    </div>
  );
};

export default Controls;