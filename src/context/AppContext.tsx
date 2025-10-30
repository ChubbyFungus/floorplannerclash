import React, { createContext, useContext, useReducer, ReactNode } from 'react';

// ==================== Types ====================
export interface FloorplanElement {
  id: string;
  type: 'room' | 'wall' | 'door' | 'window' | 'furniture';
  x: number;
  y: number;
  width: number;
  height: number;
  properties: Record<string, any>;
}

export interface Floorplan {
  id: string;
  name: string;
  elements: FloorplanElement[];
  rooms: any[];
  lastModified: Date;
}

export interface Message {
  id: string;
  content: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
  type: 'text' | 'image' | 'file';
  metadata?: Record<string, any>;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  floorplanId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AppError {
  id: string;
  message: string;
  type: 'error' | 'warning' | 'info';
  code?: string;
  timestamp: Date;
  details?: Record<string, any>;
}

// ==================== State Interface ====================
export interface AppState {
  // UI State
  isLoading: boolean;
  loadingMessage?: string;
  activeModal: string | null;
  sidebarOpen: boolean;
  theme: 'light' | 'dark';
  currentView: 'floorplan' | 'conversation' | 'settings';
  notifications: Array<{
    id: string;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
    timestamp: Date;
  }>;
  
  // Floorplan State
  currentFloorplan: Floorplan | null;
  floorplans: Floorplan[];
  selectedElements: string[];
  clipboard: FloorplanElement[];
  zoom: number;
  pan: { x: number; y: number };
  gridVisible: boolean;
  snapToGrid: boolean;
  gridSize: number;
  mode: 'select' | 'draw' | 'move' | 'resize';
  
  // Conversation State
  conversations: Conversation[];
  currentConversationId: string | null;
  isTyping: boolean;
  aiResponse: string;
  conversationFilters: {
    searchQuery: string;
    dateRange: { start: Date | null; end: Date | null };
    floorplanFilter: string | null;
  };
  
  // Error State
  errors: AppError[];
  connectionStatus: 'online' | 'offline' | 'reconnecting';
  lastSyncTime: Date | null;
}

// ==================== Action Types ====================
export type AppAction =
  // UI Actions
  | { type: 'SET_LOADING'; payload: { isLoading: boolean; message?: string } }
  | { type: 'OPEN_MODAL'; payload: string }
  | { type: 'CLOSE_MODAL' }
  | { type: 'TOGGLE_SIDEBAR'; payload?: boolean }
  | { type: 'SET_THEME'; payload: 'light' | 'dark' }
  | { type: 'SET_VIEW'; payload: 'floorplan' | 'conversation' | 'settings' }
  | { type: 'ADD_NOTIFICATION'; payload: { message: string; type: 'success' | 'error' | 'warning' | 'info' } }
  | { type: 'REMOVE_NOTIFICATION'; payload: string }
  | { type: 'CLEAR_NOTIFICATIONS' }
  
  // Floorplan Actions
  | { type: 'SET_CURRENT_FLOORPLAN'; payload: Floorplan | null }
  | { type: 'ADD_FLOORPLAN'; payload: Floorplan }
  | { type: 'UPDATE_FLOORPLAN'; payload: { id: string; updates: Partial<Floorplan> } }
  | { type: 'DELETE_FLOORPLAN'; payload: string }
  | { type: 'SET_SELECTED_ELEMENTS'; payload: string[] }
  | { type: 'ADD_TO_CLIPBOARD'; payload: FloorplanElement[] }
  | { type: 'CLEAR_CLIPBOARD' }
  | { type: 'SET_ZOOM'; payload: number }
  | { type: 'SET_PAN'; payload: { x: number; y: number } }
  | { type: 'TOGGLE_GRID'; payload?: boolean }
  | { type: 'TOGGLE_SNAP_TO_GRID'; payload?: boolean }
  | { type: 'SET_GRID_SIZE'; payload: number }
  | { type: 'SET_MODE'; payload: 'select' | 'draw' | 'move' | 'resize' }
  | { type: 'ADD_FLOORPLAN_ELEMENT'; payload: FloorplanElement }
  | { type: 'UPDATE_FLOORPLAN_ELEMENT'; payload: { id: string; updates: Partial<FloorplanElement> } }
  | { type: 'DELETE_FLOORPLAN_ELEMENTS'; payload: string[] }
  
  // Conversation Actions
  | { type: 'SET_CONVERSATIONS'; payload: Conversation[] }
  | { type: 'ADD_CONVERSATION'; payload: Conversation }
  | { type: 'UPDATE_CONVERSATION'; payload: { id: string; updates: Partial<Conversation> } }
  | { type: 'DELETE_CONVERSATION'; payload: string }
  | { type: 'SET_CURRENT_CONVERSATION'; payload: string | null }
  | { type: 'ADD_MESSAGE'; payload: { conversationId: string; message: Message } }
  | { type: 'UPDATE_MESSAGE'; payload: { conversationId: string; messageId: string; updates: Partial<Message> } }
  | { type: 'DELETE_MESSAGE'; payload: { conversationId: string; messageId: string } }
  | { type: 'SET_TYPING'; payload: boolean }
  | { type: 'SET_AI_RESPONSE'; payload: string }
  | { type: 'CLEAR_AI_RESPONSE' }
  | { type: 'SET_CONVERSATION_FILTERS'; payload: Partial<AppState['conversationFilters']> }
  | { type: 'CLEAR_CONVERSATION_FILTERS' }
  
  // Error Actions
  | { type: 'ADD_ERROR'; payload: Omit<AppError, 'id' | 'timestamp'> }
  | { type: 'REMOVE_ERROR'; payload: string }
  | { type: 'CLEAR_ERRORS' }
  | { type: 'SET_CONNECTION_STATUS'; payload: 'online' | 'offline' | 'reconnecting' }
  | { type: 'SET_SYNC_TIME'; payload: Date | null }
  
  // Bulk Actions
  | { type: 'RESET_STATE' }
  | { type: 'INITIALIZE_STATE'; payload: Partial<AppState> };

// ==================== Initial State ====================
const initialState: AppState = {
  // UI State
  isLoading: false,
  activeModal: null,
  sidebarOpen: true,
  theme: 'light',
  currentView: 'floorplan',
  notifications: [],
  
  // Floorplan State
  currentFloorplan: null,
  floorplans: [],
  selectedElements: [],
  clipboard: [],
  zoom: 1,
  pan: { x: 0, y: 0 },
  gridVisible: true,
  snapToGrid: true,
  gridSize: 20,
  mode: 'select',
  
  // Conversation State
  conversations: [],
  currentConversationId: null,
  isTyping: false,
  aiResponse: '',
  conversationFilters: {
    searchQuery: '',
    dateRange: { start: null, end: null },
    floorplanFilter: null,
  },
  
  // Error State
  errors: [],
  connectionStatus: 'online',
  lastSyncTime: null,
};

// ==================== Reducer ====================
function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    // UI Actions
    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload.isLoading,
        loadingMessage: action.payload.message,
      };
    
    case 'OPEN_MODAL':
      return {
        ...state,
        activeModal: action.payload,
      };
    
    case 'CLOSE_MODAL':
      return {
        ...state,
        activeModal: null,
      };
    
    case 'TOGGLE_SIDEBAR':
      return {
        ...state,
        sidebarOpen: action.payload !== undefined ? action.payload : !state.sidebarOpen,
      };
    
    case 'SET_THEME':
      return {
        ...state,
        theme: action.payload,
      };
    
    case 'SET_VIEW':
      return {
        ...state,
        currentView: action.payload,
      };
    
    case 'ADD_NOTIFICATION':
      return {
        ...state,
        notifications: [
          ...state.notifications,
          {
            id: Date.now().toString(),
            message: action.payload.message,
            type: action.payload.type,
            timestamp: new Date(),
          },
        ],
      };
    
    case 'REMOVE_NOTIFICATION':
      return {
        ...state,
        notifications: state.notifications.filter(n => n.id !== action.payload),
      };
    
    case 'CLEAR_NOTIFICATIONS':
      return {
        ...state,
        notifications: [],
      };
    
    // Floorplan Actions
    case 'SET_CURRENT_FLOORPLAN':
      return {
        ...state,
        currentFloorplan: action.payload,
        selectedElements: [],
      };
    
    case 'ADD_FLOORPLAN':
      return {
        ...state,
        floorplans: [...state.floorplans, action.payload],
      };
    
    case 'UPDATE_FLOORPLAN':
      return {
        ...state,
        floorplans: state.floorplans.map(fp =>
          fp.id === action.payload.id
            ? { ...fp, ...action.payload.updates }
            : fp
        ),
        currentFloorplan: state.currentFloorplan?.id === action.payload.id
          ? { ...state.currentFloorplan, ...action.payload.updates }
          : state.currentFloorplan,
      };
    
    case 'DELETE_FLOORPLAN':
      return {
        ...state,
        floorplans: state.floorplans.filter(fp => fp.id !== action.payload),
        currentFloorplan: state.currentFloorplan?.id === action.payload
          ? null
          : state.currentFloorplan,
      };
    
    case 'SET_SELECTED_ELEMENTS':
      return {
        ...state,
        selectedElements: action.payload,
      };
    
    case 'ADD_TO_CLIPBOARD':
      return {
        ...state,
        clipboard: action.payload,
      };
    
    case 'CLEAR_CLIPBOARD':
      return {
        ...state,
        clipboard: [],
      };
    
    case 'SET_ZOOM':
      return {
        ...state,
        zoom: Math.max(0.1, Math.min(5, action.payload)),
      };
    
    case 'SET_PAN':
      return {
        ...state,
        pan: action.payload,
      };
    
    case 'TOGGLE_GRID':
      return {
        ...state,
        gridVisible: action.payload !== undefined ? action.payload : !state.gridVisible,
      };
    
    case 'TOGGLE_SNAP_TO_GRID':
      return {
        ...state,
        snapToGrid: action.payload !== undefined ? action.payload : !state.snapToGrid,
      };
    
    case 'SET_GRID_SIZE':
      return {
        ...state,
        gridSize: Math.max(5, Math.min(100, action.payload)),
      };
    
    case 'SET_MODE':
      return {
        ...state,
        mode: action.payload,
        selectedElements: action.payload === 'select' ? state.selectedElements : [],
      };
    
    case 'ADD_FLOORPLAN_ELEMENT':
      if (!state.currentFloorplan) return state;
      return {
        ...state,
        currentFloorplan: {
          ...state.currentFloorplan,
          elements: [...state.currentFloorplan.elements, action.payload],
          lastModified: new Date(),
        },
      };
    
    case 'UPDATE_FLOORPLAN_ELEMENT':
      if (!state.currentFloorplan) return state;
      return {
        ...state,
        currentFloorplan: {
          ...state.currentFloorplan,
          elements: state.currentFloorplan.elements.map(el =>
            el.id === action.payload.id
              ? { ...el, ...action.payload.updates }
              : el
          ),
          lastModified: new Date(),
        },
      };
    
    case 'DELETE_FLOORPLAN_ELEMENTS':
      if (!state.currentFloorplan) return state;
      return {
        ...state,
        currentFloorplan: {
          ...state.currentFloorplan,
          elements: state.currentFloorplan.elements.filter(
            el => !action.payload.includes(el.id)
          ),
          lastModified: new Date(),
        },
        selectedElements: state.selectedElements.filter(
          id => !action.payload.includes(id)
        ),
      };
    
    // Conversation Actions
    case 'SET_CONVERSATIONS':
      return {
        ...state,
        conversations: action.payload,
      };
    
    case 'ADD_CONVERSATION':
      return {
        ...state,
        conversations: [...state.conversations, action.payload],
      };
    
    case 'UPDATE_CONVERSATION':
      return {
        ...state,
        conversations: state.conversations.map(conv =>
          conv.id === action.payload.id
            ? { ...conv, ...action.payload.updates }
            : conv
        ),
      };
    
    case 'DELETE_CONVERSATION':
      return {
        ...state,
        conversations: state.conversations.filter(conv => conv.id !== action.payload),
        currentConversationId: state.currentConversationId === action.payload
          ? null
          : state.currentConversationId,
      };
    
    case 'SET_CURRENT_CONVERSATION':
      return {
        ...state,
        currentConversationId: action.payload,
      };
    
    case 'ADD_MESSAGE':
      return {
        ...state,
        conversations: state.conversations.map(conv =>
          conv.id === action.payload.conversationId
            ? {
                ...conv,
                messages: [...conv.messages, action.payload.message],
                updatedAt: new Date(),
              }
            : conv
        ),
      };
    
    case 'UPDATE_MESSAGE':
      return {
        ...state,
        conversations: state.conversations.map(conv =>
          conv.id === action.payload.conversationId
            ? {
                ...conv,
                messages: conv.messages.map(msg =>
                  msg.id === action.payload.messageId
                    ? { ...msg, ...action.payload.updates }
                    : msg
                ),
                updatedAt: new Date(),
              }
            : conv
        ),
      };
    
    case 'DELETE_MESSAGE':
      return {
        ...state,
        conversations: state.conversations.map(conv =>
          conv.id === action.payload.conversationId
            ? {
                ...conv,
                messages: conv.messages.filter(msg => msg.id !== action.payload.messageId),
                updatedAt: new Date(),
              }
            : conv
        ),
      };
    
    case 'SET_TYPING':
      return {
        ...state,
        isTyping: action.payload,
      };
    
    case 'SET_AI_RESPONSE':
      return {
        ...state,
        aiResponse: action.payload,
      };
    
    case 'CLEAR_AI_RESPONSE':
      return {
        ...state,
        aiResponse: '',
      };
    
    case 'SET_CONVERSATION_FILTERS':
      return {
        ...state,
        conversationFilters: {
          ...state.conversationFilters,
          ...action.payload,
        },
      };
    
    case 'CLEAR_CONVERSATION_FILTERS':
      return {
        ...state,
        conversationFilters: initialState.conversationFilters,
      };
    
    // Error Actions
    case 'ADD_ERROR':
      return {
        ...state,
        errors: [
          ...state.errors,
          {
            ...action.payload,
            id: Date.now().toString(),
            timestamp: new Date(),
          },
        ],
      };
    
    case 'REMOVE_ERROR':
      return {
        ...state,
        errors: state.errors.filter(err => err.id !== action.payload),
      };
    
    case 'CLEAR_ERRORS':
      return {
        ...state,
        errors: [],
      };
    
    case 'SET_CONNECTION_STATUS':
      return {
        ...state,
        connectionStatus: action.payload,
      };
    
    case 'SET_SYNC_TIME':
      return {
        ...state,
        lastSyncTime: action.payload,
      };
    
    // Bulk Actions
    case 'RESET_STATE':
      return initialState;
    
    case 'INITIALIZE_STATE':
      return {
        ...state,
        ...action.payload,
      };
    
    default:
      return state;
  }
}

// ==================== Context ====================
interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  
  // UI Action Creators
  setLoading: (isLoading: boolean, message?: string) => void;
  openModal: (modalId: string) => void;
  closeModal: () => void;
  toggleSidebar: (open?: boolean) => void;
  setTheme: (theme: 'light' | 'dark') => void;
  setView: (view: 'floorplan' | 'conversation' | 'settings') => void;
  addNotification: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
  
  // Floorplan Action Creators
  setCurrentFloorplan: (floorplan: Floorplan | null) => void;
  addFloorplan: (floorplan: Floorplan) => void;
  updateFloorplan: (id: string, updates: Partial<Floorplan>) => void;
  deleteFloorplan: (id: string) => void;
  setSelectedElements: (elementIds: string[]) => void;
  addToClipboard: (elements: FloorplanElement[]) => void;
  clearClipboard: () => void;
  setZoom: (zoom: number) => void;
  setPan: (pan: { x: number; y: number }) => void;
  toggleGrid: (visible?: boolean) => void;
  toggleSnapToGrid: (enabled?: boolean) => void;
  setGridSize: (size: number) => void;
  setMode: (mode: 'select' | 'draw' | 'move' | 'resize') => void;
  addFloorplanElement: (element: FloorplanElement) => void;
  updateFloorplanElement: (id: string, updates: Partial<FloorplanElement>) => void;
  deleteFloorplanElements: (elementIds: string[]) => void;
  
  // Conversation Action Creators
  setConversations: (conversations: Conversation[]) => void;
  addConversation: (conversation: Conversation) => void;
  updateConversation: (id: string, updates: Partial<Conversation>) => void;
  deleteConversation: (id: string) => void;
  setCurrentConversation: (id: string | null) => void;
  addMessage: (conversationId: string, message: Message) => void;
  updateMessage: (conversationId: string, messageId: string, updates: Partial<Message>) => void;
  deleteMessage: (conversationId: string, messageId: string) => void;
  setTyping: (isTyping: boolean) => void;
  setAiResponse: (response: string) => void;
  clearAiResponse: () => void;
  setConversationFilters: (filters: Partial<AppState['conversationFilters']>) => void;
  clearConversationFilters: () => void;
  
  // Error Action Creators
  addError: (error: Omit<AppError, 'id' | 'timestamp'>) => void;
  removeError: (id: string) => void;
  clearErrors: () => void;
  setConnectionStatus: (status: 'online' | 'offline' | 'reconnecting') => void;
  setSyncTime: (time: Date | null) => void;
  
  // Utility Action Creators
  resetState: () => void;
  initializeState: (initialState: Partial<AppState>) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// ==================== Provider Component ====================
interface AppProviderProps {
  children: ReactNode;
  initialState?: Partial<AppState>;
}

export function AppProvider({ children, initialState }: AppProviderProps) {
  const [state, dispatch] = useReducer(appReducer, {
    ...initialState,
    ...(initialState ? {} : initialState),
  } as AppState);

  // UI Action Creators
  const setLoading = (isLoading: boolean, message?: string) =>
    dispatch({ type: 'SET_LOADING', payload: { isLoading, message } });

  const openModal = (modalId: string) =>
    dispatch({ type: 'OPEN_MODAL', payload: modalId });

  const closeModal = () =>
    dispatch({ type: 'CLOSE_MODAL' });

  const toggleSidebar = (open?: boolean) =>
    dispatch({ type: 'TOGGLE_SIDEBAR', payload: open });

  const setTheme = (theme: 'light' | 'dark') =>
    dispatch({ type: 'SET_THEME', payload: theme });

  const setView = (view: 'floorplan' | 'conversation' | 'settings') =>
    dispatch({ type: 'SET_VIEW', payload: view });

  const addNotification = (message: string, type: 'success' | 'error' | 'warning' | 'info') =>
    dispatch({ type: 'ADD_NOTIFICATION', payload: { message, type } });

  const removeNotification = (id: string) =>
    dispatch({ type: 'REMOVE_NOTIFICATION', payload: id });

  const clearNotifications = () =>
    dispatch({ type: 'CLEAR_NOTIFICATIONS' });

  // Floorplan Action Creators
  const setCurrentFloorplan = (floorplan: Floorplan | null) =>
    dispatch({ type: 'SET_CURRENT_FLOORPLAN', payload: floorplan });

  const addFloorplan = (floorplan: Floorplan) =>
    dispatch({ type: 'ADD_FLOORPLAN', payload: floorplan });

  const updateFloorplan = (id: string, updates: Partial<Floorplan>) =>
    dispatch({ type: 'UPDATE_FLOORPLAN', payload: { id, updates } });

  const deleteFloorplan = (id: string) =>
    dispatch({ type: 'DELETE_FLOORPLAN', payload: id });

  const setSelectedElements = (elementIds: string[]) =>
    dispatch({ type: 'SET_SELECTED_ELEMENTS', payload: elementIds });

  const addToClipboard = (elements: FloorplanElement[]) =>
    dispatch({ type: 'ADD_TO_CLIPBOARD', payload: elements });

  const clearClipboard = () =>
    dispatch({ type: 'CLEAR_CLIPBOARD' });

  const setZoom = (zoom: number) =>
    dispatch({ type: 'SET_ZOOM', payload: zoom });

  const setPan = (pan: { x: number; y: number }) =>
    dispatch({ type: 'SET_PAN', payload: pan });

  const toggleGrid = (visible?: boolean) =>
    dispatch({ type: 'TOGGLE_GRID', payload: visible });

  const toggleSnapToGrid = (enabled?: boolean) =>
    dispatch({ type: 'TOGGLE_SNAP_TO_GRID', payload: enabled });

  const setGridSize = (size: number) =>
    dispatch({ type: 'SET_GRID_SIZE', payload: size });

  const setMode = (mode: 'select' | 'draw' | 'move' | 'resize') =>
    dispatch({ type: 'SET_MODE', payload: mode });

  const addFloorplanElement = (element: FloorplanElement) =>
    dispatch({ type: 'ADD_FLOORPLAN_ELEMENT', payload: element });

  const updateFloorplanElement = (id: string, updates: Partial<FloorplanElement>) =>
    dispatch({ type: 'UPDATE_FLOORPLAN_ELEMENT', payload: { id, updates } });

  const deleteFloorplanElements = (elementIds: string[]) =>
    dispatch({ type: 'DELETE_FLOORPLAN_ELEMENTS', payload: elementIds });

  // Conversation Action Creators
  const setConversations = (conversations: Conversation[]) =>
    dispatch({ type: 'SET_CONVERSATIONS', payload: conversations });

  const addConversation = (conversation: Conversation) =>
    dispatch({ type: 'ADD_CONVERSATION', payload: conversation });

  const updateConversation = (id: string, updates: Partial<Conversation>) =>
    dispatch({ type: 'UPDATE_CONVERSATION', payload: { id, updates } });

  const deleteConversation = (id: string) =>
    dispatch({ type: 'DELETE_CONVERSATION', payload: id });

  const setCurrentConversation = (id: string | null) =>
    dispatch({ type: 'SET_CURRENT_CONVERSATION', payload: id });

  const addMessage = (conversationId: string, message: Message) =>
    dispatch({ type: 'ADD_MESSAGE', payload: { conversationId, message } });

  const updateMessage = (conversationId: string, messageId: string, updates: Partial<Message>) =>
    dispatch({ type: 'UPDATE_MESSAGE', payload: { conversationId, messageId, updates } });

  const deleteMessage = (conversationId: string, messageId: string) =>
    dispatch({ type: 'DELETE_MESSAGE', payload: { conversationId, messageId } });

  const setTyping = (isTyping: boolean) =>
    dispatch({ type: 'SET_TYPING', payload: isTyping });

  const setAiResponse = (response: string) =>
    dispatch({ type: 'SET_AI_RESPONSE', payload: response });

  const clearAiResponse = () =>
    dispatch({ type: 'CLEAR_AI_RESPONSE' });

  const setConversationFilters = (filters: Partial<AppState['conversationFilters']>) =>
    dispatch({ type: 'SET_CONVERSATION_FILTERS', payload: filters });

  const clearConversationFilters = () =>
    dispatch({ type: 'CLEAR_CONVERSATION_FILTERS' });

  // Error Action Creators
  const addError = (error: Omit<AppError, 'id' | 'timestamp'>) =>
    dispatch({ type: 'ADD_ERROR', payload: error });

  const removeError = (id: string) =>
    dispatch({ type: 'REMOVE_ERROR', payload: id });

  const clearErrors = () =>
    dispatch({ type: 'CLEAR_ERRORS' });

  const setConnectionStatus = (status: 'online' | 'offline' | 'reconnecting') =>
    dispatch({ type: 'SET_CONNECTION_STATUS', payload: status });

  const setSyncTime = (time: Date | null) =>
    dispatch({ type: 'SET_SYNC_TIME', payload: time });

  // Utility Action Creators
  const resetState = () =>
    dispatch({ type: 'RESET_STATE' });

  const initializeState = (initialState: Partial<AppState>) =>
    dispatch({ type: 'INITIALIZE_STATE', payload: initialState });

  const contextValue: AppContextType = {
    state,
    dispatch,
    // UI
    setLoading,
    openModal,
    closeModal,
    toggleSidebar,
    setTheme,
    setView,
    addNotification,
    removeNotification,
    clearNotifications,
    // Floorplan
    setCurrentFloorplan,
    addFloorplan,
    updateFloorplan,
    deleteFloorplan,
    setSelectedElements,
    addToClipboard,
    clearClipboard,
    setZoom,
    setPan,
    toggleGrid,
    toggleSnapToGrid,
    setGridSize,
    setMode,
    addFloorplanElement,
    updateFloorplanElement,
    deleteFloorplanElements,
    // Conversation
    setConversations,
    addConversation,
    updateConversation,
    deleteConversation,
    setCurrentConversation,
    addMessage,
    updateMessage,
    deleteMessage,
    setTyping,
    setAiResponse,
    clearAiResponse,
    setConversationFilters,
    clearConversationFilters,
    // Error
    addError,
    removeError,
    clearErrors,
    setConnectionStatus,
    setSyncTime,
    // Utility
    resetState,
    initializeState,
  };

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
}

// ==================== Hook ====================
export function useAppContext() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}

// ==================== Selectors ====================
export function useAppSelector<T>(selector: (state: AppState) => T): T {
  const { state } = useAppContext();
  return selector(state);
}

export function useCurrentFloorplan() {
  return useAppSelector(state => state.currentFloorplan);
}

export function useFloorplans() {
  return useAppSelector(state => state.floorplans);
}

export function useSelectedElements() {
  return useAppSelector(state => state.selectedElements);
}

export function useCurrentConversation() {
  return useAppSelector(state => 
    state.conversations.find(c => c.id === state.currentConversationId) || null
  );
}

export function useConversations() {
  return useAppSelector(state => state.conversations);
}

export function useErrors() {
  return useAppSelector(state => state.errors);
}

export function useIsLoading() {
  return useAppSelector(state => state.isLoading);
}

export function useActiveModal() {
  return useAppSelector(state => state.activeModal);
}

export function useConnectionStatus() {
  return useAppSelector(state => state.connectionStatus);
}

// ==================== Default Export ====================
export default AppContext;