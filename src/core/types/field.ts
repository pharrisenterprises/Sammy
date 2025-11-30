/**
 * @fileoverview Field type definitions (stub for testing)
 * @module core/types/field
 */

export interface Field {
  field_name: string;
  mapped: boolean;
  inputvarfields: string;
  [key: string]: any;
}
