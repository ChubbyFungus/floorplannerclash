
// FIX: Removed circular dependency `import { RoomType } from './types';` which was causing a conflict with the local declaration.
export enum RoomType {
  Kitchen = 'kitchen',
  Bathroom = 'bathroom',
}

export type ItemType = 'upper_cabinet' | 'base_cabinet' | 'pantryTall' | 'kitchen_island' | 'sink' | 'toilet' | 'bathtub' | 'fridge' | 'range' | 'vent_hood' | 'dishwasher' | 'corner_cabinet_upper' | 'corner_cabinet_lower' | 'microwave_wall';

export type SurfaceType = 'floor' | 'countertop' | 'backsplash';

import { OpeningPattern, DoorStyle } from './components/Cabinet';

export type CornerKey = 'back-left' | 'back-right' | 'front-left' | 'front-right';

export interface SceneItemMeta {
  cornerLock?: {
    corner: CornerKey;
    x: number;
    z: number;
    yaw: number;
  };
  [key: string]: unknown;
}

export interface SceneItem {
  id: number;
  type: ItemType;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  catalogId?: string;
  widthInches?: number;
  heightInches?: number;
  depthInches?: number;
  openingPattern?: OpeningPattern;
  doorStyle?: DoorStyle;
  category?: string;
  meta?: SceneItemMeta;
}

export interface SelectedPosition {
  point: [number, number, number];
  normal: [number, number, number];
  surfaceType?: SurfaceType;
}

export interface Backsplash {
    id: number;
    points: [number, number, number][];
    normal: [number, number, number];
}

export interface TextureOption {
  id: string;
  name: string;
  src: string;
}

export interface RoomDimensions {
  width: number;
  depth: number;
}
