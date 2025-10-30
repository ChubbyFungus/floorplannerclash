import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

// Types for floor plan and 3D objects
export interface FloorPlan {
  id: string;
  name: string;
  version: string;
  createdAt: Date;
  updatedAt: Date;
  rooms: Room[];
  walls: Wall[];
  doors: Door[];
  windows: Window[];
  dimensions: {
    width: number;
    height: number;
    scale: number;
  };
  metadata: {
    architect?: string;
    project?: string;
    description?: string;
    tags: string[];
  };
}

export interface Room {
  id: string;
  name: string;
  type: 'bedroom' | 'bathroom' | 'kitchen' | 'living' | 'dining' | 'office' | 'storage' | 'hallway' | 'other';
  area: number;
  perimeter: number;
  coordinates: { x: number; y: number }[];
  floorMaterial?: string;
  ceilingHeight?: number;
  color?: string;
}

export interface Wall {
  id: string;
  startPoint: { x: number; y: number };
  endPoint: { x: number; y: number };
  thickness: number;
  height: number;
  material: string;
  loadBearing: boolean;
}

export interface Door {
  id: string;
  wallId: string;
  position: { x: number; y: number };
  width: number;
  height: number;
  swingDirection: 'left' | 'right' | 'out' | 'in';
  doorType: 'standard' | 'sliding' | 'double' | 'garage';
}

export interface Window {
  id: string;
  wallId: string;
  position: { x: number; y: number };
  width: number;
  height: number;
  sillHeight: number;
  windowType: 'standard' | 'bay' | 'sliding' | 'fixed';
}

export interface ClashResult {
  id: string;
  type: 'door-wall' | 'window-wall' | 'room-overlap' | 'dimension-conflict';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  position: { x: number; y: number; z?: number };
  elements: {
    elementType: string;
    elementId: string;
    name?: string;
  }[];
  suggestions: string[];
  resolved: boolean;
  createdAt: Date;
}

export interface FloorPlan3D {
  scene: any; // Three.js scene
  camera: any; // Three.js camera
  renderer: any; // Three.js renderer
  controls: any; // OrbitControls or similar
}

interface FloorPlanState {
  currentFloorPlan: FloorPlan | null;
  floorPlans: FloorPlan[];
  activeClashes: ClashResult[];
  selectedElements: string[];
  viewMode: '2d' | '3d';
  showGrid: boolean;
  showMeasurements: boolean;
  snapToGrid: boolean;
  zoomLevel: number;
  panOffset: { x: number; y: number };
  isEditMode: boolean;
  hasUnsavedChanges: boolean;
}

const initialFloorPlanState: FloorPlanState = {
  currentFloorPlan: null,
  floorPlans: [],
  activeClashes: [],
  selectedElements: [],
  viewMode: '2d',
  showGrid: true,
  showMeasurements: false,
  snapToGrid: true,
  zoomLevel: 1,
  panOffset: { x: 0, y: 0 },
  isEditMode: false,
  hasUnsavedChanges: false,
};

/**
 * Custom hook for managing floor plan state and 3D object interactions
 * Handles all floor plan operations, 3D rendering, and clash detection
 */
export const useFloorplan = () => {
  const [state, setState] = useState<FloorPlanState>(initialFloorPlanState);
  const [floorPlan3D, setFloorPlan3D] = useState<FloorPlan3D | null>(null);
  
  // Refs for 3D rendering cleanup
  const threeJsCleanupRef = useRef<(() => void) | null>(null);

  // Update state helper
  const updateState = useCallback((updates: Partial<FloorPlanState>) => {
    setState(prev => ({
      ...prev,
      ...updates,
    }));
  }, []);

  // Floor plan management
  const loadFloorPlan = useCallback(async (floorPlanId: string) => {
    try {
      // Simulate API call to load floor plan
      const mockFloorPlan: FloorPlan = {
        id: floorPlanId,
        name: `Floor Plan ${floorPlanId}`,
        version: '1.0',
        createdAt: new Date(),
        updatedAt: new Date(),
        rooms: [
          {
            id: 'room-1',
            name: 'Living Room',
            type: 'living',
            area: 24.5,
            perimeter: 20.0,
            coordinates: [
              { x: 0, y: 0 },
              { x: 5, y: 0 },
              { x: 5, y: 4.9 },
              { x: 0, y: 4.9 },
            ],
            floorMaterial: 'hardwood',
            ceilingHeight: 2.7,
          },
        ],
        walls: [
          {
            id: 'wall-1',
            startPoint: { x: 0, y: 0 },
            endPoint: { x: 5, y: 0 },
            thickness: 0.2,
            height: 2.7,
            material: 'drywall',
            loadBearing: false,
          },
        ],
        doors: [],
        windows: [],
        dimensions: {
          width: 5,
          height: 4.9,
          scale: 1,
        },
        metadata: {
          tags: ['residential', 'living'],
        },
      };

      updateState({
        currentFloorPlan: mockFloorPlan,
        hasUnsavedChanges: false,
      });

      return mockFloorPlan;
    } catch (error) {
      throw new Error(`Failed to load floor plan: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [updateState]);

  const saveFloorPlan = useCallback(async (floorPlan?: FloorPlan) => {
    const planToSave = floorPlan || state.currentFloorPlan;
    if (!planToSave) {
      throw new Error('No floor plan to save');
    }

    try {
      const updatedPlan = {
        ...planToSave,
        updatedAt: new Date(),
      };

      // Simulate API call to save floor plan
      await new Promise(resolve => setTimeout(resolve, 1000));

      updateState(prev => ({
        currentFloorPlan: updatedPlan,
        floorPlans: prev.floorPlans.map(fp => 
          fp.id === updatedPlan.id ? updatedPlan : fp
        ),
        hasUnsavedChanges: false,
      }));

      return updatedPlan;
    } catch (error) {
      throw new Error(`Failed to save floor plan: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [state.currentFloorPlan, updateState]);

  const createNewFloorPlan = useCallback(() => {
    const newPlan: FloorPlan = {
      id: `fp-${Date.now()}`,
      name: 'Untitled Floor Plan',
      version: '1.0',
      createdAt: new Date(),
      updatedAt: new Date(),
      rooms: [],
      walls: [],
      doors: [],
      windows: [],
      dimensions: {
        width: 10,
        height: 8,
        scale: 1,
      },
      metadata: {
        tags: [],
      },
    };

    updateState({
      currentFloorPlan: newPlan,
      floorPlans: [...state.floorPlans, newPlan],
      hasUnsavedChanges: true,
    });

    return newPlan;
  }, [state.floorPlans, updateState]);

  const deleteFloorPlan = useCallback(async (floorPlanId: string) => {
    try {
      // Simulate API call to delete floor plan
      await new Promise(resolve => setTimeout(resolve, 500));

      updateState(prev => ({
        currentFloorPlan: prev.currentFloorPlan?.id === floorPlanId ? null : prev.currentFloorPlan,
        floorPlans: prev.floorPlans.filter(fp => fp.id !== floorPlanId),
        activeClashes: prev.activeClashes.filter(clash => 
          !clash.elements.some(el => el.elementId.includes(floorPlanId))
        ),
      }));
    } catch (error) {
      throw new Error(`Failed to delete floor plan: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [updateState]);

  // Floor plan elements management
  const addRoom = useCallback((room: Omit<Room, 'id'>) => {
    if (!state.currentFloorPlan) return;

    const newRoom: Room = {
      ...room,
      id: `room-${Date.now()}`,
    };

    const updatedPlan = {
      ...state.currentFloorPlan,
      rooms: [...state.currentFloorPlan.rooms, newRoom],
      updatedAt: new Date(),
    };

    updateState({
      currentFloorPlan: updatedPlan,
      hasUnsavedChanges: true,
    });

    return newRoom;
  }, [state.currentFloorPlan, updateState]);

  const updateRoom = useCallback((roomId: string, updates: Partial<Room>) => {
    if (!state.currentFloorPlan) return;

    const updatedPlan = {
      ...state.currentFloorPlan,
      rooms: state.currentFloorPlan.rooms.map(room =>
        room.id === roomId ? { ...room, ...updates } : room
      ),
      updatedAt: new Date(),
    };

    updateState({
      currentFloorPlan: updatedPlan,
      hasUnsavedChanges: true,
    });
  }, [state.currentFloorPlan, updateState]);

  const deleteRoom = useCallback((roomId: string) => {
    if (!state.currentFloorPlan) return;

    const updatedPlan = {
      ...state.currentFloorPlan,
      rooms: state.currentFloorPlan.rooms.filter(room => room.id !== roomId),
      updatedAt: new Date(),
    };

    updateState({
      currentFloorPlan: updatedPlan,
      hasUnsavedChanges: true,
    });
  }, [state.currentFloorPlan, updateState]);

  // Clash detection and management
  const detectClashes = useCallback(async () => {
    if (!state.currentFloorPlan) return [];

    try {
      // Simulate clash detection algorithm
      await new Promise(resolve => setTimeout(resolve, 2000));

      const mockClashes: ClashResult[] = [
        {
          id: `clash-${Date.now()}`,
          type: 'room-overlap',
          severity: 'medium',
          description: 'Two rooms overlap in the same space',
          position: { x: 2.5, y: 2.5 },
          elements: [
            { elementType: 'room', elementId: 'room-1', name: 'Living Room' },
            { elementType: 'room', elementId: 'room-2', name: 'Dining Room' },
          ],
          suggestions: [
            'Adjust room boundaries to eliminate overlap',
            'Combine rooms into a single larger space',
            'Relocate one room to prevent collision',
          ],
          resolved: false,
          createdAt: new Date(),
        },
      ];

      updateState({
        activeClashes: mockClashes,
      });

      return mockClashes;
    } catch (error) {
      throw new Error(`Failed to detect clashes: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [state.currentFloorPlan, updateState]);

  const resolveClash = useCallback((clashId: string) => {
    updateState(prev => ({
      activeClashes: prev.activeClashes.map(clash =>
        clash.id === clashId ? { ...clash, resolved: true } : clash
      ),
    }));
  }, [updateState]);

  const ignoreClash = useCallback((clashId: string) => {
    updateState(prev => ({
      activeClashes: prev.activeClashes.filter(clash => clash.id !== clashId),
    }));
  }, [updateState]);

  // View management
  const setViewMode = useCallback((mode: '2d' | '3d') => {
    updateState({ viewMode: mode });
  }, [updateState]);

  const toggleGrid = useCallback(() => {
    updateState(prev => ({ showGrid: !prev.showGrid }));
  }, [updateState]);

  const toggleMeasurements = useCallback(() => {
    updateState(prev => ({ showMeasurements: !prev.showMeasurements }));
  }, [updateState]);

  const toggleEditMode = useCallback(() => {
    updateState(prev => ({ isEditMode: !prev.isEditMode }));
  }, [updateState]);

  const setZoomLevel = useCallback((zoom: number) => {
    updateState({ zoomLevel: Math.max(0.1, Math.min(5, zoom)) });
  }, [updateState]);

  const setPanOffset = useCallback((offset: { x: number; y: number }) => {
    updateState({ panOffset: offset });
  }, [updateState]);

  // Selection management
  const selectElement = useCallback((elementId: string, addToSelection = false) => {
    updateState(prev => ({
      selectedElements: addToSelection
        ? [...prev.selectedElements, elementId]
        : [elementId],
    }));
  }, [updateState]);

  const clearSelection = useCallback(() => {
    updateState({ selectedElements: [] });
  }, [updateState]);

  const selectMultipleElements = useCallback((elementIds: string[]) => {
    updateState({ selectedElements: elementIds });
  }, [updateState]);

  // 3D rendering management
  const initialize3DScene = useCallback(() => {
    // This would typically initialize Three.js scene
    // For now, we'll create a mock 3D object
    const mock3D: FloorPlan3D = {
      scene: { /* Three.js scene object */ },
      camera: { /* Three.js camera object */ },
      renderer: { /* Three.js renderer object */ },
      controls: { /* OrbitControls object */ },
    };

    setFloorPlan3D(mock3D);
  }, []);

  const cleanup3DScene = useCallback(() => {
    if (threeJsCleanupRef.current) {
      threeJsCleanupRef.current();
      threeJsCleanupRef.current = null;
    }
    setFloorPlan3D(null);
  }, []);

  const render3D = useCallback(() => {
    // This would handle 3D rendering
    if (floorPlan3D && state.currentFloorPlan) {
      // Update 3D scene with current floor plan data
      console.log('Rendering 3D scene with floor plan:', state.currentFloorPlan.name);
    }
  }, [floorPlan3D, state.currentFloorPlan]);

  // Snap to grid functionality
  const snapToGrid = useCallback((value: number, gridSize = 0.1) => {
    return Math.round(value / gridSize) * gridSize;
  }, []);

  // Validation helpers
  const validateFloorPlan = useCallback((floorPlan: FloorPlan) => {
    const errors: string[] = [];

    // Basic validation
    if (!floorPlan.name?.trim()) {
      errors.push('Floor plan name is required');
    }

    if (floorPlan.rooms.length === 0) {
      errors.push('At least one room is required');
    }

    // Check for duplicate room names
    const roomNames = floorPlan.rooms.map(room => room.name);
    const uniqueRoomNames = new Set(roomNames);
    if (roomNames.length !== uniqueRoomNames.size) {
      errors.push('Room names must be unique');
    }

    // Check room areas are positive
    floorPlan.rooms.forEach(room => {
      if (room.area <= 0) {
        errors.push(`Room "${room.name}" must have a positive area`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
    };
  }, []);

  // Computed values
  const totalRooms = state.currentFloorPlan?.rooms.length || 0;
  const totalArea = state.currentFloorPlan?.rooms.reduce((sum, room) => sum + room.area, 0) || 0;
  const unresolvedClashes = state.activeClashes.filter(clash => !clash.resolved);
  const criticalClashes = unresolvedClashes.filter(clash => clash.severity === 'critical');

  // Effect for auto-save
  useEffect(() => {
    if (state.hasUnsavedChanges && state.currentFloorPlan) {
      const autoSaveTimer = setTimeout(() => {
        saveFloorPlan().catch(error => {
          console.error('Auto-save failed:', error);
        });
      }, 30000); // Auto-save after 30 seconds of inactivity

      return () => clearTimeout(autoSaveTimer);
    }
  }, [state.hasUnsavedChanges, state.currentFloorPlan, saveFloorPlan]);

  // Effect for 3D scene cleanup
  useEffect(() => {
    return () => {
      cleanup3DScene();
    };
  }, [cleanup3DScene]);

  return {
    // State
    ...state,
    floorPlan3D,

    // Floor plan management
    loadFloorPlan,
    saveFloorPlan,
    createNewFloorPlan,
    deleteFloorPlan,

    // Floor plan elements
    addRoom,
    updateRoom,
    deleteRoom,

    // Clash detection
    detectClashes,
    resolveClash,
    ignoreClash,

    // View management
    setViewMode,
    toggleGrid,
    toggleMeasurements,
    toggleEditMode,
    setZoomLevel,
    setPanOffset,

    // Selection management
    selectElement,
    clearSelection,
    selectMultipleElements,

    // 3D rendering
    initialize3DScene,
    cleanup3DScene,
    render3D,

    // Utilities
    snapToGrid,
    validateFloorPlan,

    // Computed values
    totalRooms,
    totalArea,
    unresolvedClashes,
    criticalClashes,

    // State updates
    updateState,
  };
};

export default useFloorplan;