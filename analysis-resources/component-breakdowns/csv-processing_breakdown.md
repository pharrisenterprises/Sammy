# csv-processing_breakdown.md

## Purpose
Data import, parsing, validation, and field mapping engine that transforms CSV/Excel files into structured data rows for data-driven test execution with fuzzy auto-mapping.

## Inputs
- File uploads: CSV (.csv) and Excel (.xlsx) files from user
- Recorded steps: array of step objects with labels for mapping targets
- Project ID: associated automation project identifier
- File requirements: CSV with headers in first row, Excel first sheet used

## Outputs
- Parsed data: array of row objects with header keys (first 10 rows stored as preview)
- Field mappings: { field_name: string, mapped: boolean, inputvarfields: string }[] associating CSV columns to step labels
- Mapping statistics: count of mapped/unmapped fields, progress percentage
- Storage: Persisted to IndexedDB via update_project_csv and update_project_fields actions

## Internal Architecture
- **Upload Handler** (FieldMapper.tsx lines 120-220): File.text() for CSV, FileReader.arrayBuffer() for Excel, Papa.parse() with header:true for CSV, XLSX.read() + sheet_to_json() for Excel
- **Auto-Mapping Algorithm** (lines 220-300): Normalizes field names (lowercase, remove spaces/underscores), compares with step labels using stringSimilarity.compareTwoStrings(), threshold 0.3 (30% similarity), selects best match per field
- **Manual Mapping UI** (FieldMappingTable.tsx): React Select dropdown per CSV field, maps to recorded step labels, tracks mapped status
- **Validation**: Checks for empty files, missing headers, parse errors, requires at least one mapped field before save
- **Similarity Algorithm**: Dice coefficient from string-similarity library, bigram-based comparison, returns 0-1 score

## Critical Dependencies
- **Files**: src/pages/FieldMapper.tsx (523 lines), src/components/Mapper/FieldMappingTable.tsx, src/components/Mapper/MappingSummary.tsx
- **Libraries**: papaparse (5.5.3) for CSV, xlsx (0.18.5) for Excel, string-similarity (4.0.4) for fuzzy matching
- **Browser APIs**: File API, FileReader for binary parsing
- **Subsystems**: Storage Layer for persistence, Recording Engine for step labels, Test Runner consumes CSV data

## Hidden Assumptions
- First row always contains headers - no header detection or user prompt
- Excel files use first sheet only - multi-sheet workbooks ignored
- Similarity threshold 0.3 (30%) is universal - not configurable per project
- Field names normalized by removing spaces/underscores - may break intentional distinctions
- Auto-mapping uses greedy first-match - doesn't consider global optimization
- Only first 10 rows stored as preview - rest of CSV discarded until test execution
- CSV encoding assumed UTF-8 - no encoding detection or conversion

## Stability Concerns
- **Threshold Tuning**: 0.3 may be too low (false positives) or too high (misses matches) depending on naming conventions
- **Large Files**: No streaming parser - entire CSV loaded into memory (potential browser crash on 100k+ rows)
- **Excel Compatibility**: XLSX library may not handle all Excel features (macros, formulas, merged cells)
- **Encoding Issues**: Non-UTF-8 files display garbled characters - no charset detection
- **No Type Validation**: Doesn't check if CSV values match expected types (email format, phone numbers)
- **Duplicate Mappings**: Multiple CSV columns can map to same step - no conflict detection

## Edge Cases
- **Empty CSV**: File with headers but no data rows - passes validation but fails during test execution
- **Malformed CSV**: Unquoted commas, line breaks in fields - Papa.parse may fail or produce wrong columns
- **Identical Field Names**: Two columns named "Email" - both map to same step, later overwrites earlier
- **No Matches Found**: If all similarity scores < 0.3, no fields auto-mapped - user must map manually
- **Special Characters**: Field names with quotes, commas, newlines may break mapping display
- **Missing Step Labels**: If recorded steps have no labels, auto-mapping impossible

## Developer-Must-Know Notes
- CSV processing happens client-side in extension page - no server upload
- Only preview (10 rows) persisted to IndexedDB - full CSV re-parsed during test execution
- Auto-mapping is greedy - first best match wins, no global optimization to minimize total distance
- stringSimilarity uses Dice coefficient (bigram overlap) - case insensitive after normalization
- Field mappings stored as parsed_fields[] in project - separate from csv_data[] preview
- Manual mapping overrides auto-mapping - no indication which fields were auto vs manually mapped
- Save requires at least one mapped field - enforced in UI validation
- Test Runner uses mappingLookup object to inject CSV values into step labels during execution

## 2. Primary Responsibilities

1. **File Import**: Accept CSV and Excel files (.csv, .xlsx)
2. **Parsing**: Convert files to structured JSON data
3. **Header Extraction**: Identify column names for mapping
4. **Data Preview**: Show first 10 rows for validation
5. **Auto-Mapping**: Fuzzy match CSV columns to recorded step labels
6. **Manual Mapping**: Enable user to override auto-mapping
7. **Validation**: Check for required fields, data types, empty values
8. **Storage**: Persist CSV data and mappings in IndexedDB

## 3. Dependencies

### Files
- `src/pages/FieldMapper.tsx` (523 lines) - Main implementation
- `src/components/Mapper/FieldMappingTable.tsx` - Mapping UI
- `src/components/Mapper/MappingSummary.tsx` - Statistics display
- `src/common/services/indexedDB.ts` - Data persistence

### External Libraries
- **papaparse** (5.5.3) - CSV parsing
- **xlsx** (0.18.5) - Excel file parsing
- **string-similarity** (4.0.4) - Fuzzy string matching for auto-mapping

### Browser APIs
- File API - Read uploaded files
- FileReader - Parse file contents

## 4. Inputs / Outputs

### Inputs
- **CSV/Excel Files**: User-uploaded data files
- **Recorded Steps**: Array of step objects with labels
- **Project ID**: Associated automation project

### File Format Requirements
```csv
First Name,Last Name,Email,Phone Number
John,Doe,john@example.com,555-1234
Jane,Smith,jane@example.com,555-5678
```

### Outputs
- **Parsed CSV Data**: Array of row objects
  ```typescript
  [
    { "First Name": "John", "Last Name": "Doe", ... },
    { "First Name": "Jane", "Last Name": "Smith", ... }
  ]
  ```

- **Field Mappings**: CSV column → Step label associations
  ```typescript
  {
    field_name: "First Name",
    mapped: true,
    inputvarfields: "Enter your first name"
  }
  ```

- **Mapping Statistics**: Count of mapped/unmapped fields, progress percentage

## 5. Interactions with Other Subsystems

### Dependencies (Consumes)
- **Storage Layer** → Saves CSV data and field mappings
- **Recording Engine** → Uses recorded step labels as mapping targets
- **UI Components** → Provides FieldMappingTable, upload button

### Dependents (Provides To)
- **Test Runner** → Supplies CSV rows for data-driven execution
- **Field Mapper UI** → Displays mapping status and controls

### Data Flow
```
User uploads CSV
  ↓
Papa.parse() / XLSX.read()
  ↓
Extract headers + first 10 rows
  ↓
Create Field objects (unmapped)
  ↓
Auto-mapping (optional)
  ↓
User adjusts mappings
  ↓
Save to IndexedDB (csv_data + parsed_fields)
  ↓
Test Runner reads data
  ↓
Inject values into steps during execution
```

## 6. Internal Structure

### CSV Upload Handler (`FieldMapper.tsx` lines 120-220)

```typescript
const handleCSVUpload = async (file: File | null) => {
  if (!file) return;
  
  setIsUploadingCSV(true);
  setError("");
  setFields([]);
  
  const fileName = file.name.toLowerCase();
  let extractedRows: any[] = [];
  
  if (fileName.endsWith(".csv")) {
    // Parse CSV
    const text = await file.text();
    const result = Papa.parse(text, {
      header: true,           // First row = headers
      skipEmptyLines: true    // Ignore blank lines
    });
    
    if (result.errors.length > 0) {
      setError("CSV parse error: " + result.errors[0].message);
      return;
    }
    
    extractedRows = result.data;
  } else if (fileName.endsWith(".xlsx")) {
    // Parse Excel
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    extractedRows = XLSX.utils.sheet_to_json(worksheet);
  } else {
    setError("Unsupported file format");
    return;
  }
  
  // Extract headers
  const headers = Object.keys(extractedRows[0]);
  
  // Create field objects
  const csvFields = headers.map(header => ({
    field_name: header,
    mapped: false,
    inputvarfields: ""
  }));
  
  // Store preview (first 10 rows)
  const dataPreview = extractedRows.slice(0, 10);
  setCsvdata(dataPreview);
  
  // Save to DB
  updateProjectcsv(projectId, dataPreview, () => {
    setError("CSV uploaded successfully!");
  });
  
  setFields(csvFields);
  setIsUploadingCSV(false);
};
```

### Auto-Mapping Algorithm (`FieldMapper.tsx` lines 220-300)

```typescript
const autoMapFields = () => {
  setIsMapping(true);
  let newlyMappedCount = 0;
  
  fields.forEach((field, index) => {
    // Skip already mapped fields
    if (field.mapped || field.inputvarfields) return;
    
    // Normalize field name: lowercase, remove spaces/underscores
    const normalizedFieldName = field.field_name
      .toLowerCase()
      .replace(/[\s_]/g, "");
    
    let bestMatch = null;
    let bestScore = 0;
    
    // Compare with all recorded step labels
    recordedSteps.forEach((step) => {
      const stepName = step.label?.toLowerCase().replace(/[\s_]/g, "");
      if (!stepName) return;
      
      // Calculate similarity (0-1 scale)
      const score = stringSimilarity.compareTwoStrings(
        normalizedFieldName,
        stepName
      );
      
      if (score > bestScore) {
        bestScore = score;
        bestMatch = step;
      }
    });
    
    // Threshold: 30% similarity required
    if (bestMatch && bestScore >= 0.3) {
      newlyMappedCount++;
      updateFieldMapping(index, {
        mapped: true,
        inputvarfields: bestMatch.label || ""
      });
    }
  });
  
  setError(`Auto-mapped ${newlyMappedCount} fields`);
  setIsMapping(false);
};
```

**Similarity Algorithm** (from `string-similarity` library):
- Compares two strings using Dice's coefficient
- Splits strings into bigrams (2-character pairs)
- Calculates overlap: `2 * common_bigrams / (bigrams_a + bigrams_b)`
- Example: `"FirstName"` vs `"first_name"` → 0.85 (high match)

### Manual Mapping UI (`FieldMappingTable.tsx`)

**Component Structure**:
```typescript
<Table>
  <TableHeader>
    <TableRow>
      <TableHead>CSV Field</TableHead>
      <TableHead>Recorded Step</TableHead>
      <TableHead>Status</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {fields.map((field, index) => (
      <TableRow>
        <TableCell>{field.field_name}</TableCell>
        <TableCell>
          <Select
            value={field.inputvarfields}
            onValueChange={(value) => 
              onUpdateField(index, { 
                inputvarfields: value, 
                mapped: true 
              })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select step..." />
            </SelectTrigger>
            <SelectContent>
              {recordedSteps.map(step => (
                <SelectItem value={step.label}>
                  {step.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </TableCell>
        <TableCell>
          {field.mapped ? "✓ Mapped" : "○ Unmapped"}
        </TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>
```

### Save Mappings (`FieldMapper.tsx` lines 300-350)

```typescript
const saveMappings = async () => {
  const mappedFields = fields.filter(f => f.mapped);
  
  if (mappedFields.length === 0) {
    setError("No fields mapped. Map at least one field.");
    return;
  }
  
  const status = 'testing';
  
  updateProjectFields(projectId, fields, status, 
    () => {
      setError("Mappings saved successfully!");
    },
    (error) => {
      setError("Save failed: " + error);
    }
  );
};

const updateProjectFields = (projectId, fields, status, onSuccess, onError) => {
  chrome.runtime.sendMessage({
    action: "update_project_fields",
    payload: { id: projectId, parsed_fields: fields, status }
  }, (response) => {
    if (response?.success) onSuccess();
    else onError(response?.error);
  });
};
```

## 7. Complexity Assessment

**Complexity Rating**: 🟢 **LOW-MEDIUM** (4/10)

### Why Complexity Exists

1. **Multiple File Formats**: CSV and Excel require different parsers
2. **Fuzzy Matching**: String similarity algorithm requires tuning (threshold = 0.3)
3. **Normalization Logic**: Inconsistent field names (spaces, underscores, case)
4. **UI State Synchronization**: Mappings must stay in sync with fields array
5. **Validation Edge Cases**: Empty CSVs, missing headers, malformed data

### Risks

1. **Threshold Tuning**: 0.3 (30%) may be too low (false positives) or too high (misses matches)
2. **Large CSV Files**: No streaming parser, entire file loaded into memory
3. **Excel Compatibility**: XLSX library may not handle all Excel features (macros, formulas)
4. **Encoding Issues**: Non-UTF-8 files may display garbled characters
5. **No Type Validation**: Doesn't check if CSV values match expected types (e.g., email format)
6. **No Duplicate Detection**: Multiple CSV columns might map to same step

### Refactoring Implications

**Immediate Needs** (Phase 1):

1. **Extract CSV Service**:
   ```typescript
   class CSVProcessor {
     async parse(file: File): Promise<CSVData> {
       // Detect format, parse, extract headers
     }
     
     validate(data: CSVData): ValidationResult {
       // Check for required fields, types, duplicates
     }
     
     preview(data: CSVData, rowCount: number): CSVRow[] {
       // Return first N rows
     }
   }
   ```

2. **Create Mapping Service**:
   ```typescript
   class FieldMapper {
     autoMap(
       csvHeaders: string[], 
       stepLabels: string[], 
       threshold: number = 0.3
     ): Mapping[] {
       // Fuzzy match logic
     }
     
     validateMappings(mappings: Mapping[]): ValidationResult {
       // Check for unmapped required fields, duplicates
     }
   }
   ```

3. **Add Configuration**:
   ```typescript
   interface MappingConfig {
     similarityThreshold: number;  // Default 0.3
     requireAllFieldsMapped: boolean;  // Default false
     allowDuplicateMappings: boolean;  // Default true
     normalizationRules: {
       lowercase: boolean;
       removeSpaces: boolean;
       removeUnderscores: boolean;
     };
   }
   ```

**Long-Term Vision** (Phase 2):

4. **Add Streaming Parser**:
   - Handle large files (100k+ rows) without memory issues
   - Use Web Workers for parsing in background
   - Show progress bar during long parses

5. **Improve Validation**:
   - Type inference (detect emails, phone numbers, dates)
   - Required field checking
   - Value range validation (e.g., age 0-120)
   - Regex pattern matching

6. **Enhanced Auto-Mapping**:
   - Machine learning model trained on past mappings
   - Context-aware matching (consider nearby fields)
   - Multi-field matching (e.g., "First Name" + "Last Name" → "Full Name")

7. **Add Data Transformation**:
   ```typescript
   interface Transformation {
     type: 'uppercase' | 'lowercase' | 'trim' | 'format_date' | 'custom';
     apply(value: string): string;
   }
   ```

8. **Support Multiple CSV Files**:
   - Merge multiple CSVs (e.g., users + addresses)
   - Join on common columns
   - Handle missing values in joins

**Complexity Reduction Target**: Low (3/10) after refactoring

### Key Improvements from Refactoring

- **Performance**: Streaming parser handles large files efficiently
- **Accuracy**: Better validation prevents runtime errors
- **Flexibility**: Configurable matching thresholds and rules
- **User Experience**: Type hints and auto-suggestions improve mapping speed
- **Reliability**: Robust error handling for edge cases
