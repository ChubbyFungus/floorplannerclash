import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

// Types for conversation and LLM interactions
export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  type?: 'text' | 'image' | 'file' | 'action';
  metadata?: {
    floorPlanId?: string;
    roomId?: string;
    suggestions?: string[];
    actions?: ConversationAction[];
    confidence?: number;
    model?: string;
    tokens?: number;
  };
}

export interface ConversationAction {
  type: 'create_room' | 'delete_room' | 'modify_room' | 'add_door' | 'add_window' | 'detect_clash' | 'generate_report';
  payload: Record<string, any>;
  label: string;
  icon?: string;
}

export interface ConversationContext {
  currentFloorPlanId?: string;
  selectedRoomId?: string;
  activeView: string;
  userPreferences: {
    language: string;
    detailLevel: 'simple' | 'detailed' | 'technical';
    explanationStyle: 'casual' | 'professional' | 'educational';
  };
  conversationHistory: string[];
  constraints: string[];
}

export interface LLMResponse {
  message: string;
  actions?: ConversationAction[];
  suggestions?: string[];
  confidence: number;
  reasoning?: string;
  followUpQuestions?: string[];
}

export interface ConversationState {
  messages: ConversationMessage[];
  isProcessing: boolean;
  currentInput: string;
  context: ConversationContext;
  conversationId: string;
  isTyping: boolean;
  typingMessage?: string;
  suggestedActions: ConversationAction[];
  userMood: 'neutral' | 'frustrated' | 'excited' | 'confused' | 'satisfied';
  conversationStage: 'greeting' | 'exploration' | 'editing' | 'review' | 'completion';
}

const initialConversationState: ConversationState = {
  messages: [],
  isProcessing: false,
  currentInput: '',
  context: {
    activeView: 'upload',
    userPreferences: {
      language: 'en',
      detailLevel: 'detailed',
      explanationStyle: 'professional',
    },
    conversationHistory: [],
    constraints: [],
  },
  conversationId: `conv-${Date.now()}`,
  isTyping: false,
  suggestedActions: [],
  userMood: 'neutral',
  conversationStage: 'greeting',
};

const welcomeMessage: ConversationMessage = {
  id: 'welcome-msg',
  role: 'assistant',
  content: "Hello! I'm your AI assistant for floor plan design and clash detection. I can help you create, modify, and analyze your floor plans. What would you like to work on today?",
  timestamp: new Date(),
  type: 'text',
  metadata: {
    model: 'floorplan-assistant-v1',
  },
};

/**
 * Custom hook for managing conversation flow and LLM interactions
 * Handles chat interface, AI responses, and conversation context
 */
export const useConversation = () => {
  const [state, setState] = useState<ConversationState>(initialConversationState);
  const [error, setError] = useState<string | null>(null);
  
  // Refs for cleanup and management
  const messageIdCounter = useRef(0);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const conversationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Helper function to generate unique message IDs
  const generateMessageId = useCallback(() => {
    messageIdCounter.current += 1;
    return `msg-${Date.now()}-${messageIdCounter.current}`;
  }, []);

  // Update state helper
  const updateState = useCallback((updates: Partial<ConversationState>) => {
    setState(prev => ({
      ...prev,
      ...updates,
    }));
  }, []);

  // Initialize conversation with welcome message
  useEffect(() => {
    updateState({
      messages: [welcomeMessage],
      conversationStage: 'greeting',
    });
  }, [updateState]);

  // Send message to LLM
  const sendMessage = useCallback(async (content: string, options?: {
    context?: Partial<ConversationContext>;
    includeHistory?: boolean;
    stream?: boolean;
  }) => {
    if (!content.trim()) return;

    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();

    try {
      // Add user message
      const userMessage: ConversationMessage = {
        id: generateMessageId(),
        role: 'user',
        content: content.trim(),
        timestamp: new Date(),
        type: 'text',
      };

      updateState(prev => ({
        messages: [...prev.messages, userMessage],
        currentInput: '',
        isProcessing: true,
        userMood: 'neutral',
        context: {
          ...prev.context,
          ...options?.context,
          conversationHistory: [
            ...prev.context.conversationHistory.slice(-9), // Keep last 10 messages
            content,
          ],
        },
      }));

      // Show typing indicator
      setState(prev => ({ ...prev, isTyping: true, typingMessage: 'AI is thinking...' }));

      // Simulate LLM processing
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Generate mock response based on input
      const response = await generateMockLLMResponse(content, state.context);

      // Simulate typing effect
      await simulateTypingEffect(response.message);

      // Create assistant message
      const assistantMessage: ConversationMessage = {
        id: generateMessageId(),
        role: 'assistant',
        content: response.message,
        timestamp: new Date(),
        type: 'text',
        metadata: {
          suggestions: response.suggestions,
          actions: response.actions,
          confidence: response.confidence,
          model: 'floorplan-assistant-v2',
          tokens: Math.floor(Math.random() * 200) + 100,
        },
      };

      // Update conversation stage based on context
      const newStage = determineConversationStage(content, state.context);

      setState(prev => ({
        ...prev,
        messages: [...prev.messages, assistantMessage],
        isProcessing: false,
        isTyping: false,
        typingMessage: undefined,
        suggestedActions: response.actions || [],
        userMood: determineUserMood(content),
        conversationStage: newStage,
      }));

      // Clear any existing timeout and set new one
      if (conversationTimeoutRef.current) {
        clearTimeout(conversationTimeoutRef.current);
      }

      // Set conversation timeout (auto-end after 30 minutes of inactivity)
      conversationTimeoutRef.current = setTimeout(() => {
        endConversation('Session timed out due to inactivity');
      }, 30 * 60 * 1000);

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return; // Request was cancelled
      }

      const errorMessage = error instanceof Error ? error.message : 'Failed to process message';
      setError(errorMessage);

      setState(prev => ({
        ...prev,
        isProcessing: false,
        isTyping: false,
        typingMessage: undefined,
        userMood: 'frustrated',
      }));

      // Auto-clear error after 5 seconds
      setTimeout(() => setError(null), 5000);
    }
  }, [state.context, generateMessageId, updateState]);

  // Generate mock LLM responses (in real implementation, this would call an actual LLM API)
  const generateMockLLMResponse = async (
    input: string,
    context: ConversationContext
  ): Promise<LLMResponse> => {
    const lowerInput = input.toLowerCase();

    if (lowerInput.includes('hello') || lowerInput.includes('hi')) {
      return {
        message: "Hello! I'm here to help you with your floor plan design. I can assist you with room creation, door and window placement, clash detection, and generating reports. What would you like to work on?",
        suggestions: [
          "Create a new room",
          "Detect clashes",
          "Generate a report",
          "Show me my floor plan"
        ],
        confidence: 0.95,
        reasoning: "User is greeting the assistant",
      };
    }

    if (lowerInput.includes('room') || lowerInput.includes('create') || lowerInput.includes('add')) {
      return {
        message: "I'd be happy to help you create a room! I can assist with room layout, dimensions, and ensure proper building standards. What type of room would you like to create, and do you have any specific requirements for size or location?",
        actions: [
          {
            type: 'create_room',
            payload: { roomType: 'living' },
            label: 'Create Living Room',
            icon: 'home',
          },
          {
            type: 'create_room',
            payload: { roomType: 'bedroom' },
            label: 'Create Bedroom',
            icon: 'bed',
          },
          {
            type: 'create_room',
            payload: { roomType: 'kitchen' },
            label: 'Create Kitchen',
            icon: 'utensils',
          },
        ],
        suggestions: [
          "Create a living room",
          "Create a bedroom",
          "Create a kitchen",
          "Set room dimensions"
        ],
        confidence: 0.88,
        reasoning: "User wants to create or modify rooms",
      };
    }

    if (lowerInput.includes('clash') || lowerInput.includes('conflict') || lowerInput.includes('error')) {
      return {
        message: "I can help you identify and resolve conflicts in your floor plan. Let me run a comprehensive clash detection analysis to find any overlapping elements, improper spacing, or building code violations.",
        actions: [
          {
            type: 'detect_clash',
            payload: { analysisType: 'comprehensive' },
            label: 'Run Clash Detection',
            icon: 'search',
          },
        ],
        suggestions: [
          "Run clash detection",
          "View current conflicts",
          "Show building code violations",
          "Auto-resolve conflicts"
        ],
        confidence: 0.92,
        reasoning: "User is asking about conflicts or clashes",
      };
    }

    if (lowerInput.includes('report') || lowerInput.includes('export') || lowerInput.includes('summary')) {
      return {
        message: "I can generate a comprehensive report of your floor plan including room areas, door/window specifications, potential issues, and compliance with building codes. What type of report would you prefer?",
        actions: [
          {
            type: 'generate_report',
            payload: { reportType: 'summary' },
            label: 'Generate Summary Report',
            icon: 'file-text',
          },
          {
            type: 'generate_report',
            payload: { reportType: 'detailed' },
            label: 'Generate Detailed Report',
            icon: 'file-documentation',
          },
        ],
        suggestions: [
          "Generate summary report",
          "Generate detailed report",
          "Export as PDF",
          "Export as CAD file"
        ],
        confidence: 0.85,
        reasoning: "User wants to generate a report",
      };
    }

    // Default response
    return {
      message: "I understand you're asking about floor plan design. I can help with room creation, clash detection, material specifications, and generating reports. Could you please be more specific about what you'd like to do?",
      suggestions: [
        "Help me create a room",
        "Check for conflicts",
        "Generate a report",
        "Show current floor plan"
      ],
      confidence: 0.70,
      reasoning: "Default response for unclear input",
    };
  };

  // Simulate typing effect for better UX
  const simulateTypingEffect = async (message: string) => {
    const words = message.split(' ');
    const typingSpeed = 30; // milliseconds per word

    for (let i = 0; i <= words.length; i++) {
      const partialMessage = words.slice(0, i).join(' ');
      setState(prev => ({
        ...prev,
        typingMessage: partialMessage + (i < words.length ? '...' : ''),
      }));

      await new Promise(resolve => setTimeout(resolve, typingSpeed));
    }
  };

  // Determine conversation stage based on context
  const determineConversationStage = (
    input: string,
    context: ConversationContext
  ): ConversationState['conversationStage'] => {
    const lowerInput = input.toLowerCase();

    if (lowerInput.includes('hello') || lowerInput.includes('hi')) {
      return 'greeting';
    }

    if (lowerInput.includes('create') || lowerInput.includes('add') || lowerInput.includes('modify')) {
      return 'editing';
    }

    if (lowerInput.includes('clash') || lowerInput.includes('error') || lowerInput.includes('problem')) {
      return 'review';
    }

    if (lowerInput.includes('report') || lowerInput.includes('done') || lowerInput.includes('finish')) {
      return 'completion';
    }

    return 'exploration';
  };

  // Determine user mood based on input
  const determineUserMood = (input: string): ConversationState['userMood'] => {
    const lowerInput = input.toLowerCase();

    if (lowerInput.includes('frustrated') || lowerInput.includes('annoying') || lowerInput.includes('hate')) {
      return 'frustrated';
    }

    if (lowerInput.includes('love') || lowerInput.includes('great') || lowerInput.includes('awesome')) {
      return 'excited';
    }

    if (lowerInput.includes('confused') || lowerInput.includes('don\'t understand') || lowerInput.includes('help')) {
      return 'confused';
    }

    if (lowerInput.includes('good') || lowerInput.includes('perfect') || lowerInput.includes('thanks')) {
      return 'satisfied';
    }

    return 'neutral';
  };

  // Execute suggested action
  const executeAction = useCallback(async (action: ConversationAction) => {
    try {
      updateState(prev => ({ isProcessing: true }));

      // Simulate action execution
      await new Promise(resolve => setTimeout(resolve, 1000));

      const resultMessage: ConversationMessage = {
        id: generateMessageId(),
        role: 'assistant',
        content: `I've successfully ${action.label.toLowerCase()}. What would you like to do next?`,
        timestamp: new Date(),
        type: 'action',
        metadata: {
          actions: [action],
        },
      };

      updateState(prev => ({
        messages: [...prev.messages, resultMessage],
        isProcessing: false,
        suggestedActions: prev.suggestedActions.filter(a => a !== action),
      }));

    } catch (error) {
      setError(`Failed to execute action: ${error instanceof Error ? error.message : 'Unknown error'}`);
      updateState(prev => ({ isProcessing: false }));
    }
  }, [generateMessageId, updateState]);

  // Update conversation context
  const updateContext = useCallback((updates: Partial<ConversationContext>) => {
    updateState(prev => ({
      context: {
        ...prev.context,
        ...updates,
      },
    }));
  }, [updateState]);

  // Clear conversation
  const clearConversation = useCallback(() => {
    updateState({
      messages: [welcomeMessage],
      currentInput: '',
      suggestedActions: [],
      userMood: 'neutral',
      conversationStage: 'greeting',
      conversationId: `conv-${Date.now()}`,
    });
  }, [updateState]);

  // End conversation
  const endConversation = useCallback((reason?: string) => {
    const endMessage: ConversationMessage = {
      id: generateMessageId(),
      role: 'assistant',
      content: reason || "Thank you for using the floor plan assistant. Feel free to ask questions anytime!",
      timestamp: new Date(),
      type: 'text',
    };

    updateState(prev => ({
      ...prev,
      messages: [...prev.messages, endMessage],
      isProcessing: false,
      isTyping: false,
    }));
  }, [generateMessageId, updateState]);

  // Retry last failed message
  const retryLastMessage = useCallback(async () => {
    const lastUserMessage = state.messages
      .filter(msg => msg.role === 'user')
      .pop();

    if (lastUserMessage) {
      await sendMessage(lastUserMessage.content);
    }
  }, [state.messages, sendMessage]);

  // Load conversation history
  const loadConversation = useCallback((conversationId: string) => {
    // In a real implementation, this would load from a database
    console.log(`Loading conversation: ${conversationId}`);
  }, []);

  // Save conversation
  const saveConversation = useCallback(async () => {
    try {
      // In a real implementation, this would save to a database
      console.log('Saving conversation:', state.conversationId);
      return true;
    } catch (error) {
      setError('Failed to save conversation');
      return false;
    }
  }, [state.conversationId]);

  // Computed values
  const messageCount = state.messages.length;
  const userMessageCount = state.messages.filter(msg => msg.role === 'user').length;
  const assistantMessageCount = state.messages.filter(msg => msg.role === 'assistant').length;
  const averageResponseTime = useMemo(() => {
    const userMessages = state.messages.filter(msg => msg.role === 'user');
    let totalTime = 0;
    let responseCount = 0;

    for (let i = 0; i < userMessages.length - 1; i++) {
      const currentUserMsg = userMessages[i];
      const nextAssistantMsg = state.messages.find(msg => 
        msg.timestamp > currentUserMsg.timestamp && msg.role === 'assistant'
      );

      if (nextAssistantMsg) {
        totalTime += nextAssistantMsg.timestamp.getTime() - currentUserMsg.timestamp.getTime();
        responseCount++;
      }
    }

    return responseCount > 0 ? totalTime / responseCount / 1000 : 0; // in seconds
  }, [state.messages]);

  const hasRecentActivity = useMemo(() => {
    const lastMessage = state.messages[state.messages.length - 1];
    if (!lastMessage) return false;
    return Date.now() - lastMessage.timestamp.getTime() < 5 * 60 * 1000; // 5 minutes
  }, [state.messages]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (conversationTimeoutRef.current) {
        clearTimeout(conversationTimeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    // State
    ...state,
    error,

    // Actions
    sendMessage,
    executeAction,
    updateContext,
    clearConversation,
    endConversation,
    retryLastMessage,
    loadConversation,
    saveConversation,

    // Utilities
    generateMessageId,

    // Computed values
    messageCount,
    userMessageCount,
    assistantMessageCount,
    averageResponseTime,
    hasRecentActivity,
  };
};

export default useConversation;