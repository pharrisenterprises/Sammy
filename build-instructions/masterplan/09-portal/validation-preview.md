# Validation & Preview System
**Project:** Chrome Extension Test Recorder  
**Document Version:** 1.0  
**Last Updated:** November 25, 2025  
**Status:** Complete Technical Specification

## Table of Contents
1. Overview
2. Validation Rules
3. Pre-Save Validation
4. Data Quality Checks
5. Preview Execution Flow
6. Error Display
7. Warning System
8. User Confirmation
9. Fix Suggestions
10. Testing Strategy

---

## 1. Overview

### 1.1 Purpose

The Validation & Preview system ensures data quality before test execution by checking field mappings, CSV structure, and providing sample row validation with fix suggestions.

### 1.2 Validation Layers
```
┌─────────────────────────────────────────────────────────┐
│ Layer 1: FILE VALIDATION                               │
│ - File size, format, structure                         │
│ - Before parsing                                        │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ Layer 2: PARSE VALIDATION                              │
│ - Header detection, row count, column integrity        │
│ - During parsing                                        │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ Layer 3: MAPPING VALIDATION                            │
│ - Required fields mapped, no duplicates                │
│ - Before save                                           │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ Layer 4: DATA QUALITY VALIDATION                       │
│ - Empty values, type mismatches, format validation     │
│ - After mapping, before execution                       │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ Layer 5: PREVIEW EXECUTION (Optional)                  │
│ - Test first row, identify runtime issues              │
│ - User-triggered                                        │
└─────────────────────────────────────────────────────────┘
```

---

## 2. Validation Rules

### 2.1 Critical Validation Rules
```typescript
interface ValidationRule {
  id: string;
  level: 'error' | 'warning';
  check: (context: ValidationContext) => boolean;
  message: string;
  suggestion?: string;
}

const VALIDATION_RULES: ValidationRule[] = [
  {
    id: 'at-least-one-mapping',
    level: 'error',
    check: (ctx) => ctx.mappedFields.length > 0,
    message: 'At least one field must be mapped',
    suggestion: 'Use Auto-Map or manually select a mapping'
  },
  {
    id: 'no-empty-headers',
    level: 'error',
    check: (ctx) => !ctx.headers.some(h => !h || h.trim() === ''),
    message: 'CSV contains empty column headers',
    suggestion: 'Add names to all columns in your CSV file'
  },
  {
    id: 'no-duplicate-headers',
    level: 'warning',
    check: (ctx) => new Set(ctx.headers).size === ctx.headers.length,
    message: 'CSV contains duplicate column names',
    suggestion: 'Rename columns to make them unique'
  },
  {
    id: 'no-empty-data',
    level: 'error',
    check: (ctx) => ctx.data.length > 0,
    message: 'CSV contains no data rows (headers only)',
    suggestion: 'Add data rows to your CSV file'
  },
  {
    id: 'within-row-limit',
    level: 'error',
    check: (ctx) => ctx.data.length <= 10000,
    message: `CSV exceeds 10,000 row limit (${ctx.data.length} rows)`,
    suggestion: 'Split into smaller files or filter data'
  },
  {
    id: 'within-column-limit',
    level: 'warning',
    check: (ctx) => ctx.headers.length <= 50,
    message: `CSV has ${ctx.headers.length} columns (recommended max: 50)`,
    suggestion: 'Consider removing unused columns'
  },
  {
    id: 'low-empty-values',
    level: 'warning',
    check: (ctx) => !hasHighEmptyPercentage(ctx.mappedFields, ctx.data),
    message: 'Some mapped fields have >10% empty values',
    suggestion: 'Review data quality or mark fields as optional'
  },
  {
    id: 'no-completely-empty-columns',
    level: 'warning',
    check: (ctx) => !hasCompletelyEmptyColumns(ctx.headers, ctx.data),
    message: 'Some columns contain no values',
    suggestion: 'Remove empty columns from CSV'
  }
];

function hasHighEmptyPercentage(
  mappedFields: Field[],
  data: any[]
): boolean {
  return mappedFields.some(field => {
    const emptyCount = data.filter(row => 
      !row[field.field_name] || row[field.field_name].trim() === ''
    ).length;
    return (emptyCount / data.length) > 0.1; // 10% threshold
  });
}

function hasCompletelyEmptyColumns(
  headers: string[],
  data: any[]
): boolean {
  return headers.some(header => 
    data.every(row => !row[header] || row[header].trim() === '')
  );
}
```

---

## 3. Pre-Save Validation

### 3.1 Validation Function
```typescript
interface ValidationContext {
  headers: string[];
  data: any[];
  fields: Field[];
  mappedFields: Field[];
  recordedSteps: RecordedStep[];
}

interface ValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

interface ValidationIssue {
  ruleId: string;
  level: 'error' | 'warning';
  message: string;
  suggestion?: string;
  affectedFields?: string[];
}

export function validateMappings(context: ValidationContext): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  VALIDATION_RULES.forEach(rule => {
    const passed = rule.check(context);
    
    if (!passed) {
      const issue: ValidationIssue = {
        ruleId: rule.id,
        level: rule.level,
        message: rule.message,
        suggestion: rule.suggestion
      };

      if (rule.level === 'error') {
        errors.push(issue);
      } else {
        warnings.push(issue);
      }
    }
  });

  // Additional custom checks
  const duplicateMappings = findDuplicateMappings(context.mappedFields);
  if (duplicateMappings.length > 0) {
    warnings.push({
      ruleId: 'duplicate-mappings',
      level: 'warning',
      message: `Multiple CSV columns map to same step: ${duplicateMappings.join(', ')}`,
      suggestion: 'Later values will overwrite earlier ones',
      affectedFields: duplicateMappings
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

function findDuplicateMappings(fields: Field[]): string[] {
  const labelCounts = new Map<string, string[]>();
  
  fields.filter(f => f.mapped).forEach(field => {
    const label = field.inputvarfields;
    if (!labelCounts.has(label)) {
      labelCounts.set(label, []);
    }
    labelCounts.get(label)!.push(field.field_name);
  });

  const duplicates: string[] = [];
  labelCounts.forEach((csvFields, stepLabel) => {
    if (csvFields.length > 1) {
      duplicates.push(`"${stepLabel}" (${csvFields.join(', ')})`);
    }
  });

  return duplicates;
}
```

### 3.2 Save Button Logic
```tsx
export function SaveMappingsButton({ 
  fields, 
  data, 
  headers,
  recordedSteps,
  onSave 
}: SaveMappingsButtonProps) {
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleSaveClick = () => {
    const mappedFields = fields.filter(f => f.mapped);
    
    const result = validateMappings({
      headers,
      data,
      fields,
      mappedFields,
      recordedSteps
    });

    setValidationResult(result);

    if (!result.valid) {
      // Show errors, block save
      return;
    }

    if (result.warnings.length > 0) {
      // Show confirmation dialog with warnings
      setShowConfirm(true);
    } else {
      // Save immediately
      onSave();
    }
  };

  return (
    <>
      <Button
        onClick={handleSaveClick}
        disabled={fields.filter(f => f.mapped).length === 0}
      >
        Save Mappings
      </Button>

      {validationResult && !validationResult.valid && (
        <ValidationErrorDisplay errors={validationResult.errors} />
      )}

      <ConfirmDialog
        open={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={() => {
          setShowConfirm(false);
          onSave();
        }}
        title="Save with Warnings?"
        warnings={validationResult?.warnings || []}
      />
    </>
  );
}
```

---

## 4. Data Quality Checks

### 4.1 Type Inference
```typescript
type DataType = 'string' | 'number' | 'email' | 'phone' | 'date' | 'boolean' | 'url';

function inferDataType(values: string[]): DataType {
  const samples = values.filter(v => v && v.trim() !== '').slice(0, 10);
  
  if (samples.length === 0) return 'string';

  // Check for numbers
  if (samples.every(v => /^-?\d+(\.\d+)?$/.test(v))) {
    return 'number';
  }

  // Check for emails
  if (samples.every(v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))) {
    return 'email';
  }

  // Check for phone numbers
  if (samples.every(v => /^[\d\s\-\(\)]+$/.test(v) && v.replace(/\D/g, '').length >= 10)) {
    return 'phone';
  }

  // Check for dates
  if (samples.every(v => !isNaN(Date.parse(v)))) {
    return 'date';
  }

  // Check for booleans
  const boolValues = ['true', 'false', 'yes', 'no', '0', '1'];
  if (samples.every(v => boolValues.includes(v.toLowerCase()))) {
    return 'boolean';
  }

  // Check for URLs
  if (samples.every(v => /^https?:\/\/.+/.test(v))) {
    return 'url';
  }

  return 'string';
}
```

### 4.2 Data Quality Report
```tsx
interface DataQualityMetrics {
  totalRows: number;
  totalColumns: number;
  mappedColumns: number;
  unmappedColumns: number;
  emptyValueCount: number;
  columnMetrics: Array<{
    header: string;
    mapped: boolean;
    inferredType: DataType;
    emptyCount: number;
    emptyPercent: number;
    uniqueCount: number;
    sampleValues: string[];
  }>;
}

function calculateDataQuality(
  headers: string[],
  data: any[],
  fields: Field[]
): DataQualityMetrics {
  const mappedFields = new Set(fields.filter(f => f.mapped).map(f => f.field_name));

  const columnMetrics = headers.map(header => {
    const values = data.map(row => String(row[header] || ''));
    const nonEmpty = values.filter(v => v.trim() !== '');
    const emptyCount = values.length - nonEmpty.length;

    return {
      header,
      mapped: mappedFields.has(header),
      inferredType: inferDataType(values),
      emptyCount,
      emptyPercent: (emptyCount / values.length) * 100,
      uniqueCount: new Set(nonEmpty).size,
      sampleValues: nonEmpty.slice(0, 3)
    };
  });

  const totalEmpty = columnMetrics.reduce((sum, m) => sum + m.emptyCount, 0);

  return {
    totalRows: data.length,
    totalColumns: headers.length,
    mappedColumns: mappedFields.size,
    unmappedColumns: headers.length - mappedFields.size,
    emptyValueCount: totalEmpty,
    columnMetrics
  };
}

export function DataQualityReport({ metrics }: { metrics: DataQualityMetrics }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Data Quality Report</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="text-center">
            <div className="text-2xl font-bold">{metrics.totalRows}</div>
            <div className="text-sm text-gray-500">Total Rows</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{metrics.mappedColumns}</div>
            <div className="text-sm text-gray-500">Mapped Columns</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{metrics.unmappedColumns}</div>
            <div className="text-sm text-gray-500">Unmapped</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{metrics.emptyValueCount}</div>
            <div className="text-sm text-gray-500">Empty Values</div>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Column</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Empty</TableHead>
              <TableHead>Unique</TableHead>
              <TableHead>Samples</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {metrics.columnMetrics.map((col, i) => (
              <TableRow key={i}>
                <TableCell>{col.header}</TableCell>
                <TableCell>
                  <Badge variant="outline">{col.inferredType}</Badge>
                </TableCell>
                <TableCell>
                  {col.mapped ? (
                    <Badge variant="success">Mapped</Badge>
                  ) : (
                    <Badge variant="secondary">Unmapped</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {col.emptyCount} ({col.emptyPercent.toFixed(1)}%)
                </TableCell>
                <TableCell>{col.uniqueCount}</TableCell>
                <TableCell className="text-xs truncate max-w-xs">
                  {col.sampleValues.join(', ')}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
```

---

## 5. Preview Execution Flow

### 5.1 Purpose

Preview execution runs the first CSV row through the recorded steps to catch runtime issues before executing all rows.

### 5.2 Preview Execution Component
```tsx
export function PreviewExecutionButton({ 
  projectId, 
  csvData, 
  fields 
}: PreviewExecutionButtonProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<PreviewResult | null>(null);

  const handlePreview = async () => {
    setIsRunning(true);
    setResult(null);

    try {
      // Create mapping lookup
      const mappingLookup: Record<string, string> = {};
      fields.filter(f => f.mapped).forEach(field => {
        mappingLookup[field.inputvarfields] = csvData[0][field.field_name];
      });

      // Send to background for execution
      chrome.runtime.sendMessage(
        {
          action: 'preview_execution',
          payload: {
            projectId,
            mappingLookup,
            rowIndex: 0
          }
        },
        (response) => {
          if (response.success) {
            setResult({
              success: true,
              stepsExecuted: response.stepsExecuted,
              duration: response.duration,
              logs: response.logs
            });
          } else {
            setResult({
              success: false,
              error: response.error,
              failedStep: response.failedStep,
              logs: response.logs
            });
          }
          setIsRunning(false);
        }
      );
    } catch (error) {
      setResult({
        success: false,
        error: error.message,
        logs: []
      });
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-4">
      <Button
        onClick={handlePreview}
        disabled={isRunning || csvData.length === 0}
        variant="outline"
      >
        <Play className="h-4 w-4 mr-2" />
        {isRunning ? 'Running Preview...' : 'Preview First Row'}
      </Button>

      {result && (
        <PreviewResultDisplay result={result} />
      )}
    </div>
  );
}
```

### 5.3 Preview Result Display
```tsx
interface PreviewResult {
  success: boolean;
  stepsExecuted?: number;
  duration?: number;
  error?: string;
  failedStep?: number;
  logs: Array<{ level: string; message: string; timestamp: number }>;
}

export function PreviewResultDisplay({ result }: { result: PreviewResult }) {
  if (result.success) {
    return (
      <Alert variant="default">
        <CheckCircle className="h-4 w-4" />
        <AlertTitle>Preview Successful</AlertTitle>
        <AlertDescription>
          Executed {result.stepsExecuted} steps in {result.duration}ms.
          Ready to run all {result.totalRows} rows.
        </AlertDescription>
      </Alert>
    );
  } else {
    return (
      <Alert variant="destructive">
        <XCircle className="h-4 w-4" />
        <AlertTitle>Preview Failed</AlertTitle>
        <AlertDescription>
          <p className="mb-2">
            Error at step {result.failedStep}: {result.error}
          </p>
          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm">
                View Execution Logs
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-4 max-h-64 overflow-auto">
              <div className="space-y-1">
                {result.logs.map((log, i) => (
                  <div 
                    key={i}
                    className={cn(
                      "text-xs p-2 rounded",
                      log.level === 'error' && "bg-red-50 text-red-800",
                      log.level === 'success' && "bg-green-50 text-green-800",
                      log.level === 'info' && "bg-gray-50 text-gray-800"
                    )}
                  >
                    [{new Date(log.timestamp).toLocaleTimeString()}] {log.message}
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </AlertDescription>
      </Alert>
    );
  }
}
```

---

## 6. Error Display

### 6.1 Validation Error List
```tsx
export function ValidationErrorDisplay({ errors }: { errors: ValidationIssue[] }) {
  if (errors.length === 0) return null;

  return (
    <Alert variant="destructive">
      <XCircle className="h-4 w-4" />
      <AlertTitle>Cannot Save - {errors.length} Error(s)</AlertTitle>
      <AlertDescription>
        <ul className="list-disc list-inside space-y-2 mt-2">
          {errors.map((error, i) => (
            <li key={i}>
              {error.message}
              {error.suggestion && (
                <div className="text-sm mt-1 ml-6 text-gray-600">
                  💡 {error.suggestion}
                </div>
              )}
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}
```

### 6.2 Warning Confirmation Dialog
```tsx
export function WarningConfirmDialog({ 
  open, 
  onClose, 
  onConfirm, 
  warnings 
}: WarningConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            Save with {warnings.length} Warning(s)?
          </AlertDialogTitle>
          <AlertDialogDescription>
            <ul className="list-disc list-inside space-y-2 my-4">
              {warnings.map((warning, i) => (
                <li key={i}>
                  {warning.message}
                  {warning.suggestion && (
                    <div className="text-sm mt-1 ml-6 text-gray-600">
                      💡 {warning.suggestion}
                    </div>
                  )}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm">
              You can proceed despite these warnings, but results may be unexpected.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Go Back and Fix</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            Save Anyway
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

---

## 7. Warning System

### 7.1 Warning Severity Levels
```typescript
type WarningSeverity = 'low' | 'medium' | 'high';

interface Warning {
  id: string;
  severity: WarningSeverity;
  message: string;
  suggestion: string;
  affectedFields?: string[];
  canIgnore: boolean;
}

const WARNING_CONFIG: Record<WarningSeverity, any> = {
  low: {
    icon: Info,
    color: 'text-blue-600',
    borderColor: 'border-blue-500'
  },
  medium: {
    icon: AlertCircle,
    color: 'text-yellow-600',
    borderColor: 'border-yellow-500'
  },
  high: {
    icon: AlertTriangle,
    color: 'text-orange-600',
    borderColor: 'border-orange-500'
  }
};
```

### 7.2 Warning Badge Component
```tsx
export function WarningSeverityBadge({ severity }: { severity: WarningSeverity }) {
  const config = WARNING_CONFIG[severity];
  const Icon = config.icon;

  return (
    <Badge variant="outline" className={cn("gap-1", config.color)}>
      <Icon className="h-3 w-3" />
      {severity.toUpperCase()}
    </Badge>
  );
}
```

---

## 8. User Confirmation

### 8.1 Confirmation Flow
```typescript
enum ConfirmationLevel {
  NONE,           // No confirmation needed
  SOFT,           // Show warning, allow proceed
  HARD            // Show error, block proceed
}

function getConfirmationLevel(result: ValidationResult): ConfirmationLevel {
  if (result.errors.length > 0) {
    return ConfirmationLevel.HARD;
  }

  const highSeverityWarnings = result.warnings.filter(w => 
    w.severity === 'high'
  );

  if (highSeverityWarnings.length > 0) {
    return ConfirmationLevel.SOFT;
  }

  if (result.warnings.length > 0) {
    return ConfirmationLevel.SOFT;
  }

  return ConfirmationLevel.NONE;
}
```

---

## 9. Fix Suggestions

### 9.1 Actionable Fix Buttons
```tsx
export function FixSuggestion({ issue }: { issue: ValidationIssue }) {
  const getFix = () => {
    switch (issue.ruleId) {
      case 'at-least-one-mapping':
        return {
          label: 'Auto-Map Fields',
          action: () => triggerAutoMapping()
        };
      
      case 'low-empty-values':
        return {
          label: 'Show Empty Rows',
          action: () => filterEmptyRows()
        };

      case 'duplicate-mappings':
        return {
          label: 'Review Duplicates',
          action: () => highlightDuplicates()
        };

      default:
        return null;
    }
  };

  const fix = getFix();

  if (!fix) return null;

  return (
    <Button variant="outline" size="sm" onClick={fix.action}>
      {fix.label}
    </Button>
  );
}
```

---

## 10. Testing Strategy

### 10.1 Unit Tests
```typescript
describe('Validation Rules', () => {
  it('requires at least one mapped field', () => {
    const context: ValidationContext = {
      headers: ['Name', 'Email'],
      data: [{ Name: 'John', Email: 'john@example.com' }],
      fields: [
        { field_name: 'Name', mapped: false, inputvarfields: '' },
        { field_name: 'Email', mapped: false, inputvarfields: '' }
      ],
      mappedFields: [],
      recordedSteps: []
    };

    const result = validateMappings(context);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ ruleId: 'at-least-one-mapping' })
    );
  });

  it('detects duplicate column names', () => {
    const context: ValidationContext = {
      headers: ['Name', 'Name'],
      data: [{ Name: 'John' }],
      fields: [],
      mappedFields: [],
      recordedSteps: []
    };

    const result = validateMappings(context);

    expect(result.warnings).toContainEqual(
      expect.objectContaining({ ruleId: 'no-duplicate-headers' })
    );
  });
});
```

### 10.2 Integration Tests
```typescript
describe('Validation Flow', () => {
  it('blocks save when critical errors exist', () => {
    render(<FieldMapper />);

    const saveButton = screen.getByText('Save Mappings');
    fireEvent.click(saveButton);

    expect(screen.getByText(/Cannot Save/)).toBeInTheDocument();
    expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
  });

  it('shows confirmation when warnings exist', async () => {
    render(<FieldMapper />);

    // Setup with warnings
    // ...

    const saveButton = screen.getByText('Save Mappings');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText(/Save with.*Warning/)).toBeInTheDocument();
    });
  });
});
```

---

## Summary

The Validation & Preview System provides:
- ✅ **5-layer validation** (file, parse, mapping, data quality, preview execution)
- ✅ **8 validation rules** covering structure, mappings, and data quality
- ✅ **Type inference** for columns (number, email, phone, date, boolean, URL)
- ✅ **Data quality report** with empty value statistics and sample data
- ✅ **Preview execution** to test first CSV row before full run
- ✅ **Error display** with clear messages and fix suggestions
- ✅ **3-tier warning system** (low, medium, high severity)
- ✅ **User confirmation flow** for warnings with option to proceed
- ✅ **Actionable fix suggestions** (Auto-Map, Show Empty Rows, Review Duplicates)
- ✅ **Comprehensive testing** with unit and integration test coverage

This ensures users catch data issues early with clear guidance on how to resolve them before execution.
