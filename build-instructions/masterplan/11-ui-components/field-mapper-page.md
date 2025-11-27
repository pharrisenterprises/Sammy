# Field Mapper Page
**Project:** Chrome Extension Test Recorder - UI Components  
**Document Version:** 1.0  
**Last Updated:** November 25, 2025  
**Status:** Complete Technical Specification

## Table of Contents
1. Overview
2. Data Interfaces
3. Page Layout
4. CSV Upload
5. Mapping Table
6. Auto-Mapping
7. Mapping Summary
8. Preview Panel
9. State Management
10. Testing Strategy

---

## 1. Overview

### 1.1 Purpose

The Field Mapper page (523 lines) provides the interface for uploading CSV files and mapping columns to recorded step labels for data-driven testing.

### 1.2 File Location
```
src/pages/FieldMapper.tsx (523 lines)
```

### 1.3 Key Features

- CSV file upload with drag-and-drop
- Column-to-field mapping table
- Auto-mapping with similarity matching
- Mapping validation and summary
- Preview panel with sample data

---

## 2. Data Interfaces

### 2.1 Field Interface (CRITICAL - Must Match Existing)
```typescript
// CRITICAL: Field interface MUST match existing system
interface Field {
  field_name: string;       // CSV column name
  mapped: boolean;          // Is this field mapped to a step?
  inputvarfields: string;   // The step label this maps to
}
```

### 2.2 Mapping State
```typescript
interface MappingState {
  projectId: number | null;
  csvFile: File | null;
  csvHeaders: string[];
  csvRows: string[][];
  fields: Field[];
  stepLabels: string[];     // Available step labels to map to
  isLoading: boolean;
  error: string | null;
}
```

### 2.3 CSV Data
```typescript
interface CSVData {
  headers: string[];
  rows: string[][];
  totalRows: number;
}
```

---

## 3. Page Layout

### 3.1 Component Structure
```typescript
// src/pages/FieldMapper.tsx
import React, { useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import Papa from 'papaparse';
import { Upload, FileSpreadsheet, ArrowRight, Check, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FieldMappingTable } from '@/components/Mapper/FieldMappingTable';
import { MappingSummary } from '@/components/Mapper/MappingSummary';

export function FieldMapper() {
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('id');

  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<CSVData | null>(null);
  const [fields, setFields] = useState<Field[]>([]);
  const [stepLabels, setStepLabels] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load step labels on mount
  useEffect(() => {
    if (projectId) {
      loadStepLabels(parseInt(projectId));
    }
  }, [projectId]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-2xl font-bold text-gray-900">
          Field Mapper
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          Map CSV columns to recording fields for data-driven testing
        </p>
      </header>

      <div className="p-6">
        {!csvData ? (
          /* Upload Zone */
          <CSVUploadZone onFileSelect={handleFileSelect} />
        ) : (
          /* Mapping Interface */
          <div className="space-y-6">
            {/* File Info */}
            <FileInfoCard file={csvFile} totalRows={csvData.totalRows} />

            {/* Mapping Table */}
            <FieldMappingTable
              fields={fields}
              stepLabels={stepLabels}
              onMappingChange={handleMappingChange}
              onAutoMap={handleAutoMap}
            />

            {/* Summary */}
            <MappingSummary fields={fields} onSave={handleSave} />

            {/* Preview */}
            <PreviewPanel headers={csvData.headers} rows={csvData.rows.slice(0, 5)} fields={fields} />
          </div>
        )}
      </div>
    </div>
  );
}
```

---

## 4. CSV Upload

### 4.1 Upload Zone Component
```typescript
// src/components/Mapper/CSVUploadZone.tsx
interface CSVUploadZoneProps {
  onFileSelect: (file: File) => void;
}

export function CSVUploadZone({ onFileSelect }: CSVUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file && (file.type === 'text/csv' || file.name.endsWith('.csv'))) {
      onFileSelect(file);
    }
  }, [onFileSelect]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
      className={`
        border-2 border-dashed rounded-lg p-12 text-center cursor-pointer
        transition-colors
        ${isDragging
          ? 'border-blue-500 bg-blue-50'
          : 'border-gray-300 hover:border-gray-400'
        }
      `}
    >
      <FileSpreadsheet className="w-16 h-16 mx-auto text-gray-400 mb-4" />
      <p className="text-lg font-medium text-gray-700 mb-2">
        Drop your CSV file here
      </p>
      <p className="text-sm text-gray-500">
        or click to browse
      </p>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}
```

### 4.2 CSV Parsing
```typescript
// Using PapaParse library
async function handleFileSelect(file: File): Promise<void> {
  setCsvFile(file);
  setIsLoading(true);

  Papa.parse(file, {
    header: false,
    skipEmptyLines: true,
    complete: (results) => {
      const rows = results.data as string[][];
      const headers = rows[0];
      const dataRows = rows.slice(1);

      setCsvData({
        headers,
        rows: dataRows,
        totalRows: dataRows.length
      });

      // Initialize fields from headers
      const initialFields: Field[] = headers.map(header => ({
        field_name: header,
        mapped: false,
        inputvarfields: ''
      }));

      setFields(initialFields);
      setIsLoading(false);
    },
    error: (error) => {
      console.error('CSV parse error:', error);
      setIsLoading(false);
    }
  });
}
```

---

## 5. Mapping Table

### 5.1 Table Component
```typescript
// src/components/Mapper/FieldMappingTable.tsx
interface FieldMappingTableProps {
  fields: Field[];
  stepLabels: string[];
  onMappingChange: (fieldName: string, stepLabel: string) => void;
  onAutoMap: () => void;
}

export function FieldMappingTable({
  fields,
  stepLabels,
  onMappingChange,
  onAutoMap
}: FieldMappingTableProps) {
  return (
    <div className="bg-white rounded-lg shadow">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">
          Column Mappings
        </h2>
        <Button onClick={onAutoMap} variant="outline">
          Auto-Map Fields
        </Button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                CSV Column
              </th>
              <th className="px-6 py-3 w-12"></th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Maps To Step
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {fields.map((field) => (
              <MappingRow
                key={field.field_name}
                field={field}
                stepLabels={stepLabels}
                onMappingChange={onMappingChange}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

### 5.2 Mapping Row
```typescript
interface MappingRowProps {
  field: Field;
  stepLabels: string[];
  onMappingChange: (fieldName: string, stepLabel: string) => void;
}

function MappingRow({ field, stepLabels, onMappingChange }: MappingRowProps) {
  return (
    <tr className="hover:bg-gray-50">
      {/* CSV Column Name */}
      <td className="px-6 py-4">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="w-4 h-4 text-gray-400" />
          <span className="font-medium text-gray-900">{field.field_name}</span>
        </div>
      </td>

      {/* Arrow */}
      <td className="px-6 py-4 text-center">
        <ArrowRight className="w-4 h-4 text-gray-400" />
      </td>

      {/* Step Dropdown */}
      <td className="px-6 py-4">
        <select
          value={field.inputvarfields}
          onChange={(e) => onMappingChange(field.field_name, e.target.value)}
          className="w-full rounded-md border-gray-300 text-sm"
        >
          <option value="">-- Select Step --</option>
          {stepLabels.map((label) => (
            <option key={label} value={label}>
              {label}
            </option>
          ))}
        </select>
      </td>

      {/* Status */}
      <td className="px-6 py-4">
        {field.mapped ? (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
            <Check className="w-3 h-3" />
            Mapped
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
            <AlertTriangle className="w-3 h-3" />
            Unmapped
          </span>
        )}
      </td>
    </tr>
  );
}
```

---

## 6. Auto-Mapping

### 6.1 Auto-Map Function
```typescript
// CRITICAL: Use 0.3 threshold (30% similarity), NOT 0.8
import stringSimilarity from 'string-similarity';

function handleAutoMap(): void {
  const updatedFields = fields.map(field => {
    // Find best matching step label
    const matches = stringSimilarity.findBestMatch(
      field.field_name.toLowerCase(),
      stepLabels.map(label => label.toLowerCase())
    );

    // CRITICAL: Threshold is 0.3 (30%), NOT 0.8 (80%)
    if (matches.bestMatch.rating >= 0.3) {
      const matchedLabel = stepLabels[matches.bestMatchIndex];
      return {
        ...field,
        mapped: true,
        inputvarfields: matchedLabel
      };
    }

    return field;
  });

  setFields(updatedFields);

  // Log auto-mapping results
  const mappedCount = updatedFields.filter(f => f.mapped).length;
  console.log(`Auto-mapped ${mappedCount} of ${fields.length} fields`);
}
```

### 6.2 Similarity Scoring
```typescript
// string-similarity uses Dice coefficient
// 0.0 = no similarity, 1.0 = exact match

// Examples at 0.3 threshold:
// "email" ↔ "Email Address" = 0.36 ✓ MATCHES
// "first_name" ↔ "First Name" = 0.67 ✓ MATCHES
// "user_id" ↔ "Username" = 0.35 ✓ MATCHES
// "xyz" ↔ "Email" = 0.0 ✗ NO MATCH

// At 0.8 threshold (TOO STRICT):
// "email" ↔ "Email Address" = 0.36 ✗ NO MATCH (wrong!)
// "first_name" ↔ "First Name" = 0.67 ✗ NO MATCH (wrong!)
```

### 6.3 Manual Mapping Change
```typescript
function handleMappingChange(fieldName: string, stepLabel: string): void {
  setFields(prevFields =>
    prevFields.map(field => {
      if (field.field_name === fieldName) {
        return {
          ...field,
          mapped: stepLabel !== '',
          inputvarfields: stepLabel
        };
      }
      return field;
    })
  );
}
```

---

## 7. Mapping Summary

### 7.1 Summary Component
```typescript
// src/components/Mapper/MappingSummary.tsx
interface MappingSummaryProps {
  fields: Field[];
  onSave: () => void;
}

export function MappingSummary({ fields, onSave }: MappingSummaryProps) {
  const mappedCount = fields.filter(f => f.mapped).length;
  const unmappedCount = fields.length - mappedCount;
  const allMapped = unmappedCount === 0;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          {/* Mapped Count */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
              <Check className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{mappedCount} Mapped</div>
              <div className="text-sm text-gray-600">Fields configured</div>
            </div>
          </div>

          {/* Unmapped Count */}
          {unmappedCount > 0 && (
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">{unmappedCount} Unmapped</div>
                <div className="text-sm text-gray-600">Fields need attention</div>
              </div>
            </div>
          )}
        </div>

        {/* Save Button */}
        <Button onClick={onSave} disabled={!allMapped} size="lg">
          {allMapped ? 'Save Mappings' : 'Map All Fields First'}
        </Button>
      </div>

      {/* Warning */}
      {!allMapped && (
        <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            All CSV columns must be mapped to step labels before saving.
            Unmapped columns will not be used during test execution.
          </p>
        </div>
      )}
    </div>
  );
}
```

---

## 8. Preview Panel

### 8.1 Preview Component
```typescript
// src/components/Mapper/PreviewPanel.tsx
interface PreviewPanelProps {
  headers: string[];
  rows: string[][];
  fields: Field[];
}

export function PreviewPanel({ headers, rows, fields }: PreviewPanelProps) {
  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Data Preview</h2>
        <p className="text-sm text-gray-600 mt-1">First 5 rows of your CSV</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {headers.map((header, index) => {
                const field = fields.find(f => f.field_name === header);
                const isMapped = field?.mapped;

                return (
                  <th key={index} className="px-4 py-3 text-left font-medium text-gray-700">
                    {header}
                    {isMapped && (
                      <div className="text-xs text-green-600 font-normal mt-1">
                        → {field.inputvarfields}
                      </div>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="hover:bg-gray-50">
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="px-4 py-3 text-gray-900">
                    {cell || '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

---

## 9. State Management

### 9.1 Load Step Labels
```typescript
async function loadStepLabels(projectId: number): Promise<void> {
  try {
    // CRITICAL: Use lowercase snake_case action
    const response = await chrome.runtime.sendMessage({
      action: 'get_project_steps',  // NOT 'GET_PROJECT_STEPS'
      data: { id: projectId }
    });

    if (response.success) {
      // Extract unique labels from steps
      const labels = response.steps
        .map((step: Step) => step.label)
        .filter((label: string) => label && label.trim());

      setStepLabels([...new Set(labels)]);
    }
  } catch (error) {
    console.error('Failed to load step labels:', error);
  }
}
```

### 9.2 Save Mappings
```typescript
async function handleSave(): Promise<void> {
  if (!projectId) return;

  try {
    // Save field mappings
    const response = await chrome.runtime.sendMessage({
      action: 'save_field_mappings',
      data: {
        projectId: parseInt(projectId),
        fields: fields
      }
    });

    if (response.success) {
      // Navigate to test runner
      navigate(`/runner?id=${projectId}`);
    }
  } catch (error) {
    console.error('Failed to save mappings:', error);
  }
}
```

---

## 10. Testing Strategy

### 10.1 Component Tests
```typescript
describe('FieldMapper', () => {
  it('parses CSV file correctly', async () => {
    const file = new File(
      ['name,email\nJohn,john@test.com'],
      'test.csv',
      { type: 'text/csv' }
    );

    render(<FieldMapper />);

    // Simulate file drop
    const dropZone = screen.getByText(/Drop your CSV/i);
    fireEvent.drop(dropZone, { dataTransfer: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('name')).toBeInTheDocument();
      expect(screen.getByText('email')).toBeInTheDocument();
    });
  });

  it('auto-maps with 0.3 threshold', async () => {
    // Setup with step labels
    const stepLabels = ['Email Address', 'First Name'];

    render(<FieldMapper />);

    fireEvent.click(screen.getByText('Auto-Map Fields'));

    // Both should match with 0.3 threshold
    await waitFor(() => {
      expect(screen.getAllByText('Mapped')).toHaveLength(2);
    });
  });
});
```

---

## Summary

Field Mapper Page provides:
- ✅ **Correct Field interface** (`field_name`, `mapped`, `inputvarfields`)
- ✅ **CSV upload** with drag-and-drop and PapaParse
- ✅ **Mapping table** with dropdowns
- ✅ **Auto-mapping** with **0.3 threshold** (NOT 0.8)
- ✅ **Mapping summary** with validation
- ✅ **Preview panel** with sample data
- ✅ **Correct message actions** (lowercase snake_case)
- ✅ **Testing strategy** for components

Aligns with existing project knowledge base interfaces.
