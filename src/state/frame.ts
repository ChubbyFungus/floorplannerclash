import Ajv from 'ajv';
import schema from '../../schema/floorplan.schema.json';

export interface Frame {
  roomType?: 'kitchen' | 'bathroom';
  style?: 'modern' | 'traditional' | 'transitional';
  dimensions?: {
    width: number;
    depth: number;
  };
  floorMaterial?: string;
  appliances?: {
    refrigerator?: {
      type: string;
      finish?: string;
    };
    oven?: {
      type: string;
      finish?: string;
    };
    sink?: {
      type: string;
      finish?: string;
    };
    toilet?: {
      type: string;
      finish?: string;
    };
    bathtub?: {
      type: string;
      finish?: string;
    };
    shower?: {
      type: string;
      finish?: string;
    };
  };
  cabinets?: {
    style?: string;
    color?: string;
  };
  countertops?: {
    material?: string;
    color?: string;
  };
  layout?: string;
}

class FrameManager {
  private frame: Frame = {};
  private ajv: Ajv;
  private validate: any;

  constructor() {
    this.ajv = new Ajv({ allErrors: true });
    this.validate = this.ajv.compile(schema);
  }

  apply(fills: Partial<Frame>): void {
    this.frame = { ...this.frame, ...fills };
  }

  validateWithAjv(): { valid: boolean; errors?: string[] } {
    const valid = this.validate(this.frame);
    if (!valid) {
      const errors = this.validate.errors?.map(err => {
        const path = err.instancePath || 'root';
        const message = err.message || 'Unknown error';
        return `${path}: ${message}`;
      }) || [];
      return { valid: false, errors };
    }
    return { valid: true };
  }

  listMissingOrLowConfidence(): string[] {
    const missing: string[] = [];
    const { roomType, style, dimensions } = this.frame;

    if (!roomType) missing.push('roomType');
    if (!style) missing.push('style');
    if (!dimensions?.width || !dimensions?.depth) missing.push('dimensions');

    if (roomType === 'kitchen') {
      if (!this.frame.appliances?.refrigerator?.type) missing.push('appliances.refrigerator.type');
      if (!this.frame.appliances?.oven?.type) missing.push('appliances.oven.type');
      if (!this.frame.appliances?.sink?.type) missing.push('appliances.sink.type');
    } else if (roomType === 'bathroom') {
      if (!this.frame.appliances?.toilet?.type) missing.push('appliances.toilet.type');
    }

    // Style-specific requirements
    if (style === 'modern') {
      if (this.frame.appliances?.refrigerator && !this.frame.appliances.refrigerator.finish) {
        missing.push('appliances.refrigerator.finish (panel-ready or stainless-steel)');
      }
      if (this.frame.appliances?.oven && !this.frame.appliances.oven.finish) {
        missing.push('appliances.oven.finish (panel-ready or stainless-steel)');
      }
      if (this.frame.cabinets && !this.frame.cabinets.style) {
        missing.push('cabinets.style (flat-panel or sleek)');
      }
      if (this.frame.cabinets && !this.frame.cabinets.color) {
        missing.push('cabinets.color (white, black, or gray)');
      }
      if (this.frame.countertops && !this.frame.countertops.material) {
        missing.push('countertops.material (quartz, concrete, or stainless-steel)');
      }
    } else if (style === 'traditional') {
      if (this.frame.appliances?.refrigerator && !this.frame.appliances.refrigerator.finish) {
        missing.push('appliances.refrigerator.finish (stainless-steel, black, or white)');
      }
      if (this.frame.appliances?.oven && !this.frame.appliances.oven.finish) {
        missing.push('appliances.oven.finish (stainless-steel, black, or white)');
      }
      if (this.frame.cabinets && !this.frame.cabinets.style) {
        missing.push('cabinets.style (shaker or raised-panel)');
      }
      if (this.frame.cabinets && !this.frame.cabinets.color) {
        missing.push('cabinets.color (wood, cream, or navy)');
      }
      if (this.frame.countertops && !this.frame.countertops.material) {
        missing.push('countertops.material (granite, marble, or butcher-block)');
      }
    } else if (style === 'transitional') {
      if (this.frame.appliances?.refrigerator && !this.frame.appliances.refrigerator.finish) {
        missing.push('appliances.refrigerator.finish (stainless-steel, panel-ready, or black)');
      }
      if (this.frame.appliances?.oven && !this.frame.appliances.oven.finish) {
        missing.push('appliances.oven.finish (stainless-steel, panel-ready, or black)');
      }
      if (this.frame.cabinets && !this.frame.cabinets.style) {
        missing.push('cabinets.style (shaker or flat-panel)');
      }
      if (this.frame.cabinets && !this.frame.cabinets.color) {
        missing.push('cabinets.color (gray, white, or wood)');
      }
      if (this.frame.countertops && !this.frame.countertops.material) {
        missing.push('countertops.material (quartz, granite, or marble)');
      }
    }

    return missing;
  }

  getFrame(): Frame {
    return { ...this.frame };
  }

  reset(): void {
    this.frame = {};
  }
}

export const frameManager = new FrameManager();