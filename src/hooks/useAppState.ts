import { useState, useEffect, useCallback, useRef } from 'react';

// Types for app state
export interface AppState {
  isLoading: boolean;
  error: string | null;
  isInitialized: boolean;
  currentView: 'upload' | 'view' | 'clash' | 'conversation';
  theme: 'light' | 'dark';
  sidebarOpen: boolean;
}

export interface LoadingState {
  isLoading: boolean;
  loadingMessage: string;
  progress: number;
}

export interface ErrorState {
  error: string | null;
  errorCode: string | null;
  errorDetails: Record<string, any> | null;
}

const initialAppState: AppState = {
  isLoading: false,
  error: null,
  isInitialized: false,
  currentView: 'upload',
  theme: 'light',
  sidebarOpen: true,
};

const initialLoadingState: LoadingState = {
  isLoading: false,
  loadingMessage: '',
  progress: 0,
};

const initialErrorState: ErrorState = {
  error: null,
  errorCode: null,
  errorDetails: null,
};

/**
 * Custom hook for managing application state, loading states, and error handling
 * Extracts all useState logic for app state management from the main component
 */
export const useAppState = () => {
  // Core app state
  const [appState, setAppState] = useState<AppState>(initialAppState);
  const [loadingState, setLoadingState] = useState<LoadingState>(initialLoadingState);
  const [errorState, setErrorState] = useState<ErrorState>(initialErrorState);
  
  // Refs for cleanup
  const errorTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Loading management
  const setLoading = useCallback((isLoading: boolean, message = '', progress = 0) => {
    setLoadingState({
      isLoading,
      loadingMessage: message,
      progress,
    });
    
    // Set app-wide loading state
    setAppState(prev => ({
      ...prev,
      isLoading,
    }));
  }, []);

  const setLoadingProgress = useCallback((progress: number, message?: string) => {
    setLoadingState(prev => ({
      ...prev,
      progress,
      loadingMessage: message || prev.loadingMessage,
    }));
  }, []);

  // Error management
  const setError = useCallback((error: string | null, errorCode?: string, details?: Record<string, any>) => {
    setErrorState({
      error,
      errorCode: errorCode || null,
      errorDetails: details || null,
    });
    
    // Auto-clear error after 5 seconds if it's not critical
    if (error && errorCode !== 'CRITICAL') {
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
      }
      errorTimeoutRef.current = setTimeout(() => {
        setError(null);
      }, 5000);
    }
    
    // Stop loading on error
    if (error) {
      setLoading(false);
    }
  }, [setLoading]);

  const clearError = useCallback(() => {
    setErrorState(initialErrorState);
    if (errorTimeoutRef.current) {
      clearTimeout(errorTimeoutRef.current);
      errorTimeoutRef.current = null;
    }
  }, []);

  // App state management
  const setCurrentView = useCallback((view: AppState['currentView']) => {
    setAppState(prev => ({
      ...prev,
      currentView: view,
    }));
  }, []);

  const toggleSidebar = useCallback(() => {
    setAppState(prev => ({
      ...prev,
      sidebarOpen: !prev.sidebarOpen,
    }));
  }, []);

  const toggleTheme = useCallback(() => {
    setAppState(prev => ({
      ...prev,
      theme: prev.theme === 'light' ? 'dark' : 'light',
    }));
  }, []);

  const resetApp = useCallback(() => {
    setAppState(initialAppState);
    setLoadingState(initialLoadingState);
    setErrorState(initialErrorState);
    
    // Clear any pending timeouts
    if (errorTimeoutRef.current) {
      clearTimeout(errorTimeoutRef.current);
    }
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
    }
  }, []);

  // Initialize app
  const initializeApp = useCallback(async () => {
    try {
      setLoading(true, 'Initializing application...', 0);
      
      // Simulate initialization steps
      await new Promise(resolve => setTimeout(resolve, 1000));
      setLoadingProgress(25, 'Loading configurations...');
      
      await new Promise(resolve => setTimeout(resolve, 800));
      setLoadingProgress(50, 'Setting up 3D engine...');
      
      await new Promise(resolve => setTimeout(resolve, 600));
      setLoadingProgress(75, 'Initializing AI models...');
      
      await new Promise(resolve => setTimeout(resolve, 400));
      setLoadingProgress(100, 'Ready!');
      
      setTimeout(() => {
        setLoading(false);
        setAppState(prev => ({
          ...prev,
          isInitialized: true,
        }));
      }, 500);
      
    } catch (error) {
      setError(
        'Failed to initialize application',
        'INIT_ERROR',
        { originalError: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }, [setLoading, setLoadingProgress, setError]);

  // Batch operations
  const updateAppState = useCallback((updates: Partial<AppState>) => {
    setAppState(prev => ({
      ...prev,
      ...updates,
    }));
  }, []);

  const updateLoadingState = useCallback((updates: Partial<LoadingState>) => {
    setLoadingState(prev => ({
      ...prev,
      ...updates,
    }));
  }, []);

  // Effect for theme persistence
  useEffect(() => {
    const savedTheme = localStorage.getItem('floorplan-theme');
    if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark')) {
      setAppState(prev => ({
        ...prev,
        theme: savedTheme as 'light' | 'dark',
      }));
    }
  }, []);

  // Effect for theme persistence
  useEffect(() => {
    localStorage.setItem('floorplan-theme', appState.theme);
    // Apply theme to document
    document.documentElement.setAttribute('data-theme', appState.theme);
  }, [appState.theme]);

  // Effect for sidebar state persistence
  useEffect(() => {
    localStorage.setItem('floorplan-sidebar-open', appState.sidebarOpen.toString());
  }, [appState.sidebarOpen]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
      }
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    };
  }, []);

  return {
    // State
    appState,
    loadingState,
    errorState,
    
    // Loading actions
    setLoading,
    setLoadingProgress,
    
    // Error actions
    setError,
    clearError,
    
    // App state actions
    setCurrentView,
    toggleSidebar,
    toggleTheme,
    resetApp,
    initializeApp,
    
    // Batch updates
    updateAppState,
    updateLoadingState,
    
    // Computed values
    hasError: !!errorState.error,
    isInitializing: loadingState.isLoading && !appState.isInitialized,
  };
};

export default useAppState;