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
    dishwasher?: {
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
    this.ajv = new Ajv({ allErrors: true, strict: false });
    this.validate = this.ajv.compile(schema);
  }

  apply(fills: Partial<Frame>): void {
    const next: Frame = { ...this.frame };

    if (fills.dimensions) {
      next.dimensions = {
        ...(next.dimensions ?? {}),
        ...fills.dimensions,
      };
    }

    if (fills.appliances) {
      next.appliances = { ...(next.appliances ?? {}) };
      for (const [key, value] of Object.entries(fills.appliances)) {
        const typedKey = key as keyof NonNullable<Frame['appliances']>;
        next.appliances[typedKey] = {
          type: '',
          ...(next.appliances[typedKey] ?? {}),
          ...(value ?? {}),
        };
      }
    }

    if (fills.cabinets) {
      next.cabinets = {
        ...(next.cabinets ?? {}),
        ...fills.cabinets,
      };
    }

    if (fills.countertops) {
      next.countertops = {
        ...(next.countertops ?? {}),
        ...fills.countertops,
      };
    }

    if (typeof fills.roomType !== 'undefined') {
      next.roomType = fills.roomType;
    }
    if (typeof fills.style !== 'undefined') {
      next.style = fills.style;
    }
    if (typeof fills.floorMaterial !== 'undefined') {
      next.floorMaterial = fills.floorMaterial;
    }
    if (typeof fills.layout !== 'undefined') {
      next.layout = fills.layout;
    }

    this.frame = next;
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
        missing.push('appliances.refrigerator.finish');
      }
      if (this.frame.appliances?.oven && !this.frame.appliances.oven.finish) {
        missing.push('appliances.oven.finish');
      }
      if (this.frame.cabinets && !this.frame.cabinets.style) {
        missing.push('cabinets.style');
      }
      if (this.frame.cabinets && !this.frame.cabinets.color) {
        missing.push('cabinets.color');
      }
      if (this.frame.countertops && !this.frame.countertops.material) {
        missing.push('countertops.material');
      }
    } else if (style === 'traditional') {
      if (this.frame.appliances?.refrigerator && !this.frame.appliances.refrigerator.finish) {
        missing.push('appliances.refrigerator.finish');
      }
      if (this.frame.appliances?.oven && !this.frame.appliances.oven.finish) {
        missing.push('appliances.oven.finish');
      }
      if (this.frame.cabinets && !this.frame.cabinets.style) {
        missing.push('cabinets.style');
      }
      if (this.frame.cabinets && !this.frame.cabinets.color) {
        missing.push('cabinets.color');
      }
      if (this.frame.countertops && !this.frame.countertops.material) {
        missing.push('countertops.material');
      }
    } else if (style === 'transitional') {
      if (this.frame.appliances?.refrigerator && !this.frame.appliances.refrigerator.finish) {
        missing.push('appliances.refrigerator.finish');
      }
      if (this.frame.appliances?.oven && !this.frame.appliances.oven.finish) {
        missing.push('appliances.oven.finish');
      }
      if (this.frame.cabinets && !this.frame.cabinets.style) {
        missing.push('cabinets.style');
      }
      if (this.frame.cabinets && !this.frame.cabinets.color) {
        missing.push('cabinets.color');
      }
      if (this.frame.countertops && !this.frame.countertops.material) {
        missing.push('countertops.material');
      }
    }

    return missing;
  }

  getFrame(): Frame {
    return { ...this.frame, roomType: this.frame.roomType ?? 'kitchen' };
  }

  reset(): void {
    this.frame = {};
  }
}

export const frameManager = new FrameManager();
