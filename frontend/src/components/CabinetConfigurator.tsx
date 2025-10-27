import React from 'react';
import type { CabinetOptions } from '../types/cabinet';
import { DOOR_STYLE_OPTIONS, FRAME_SYSTEM_OPTIONS } from '../types/cabinet';
import type { DoorStyle, FrameSystem } from './Cabinet';
import { DEFAULT_DOOR_COLOR } from './Cabinet';

interface CabinetConfiguratorProps {
  isOpen: boolean;
  options: CabinetOptions;
  onChange(_patch: Partial<CabinetOptions>): void;
}

const DOOR_STYLE_LABELS: Record<DoorStyle, string> = {
  slab: 'Slab',
  shaker: 'Shaker',
  raised: 'Raised',
  beadboard: 'Beadboard',
  louvered: 'Louvered',
  glass: 'Glass',
  none: 'Open',
};

const FRAME_SYSTEM_LABELS: Record<FrameSystem, string> = {
  frameless: 'Frameless',
  fullOverlay: 'Full Overlay',
  standardOverlay: 'Standard Overlay',
  inset: 'Inset',
};

const COLOR_SWATCHES = [
  DEFAULT_DOOR_COLOR,
  '#f5f0dc',
  '#d8d8d8',
  '#9a6b4f',
  '#3d3d3d',
];

const swatchBorder = 'ring-2 ring-offset-2 ring-cyan-500';

const CabinetConfigurator: React.FC<CabinetConfiguratorProps> = ({ isOpen, options, onChange }) => {
  if (!isOpen) return null;

  return (
    <div className="absolute top-4 right-4 z-10 max-w-sm rounded-lg bg-gray-800/80 p-4 text-gray-100 shadow-xl backdrop-blur-md">
      <h2 className="text-lg font-semibold text-white">Cabinet Options</h2>
      <p className="mt-1 text-sm text-gray-300">
        Pick a door style and finish to apply to newly placed cabinets.
      </p>

      <div className="mt-4">
        <h3 className="text-sm font-medium text-gray-200">Door Style</h3>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {DOOR_STYLE_OPTIONS.map((style) => {
            const isActive = options.doorStyle === style;
            return (
              <button
                key={style}
                type="button"
                onClick={() => onChange({ doorStyle: style })}
                className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive ? 'bg-cyan-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
                aria-pressed={isActive}
              >
                {DOOR_STYLE_LABELS[style]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4">
        <h3 className="text-sm font-medium text-gray-200">Frame System</h3>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {FRAME_SYSTEM_OPTIONS.map((system) => {
            const isActive = options.frameSystem === system;
            return (
              <button
                key={system}
                type="button"
                onClick={() => onChange({ frameSystem: system })}
                className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive ? 'bg-cyan-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
                aria-pressed={isActive}
              >
                {FRAME_SYSTEM_LABELS[system]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4">
        <h3 className="text-sm font-medium text-gray-200">Door Finish</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          {COLOR_SWATCHES.map((color) => {
            const isActive = options.doorColor.toLowerCase() === color.toLowerCase();
            return (
              <button
                key={color}
                type="button"
                onClick={() => onChange({ doorColor: color })}
                className={`h-8 w-8 rounded-full border border-gray-500 transition-transform hover:scale-105 ${
                  isActive ? swatchBorder : ''
                }`}
                style={{ backgroundColor: color }}
                aria-label={`Door color ${color}`}
                aria-pressed={isActive}
              />
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => onChange({ frameColor: options.doorColor })}
          className="mt-2 w-full rounded-md bg-gray-700 px-3 py-2 text-sm font-medium text-gray-300 hover:bg-gray-600"
        >
          Apply to Frame
        </button>
      </div>

      <div className="mt-4">
        <h3 className="text-sm font-medium text-gray-200">Frame Finish</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          {COLOR_SWATCHES.map((color) => {
            const isActive = options.frameColor.toLowerCase() === color.toLowerCase();
            return (
              <button
                key={color}
                type="button"
                onClick={() => onChange({ frameColor: color })}
                className={`h-8 w-8 rounded-full border border-gray-500 transition-transform hover:scale-105 ${
                  isActive ? swatchBorder : ''
                }`}
                style={{ backgroundColor: color }}
                aria-label={`Frame color ${color}`}
                aria-pressed={isActive}
              />
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => onChange({ doorColor: options.frameColor })}
          className="mt-2 w-full rounded-md bg-gray-700 px-3 py-2 text-sm font-medium text-gray-300 hover:bg-gray-600"
        >
          Apply to Door
        </button>
      </div>
    </div>
  );
};

export default CabinetConfigurator;
