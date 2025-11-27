# CSV Upload Component
**Project:** Chrome Extension Test Recorder  
**Document Version:** 1.0  
**Last Updated:** November 25, 2025  
**Status:** Complete Technical Specification

## Table of Contents
1. Overview
2. File Upload UI
3. PapaParse Integration
4. XLSX Integration
5. File Validation
6. Preview Table
7. Error Handling
8. Performance Optimization
9. Security Considerations
10. Testing Strategy

---

## 1. Overview

### 1.1 Purpose

The CSV Upload component enables users to import data files (CSV and Excel) into the Field Mapper for association with recorded test steps.

### 1.2 Supported Formats

| Format | Extension | Library | Max Size |
|--------|-----------|---------|----------|
| CSV | .csv | PapaParse 5.5.3 | 10MB |
| Excel | .xlsx | XLSX 0.18.5 | 10MB |
| Excel (legacy) | .xls | XLSX 0.18.5 | 10MB |

### 1.3 Requirements

- **First row must be headers** - No auto-detection of header row
- **UTF-8 encoding** - Non-UTF-8 files may display incorrectly
- **No empty columns** - All columns must have header names
- **Max 10,000 rows** - Performance constraint
- **Max 50 columns** - UI layout constraint

---

## 2. File Upload UI

### 2.1 Upload Button Component
```tsx
import React, { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Upload } from 'lucide-react';

interface CSVUploadButtonProps {
  onFileSelect: (file: File) => void;
  isUploading: boolean;
  disabled?: boolean;
}

export function CSVUploadButton({ 
  onFileSelect, 
  isUploading, 
  disabled 
}: CSVUploadButtonProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
      // Reset input so same file can be uploaded again
      e.target.value = '';
    }
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        onChange={handleFileChange}
        className="hidden"
        aria-label="Upload CSV"
      />
      <Button
        onClick={handleButtonClick}
        disabled={disabled || isUploading}
      >
        <Upload className="h-4 w-4 mr-2" />
        {isUploading ? 'Uploading...' : 'Upload CSV/Excel'}
      </Button>
    </>
  );
}
```

### 2.2 Drag-and-Drop Zone
```tsx
import React, { useState } from 'react';
import { cn } from '@/lib/utils';

interface DropZoneProps {
  onFileDrop: (file: File) => void;
  disabled?: boolean;
}

export function DropZone({ onFileDrop, disabled }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (disabled) return;

    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.csv') || 
                 file.name.endsWith('.xlsx') || 
                 file.name.endsWith('.xls'))) {
      onFileDrop(file);
    } else {
      alert('Please upload a CSV or Excel file');
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "border-2 border-dashed rounded-lg p-12 text-center transition-colors",
        isDragging ? "border-primary bg-primary/5" : "border-gray-300",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      <Upload className="mx-auto h-12 w-12 text-gray-400" />
      <p className="mt-4 text-lg font-medium">
        Drag and drop your CSV or Excel file here
      </p>
      <p className="mt-2 text-sm text-gray-500">
        or click the button above to browse
      </p>
    </div>
  );
}
```

---

## 3. PapaParse Integration

### 3.1 CSV Parsing Implementation
```typescript
import Papa from 'papaparse';

interface ParseResult {
  data: any[];
  headers: string[];
  errors: Papa.ParseError[];
}

export async function parseCSV(file: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,             // First row is headers
      dynamicTyping: false,     // Keep all values as strings
      skipEmptyLines: true,     // Ignore empty rows
      encoding: 'UTF-8',
      complete: (results) => {
        if (results.errors.length > 0) {
          // Filter critical errors (not warnings)
          const criticalErrors = results.errors.filter(
            e => e.type === 'FieldMismatch' || e.type === 'Quotes'
          );
          
          if (criticalErrors.length > 0) {
            reject(new Error(
              `CSV parsing failed: ${criticalErrors[0].message} ` +
              `(row ${criticalErrors[0].row})`
            ));
            return;
          }
        }

        const headers = Object.keys(results.data[0] || {});
        
        resolve({
          data: results.data,
          headers,
          errors: results.errors
        });
      },
      error: (error) => {
        reject(new Error(`CSV parsing error: ${error.message}`));
      }
    });
  });
}
```

### 3.2 PapaParse Configuration Options
```typescript
interface PapaParseConfig {
  header: boolean;            // true = first row is headers
  dynamicTyping: boolean;     // false = keep as strings (safer)
  skipEmptyLines: boolean;    // true = ignore blank rows
  encoding: string;           // 'UTF-8' default
  delimiter: string;          // '' = auto-detect
  newline: string;            // '' = auto-detect
  quoteChar: string;          // '"' default
  escapeChar: string;         // '"' default
  comments: string | false;   // Skip lines starting with this char
  transform: (value: string) => string;  // Custom transformer
}

// Example: Trim whitespace from all values
Papa.parse(file, {
  header: true,
  transform: (value) => value.trim(),
  complete: (results) => { /* ... */ }
});
```

### 3.3 Handling Common CSV Issues

**Issue 1: Unquoted Commas in Fields**
```csv
Name, Description, Price
Product A, High quality, durable material, 29.99
```

**Solution**: Enable `escapeChar` and warn user
```typescript
Papa.parse(file, {
  header: true,
  escapeChar: '\\',
  complete: (results) => {
    if (results.errors.some(e => e.type === 'FieldMismatch')) {
      showWarning('CSV may contain unquoted commas. Please check data.');
    }
  }
});
```

**Issue 2: Line Breaks in Fields**
```csv
Name, Description
Product A, "This is a
multi-line
description"
```

**Solution**: PapaParse handles this automatically if fields are quoted

**Issue 3: BOM (Byte Order Mark)**
```typescript
// Strip BOM if present
function stripBOM(text: string): string {
  if (text.charCodeAt(0) === 0xFEFF) {
    return text.slice(1);
  }
  return text;
}

const csvText = await file.text();
const cleanedText = stripBOM(csvText);
Papa.parse(cleanedText, { /* ... */ });
```

---

## 4. XLSX Integration

### 4.1 Excel Parsing Implementation
```typescript
import * as XLSX from 'xlsx';

export async function parseExcel(file: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        const workbook = XLSX.read(buffer, { type: 'array' });

        // Use first sheet only
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) {
          reject(new Error('Excel file has no sheets'));
          return;
        }

        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert to JSON with headers from first row
        const data = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,        // Raw array of arrays
          defval: '',       // Default value for empty cells
          blankrows: false  // Skip empty rows
        });

        if (data.length === 0) {
          reject(new Error('Excel file is empty'));
          return;
        }

        // First row is headers
        const headers = data[0] as string[];
        
        // Convert remaining rows to objects
        const rows = data.slice(1).map(row => {
          const obj: any = {};
          headers.forEach((header, index) => {
            obj[header] = row[index] || '';
          });
          return obj;
        });

        resolve({
          data: rows,
          headers,
          errors: []
        });
      } catch (error) {
        reject(new Error(`Excel parsing error: ${error.message}`));
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read Excel file'));
    };

    reader.readAsArrayBuffer(file);
  });
}
```

### 4.2 Handling Excel-Specific Issues

**Issue 1: Date Serialization**

Excel stores dates as numbers (e.g., 44562 = 2021-12-01)
```typescript
function excelDateToJSDate(serial: number): Date {
  const utcDays = Math.floor(serial - 25569);
  const utcValue = utcDays * 86400;
  return new Date(utcValue * 1000);
}

// In sheet_to_json callback:
const data = XLSX.utils.sheet_to_json(worksheet, {
  raw: false,  // Format dates as strings
  dateNF: 'yyyy-mm-dd'  // Date format
});
```

**Issue 2: Formula Values**

Excel cells may contain formulas instead of values
```typescript
const data = XLSX.utils.sheet_to_json(worksheet, {
  raw: false,      // Use formatted values (not formulas)
  defval: ''       // Default for cells with errors
});
```

**Issue 3: Merged Cells**
```typescript
// Detect merged cells
const merges = worksheet['!merges'] || [];
if (merges.length > 0) {
  showWarning('Excel file contains merged cells. Data may be incomplete.');
}
```

---

## 5. File Validation

### 5.1 Pre-Parse Validation
```typescript
interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateFile(file: File): ValidationResult {
  const errors: string[] = [];

  // Check file size (10MB limit)
  const MAX_SIZE = 10 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    errors.push(`File size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds 10MB limit`);
  }

  // Check file extension
  const validExtensions = ['.csv', '.xlsx', '.xls'];
  const hasValidExtension = validExtensions.some(ext => 
    file.name.toLowerCase().endsWith(ext)
  );
  if (!hasValidExtension) {
    errors.push('File must be CSV (.csv) or Excel (.xlsx, .xls)');
  }

  // Check file name
  if (file.name.includes('"') || file.name.includes("'")) {
    errors.push('File name cannot contain quotes');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
```

### 5.2 Post-Parse Validation
```typescript
export function validateParsedData(result: ParseResult): ValidationResult {
  const errors: string[] = [];

  // Check for data
  if (result.data.length === 0) {
    errors.push('File contains no data rows (headers only)');
  }

  // Check for headers
  if (result.headers.length === 0) {
    errors.push('File contains no column headers');
  }

  // Check for empty headers
  const emptyHeaders = result.headers.filter(h => !h || h.trim() === '');
  if (emptyHeaders.length > 0) {
    errors.push(`${emptyHeaders.length} columns have empty headers`);
  }

  // Check for duplicate headers
  const headerCounts = result.headers.reduce((acc, h) => {
    acc[h] = (acc[h] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const duplicates = Object.entries(headerCounts)
    .filter(([_, count]) => count > 1)
    .map(([header, count]) => `"${header}" (${count} times)`);
  
  if (duplicates.length > 0) {
    errors.push(`Duplicate column names: ${duplicates.join(', ')}`);
  }

  // Check row count (max 10,000)
  const MAX_ROWS = 10000;
  if (result.data.length > MAX_ROWS) {
    errors.push(`File contains ${result.data.length} rows (max ${MAX_ROWS})`);
  }

  // Check column count (max 50)
  const MAX_COLS = 50;
  if (result.headers.length > MAX_COLS) {
    errors.push(`File contains ${result.headers.length} columns (max ${MAX_COLS})`);
  }

  // Check for completely empty columns
  const emptyColumns = result.headers.filter(header => {
    return result.data.every(row => !row[header] || row[header].trim() === '');
  });
  
  if (emptyColumns.length > 0) {
    errors.push(`Empty columns: ${emptyColumns.join(', ')}`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
```

---

## 6. Preview Table

### 6.1 Preview Component
```tsx
import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Card } from '@/components/ui/card';

interface PreviewTableProps {
  headers: string[];
  data: any[];
  maxRows?: number;
}

export function PreviewTable({ 
  headers, 
  data, 
  maxRows = 10 
}: PreviewTableProps) {
  const previewData = data.slice(0, maxRows);

  return (
    <Card className="overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">#</TableHead>
            {headers.map((header, i) => (
              <TableHead key={i}>
                {header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {previewData.map((row, rowIndex) => (
            <TableRow key={rowIndex}>
              <TableCell className="font-medium">
                {rowIndex + 1}
              </TableCell>
              {headers.map((header, colIndex) => (
                <TableCell 
                  key={colIndex}
                  className={
                    !row[header] || row[header].trim() === '' 
                      ? 'bg-red-50 text-red-500' 
                      : ''
                  }
                >
                  {row[header] || '(empty)'}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {data.length > maxRows && (
        <div className="p-4 text-sm text-gray-500 border-t">
          Showing {maxRows} of {data.length} rows
        </div>
      )}
    </Card>
  );
}
```

### 6.2 Enhanced Preview with Statistics
```tsx
export function PreviewWithStats({ headers, data }: PreviewTableProps) {
  const stats = useMemo(() => {
    const columnStats = headers.map(header => {
      const values = data.map(row => row[header]);
      const emptyCount = values.filter(v => !v || v.trim() === '').length;
      const uniqueCount = new Set(values.filter(v => v)).size;
      
      return {
        header,
        emptyCount,
        emptyPercent: (emptyCount / data.length) * 100,
        uniqueCount,
        sampleValue: values.find(v => v) || '(empty)'
      };
    });

    return columnStats;
  }, [headers, data]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="text-2xl font-bold">{data.length}</div>
          <div className="text-sm text-gray-500">Total Rows</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold">{headers.length}</div>
          <div className="text-sm text-gray-500">Total Columns</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-red-600">
            {stats.filter(s => s.emptyCount > 0).length}
          </div>
          <div className="text-sm text-gray-500">Columns with Empty Values</div>
        </Card>
      </div>

      <PreviewTable headers={headers} data={data} />

      <Card>
        <CardHeader>Column Statistics</CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Column</TableHead>
              <TableHead>Empty Values</TableHead>
              <TableHead>Unique Values</TableHead>
              <TableHead>Sample</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stats.map((stat, i) => (
              <TableRow key={i}>
                <TableCell>{stat.header}</TableCell>
                <TableCell>
                  {stat.emptyCount} ({stat.emptyPercent.toFixed(1)}%)
                </TableCell>
                <TableCell>{stat.uniqueCount}</TableCell>
                <TableCell className="truncate max-w-xs">
                  {stat.sampleValue}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
```

---

## 7. Error Handling

### 7.1 Error Types and Messages
```typescript
export enum CSVErrorType {
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  INVALID_FORMAT = 'INVALID_FORMAT',
  PARSE_ERROR = 'PARSE_ERROR',
  NO_HEADERS = 'NO_HEADERS',
  NO_DATA = 'NO_DATA',
  TOO_MANY_ROWS = 'TOO_MANY_ROWS',
  TOO_MANY_COLUMNS = 'TOO_MANY_COLUMNS',
  DUPLICATE_HEADERS = 'DUPLICATE_HEADERS',
  EMPTY_COLUMNS = 'EMPTY_COLUMNS'
}

export const ERROR_MESSAGES: Record<CSVErrorType, string> = {
  [CSVErrorType.FILE_TOO_LARGE]: 
    'File exceeds 10MB limit. Please split into smaller files.',
  [CSVErrorType.INVALID_FORMAT]: 
    'File must be CSV (.csv) or Excel (.xlsx, .xls).',
  [CSVErrorType.PARSE_ERROR]: 
    'Unable to parse file. Check for formatting issues.',
  [CSVErrorType.NO_HEADERS]: 
    'File must have column headers in the first row.',
  [CSVErrorType.NO_DATA]: 
    'File contains no data rows (headers only).',
  [CSVErrorType.TOO_MANY_ROWS]: 
    'File exceeds 10,000 row limit.',
  [CSVErrorType.TOO_MANY_COLUMNS]: 
    'File exceeds 50 column limit.',
  [CSVErrorType.DUPLICATE_HEADERS]: 
    'File contains duplicate column names.',
  [CSVErrorType.EMPTY_COLUMNS]: 
    'File contains columns with no values.'
};
```

### 7.2 Error Display Component
```tsx
import { AlertCircle, XCircle } from 'lucide-react';

interface ErrorDisplayProps {
  errors: string[];
  onDismiss: () => void;
}

export function ErrorDisplay({ errors, onDismiss }: ErrorDisplayProps) {
  if (errors.length === 0) return null;

  return (
    <Alert variant="destructive" className="mb-4">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle className="flex items-center justify-between">
        Upload Failed
        <Button
          variant="ghost"
          size="sm"
          onClick={onDismiss}
        >
          <XCircle className="h-4 w-4" />
        </Button>
      </AlertTitle>
      <AlertDescription>
        <ul className="list-disc list-inside space-y-1">
          {errors.map((error, i) => (
            <li key={i}>{error}</li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}
```

---

## 8. Performance Optimization

### 8.1 Lazy Parsing
```typescript
// Parse only first N rows for preview, defer full parse
export async function lazyParseCSV(
  file: File, 
  previewRows: number = 10
): Promise<{ preview: ParseResult; fullParse: () => Promise<ParseResult> }> {
  
  // Quick preview parse
  const preview = await new Promise<ParseResult>((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      preview: previewRows,
      complete: (results) => resolve({
        data: results.data,
        headers: Object.keys(results.data[0] || {}),
        errors: results.errors
      })
    });
  });

  // Return preview + deferred full parse function
  const fullParse = () => parseCSV(file);

  return { preview, fullParse };
}
```

### 8.2 Web Worker for Large Files
```typescript
// csvWorker.ts
import Papa from 'papaparse';

self.onmessage = (e: MessageEvent) => {
  const { file, config } = e.data;

  Papa.parse(file, {
    ...config,
    complete: (results) => {
      self.postMessage({ type: 'complete', results });
    },
    error: (error) => {
      self.postMessage({ type: 'error', error });
    },
    chunk: (results, parser) => {
      self.postMessage({ type: 'progress', count: results.data.length });
    }
  });
};

// Usage in main thread:
const worker = new Worker(new URL('./csvWorker.ts', import.meta.url));

worker.onmessage = (e) => {
  if (e.data.type === 'complete') {
    setCsvData(e.data.results.data);
  } else if (e.data.type === 'progress') {
    setProgress(e.data.count);
  }
};

worker.postMessage({ file, config: { header: true } });
```

---

## 9. Security Considerations

### 9.1 File Type Validation
```typescript
// Don't trust file extension - validate MIME type
export function validateMIMEType(file: File): boolean {
  const validTypes = [
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ];

  return validTypes.includes(file.type);
}
```

### 9.2 Content Sanitization
```typescript
// Sanitize cell values to prevent XSS
export function sanitizeValue(value: string): string {
  return value
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

// Apply to all parsed data
const sanitizedData = data.map(row => {
  const sanitizedRow: any = {};
  Object.entries(row).forEach(([key, value]) => {
    sanitizedRow[key] = sanitizeValue(String(value));
  });
  return sanitizedRow;
});
```

---

## 10. Testing Strategy

### 10.1 Unit Tests
```typescript
describe('parseCSV', () => {
  it('parses valid CSV with headers', async () => {
    const csvContent = 'Name,Email\nJohn,john@example.com';
    const file = new File([csvContent], 'test.csv', { type: 'text/csv' });
    
    const result = await parseCSV(file);
    
    expect(result.headers).toEqual(['Name', 'Email']);
    expect(result.data).toEqual([{ Name: 'John', Email: 'john@example.com' }]);
  });

  it('handles malformed CSV gracefully', async () => {
    const csvContent = 'Name,Email\nJohn,"invalid,quote,field"';
    const file = new File([csvContent], 'test.csv');
    
    await expect(parseCSV(file)).rejects.toThrow('CSV parsing failed');
  });
});
```

### 10.2 Integration Tests
```typescript
describe('CSV Upload Flow', () => {
  it('completes full upload and preview', async () => {
    render(<CSVUploadButton onFileSelect={jest.fn()} isUploading={false} />);
    
    const file = new File(['Name,Email\nJohn,john@example.com'], 'test.csv');
    const input = screen.getByLabelText('Upload CSV');
    
    fireEvent.change(input, { target: { files: [file] } });
    
    await waitFor(() => {
      expect(screen.getByText('John')).toBeInTheDocument();
      expect(screen.getByText('john@example.com')).toBeInTheDocument();
    });
  });
});
```

---

## Summary

CSV Upload Component provides:
- ✅ **Dual format support** with PapaParse (CSV) and XLSX (Excel)
- ✅ **Drag-and-drop interface** with visual feedback
- ✅ **Comprehensive validation** (file size, format, headers, data)
- ✅ **Preview table** with first 10 rows and statistics
- ✅ **Robust error handling** with specific error messages
- ✅ **Performance optimization** via lazy parsing and Web Workers
- ✅ **Security measures** including MIME validation and XSS prevention

This ensures reliable data import with clear feedback for common issues.
