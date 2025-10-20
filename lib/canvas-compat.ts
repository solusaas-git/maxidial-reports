/**
 * Canvas compatibility layer for @napi-rs/canvas
 * Provides a drop-in replacement for the 'canvas' module
 */

// Re-export everything from @napi-rs/canvas
export * from '@napi-rs/canvas';

// Import specific items we need to re-export or wrap
import { createCanvas as napiCreateCanvas, Canvas as NapiCanvas } from '@napi-rs/canvas';

// Re-export with same API as 'canvas' module
export const createCanvas = napiCreateCanvas;
export type Canvas = NapiCanvas;

// Default export for compatibility
export default {
  createCanvas,
};

