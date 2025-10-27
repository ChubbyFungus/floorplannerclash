import type { DoorStyle, FrameSystem } from '../components/Cabinet';

export interface CabinetOptions {
  doorStyle: DoorStyle;
  frameSystem: FrameSystem;
  doorColor: string;
  frameColor: string;
}

export const DOOR_STYLE_OPTIONS: DoorStyle[] = [
  'slab',
  'shaker',
  'raised',
  'beadboard',
  'louvered',
  'glass',
  'none',
];

export const FRAME_SYSTEM_OPTIONS: FrameSystem[] = [
  'frameless',
  'fullOverlay',
  'standardOverlay',
  'inset',
];
