import { frameManager } from '../src/state/frame';

describe('Frame Validation Tests', () => {
  beforeEach(() => {
    frameManager.reset();
  });

  describe('Kitchen - Modern Style', () => {
    it('should validate complete modern kitchen frame', () => {
      frameManager.apply({
        roomType: 'kitchen',
        style: 'modern',
        dimensions: { width: 12, depth: 10 },
        floorMaterial: 'concrete',
        appliances: {
          refrigerator: { type: 'french-door', finish: 'panel-ready' },
          oven: { type: 'wall-oven', finish: 'stainless-steel' },
          sink: { type: 'single-basin', finish: 'stainless-steel' }
        },
        cabinets: { style: 'flat-panel', color: 'white' },
        countertops: { material: 'quartz', color: 'white' },
        layout: 'L-shaped'
      });

      const result = frameManager.validateWithAjv();
      expect(result.valid).toBe(true);
    });

    it('should reject modern kitchen with invalid appliance finish', () => {
      frameManager.apply({
        roomType: 'kitchen',
        style: 'modern',
        dimensions: { width: 12, depth: 10 },
        appliances: {
          refrigerator: { type: 'french-door', finish: 'brass' }, // Invalid for modern
          oven: { type: 'wall-oven', finish: 'stainless-steel' },
          sink: { type: 'single-basin' }
        }
      });

      const result = frameManager.validateWithAjv();
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('/appliances/refrigerator/finish: must be equal to one of the allowed values');
    });
  });

  describe('Kitchen - Traditional Style', () => {
    it('should validate complete traditional kitchen frame', () => {
      frameManager.apply({
        roomType: 'kitchen',
        style: 'traditional',
        dimensions: { width: 14, depth: 12 },
        floorMaterial: 'hardwood',
        appliances: {
          refrigerator: { type: 'bottom-freezer', finish: 'stainless-steel' },
          oven: { type: 'range', finish: 'black' },
          sink: { type: 'double-basin', finish: 'white' }
        },
        cabinets: { style: 'shaker', color: 'wood' },
        countertops: { material: 'granite', color: 'black' },
        layout: 'U-shaped'
      });

      const result = frameManager.validateWithAjv();
      expect(result.valid).toBe(true);
    });

    it('should reject traditional kitchen with invalid countertop material', () => {
      frameManager.apply({
        roomType: 'kitchen',
        style: 'traditional',
        dimensions: { width: 14, depth: 12 },
        appliances: {
          refrigerator: { type: 'bottom-freezer', finish: 'stainless-steel' },
          oven: { type: 'range', finish: 'black' },
          sink: { type: 'double-basin' }
        },
        countertops: { material: 'concrete' } // Invalid for traditional
      });

      const result = frameManager.validateWithAjv();
      expect(result.valid).toBe(false);
    });
  });

  describe('Kitchen - Transitional Style', () => {
    it('should validate complete transitional kitchen frame', () => {
      frameManager.apply({
        roomType: 'kitchen',
        style: 'transitional',
        dimensions: { width: 13, depth: 11 },
        floorMaterial: 'tile',
        appliances: {
          refrigerator: { type: 'side-by-side', finish: 'stainless-steel' },
          oven: { type: 'slide-in-range', finish: 'panel-ready' },
          sink: { type: 'farmhouse', finish: 'white' }
        },
        cabinets: { style: 'shaker', color: 'gray' },
        countertops: { material: 'quartz', color: 'gray' },
        layout: 'straight'
      });

      const result = frameManager.validateWithAjv();
      expect(result.valid).toBe(true);
    });
  });

  describe('Bathroom - Modern Style', () => {
    it('should validate complete modern bathroom frame', () => {
      frameManager.apply({
        roomType: 'bathroom',
        style: 'modern',
        dimensions: { width: 8, depth: 6 },
        floorMaterial: 'tile',
        appliances: {
          toilet: { type: 'wall-mounted', finish: 'white' },
          bathtub: { type: 'freestanding', finish: 'white' },
          shower: { type: 'walk-in', finish: 'glass' }
        },
        cabinets: { style: 'flat-panel', color: 'white' },
        countertops: { material: 'quartz', color: 'white' }
      });

      const result = frameManager.validateWithAjv();
      expect(result.valid).toBe(true);
    });
  });

  describe('Bathroom - Traditional Style', () => {
    it('should validate complete traditional bathroom frame', () => {
      frameManager.apply({
        roomType: 'bathroom',
        style: 'traditional',
        dimensions: { width: 9, depth: 7 },
        floorMaterial: 'tile',
        appliances: {
          toilet: { type: 'two-piece', finish: 'white' },
          bathtub: { type: 'clawfoot', finish: 'white' }
        },
        cabinets: { style: 'raised-panel', color: 'wood' },
        countertops: { material: 'marble', color: 'white' }
      });

      const result = frameManager.validateWithAjv();
      expect(result.valid).toBe(true);
    });
  });

  describe('Bathroom - Transitional Style', () => {
    it('should validate complete transitional bathroom frame', () => {
      frameManager.apply({
        roomType: 'bathroom',
        style: 'transitional',
        dimensions: { width: 10, depth: 8 },
        floorMaterial: 'tile',
        appliances: {
          toilet: { type: 'comfort-height', finish: 'white' },
          shower: { type: 'neo-angle', finish: 'chrome' }
        },
        cabinets: { style: 'shaker', color: 'gray' },
        countertops: { material: 'granite', color: 'gray' }
      });

      const result = frameManager.validateWithAjv();
      expect(result.valid).toBe(true);
    });
  });

  describe('Missing Required Fields', () => {
    it('should identify missing fields for incomplete frame', () => {
      frameManager.apply({
        roomType: 'kitchen',
        style: 'modern'
        // Missing dimensions and appliances
      });

      const missing = frameManager.listMissingOrLowConfidence();
      expect(missing).toContain('dimensions');
      expect(missing).toContain('appliances.refrigerator.type');
      expect(missing).toContain('appliances.oven.type');
      expect(missing).toContain('appliances.sink.type');
    });

    it('should identify style-specific missing fields', () => {
      frameManager.apply({
        roomType: 'kitchen',
        style: 'modern',
        dimensions: { width: 12, depth: 10 },
        appliances: {
          refrigerator: { type: 'french-door' }, // Missing finish
          oven: { type: 'wall-oven' }, // Missing finish
          sink: { type: 'single-basin' }
        }
      });

      const missing = frameManager.listMissingOrLowConfidence();
      expect(missing).toContain('appliances.refrigerator.finish');
      expect(missing).toContain('appliances.oven.finish');
    });
  });

  describe('Invalid Frames', () => {
    it('should reject frame with invalid room type', () => {
      frameManager.apply({
        roomType: 'livingroom' as any,
        style: 'modern',
        dimensions: { width: 12, depth: 10 }
      });

      const result = frameManager.validateWithAjv();
      expect(result.valid).toBe(false);
    });

    it('should reject frame with invalid style', () => {
      frameManager.apply({
        roomType: 'kitchen',
        style: 'gothic' as any,
        dimensions: { width: 12, depth: 10 }
      });

      const result = frameManager.validateWithAjv();
      expect(result.valid).toBe(false);
    });

    it('should reject frame with dimensions out of range', () => {
      frameManager.apply({
        roomType: 'kitchen',
        style: 'modern',
        dimensions: { width: 100, depth: 10 } // Width too large
      });

      const result = frameManager.validateWithAjv();
      expect(result.valid).toBe(false);
    });
  });
});
