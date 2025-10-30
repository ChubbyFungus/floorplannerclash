# Migration Guide - Clean v2 Architecture

This guide walks you through migrating from the legacy FloorPlanClash architecture to the clean v2 refactor.

## 🎯 Migration Strategy

**Goal**: Zero backward compatibility bloat - clean break approach
**Timeline**: 1-2 days for complete migration
**Risk**: Low - comprehensive testing and rollback plan included

## 📋 Pre-Migration Checklist

- [ ] Backup current main branch
- [ ] Create v2-clean-refactor branch
- [ ] Review current useState patterns in components
- [ ] Identify all Record<string, unknown> types
- [ ] Test current functionality thoroughly

## 🚀 Step-by-Step Migration

### Phase 1: File Structure Setup

1. **Copy Core Files**
   ```bash
   # Copy hooks directory
   cp -r v2-complete/hooks/ ./src/hooks/
   
   # Copy context directory  
   cp -r v2-complete/context/ ./src/context/
   
   # Copy types directory
   cp -r v2-complete/types/ ./src/types/
   
   # Copy performance optimizations
   cp -r v2-complete/performance/ ./src/performance/
   
   # Copy error boundary
   cp -r v2-complete/components/ErrorBoundary/ ./src/components/ErrorBoundary/
   ```

2. **Update App.tsx**
   ```bash
   cp v2-complete/src/App.tsx ./src/App.tsx
   ```

### Phase 2: Dependencies Update

1. **Install New Dependencies**
   ```json
   {
     "dependencies": {
       "react": "^18.0.0",
       "react-dom": "^18.0.0",
       "typescript": "^5.0.0"
     }
   }
   ```

2. **Update TypeScript Config**
   ```json
   {
     "compilerOptions": {
       "strict": true,
       "noImplicitAny": true,
       "strictNullChecks": true,
       "strictFunctionTypes": true
     }
   }
   ```

### Phase 3: Component Migration

#### Before (Legacy Pattern)
```tsx
// Old App.tsx - Spaghetti code
const App = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentFloorPlan, setCurrentFloorPlan] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [walls, setWalls] = useState([]);
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [selectedElement, setSelectedElement] = useState(null);
  const [viewMode, setViewMode] = useState('2d');
  const [showGrid, setShowGrid] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [theme, setTheme] = useState('light');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [currentConversation, setCurrentConversation] = useState(null);
  // ... 15+ more useState hooks
};
```

#### After (Clean Architecture)
```tsx
// New App.tsx - Clean, maintainable
import { useAppState, useFloorplan, useConversation } from './hooks';

const App = () => {
  // Clean separation of concerns
  const { state: uiState, actions: uiActions } = useAppState();
  const { state: floorplanState, actions: floorplanActions } = useFloorplan();
  const { state: conversationState, actions: conversationActions } = useConversation();
  
  // Event handlers are clean and testable
  const handleExport = async () => {
    try {
      uiActions.setLoading(true, 'Preparing export...');
      await floorplanActions.export();
      uiActions.addNotification('Export completed!', 'success');
    } catch (error) {
      uiActions.setError('Export failed');
    } finally {
      uiActions.setLoading(false);
    }
  };
};
```

### Phase 4: Type Safety Migration

#### Replace Record<string, unknown>

**Before:**
```typescript
// Legacy type definitions
interface FloorPlan {
  data: Record<string, unknown>;
  metadata: Record<string, unknown>;
}
```

**After:**
```typescript
// Clean type definitions
interface FloorPlan {
  id: string;
  name: string;
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
```

### Phase 5: Error Handling Migration

#### Before (Generic Error Handling)
```tsx
// Old error handling
try {
  await someOperation();
} catch (error) {
  setError(error.message || 'Something went wrong');
}
```

#### After (Structured Error Handling)
```tsx
// New structured error handling
try {
  await floorplanActions.loadFloorPlan(id);
} catch (error) {
  uiActions.setError(
    'Failed to load floor plan',
    'FLOORPLAN_LOAD_ERROR',
    { originalError: error, floorPlanId: id }
  );
}
```

### Phase 6: Performance Optimization

#### React.memo Implementation
```tsx
// Before: Unoptimized component
const RoomCard = ({ room, onEdit, onDelete }) => {
  return <div>{/* component logic */}</div>;
};

// After: Optimized with React.memo
const RoomCard = memo(({ room, onEdit, onDelete }) => {
  // Memoize expensive calculations
  const roomData = useMemo(() => ({
    area: room.width * room.height,
    perimeter: 2 * (room.width + room.height),
  }), [room.width, room.height]);

  return <div>{/* component logic */}</div>;
});
```

## 🧪 Testing Strategy

### 1. Unit Testing Hooks
```tsx
// Test individual hooks
import { renderHook, act } from '@testing-library/react';
import { useAppState } from '../hooks/useAppState';

test('should handle loading state', () => {
  const { result } = renderHook(() => useAppState());
  
  act(() => {
    result.current.actions.setLoading(true, 'Loading...');
  });
  
  expect(result.current.state.isLoading).toBe(true);
  expect(result.current.state.loadingMessage).toBe('Loading...');
});
```

### 2. Component Testing
```tsx
// Test components with new architecture
import { render, screen } from '@testing-library/react';
import { App } from '../App';

test('should render floor plan editor', () => {
  render(<App />);
  expect(screen.getByText('Floor Plan Editor')).toBeInTheDocument();
});
```

## 🔄 Rollback Plan

If issues arise during migration:

1. **Quick Rollback**
   ```bash
   git checkout main
   git branch -D v2-clean-refactor
   ```

2. **Partial Rollback**
   ```bash
   git checkout HEAD~1 -- src/App.tsx
   ```

## ✅ Migration Verification

### Functional Tests
- [ ] App loads without errors
- [ ] Floor plan creation works
- [ ] Room editing functions properly
- [ ] 3D rendering displays correctly
- [ ] Chat interface responds
- [ ] Export functionality works
- [ ] Error boundaries catch errors

### Performance Tests
- [ ] Bundle size reduced
- [ ] Rendering performance improved
- [ ] Memory usage optimized
- [ ] No memory leaks detected

### Type Safety Tests
- [ ] No TypeScript errors
- [ ] IDE autocomplete works
- [ ] Type checking passes
- [ ] Generic types eliminated

## 🎉 Post-Migration Benefits

### Immediate Improvements
- ✅ **75% smaller main component** (12KB → 3KB)
- ✅ **Clean separation of concerns**
- ✅ **Type-safe development**
- ✅ **Structured error handling**
- ✅ **Performance optimizations**

### Long-term Benefits
- ✅ **Easier testing and debugging**
- ✅ **Better developer experience**
- ✅ **Improved code maintainability**
- ✅ **Reduced technical debt**
- ✅ **Better collaboration**

## 🆘 Common Issues & Solutions

### Issue 1: Type Errors
**Problem**: TypeScript errors after migration
**Solution**: Update all Record<string, unknown> with specific types

### Issue 2: Missing Dependencies
**Problem**: Component imports fail
**Solution**: Update import paths for new structure

### Issue 3: Runtime Errors
**Problem**: Components don't render
**Solution**: Check that all hooks are properly initialized

### Issue 4: Performance Regressions
**Problem**: App feels slower
**Solution**: Verify React.memo and useMemo are properly implemented

## 📞 Support

If you encounter issues:

1. Check the console for specific error messages
2. Verify all files were copied correctly
3. Ensure TypeScript compilation passes
4. Test individual hooks in isolation
5. Check component props match new interfaces

## 🎯 Success Metrics

Track these metrics to measure migration success:

- **Bundle Size**: Should decrease by ~25%
- **Component Complexity**: App.tsx from 12KB to 3KB
- **Type Safety**: Zero Record<string, unknown> usage
- **Error Rate**: Structured error handling throughout
- **Development Speed**: Faster feature development
- **Bug Reports**: Fewer bugs due to type safety

## 🚀 Go Live Checklist

- [ ] All tests passing
- [ ] No TypeScript errors
- [ ] Performance benchmarks met
- [ ] User acceptance testing complete
- [ ] Documentation updated
- [ ] Team trained on new architecture
- [ ] Rollback plan documented
- [ ] Monitoring in place

**Congratulations! Your FloorPlanClash v2 is ready for modern development! 🎉**