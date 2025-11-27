# Field Mapper Overview
**Project:** Chrome Extension Test Recorder  
**Document Version:** 1.0  
**Last Updated:** November 25, 2025  
**Status:** Complete Technical Specification

## Table of Contents
1. Overview
2. Architecture
3. Component Structure
4. Data Flow
5. State Management
6. Integration Points
7. User Experience Flow
8. Performance Considerations
9. Error Handling Strategy
10. Future Enhancements

---

## 1. Overview

### 1.1 Purpose

The Field Mapper subsystem enables data-driven test automation by associating CSV column headers with recorded step labels, allowing users to execute a single recording across multiple data rows.

### 1.2 Key Capabilities

- **File Import**: Accept CSV and Excel files up to 10MB
- **Intelligent Parsing**: Auto-detect headers and data structure
- **Fuzzy Auto-Mapping**: Match CSV columns to step labels using similarity algorithms
- **Manual Override**: Drag-and-drop or dropdown-based mapping adjustment
- **Data Preview**: Display first 10 rows for validation
- **Mapping Persistence**: Save associations for reuse across test runs
- **Validation**: Check for required fields, empty values, type mismatches

### 1.3 User Workflow
```
1. Upload CSV/Excel file
   ↓
2. System parses and extracts headers
   ↓
3. Auto-mapping algorithm suggests associations (30% threshold)
   ↓
4. User reviews and adjusts mappings
   ↓
5. Validate (at least one field mapped)
   ↓
6. Save mappings to project
   ↓
7. Navigate to Test Runner for execution
```

---

## 2. Architecture

### 2.1 High-Level Components
```
┌─────────────────────────────────────────────────────────────────┐
│                      FIELD MAPPER PAGE                          │
│                   (FieldMapper.tsx - 523 lines)                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌────────────────────┐  ┌──────────────────────────────────┐ │
│  │  Upload Handler    │  │   Auto-Mapping Engine            │ │
│  │                    │  │                                  │ │
│  │  • File input      │  │  • Normalize field names         │ │
│  │  • CSV/Excel parse │  │  • Compare with step labels      │ │
│  │  • Header extract  │  │  • Calculate similarity scores   │ │
│  │  • Preview rows    │  │  • Select best matches (≥0.3)    │ │
│  └────────────────────┘  └──────────────────────────────────┘ │
│                                                                 │
│  ┌────────────────────┐  ┌──────────────────────────────────┐ │
│  │ Mapping Table UI   │  │   Validation Engine              │ │
│  │                    │  │                                  │ │
│  │  • CSV field list  │  │  • Check required fields         │ │
│  │  • Dropdown select │  │  • Validate data types           │ │
│  │  • Status icons    │  │  • Detect duplicates             │ │
│  │  • Preview values  │  │  • Empty value detection         │ │
│  └────────────────────┘  └──────────────────────────────────┘ │
│                                                                 │
│  ┌────────────────────┐  ┌──────────────────────────────────┐ │
│  │  Statistics Panel  │  │   Storage Coordinator            │ │
│  │                    │  │                                  │ │
│  │  • Mapped count    │  │  • Save mappings                 │ │
│  │  • Unmapped count  │  │  • Persist CSV data (10 rows)    │ │
│  │  • Progress %      │  │  • Update project status         │ │
│  └────────────────────┘  └──────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
        ↓                           ↓                      ↓
┌──────────────┐          ┌─────────────────┐    ┌────────────────┐
│  PapaParse   │          │ string-similarity│    │   IndexedDB    │
│  (CSV parse) │          │  (Dice coeff)    │    │  (persistence) │
└──────────────┘          └─────────────────┘    └────────────────┘
```

### 2.2 File Structure
```
src/
├── pages/
│   └── FieldMapper.tsx              (Main page - 523 lines)
├── components/
│   └── Mapper/
│       ├── FieldMappingTable.tsx    (Mapping UI - 200 lines)
│       ├── FieldMappingPanel.tsx    (Controls - 150 lines)
│       ├── MappingSummary.tsx       (Statistics - 100 lines)
│       └── WebPreview.tsx           (Data preview - 120 lines)
├── services/
│   ├── csvParser.ts                 (CSV parsing logic)
│   └── fieldMatcher.ts              (Auto-mapping algorithm)
└── types/
    └── mapping.ts                   (TypeScript interfaces)
```

---

## 3. Component Structure

### 3.1 Main Page Component

#### File: `src/pages/FieldMapper.tsx`

**Responsibilities:**
- Coordinate all child components
- Manage file upload flow
- Handle auto-mapping trigger
- Save mappings to storage
- Navigate to Test Runner

**Key State:**
```typescript
const [fields, setFields] = useState([]);
const [csvData, setCsvData] = useState([]);
const [recordedSteps, setRecordedSteps] = useState([]);
const [isUploadingCSV, setIsUploadingCSV] = useState(false);
const [isMapping, setIsMapping] = useState(false);
const [error, setError] = useState(null);
const [project, setProject] = useState(null);
```

**Key Methods:**
```typescript
handleCSVUpload(file: File): Promise
autoMapFields(): void
updateFieldMapping(index: number, updates: Partial): void
saveMappings(): Promise
validateMappings(): boolean
navigateToRunner(): void
```

### 3.2 Child Components

#### FieldMappingTable Component

**Purpose**: Display CSV fields with dropdown selectors for step association

**Props:**
```typescript
interface FieldMappingTableProps {
  fields: Field[];
  recordedSteps: RecordedStep[];
  csvPreview: any[];
  onUpdateField: (index: number, updates: Partial) => void;
}
```

**Layout:**
| CSV Field | Preview Value | Recorded Step | Status |
|-----------|---------------|---------------|--------|
| First Name | John | [Dropdown: Step labels] | ✓ Mapped |
| Email | john@... | [Dropdown: Step labels] | ○ Unmapped |

#### MappingSummary Component

**Purpose**: Show mapping statistics and progress

**Display:**
```tsx
<Card>
  <CardHeader>Mapping Progress</CardHeader>
  <CardContent>
    <Progress value={mappedPercentage} />
    <div>
      <Badge>{mappedCount} Mapped</Badge>
      <Badge>{unmappedCount} Unmapped</Badge>
    </div>
  </CardContent>
</Card>
```

#### WebPreview Component

**Purpose**: Display first 10 rows of CSV data

**Features:**
- Sortable columns
- Horizontal scroll for many columns
- Highlight empty values in red
- Show data types (inferred)

---

## 4. Data Flow

### 4.1 Complete Flow Diagram
```
┌─────────────────────────────────────────────────────────────────┐
│ 1. FILE UPLOAD                                                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
        User selects CSV/Excel file via <input type="file">
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. FILE READING                                                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
        CSV: file.text() → string
        Excel: FileReader.readAsArrayBuffer() → ArrayBuffer
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. PARSING                                                      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
        CSV: PapaParse.parse(csvText, { header: true })
          → { data: [ {col1: val1, col2: val2}, ... ], errors: [] }
        
        Excel: XLSX.read(buffer, { type: 'array' })
          → workbook.Sheets[firstSheet]
          → XLSX.utils.sheet_to_json(sheet)
          → [ {col1: val1, col2: val2}, ... ]
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. DATA EXTRACTION                                              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
        headers = Object.keys(data[0])
        preview = data.slice(0, 10)
        
        Create Field objects:
        fields = headers.map(h => ({
          field_name: h,
          mapped: false,
          inputvarfields: ""
        }))
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5. AUTO-MAPPING (Optional)                                      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
        For each field:
          1. Normalize: lowercase, remove spaces/underscores
          2. Compare with all step labels using Dice coefficient
          3. If similarity ≥ 0.3 (30%), mark as mapped
          4. Store best match in inputvarfields
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 6. USER REVIEW & MANUAL ADJUSTMENT                              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
        User sees FieldMappingTable with:
        - Auto-mapped fields (green checkmark)
        - Unmapped fields (empty circle)
        
        User can:
        - Change mapping via dropdown
        - Unmap fields
        - Re-trigger auto-mapping
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 7. VALIDATION                                                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
        Check:
        - At least one field mapped
        - No duplicate mappings (optional warning)
        - CSV has data rows (not just headers)
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 8. PERSISTENCE                                                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
        chrome.runtime.sendMessage({
          action: "update_project_fields",
          payload: {
            id: projectId,
            parsed_fields: fields,
            status: 'testing'
          }
        })
        
        chrome.runtime.sendMessage({
          action: "update_project_csv",
          payload: {
            id: projectId,
            csv_data: preview  // Only first 10 rows
          }
        })
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 9. NAVIGATION                                                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
        Redirect to Test Runner:
        window.location.href = "#/TestRunner?project=" + projectId
```

### 4.2 Message Flow
```
FieldMapper.tsx
      ↓ (upload file)
  csvParser.ts (parse)
      ↓ (return data)
  setState({ fields, csvData })
      ↓ (trigger auto-map)
  fieldMatcher.ts (compute similarities)
      ↓ (return matches)
  setState({ fields: updatedFields })
      ↓ (user saves)
  chrome.runtime.sendMessage("update_project_fields")
      ↓
Background Service
      ↓
IndexedDB (persist)
      ↓ (callback success)
  Show success notification
      ↓
  Navigate to Test Runner
```

---

## 5. State Management

### 5.1 State Structure
```typescript
// Field Mapper Page State
interface FieldMapperState {
  // Data
  fields: Field[];                    // CSV columns with mapping status
  csvData: any[];                     // Parsed CSV rows (first 10)
  recordedSteps: RecordedStep[];      // Available step labels for mapping
  project: Project | null;            // Current project metadata
  
  // UI State
  isUploadingCSV: boolean;            // File upload in progress
  isMapping: boolean;                 // Auto-mapping running
  error: string | null;               // Error/success messages
  
  // Validation
  validationErrors: string[];         // List of validation issues
  isValid: boolean;                   // Can proceed to save
}

// Field Interface
interface Field {
  field_name: string;        // CSV column name (e.g., "First Name")
  mapped: boolean;           // Has been associated with a step
  inputvarfields: string;    // Mapped step label (e.g., "Enter first name")
  confidence?: number;       // Auto-mapping confidence (0-100, optional)
}

// Recorded Step Interface (from Recording Engine)
interface RecordedStep {
  id: string;
  label: string;             // User-friendly label (e.g., "Email Address")
  event: StepEvent;
  selector?: string;
  value?: any;
}
```

### 5.2 State Updates

**File Upload:**
```typescript
setIsUploadingCSV(true);
// ... parsing logic
setFields(extractedFields);
setCsvData(parsedData.slice(0, 10));
setIsUploadingCSV(false);
```

**Auto-Mapping:**
```typescript
setIsMapping(true);
// ... similarity calculations
setFields(fieldsWithMappings);
setError(`Auto-mapped ${count} fields`);
setIsMapping(false);
```

**Manual Adjustment:**
```typescript
const updateFieldMapping = (index: number, updates: Partial) => {
  setFields(prev => prev.map((field, i) => 
    i === index ? { ...field, ...updates } : field
  ));
};
```

### 5.3 Derived State
```typescript
// Computed values (useMemo)
const mappedCount = useMemo(() => 
  fields.filter(f => f.mapped).length, 
  [fields]
);

const unmappedCount = useMemo(() => 
  fields.filter(f => !f.mapped).length, 
  [fields]
);

const mappedPercentage = useMemo(() => 
  fields.length > 0 ? (mappedCount / fields.length) * 100 : 0,
  [mappedCount, fields.length]
);

const isValid = useMemo(() => 
  mappedCount > 0 && csvData.length > 0,
  [mappedCount, csvData.length]
);
```

---

## 6. Integration Points

### 6.1 Dependencies (Consumes)

**Recording Engine:**
- Provides: `recordedSteps` array with step labels
- Used for: Mapping target options in dropdowns
- Message: `chrome.runtime.sendMessage({ action: 'get_project', payload: { id } })`

**Storage Layer:**
- Provides: Persistence for mappings and CSV data
- Used for: Saving field associations and preview data
- Messages:
  - `update_project_fields` → Save field mappings
  - `update_project_csv` → Save CSV preview (10 rows)

**File System APIs:**
- Provides: File reading capabilities
- Used for: CSV and Excel file access
- APIs:
  - `File.text()` for CSV
  - `FileReader.readAsArrayBuffer()` for Excel

### 6.2 Dependents (Provides To)

**Test Runner:**
- Provides: Field mappings for value injection
- Format: `{ field_name: "Email", inputvarfields: "Email Address" }`
- Usage: Test Runner creates lookup object to inject CSV values into steps

**Export Functionality:**
- Provides: CSV data structure for export
- Format: Array of row objects with headers as keys
- Usage: Export buttons in Dashboard/Recorder

### 6.3 External Libraries

| Library | Version | Purpose |
|---------|---------|---------|
| **papaparse** | 5.5.3 | CSV parsing with auto-header detection |
| **xlsx** | 0.18.5 | Excel file parsing (.xlsx, .xls) |
| **string-similarity** | 4.0.4 | Fuzzy matching using Dice coefficient |

---

## 7. User Experience Flow

### 7.1 Happy Path
```
1. User clicks "Upload CSV" button
   ↓
2. File picker opens
   ↓
3. User selects customers.csv (2,000 rows)
   ↓
4. Loading spinner appears
   ↓
5. System parses file (1-2 seconds)
   ↓
6. Preview table shows first 10 rows
   ↓
7. Mapping table appears with:
   - "First Name" → Auto-mapped to "Enter first name" ✓
   - "Email" → Auto-mapped to "Email Address" ✓
   - "Phone" → Unmapped ○
   ↓
8. User manually maps "Phone" to "Phone Number" step
   ↓
9. Progress bar shows 100% (3/3 fields mapped)
   ↓
10. User clicks "Save & Continue"
   ↓
11. Success message: "Mappings saved successfully!"
   ↓
12. System navigates to Test Runner
```

### 7.2 Error Paths

**Path A: Malformed CSV**
```
1. User uploads CSV with unquoted commas
   ↓
2. PapaParse returns errors array
   ↓
3. Error message: "CSV parsing failed: Unquoted field on line 5"
   ↓
4. User fixes CSV and re-uploads
```

**Path B: No Mappings**
```
1. User tries to save without mapping any fields
   ↓
2. Validation fails
   ↓
3. Error message: "Please map at least one field before saving"
   ↓
4. Save button remains disabled
```

**Path C: Large File**
```
1. User uploads 15MB CSV (exceeds 10MB limit)
   ↓
2. Error message: "File too large. Maximum size is 10MB"
   ↓
3. User splits file or uses smaller dataset
```

---

## 8. Performance Considerations

### 8.1 Current Limitations

| Metric | Current | Target (Phase 2) |
|--------|---------|------------------|
| Max file size | 10MB | 50MB (streaming) |
| Max rows | 10,000 | 100,000 (progressive) |
| Parse time (5MB) | 2-3 seconds | <1 second (Web Worker) |
| Preview rows | 10 | Configurable (10-100) |
| Auto-mapping | Synchronous | Async with progress |

### 8.2 Optimization Strategies

**Implemented:**
- Store only first 10 rows in IndexedDB (not entire CSV)
- Full CSV re-parsed during test execution from original file
- Memoized computed values (mappedCount, percentage)

**Planned (Phase 2):**
- Web Worker for parsing large files
- Streaming parser (process in chunks)
- Virtual scrolling for preview table (>100 rows)
- Debounced search/filter in mapping table

### 8.3 Memory Usage
```
Typical CSV (1,000 rows, 10 columns):
- File in memory: ~500KB
- Parsed JSON: ~800KB
- Preview (10 rows): ~8KB
- Total peak memory: ~1.3MB

Large CSV (100,000 rows, 50 columns):
- File in memory: ~50MB
- Parsed JSON: ~80MB
- Preview (10 rows): ~10KB
- Total peak memory: ~130MB (concern for 32-bit systems)
```

---

## 9. Error Handling Strategy

### 9.1 Error Categories

**Parse Errors:**
- Malformed CSV (unquoted fields, missing delimiters)
- Corrupted Excel files
- Unsupported formats (e.g., .xlsm with macros)
- Encoding issues (non-UTF-8)

**Validation Errors:**
- Empty CSV (headers but no data)
- Missing headers
- Duplicate column names
- Invalid characters in headers

**Mapping Errors:**
- No recorded steps available
- No fields mapped
- Duplicate mappings (same step mapped multiple times)

**Storage Errors:**
- IndexedDB quota exceeded
- Permission denied
- Concurrent write conflicts

### 9.2 Error Display
```tsx
{error && (
  <Alert variant={error.includes('success') ? 'default' : 'destructive'}>
    <AlertCircle />
    <AlertTitle>
      {error.includes('success') ? 'Success' : 'Error'}
    </AlertTitle>
    <AlertDescription>{error}</AlertDescription>
  </Alert>
)}
```

### 9.3 Recovery Actions

| Error Type | Recovery |
|------------|----------|
| Parse error | Show line number, allow retry |
| Validation error | Highlight issue, disable save |
| Storage error | Suggest clearing old data |
| Network timeout | Retry button |

---

## 10. Future Enhancements

### 10.1 Phase 2 Features

**Smart Type Detection:**
- Infer column types (email, phone, date, number)
- Validate values against detected type
- Show type icons in preview table

**Multi-File Support:**
- Upload multiple CSVs
- Join on common columns
- Handle missing values in joins

**Mapping Templates:**
- Save/load mapping configurations
- Share templates across projects
- Auto-apply based on column name patterns

### 10.2 Phase 3 Features

**Machine Learning Auto-Mapping:**
- Train on past mappings
- Context-aware suggestions
- Confidence scoring

**Data Transformations:**
- Uppercase/lowercase
- Date formatting
- String concatenation (First + Last → Full Name)
- Regex-based cleanup

**Advanced Validation:**
- Custom validation rules per field
- Cross-field validation (e.g., end_date > start_date)
- Required field enforcement

---

## Summary

The Field Mapper subsystem provides:
- ✅ **Dual format support** for CSV and Excel files
- ✅ **Intelligent auto-mapping** using fuzzy string matching (30% threshold)
- ✅ **User-friendly review interface** with drag-and-drop and dropdown controls
- ✅ **Efficient preview** storing only 10 rows for validation
- ✅ **Robust error handling** for parse, validation, and storage errors
- ✅ **Extensible architecture** ready for streaming, ML, and transformations

This enables users to scale from single test recordings to data-driven automation across thousands of rows with minimal manual configuration.
