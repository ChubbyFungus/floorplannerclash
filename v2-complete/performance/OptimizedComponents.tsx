/**
 * OptimizedComponents.tsx
 * React.memo wrapped versions of heavy components to prevent unnecessary re-renders
 * These components are optimized for performance in the floor planning application
 */

import React, { memo, useMemo, useCallback, useRef, useEffect } from 'react';
import type { FloorPlan, Room, Wall, Door, Window, ClashResult } from '../../hooks/useFloorplan';

// ============================================================================
// Canvas and 3D Components
// ============================================================================

/**
 * 3D Canvas component for rendering floor plans
 * Optimized to only re-render when floor plan data actually changes
 */
export const Canvas3D = memo<{
  floorPlan: FloorPlan | null;
  viewMode: '2d' | '3d';
  showGrid: boolean;
  showMeasurements: boolean;
  zoomLevel: number;
  selectedElements: string[];
  onElementSelect: (elementId: string) => void;
  onElementUpdate: (elementId: string, updates: any) => void;
}>(({ 
  floorPlan, 
  viewMode, 
  showGrid, 
  showMeasurements, 
  zoomLevel, 
  selectedElements,
  onElementSelect,
  onElementUpdate 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<any>(null);

  // Memoize rendering configuration
  const renderConfig = useMemo(() => ({
    showGrid,
    showMeasurements,
    zoomLevel,
    selectedElements,
    viewMode,
  }), [showGrid, showMeasurements, zoomLevel, selectedElements, viewMode]);

  // Memoize floor plan for 3D conversion
  const floorPlan3D = useMemo(() => {
    if (!floorPlan) return null;
    
    return {
      ...floorPlan,
      // Pre-process data for 3D rendering
      rooms: floorPlan.rooms.map(room => ({
        ...room,
        // Calculate center points for positioning
        center: {
          x: room.coordinates.reduce((sum, coord) => sum + coord.x, 0) / room.coordinates.length,
          y: room.coordinates.reduce((sum, coord) => sum + coord.y, 0) / room.coordinates.length,
        },
      })),
    };
  }, [floorPlan]);

  const handleCanvasClick = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !onElementSelect) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    // Simplified click detection - in real app would use raycasting
    onElementSelect(`element-${Math.floor(Math.random() * 1000)}`);
  }, [onElementSelect]);

  if (viewMode !== '3d') {
    return (
      <div className="canvas-2d-placeholder">
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          style={{ width: '100%', height: '100%' }}
        />
      </div>
    );
  }

  return (
    <div className="canvas-3d-container">
      <canvas
        ref={canvasRef}
        className="canvas-3d"
        onClick={handleCanvasClick}
        style={{ width: '100%', height: '100%' }}
      />
      {/* 3D controls overlay */}
      <div className="canvas-3d-controls">
        <button onClick={() => onElementUpdate('camera', { type: 'reset' })}>
          Reset View
        </button>
        <button onClick={() => onElementUpdate('camera', { type: 'top' })}>
          Top View
        </button>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for Canvas3D
  return (
    prevProps.floorPlan?.id === nextProps.floorPlan?.id &&
    prevProps.floorPlan?.updatedAt === nextProps.floorPlan?.updatedAt &&
    prevProps.viewMode === nextProps.viewMode &&
    prevProps.showGrid === nextProps.showGrid &&
    prevProps.showMeasurements === nextProps.showMeasurements &&
    prevProps.zoomLevel === nextProps.zoomLevel &&
    prevProps.selectedElements.length === nextProps.selectedElements.length
  );
});

Canvas3D.displayName = 'Canvas3D';

// ============================================================================
// Floor Plan Components
// ============================================================================

/**
 * Floor Plan Editor component
 * Optimized to only re-render when floor plan or view settings change
 */
export const FloorPlanEditor = memo<{
  floorPlan: FloorPlan | null;
  viewMode: '2d' | '3d';
  showGrid: boolean;
  snapToGrid: boolean;
  zoomLevel: number;
  selectedElements: string[];
  isEditMode: boolean;
  onFloorPlanUpdate: (updates: Partial<FloorPlan>) => void;
  onElementSelect: (elementId: string, addToSelection?: boolean) => void;
  onElementUpdate: (elementId: string, updates: any) => void;
}>(({
  floorPlan,
  viewMode,
  showGrid,
  snapToGrid,
  zoomLevel,
  selectedElements,
  isEditMode,
  onFloorPlanUpdate,
  onElementSelect,
  onElementUpdate,
}) => {
  const editorContainerRef = useRef<HTMLDivElement>(null);

  // Memoize editor state
  const editorState = useMemo(() => ({
    viewMode,
    showGrid,
    snapToGrid,
    zoomLevel,
    isEditMode,
    hasChanges: false,
  }), [viewMode, showGrid, snapToGrid, zoomLevel, isEditMode]);

  const handleViewportChange = useCallback((changes: Partial<typeof editorState>) => {
    if (editorContainerRef.current) {
      editorContainerRef.current.dispatchEvent(
        new CustomEvent('viewportChange', { detail: changes })
      );
    }
  }, []);

  if (!floorPlan) {
    return (
      <div className="editor-empty-state">
        <p>No floor plan loaded</p>
        <button onClick={() => onFloorPlanUpdate({ name: 'New Floor Plan' })}>
          Create New Floor Plan
        </button>
      </div>
    );
  }

  return (
    <div ref={editorContainerRef} className="floorplan-editor">
      <div className="editor-toolbar">
        <div className="editor-controls">
          <button
            className={viewMode === '2d' ? 'active' : ''}
            onClick={() => handleViewportChange({ viewMode: '2d' })}
          >
            2D View
          </button>
          <button
            className={viewMode === '3d' ? 'active' : ''}
            onClick={() => handleViewportChange({ viewMode: '3d' })}
          >
            3D View
          </button>
        </div>
        <div className="editor-zoom">
          <span>Zoom: {Math.round(zoomLevel * 100)}%</span>
        </div>
      </div>
      
      <div className="editor-canvas-container">
        <Canvas3D
          floorPlan={floorPlan}
          viewMode={viewMode}
          showGrid={showGrid}
          showMeasurements={true}
          zoomLevel={zoomLevel}
          selectedElements={selectedElements}
          onElementSelect={onElementSelect}
          onElementUpdate={onElementUpdate}
        />
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.floorPlan?.id === nextProps.floorPlan?.id &&
    prevProps.floorPlan?.updatedAt === nextProps.floorPlan?.updatedAt &&
    prevProps.viewMode === nextProps.viewMode &&
    prevProps.showGrid === nextProps.showGrid &&
    prevProps.snapToGrid === nextProps.snapToGrid &&
    prevProps.zoomLevel === nextProps.zoomLevel &&
    prevProps.selectedElements.length === nextProps.selectedElements.length &&
    prevProps.isEditMode === nextProps.isEditMode
  );
});

FloorPlanEditor.displayName = 'FloorPlanEditor';

// ============================================================================
// Room Components
// ============================================================================

/**
 * Room List component
 * Optimized to only re-render when rooms actually change
 */
export const RoomList = memo<{
  rooms: Room[];
  selectedRoomIds: string[];
  onRoomSelect: (roomId: string) => void;
  onRoomEdit: (roomId: string) => void;
  onRoomDelete: (roomId: string) => void;
}>(({ rooms, selectedRoomIds, onRoomSelect, onRoomEdit, onRoomDelete }) => {
  // Memoize room list for performance
  const sortedRooms = useMemo(() => {
    return [...rooms].sort((a, b) => a.name.localeCompare(b.name));
  }, [rooms]);

  // Memoize room cards to prevent re-renders
  const roomCards = useMemo(() => {
    return sortedRooms.map(room => {
      const isSelected = selectedRoomIds.includes(room.id);
      
      return (
        <RoomCard
          key={room.id}
          room={room}
          isSelected={isSelected}
          onSelect={() => onRoomSelect(room.id)}
          onEdit={() => onRoomEdit(room.id)}
          onDelete={() => onRoomDelete(room.id)}
        />
      );
    });
  }, [sortedRooms, selectedRoomIds, onRoomSelect, onRoomEdit, onRoomDelete]);

  if (rooms.length === 0) {
    return (
      <div className="room-list-empty">
        <p>No rooms defined yet</p>
      </div>
    );
  }

  return (
    <div className="room-list">
      <h3>Rooms ({rooms.length})</h3>
      <div className="room-cards">
        {roomCards}
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.rooms.length === nextProps.rooms.length &&
    prevProps.rooms.every((room, index) => 
      room.id === nextProps.rooms[index].id &&
      room.name === nextProps.rooms[index].name &&
      room.area === nextProps.rooms[index].area
    ) &&
    prevProps.selectedRoomIds.length === nextProps.selectedRoomIds.length
  );
});

RoomList.displayName = 'RoomList';

/**
 * Individual Room Card component
 */
export const RoomCard = memo<{
  room: Room;
  isSelected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}>(({ room, isSelected, onSelect, onEdit, onDelete }) => {
  // Memoize room display data
  const roomData = useMemo(() => ({
    name: room.name,
    type: room.type,
    area: room.area.toFixed(1),
    perimeter: room.perimeter.toFixed(1),
    hasSpecialFeatures: room.floorMaterial || room.ceilingHeight,
  }), [room.name, room.type, room.area, room.perimeter, room.floorMaterial, room.ceilingHeight]);

  return (
    <div
      className={`room-card ${isSelected ? 'selected' : ''}`}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      <div className="room-card-header">
        <h4 className="room-name">{roomData.name}</h4>
        <div className="room-type">{roomData.type}</div>
      </div>
      
      <div className="room-metrics">
        <div className="metric">
          <span className="metric-label">Area</span>
          <span className="metric-value">{roomData.area} m²</span>
        </div>
        <div className="metric">
          <span className="metric-label">Perimeter</span>
          <span className="metric-value">{roomData.perimeter} m</span>
        </div>
      </div>

      {roomData.hasSpecialFeatures && (
        <div className="room-features">
          {room.floorMaterial && (
            <span className="feature">Floor: {room.floorMaterial}</span>
          )}
          {room.ceilingHeight && (
            <span className="feature">Height: {room.ceilingHeight}m</span>
          )}
        </div>
      )}

      <div className="room-actions">
        <button
          className="btn-edit"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          title="Edit room"
        >
          Edit
        </button>
        <button
          className="btn-delete"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          title="Delete room"
        >
          Delete
        </button>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.room.id === nextProps.room.id &&
    prevProps.room.name === nextProps.room.name &&
    prevProps.room.area === nextProps.room.area &&
    prevProps.room.perimeter === nextProps.room.perimeter &&
    prevProps.room.type === nextProps.room.type &&
    prevProps.room.floorMaterial === nextProps.room.floorMaterial &&
    prevProps.room.ceilingHeight === nextProps.room.ceilingHeight &&
    prevProps.isSelected === nextProps.isSelected
  );
});

RoomCard.displayName = 'RoomCard';

// ============================================================================
// Export all optimized components
// ============================================================================

export default {
  Canvas3D,
  FloorPlanEditor,
  RoomList,
  RoomCard,
};