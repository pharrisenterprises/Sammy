# CSV PROCESSING ENGINE ROLLUP

## 1. Scope & Sources

**Sources**:
- `component-breakdowns/csv-processing_breakdown.md` (419 lines)
- `modularization-plans/csv-processing_mod-plan.md` (empty - to be populated)
- `implementation-guides/csv-processing_impl.md` (N/A - not planned)

**Subsystem Purpose**: The CSV Processing Engine handles data import, parsing, validation, and field mapping for data-driven test execution. It transforms CSV/Excel files into structured data rows and auto-maps columns to recorded step labels using fuzzy string matching.

**Criticality**: ⭐⭐⭐ (Medium-High - enables data-driven automation, but system works without it)

---

## 2. Core Responsibilities (Compressed)

### MUST DO
- **File Import**: Accept CSV and Excel files (.csv, .xlsx) via file input
- **Parsing**: Use PapaParse for CSV, XLSX library for Excel—convert to JSON array
- **Header Extraction**: First row becomes column names for mapping
- **Data Preview**: Show first 10 rows for validation (performance optimization)
- **Auto-Mapping**: Fuzzy match CSV column names to recorded step labels (threshold 0.3)
- **Manual Mapping**: Enable drag-and-drop or dropdown selection for user overrides
- **Storage**: Persist CSV data (`csv_data`) and mappings (`parsed_fields`) in IndexedDB project record
- **Injection Coordination**: Provide mapped values to Test Runner for step value replacement

### MUST NOT DO
- **Never parse entire file client-side**: Show only first 10 rows in UI—full data stored in DB
- **Never auto-map with certainty**: 0.3 threshold is aggressive—user must review all mappings
- **Never skip validation**: Check for empty columns, missing headers, data type mismatches
- **Never mutate original CSV data**: Keep raw data intact; apply transformations during execution

---

## 3. Interfaces & Contracts (Compressed)

### Input File Requirements
```csv
First Name,Last Name,Email,Phone Number
John,Doe,john@example.com,555-1234
Jane,Smith,jane@example.com,555-5678
```

**Rules**:
- First row = headers
- No empty column names
- UTF-8 encoding (BOM optional)
- Max file size: ~10MB (IndexedDB quota limit)

### Parsed Data Structure
```typescript
// Stored in project.csv_data
[
  { "First Name": "John", "Last Name": "Doe", "Email": "john@example.com", ... },
  { "First Name": "Jane", "Last Name": "Smith", "Email": "jane@example.com", ... }
]
```

### Field Mapping Structure
```typescript
// Stored in project.parsed_fields
interface Field {
  field_name: string;        // CSV column name (e.g., "First Name")
  mapped: boolean;           // Is mapped to a step?
  inputvarfields: string;    // Mapped step label (e.g., "Enter your first name")
}

// Example:
{
  field_name: "Email",
  mapped: true,
  inputvarfields: "Email Address"
}
```

### Auto-Mapping Algorithm
```typescript
// For each CSV column:
1. Get column name (e.g., "First Name")
2. For each recorded step label:
   - Calculate string similarity (Levenshtein distance)
   - If similarity >= 0.3, mark as candidate
3. Select highest similarity match
4. If match found, set mapped=true and inputvarfields=step.label
5. Else, set mapped=false and inputvarfields=""
```

**Similarity Threshold**: 0.3 (30% match) — very aggressive to catch partial matches like "First Name" → "Name (First)"

### Injection Contract (Test Runner)
```typescript
// For each data row:
for (const step of recordedSteps) {
  // Find matching field mapping
  const mapping = parsed_fields.find(f => f.inputvarfields === step.label);
  
  if (mapping) {
    // Replace step value with CSV value
    step.value = currentRow[mapping.field_name];
  }
  
  // Execute step with injected value
  await chrome.tabs.sendMessage(tabId, { type: 'runStep', data: step });
}
```

---

## 4. Cross-Cutting Rules & Constraints

### Architectural Boundaries
- **CSV Processing = UI Layer**: Lives in `src/pages/FieldMapper.tsx` (523 lines)
- **No Business Logic in Parser**: PapaParse/XLSX do heavy lifting—FieldMapper just coordinates
- **Storage via Background**: Must message background service to save CSV data and mappings

### Layering Restrictions
- **Must operate in extension page context**: Cannot use CSV parsing in content script (library size)
- **Must validate before storage**: Check for empty columns, duplicate headers before saving

### Performance Constraints
- **Client-Side Parsing**: Large files (100k+ rows) can freeze UI for 2-5 seconds
- **Preview-Only Display**: Show first 10 rows in table—rendering 10k rows crashes browser
- **IndexedDB Size Limit**: Chrome limits IndexedDB to ~60% of disk space—10MB CSV = ~30MB stored (JSON overhead)

### Error Handling Rules
- **Parse Errors Show Alert**: If PapaParse fails, show error message—don't save partial data
- **Empty File Check**: Reject files with 0 rows or no headers
- **Encoding Issues**: PapaParse auto-detects encoding but may fail on non-UTF8—no graceful fallback

### Security Requirements
- **No eval() on CSV Data**: Treat all CSV values as untrusted strings—escape before injecting into page
- **No Formula Execution**: Excel files may contain formulas—XLSX library evaluates them (XSS risk if formula contains malicious code)
- **File Size Limit**: Enforce 10MB max to prevent DoS via large file upload

---

## 5. Edge Cases & Pitfalls

### Critical Edge Cases
1. **Duplicate Column Names**: CSV with two "Name" columns—PapaParse overwrites first with second. Solution: Suffix duplicates with `_1`, `_2`.

2. **Case-Sensitive Matching**: Auto-mapping is case-insensitive but manual mapping stores exact label—"Email" ≠ "email" during injection.

3. **Multi-Step Same Label**: If two steps have same label (e.g., "First Name" and "First Name (Optional)"), both map to same CSV column—ambiguous injection.

4. **Partial Row Data**: CSV row with fewer columns than headers—PapaParse fills missing cells with `undefined`. Test Runner must handle undefined values gracefully.

5. **Special Characters in Column Names**: CSV column "User's Name" becomes `{ "User's Name": "..." }`—must quote when accessing as `row["User's Name"]`, not `row.User's Name`.

### Common Pitfalls
- **Forgetting to Save Mappings**: User adjusts mappings in UI but doesn't click Save—mappings lost on page navigation
- **0.3 Threshold Too Aggressive**: Matches unrelated fields (e.g., "Name" matches "Username" at 0.4)—user must review all mappings
- **Excel Date Serialization**: XLSX library converts Excel dates to Unix timestamps—need to format back to human-readable dates
- **Large File Timeout**: 100k-row CSV takes 10+ seconds to parse—no progress indicator or cancellation

### Maintenance Traps
- **No Type Validation**: CSV values are always strings—Test Runner must convert to numbers/booleans if needed
- **No Schema Versioning**: If field mapping structure changes, old projects break—no migration logic
- **Magic Number 0.3**: Similarity threshold is hardcoded—no UI to adjust or per-project override

---

## 6. Pointers to Detailed Docs

### Full Technical Specifications
- **Component Breakdown**: `analysis-resources/component-breakdowns/csv-processing_breakdown.md`
  - PapaParse and XLSX library usage
  - Auto-mapping algorithm details (string-similarity library)
  - Field mapping UI component breakdown
  - Data flow from upload to execution

### Modularization Roadmap
- **Modularization Plan**: `analysis-resources/modularization-plans/csv-processing_mod-plan.md` (to be populated)
  - Extract parsing logic to separate CSVParser service
  - Add configurable auto-mapping threshold (per-project setting)
  - Implement progressive parsing for large files (Web Workers)
  - Add data validation layer (type checking, required fields)

### Implementation Guidelines
- **Implementation Guide**: N/A (not planned—CSV processing is UI-specific, not core automation logic)

### Related Systems
- **Field Mapper UI**: Primary consumer (displays CSV data, mapping controls)
- **Storage Layer**: Persists CSV data and field mappings in project record
- **Test Runner**: Injects CSV values into steps during execution
- **Recording Engine**: Provides step labels as mapping targets
