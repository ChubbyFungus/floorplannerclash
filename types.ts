import { Vector3 } from "three";

export interface Dimensions {
  width: number;
  height: number;
  depth: number;
}

export type ObjectType = 'cabinet_base' | 'cabinet_wall' | 'refrigerator' | 'oven' | 'sink' | 'island' | 'toilet' | 'shower' | 'vanity' | 'window' | 'bathtub' | 'opening' | 'vent_hood' | 'dishwasher' | 'cooktop';

export interface FloorplanObject {
  id: string;
  type: ObjectType;
  position: Vector3;
  rotation: Vector3;
  dimensions: Dimensions;
  color: string;
  material: string; // e.g., 'light_wood', 'stainless_steel'
  countertopMaterial?: string;
  countertopColor?: string;
}

export interface Room {
  type: 'kitchen' | 'bathroom';
  dimensions: {
    width: number;
    depth: number;
  };
  floorMaterial: string; // e.g., 'light_wood_plank', 'gray_tile'
}

export interface Floorplan {
  room: Room;
  objects: FloorplanObject[];
}

export interface Choice {
  name: string;
  description: string;
  material: string; // The material key to be used for texturing
  imageUrl?: string; // Optional URL for generated style images
}

export interface ConversationTurn {
  role: 'user' | 'model';
  text: string;
  choices?: Choice[];
}