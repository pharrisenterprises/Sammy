/**
 * Tests for useCsv hook
 * @module hooks/useCsv.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useCsv,
  createCsvString,
  isValidEmail,
  isValidPhone,
  type CsvRow,
} from './useCsv';
import type { IChromeRuntime } from './useStorage';

// ============================================================================
// MOCKS
// ============================================================================

// Mock papaparse
vi.mock('papaparse', () => ({
  default: {
    parse: vi.fn((text: string, options: { header?: boolean }) => {
      const lines = text.trim().split('\n');
      const headers = lines[0].split(',').map(h => h.trim());
      const data = lines.slice(1).map(line => {
        const values = line.split(',');
        const row: Record<string, string> = {};
        headers.forEach((h, i) => {
          row[h] = values[i]?.trim() ?? '';
        });
        return row;
      });
      return {
        data,
        meta: { fields: headers },
        errors: [],
      };
    }),
  },
}));

// Mock xlsx
vi.mock('xlsx', () => ({
  read: vi.fn(() => ({
    SheetNames: ['Sheet1'],
    Sheets: {
      Sheet1: {},
    },
  })),
  utils: {
    sheet_to_json: vi.fn(() => [
      { Name: 'John', Email: 'john@test.com' },
      { Name: 'Jane', Email: 'jane@test.com' },
    ]),
  },
}));

function createMockChromeRuntime(): IChromeRuntime {
  return {
    sendMessage: vi.fn((message, callback) => {
      setTimeout(() => {
        if ((message as { action?: string }).action === 'get_project_by_id') {
          callback?.({
            success: true,
            data: {
              project: {
                id: 1,
                csv_data: [{ Name: 'Test', Email: 'test@example.com' }],
                parsed_fields: [
                  { field_name: 'Name', mapped: true, inputvarfields: 'Full Name' },
                ],
              },
            },
          });
        } else {
          callback?.({ success: true });
        }
      }, 0);
    }),
    lastError: undefined,
  };
}

let mockChrome: { runtime: IChromeRuntime };

beforeEach(() => {
  mockChrome = { runtime: createMockChromeRuntime() };
  (global as unknown as { chrome: typeof mockChrome }).chrome = mockChrome;
  vi.clearAllMocks();
});

afterEach(() => {
  delete (global as unknown as { chrome?: unknown }).chrome;
});

// ============================================================================
// TESTS
// ============================================================================

describe('useCsv', () => {
  const defaultOptions = {
    projectId: 1,
    stepLabels: ['Full Name', 'Email Address', 'Phone Number'],
  };

  describe('initial state', () => {
    it('should have empty initial state', () => {
      const { result } = renderHook(() => useCsv(defaultOptions));

      expect(result.current.csvData).toHaveLength(0);
      expect(result.current.headers).toHaveLength(0);
      expect(result.current.fields).toHaveLength(0);
      expect(result.current.isLoading).toBe(false);
    });

    it('should have zero mapping progress', () => {
      const { result } = renderHook(() => useCsv(defaultOptions));

      expect(result.current.mappingProgress.total).toBe(0);
      expect(result.current.mappingProgress.mapped).toBe(0);
      expect(result.current.mappingProgress.percentage).toBe(0);
    });
  });

  describe('CSV parsing', () => {
    it('should parse CSV text', async () => {
      const { result } = renderHook(() => useCsv(defaultOptions));

      const csvText = 'Name,Email\nJohn,john@test.com\nJane,jane@test.com';

      await act(async () => {
        await result.current.parseCsvText(csvText);
      });

      expect(result.current.headers).toContain('Name');
      expect(result.current.headers).toContain('Email');
      expect(result.current.csvData).toHaveLength(2);
      expect(result.current.fields).toHaveLength(2);
    });

    it('should create field mappings from headers', async () => {
      const { result } = renderHook(() => useCsv(defaultOptions));

      const csvText = 'Name,Email\nJohn,john@test.com';

      await act(async () => {
        await result.current.parseCsvText(csvText);
      });

      expect(result.current.fields[0].field_name).toBe('Name');
      expect(result.current.fields[0].mapped).toBe(false);
    });

    it('should reject files exceeding row limit', async () => {
      const { result } = renderHook(() => useCsv({
        ...defaultOptions,
        maxRows: 1,
      }));

      const csvText = 'Name\nJohn\nJane';

      await act(async () => {
        const parseResult = await result.current.parseCsvText(csvText);
        expect(parseResult.success).toBe(false);
      });
    });
  });

  describe('auto-mapping', () => {
    it('should auto-map similar field names', async () => {
      const { result } = renderHook(() => useCsv(defaultOptions));

      const csvText = 'Full Name,Email\nJohn,john@test.com';

      await act(async () => {
        await result.current.parseCsvText(csvText);
      });

      act(() => {
        result.current.autoMap();
      });

      const nameField = result.current.fields.find(f => f.field_name === 'Full Name');
      expect(nameField?.mapped).toBe(true);
      expect(nameField?.inputvarfields).toBe('Full Name');
    });

    it('should return mapping results', async () => {
      const { result } = renderHook(() => useCsv(defaultOptions));

      const csvText = 'Name,Email\nJohn,john@test.com';

      await act(async () => {
        await result.current.parseCsvText(csvText);
      });

      let autoMapResults;
      act(() => {
        autoMapResults = result.current.autoMap();
      });

      expect(autoMapResults).toBeDefined();
      expect(autoMapResults!.length).toBe(2);
    });
  });

  describe('manual mapping', () => {
    it('should set field mapping', async () => {
      const { result } = renderHook(() => useCsv(defaultOptions));

      const csvText = 'Name,Email\nJohn,john@test.com';

      await act(async () => {
        await result.current.parseCsvText(csvText);
      });

      act(() => {
        result.current.setFieldMapping('Name', 'Full Name');
      });

      const nameField = result.current.fields.find(f => f.field_name === 'Name');
      expect(nameField?.mapped).toBe(true);
      expect(nameField?.inputvarfields).toBe('Full Name');
    });

    it('should clear field mapping', async () => {
      const { result } = renderHook(() => useCsv(defaultOptions));

      const csvText = 'Name,Email\nJohn,john@test.com';

      await act(async () => {
        await result.current.parseCsvText(csvText);
      });

      act(() => {
        result.current.setFieldMapping('Name', 'Full Name');
        result.current.clearFieldMapping('Name');
      });

      const nameField = result.current.fields.find(f => f.field_name === 'Name');
      expect(nameField?.mapped).toBe(false);
    });

    it('should clear all mappings', async () => {
      const { result } = renderHook(() => useCsv(defaultOptions));

      const csvText = 'Name,Email\nJohn,john@test.com';

      await act(async () => {
        await result.current.parseCsvText(csvText);
      });

      act(() => {
        result.current.setFieldMapping('Name', 'Full Name');
        result.current.setFieldMapping('Email', 'Email Address');
        result.current.clearAllMappings();
      });

      expect(result.current.mappingProgress.mapped).toBe(0);
    });

    it('should update mapping progress', async () => {
      const { result } = renderHook(() => useCsv(defaultOptions));

      const csvText = 'Name,Email\nJohn,john@test.com';

      await act(async () => {
        await result.current.parseCsvText(csvText);
      });

      act(() => {
        result.current.setFieldMapping('Name', 'Full Name');
      });

      expect(result.current.mappingProgress.mapped).toBe(1);
      expect(result.current.mappingProgress.percentage).toBe(50);
    });
  });

  describe('validation', () => {
    it('should validate empty data', async () => {
      const { result } = renderHook(() => useCsv(defaultOptions));

      act(() => {
        const validation = result.current.validate();
        expect(validation.valid).toBe(false);
        expect(validation.errors.length).toBeGreaterThan(0);
      });
    });

    it('should detect unmapped fields', async () => {
      const { result } = renderHook(() => useCsv(defaultOptions));

      const csvText = 'Name,Email\nJohn,john@test.com';

      await act(async () => {
        await result.current.parseCsvText(csvText);
      });

      act(() => {
        const validation = result.current.validate();
        expect(validation.errors.some(e => e.message.includes('No fields are mapped'))).toBe(true);
      });
    });

    it('should calculate statistics', async () => {
      const { result } = renderHook(() => useCsv(defaultOptions));

      const csvText = 'Name,Email\nJohn,john@test.com\nJane,';

      await act(async () => {
        await result.current.parseCsvText(csvText);
      });

      expect(result.current.statistics).not.toBeNull();
      expect(result.current.statistics?.totalRows).toBe(2);
      expect(result.current.statistics?.totalColumns).toBe(2);
    });
  });

  describe('persistence', () => {
    it('should save to project', async () => {
      const { result } = renderHook(() => useCsv(defaultOptions));

      const csvText = 'Name,Email\nJohn,john@test.com';

      await act(async () => {
        await result.current.parseCsvText(csvText);
      });

      let success;
      await act(async () => {
        success = await result.current.saveToProject();
      });

      expect(success).toBe(true);
    });

    it('should load from project', async () => {
      const { result } = renderHook(() => useCsv(defaultOptions));

      await act(async () => {
        await result.current.loadFromProject();
      });

      expect(result.current.csvData.length).toBeGreaterThan(0);
      expect(result.current.fields.length).toBeGreaterThan(0);
    });
  });

  describe('utilities', () => {
    it('should get field by name', async () => {
      const { result } = renderHook(() => useCsv(defaultOptions));

      const csvText = 'Name,Email\nJohn,john@test.com';

      await act(async () => {
        await result.current.parseCsvText(csvText);
      });

      const field = result.current.getFieldByName('Name');
      expect(field).toBeDefined();
      expect(field?.field_name).toBe('Name');
    });

    it('should get mapped and unmapped fields', async () => {
      const { result } = renderHook(() => useCsv(defaultOptions));

      const csvText = 'Name,Email\nJohn,john@test.com';

      await act(async () => {
        await result.current.parseCsvText(csvText);
      });

      act(() => {
        result.current.setFieldMapping('Name', 'Full Name');
      });

      expect(result.current.getMappedFields()).toHaveLength(1);
      expect(result.current.getUnmappedFields()).toHaveLength(1);
    });

    it('should export mappings', async () => {
      const { result } = renderHook(() => useCsv(defaultOptions));

      const csvText = 'Name,Email\nJohn,john@test.com';

      await act(async () => {
        await result.current.parseCsvText(csvText);
      });

      const exported = result.current.exportMappings();
      expect(exported.projectId).toBe(1);
      expect(exported.fields).toHaveLength(2);
    });

    it('should clear data', async () => {
      const { result } = renderHook(() => useCsv(defaultOptions));

      const csvText = 'Name,Email\nJohn,john@test.com';

      await act(async () => {
        await result.current.parseCsvText(csvText);
      });

      act(() => {
        result.current.clearData();
      });

      expect(result.current.csvData).toHaveLength(0);
      expect(result.current.fields).toHaveLength(0);
    });
  });
});

describe('utility functions', () => {
  describe('createCsvString', () => {
    it('should create valid CSV string', () => {
      const headers = ['Name', 'Email'];
      const rows: CsvRow[] = [
        { Name: 'John', Email: 'john@test.com' },
        { Name: 'Jane', Email: 'jane@test.com' },
      ];

      const csv = createCsvString(headers, rows);

      expect(csv).toContain('"Name","Email"');
      expect(csv).toContain('"John","john@test.com"');
    });

    it('should escape quotes', () => {
      const headers = ['Name'];
      const rows: CsvRow[] = [{ Name: 'John "Johnny" Doe' }];

      const csv = createCsvString(headers, rows);

      expect(csv).toContain('""Johnny""');
    });
  });

  describe('isValidEmail', () => {
    it('should validate correct emails', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name@domain.co.uk')).toBe(true);
    });

    it('should reject invalid emails', () => {
      expect(isValidEmail('invalid')).toBe(false);
      expect(isValidEmail('missing@domain')).toBe(false);
      expect(isValidEmail('@nodomain.com')).toBe(false);
    });
  });

  describe('isValidPhone', () => {
    it('should validate correct phones', () => {
      expect(isValidPhone('555-123-4567')).toBe(true);
      expect(isValidPhone('+1 (555) 123-4567')).toBe(true);
    });

    it('should reject invalid phones', () => {
      expect(isValidPhone('12345')).toBe(false);
      expect(isValidPhone('abc')).toBe(false);
    });
  });
});
