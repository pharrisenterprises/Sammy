# CSV Processing - Component Breakdown

## 1. Purpose
Parses uploaded CSV files using Papa Parse, auto-detects field mappings to recorded input steps, provides manual mapping UI, and injects CSV row data into replay execution for data-driven testing.

## 2. Inputs
- CSV files via <input type="file">
- Recorded steps array with label fields
- User-selected field mappings { csvColumn: "Email", inputLabel: "Username" }

## 3. Outputs
- Parsed CSV data (2D array of strings)
- Field mappings (csvColumn → input step binding)
- Test execution with CSV data injection per row

## 4. Internal Architecture
- Papa Parse library (papaparse 5.5.3) for CSV parsing
- Auto-mapping heuristic: fuzzy string matching between CSV headers and input labels
- Manual mapping UI: dropdowns to assign CSV columns to input fields
- Replay integration: executeStep(step, csvRow) injects csvRow[mappedColumn] as input value

## 5. Critical Dependencies
- papaparse 5.5.3 for CSV parsing
- string-similarity 4.0.4 for auto-mapping fuzzy match
- Mapper.tsx page (file location TBD, not found in search)

## 6. Hidden Assumptions
- CSV files have headers in first row
- All CSV cells are strings (no date/number parsing)
- CSV encoding is UTF-8 (non-ASCII characters may break)

## 7. Stability Concerns
- No validation of CSV row count vs test run capacity (10,000 rows may timeout)
- Papa Parse runs on main thread (blocks UI for large files)
- Auto-mapping threshold hardcoded (no user tuning)

## 8. Edge Cases
- CSV without headers: Auto-mapping fails
- Empty CSV cells: Injected as empty string "" (may fail validation)
- CSV columns > input fields: Extra columns ignored

## 9. Developer-Must-Know Notes
- Use Papa Parse worker mode: `Papa.parse(file, { worker: true })` to avoid UI blocking
- Auto-mapping uses compareTwoStrings() with 0.6 threshold (60% similarity)
- CSV row iteration in TestRunner: `for (let i = 0; i < csvData.length; i++) { await executeReplay(steps, csvData[i]); }`
