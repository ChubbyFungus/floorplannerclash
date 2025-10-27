# Canvas JSON Structure with 3D Dimensions

## **📐 Enhanced JSON Format**

The canvas AI now supports **exact 3D size dimensions** for all objects. When loading JSON data, the canvas will automatically resize objects to match the specified dimensions.

### **📋 Complete Structure Example**

```json
{
  "meta": {
    "room_type": "kitchen",
    "unit": "meters",
    "ceiling_height": 2.5,
    "total_area": 11.4,
    "created_at": "2024-01-15T10:30:00Z"
  },
  "floorplan": {
    "walls": [
      {
        "id": "wall-1",
        "start": [-1.9, -1.5],
        "end": [1.9, -1.5],
        "thickness": 0.15,
        "height": 2.5
      },
      {
        "id": "wall-2",
        "start": [1.9, -1.5],
        "end": [1.9, 1.5],
        "thickness": 0.15,
        "height": 2.5
      },
      {
        "id": "wall-3",
        "start": [1.9, 1.5],
        "end": [-1.9, 1.5],
        "thickness": 0.15,
        "height": 2.5
      },
      {
        "id": "wall-4",
        "start": [-1.9, 1.5],
        "end": [-1.9, -1.5],
        "thickness": 0.15,
        "height": 2.5
      }
    ],
    "rooms": [
      {
        "id": "room-1",
        "name": "Kitchen",
        "walls": ["wall-1", "wall-2", "wall-3", "wall-4"],
        "position": [0, 0],
        "color": "#f5f5dc"
      }
    ],
    "openings": [
      {
        "id": "door-1",
        "type": "doorway",
        "wall_id": "wall-1",
        "position": [0, -1.5],
        "width": 0.9,
        "height": 2.1
      }
    ]
  },
  "scene": {
    "items": [
      {
        "id": "refrigerator-1",
        "name": "refrigerator",
        "category": "appliance",
        "position": [-1.4, 1.2, 0.02],
        "rotation": 0,
        "size": {
          "width": 0.6,
          "height": 1.7,
          "depth": 0.65
        }
      },
      {
        "id": "stove-1",
        "name": "stove",
        "category": "appliance", 
        "position": [1.2, -1.2, 0.9],
        "rotation": 0,
        "size": {
          "width": 0.6,
          "height": 0.85,
          "depth": 0.6
        }
      },
      {
        "id": "cabinet-1",
        "name": "cabinet",
        "category": "storage",
        "position": [0, 1.3, 0.05],
        "rotation": 180,
        "size": {
          "width": 0.8,
          "height": 0.9,
          "depth": 0.6
        }
      },
      {
        "id": "sink-1", 
        "name": "sink",
        "category": "fixture",
        "position": [-0.8, 1.3, 0.9],
        "rotation": 180,
        "size": {
          "width": 0.7,
          "height": 0.2,
          "depth": 0.5
        }
      }
    ]
  }
}
```

## **🔧 Object Size Specification**

### **Required Size Fields**
```json
{
  "size": {
    "width": 0.6,   // X-axis dimension in meters
    "height": 1.7,  // Y-axis dimension in meters  
    "depth": 0.65   // Z-axis dimension in meters
  }
}
```

### **Alternative Names (Both Supported)**
```json
// Option 1: "size"
"size": { "width": 0.6, "height": 1.7, "depth": 0.65 }

// Option 2: "dimensions" 
"dimensions": { "width": 0.6, "height": 1.7, "depth": 0.65 }
```

## **📏 Dimension Guidelines by Category**

### **🍳 Kitchen Appliances**
```json
{
  "refrigerator": { "width": 0.6, "height": 1.7, "depth": 0.65 },
  "stove": { "width": 0.6, "height": 0.85, "depth": 0.6 },
  "microwave": { "width": 0.5, "height": 0.3, "depth": 0.4 },
  "dishwasher": { "width": 0.6, "height": 0.85, "depth": 0.6 }
}
```

### **🪑 Furniture**
```json
{
  "dining_table": { "width": 1.2, "height": 0.75, "depth": 0.8 },
  "chair": { "width": 0.45, "height": 0.8, "depth": 0.5 },
  "sofa": { "width": 2.0, "height": 0.85, "depth": 0.9 },
  "coffee_table": { "width": 1.0, "height": 0.4, "depth": 0.6 }
}
```

### **🗄️ Storage**
```json
{
  "cabinet": { "width": 0.8, "height": 0.9, "depth": 0.6 },
  "bookshelf": { "width": 0.8, "height": 1.8, "depth": 0.3 },
  "dresser": { "width": 1.2, "height": 0.8, "depth": 0.5 },
  "wardrobe": { "width": 1.0, "height": 2.0, "depth": 0.6 }
}
```

### **🚿 Fixtures**
```json
{
  "sink": { "width": 0.7, "height": 0.2, "depth": 0.5 },
  "toilet": { "width": 0.4, "height": 0.8, "depth": 0.7 },
  "bathtub": { "width": 1.7, "height": 0.6, "depth": 0.8 },
  "shower": { "width": 0.9, "height": 2.1, "depth": 0.9 }
}
```

## **🎯 Position & Coordinate System**

### **Position Format**
```json
"position": [x, z, y]  // Array format: [x-axis, z-axis, y-axis]
// OR
"position": { "x": 1.2, "y": 0.9, "z": -1.2 }  // Object format
```

### **Coordinate System**
- **X-axis**: Left (-) to Right (+)
- **Y-axis**: Floor (0) to Ceiling (+) 
- **Z-axis**: Front (-) to Back (+)
- **Units**: Always in meters
- **Origin**: Center of room at floor level (0, 0, 0)

### **Rotation**
```json
"rotation": 0    // Degrees: 0=front, 90=right, 180=back, 270=left
```

## **🔄 Backward Compatibility**

### **Legacy Support**
- **Without size**: Objects use default catalog dimensions
- **With scale only**: `"scale": 1.2` applies uniform scaling
- **Mixed format**: Size dimensions override scale values

### **Migration Example**
```json
// OLD FORMAT (still works)
{
  "name": "refrigerator",
  "position": [1.2, -1.2],
  "scale": 1.1
}

// NEW FORMAT (recommended)
{
  "name": "refrigerator", 
  "position": [1.2, -1.2, 0.02],
  "size": {
    "width": 0.66,  // 0.6 * 1.1 
    "height": 1.87, // 1.7 * 1.1
    "depth": 0.715  // 0.65 * 1.1
  }
}
```

## **⚡ AI Processing Benefits**

### **Accurate Space Planning**
- **Exact measurements** for clearance calculations
- **Realistic proportions** between objects
- **Standard dimensions** for real-world accuracy

### **Natural Language Support** 
- *"Place a 60cm wide refrigerator"*
- *"Add a 1.2m dining table"*  
- *"Make the cabinet 90cm tall"*

### **Export Consistency**
- **Roundtrip accuracy**: Import → Edit → Export maintains dimensions
- **CAD compatibility**: Exact measurements for professional tools
- **Real-world validation**: Verify if furniture fits actual spaces

---

**Status**: ✅ Fully implemented
**Canvas Support**: ✅ Automatic object resizing 
**Export**: ✅ Dimensions preserved in output
**AI Integration**: ✅ Natural language dimension processing 