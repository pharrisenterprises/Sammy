/**
 * @fileoverview Step type definitions (stub for testing)
 * @module core/types/step
 */

export interface Step {
  id?: string;
  event?: string;
  selector?: string;
  value?: string;
  [key: string]: any;
}
