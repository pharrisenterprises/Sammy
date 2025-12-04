# Core Module

> Unified core functionality for the Anthropic Auto-Allow Chrome Extension

## Overview

The core module provides all foundational functionality for the extension including:

- **Types**: Data models (Step, Project, TestRun, ParsedField, LocatorBundle)
- **Storage**: IndexedDB persistence with Dexie
- **Replay**: Test execution engine with multi-strategy element finding
- **Orchestrator**: Multi-row test coordination with tab management
- **Background**: Service worker message routing and tab lifecycle
- **CSV**: Data import with parsing, mapping, and validation
- **Content**: Page automation with recording and replay
- **UI**: Component contracts and state management

## Installation

```typescript
import { 
  // Types
  type Step,
  type Project,
  createProject,
  createStep,
  
  // Storage
  getStorageService,
  
  // Replay
  createReplayEngine,
  
  // Orchestrator
  createTestOrchestrator,
  
  // Background
  createMessageRouter,
  
  // CSV
  createCSVProcessingService,
  
  // Content
  createContextBridge,
  createNotificationUI,
  
  // UI
  createUIStateManager,
} from '@/core';
```

## Module Structure

```
src/core/
├── types/           # Data type definitions
│   ├── Step.ts
│   ├── Project.ts
│   ├── TestRun.ts
│   ├── ParsedField.ts
│   ├── LocatorBundle.ts
│   └── index.ts
├── storage/         # IndexedDB persistence
│   ├── database.ts
│   ├── repositories/
│   ├── StorageService.ts
│   └── index.ts
├── replay/          # Test execution
│   ├── IReplayEngine.ts
│   ├── ReplayConfig.ts
│   ├── ReplayState.ts
│   ├── ElementFinder.ts
│   ├── ActionExecutor.ts
│   ├── StepExecutor.ts
│   ├── ReplayEngine.ts
│   ├── ReplaySession.ts
│   └── index.ts
├── orchestrator/    # Test coordination
│   ├── ITestOrchestrator.ts
│   ├── TestOrchestrator.ts
│   ├── ChromeTabManager.ts
│   └── index.ts
├── background/      # Service worker
│   ├── IBackgroundService.ts
│   ├── MessageRouter.ts
│   ├── BackgroundTabManager.ts
│   └── index.ts
├── csv/             # Data import
│   ├── ICSVParser.ts
│   ├── CSVParser.ts
│   ├── FieldMapper.ts
│   ├── CSVValidator.ts
│   ├── CSVProcessingService.ts
│   └── index.ts
├── content/         # Page automation
│   ├── IContentScript.ts
│   ├── ContextBridge.ts
│   ├── NotificationUI.ts
│   └── index.ts
├── ui/              # UI components
│   ├── IUIComponents.ts
│   ├── UIStateManager.ts
│   └── index.ts
└── index.ts         # Master barrel export
```

## Quick Start

### Creating a Project

```typescript
import { createProject, getStorageService } from '@/core';

const project = createProject({
  name: 'My Test Project',
  target_url: 'https://example.com',
});

const storage = getStorageService();
const savedProject = await storage.createProject(project);
```

### Recording Steps

```typescript
import { createClickStep, createInputStep, createLocatorBundle } from '@/core';

const bundle = createLocatorBundle({
  xpath: '//button[@id="submit"]',
  id: 'submit',
  tag: 'button',
});

const clickStep = createClickStep('Submit Button', bundle);
const inputStep = createInputStep('Email', 'user@example.com', bundle);
```

### Running Tests

```typescript
import { createReplayEngine, createReplaySession } from '@/core';

const engine = createReplayEngine();
const session = createReplaySession({
  steps: project.recorded_steps,
  csvData: [{ email: 'test@example.com' }],
  fieldMappings: mappings,
});

session.onRowComplete((result) => {
  console.log(`Row ${result.rowIndex}: ${result.passed ? 'PASSED' : 'FAILED'}`);
});

await session.start();
```

### Processing CSV Data

```typescript
import { createCSVProcessingService } from '@/core';

const csvService = createCSVProcessingService();
const result = await csvService.processFile(file, steps);

console.log(`Parsed ${result.parseResult.data.rows.length} rows`);
console.log(`Mapped ${result.mappings.filter(m => m.mapped).length} fields`);
```

### UI State Management

```typescript
import { createUIStateManager, selectors } from '@/core';

const uiState = createUIStateManager();

uiState.subscribe((state) => {
  if (selectors.isLoading(state)) {
    showSpinner();
  }
});

uiState.setLoading(true, 'Loading...');
uiState.toastSuccess('Operation completed!');
```

## Configuration

### Default Values

```typescript
import { ALL_DEFAULTS } from '@/core';

// ALL_DEFAULTS contains:
{
  storage: { dbName, dbVersion },
  replay: { findTimeout, retryInterval, maxRetries, fuzzyThreshold, boundingBoxThreshold },
  orchestrator: { rowDelay, stepDelay, humanDelay, stepTimeout },
  background: { handlerTimeout, injectionDelay },
  csv: { similarityThreshold, previewRowCount, maxEmptyCellRatio, minMappedFields },
  content: { stepTimeout, notificationDuration, animationDuration, extensionTimeout },
  ui: { pageSize, logLimit, toastDuration, maxToasts },
}
```

### Critical Values

| Value | Default | Description |
|-------|---------|-------------|
| findTimeout | 2000ms | Element search timeout |
| retryInterval | 150ms | Retry delay between attempts |
| maxRetries | 13 | Maximum retry attempts |
| fuzzyThreshold | 0.4 | Text matching threshold |
| similarityThreshold | 0.3 | CSV auto-mapping threshold |
| stepTimeout | 30000ms | Step execution timeout |

## Testing

```bash
# Run all core tests
npm run test -- src/core/

# Run specific module tests
npm run test -- src/core/types/
npm run test -- src/core/storage/
npm run test -- src/core/replay/

# Run integration tests
npm run test -- src/core/integration.test.ts

# Type check
npm run type-check

# Lint
npm run lint -- src/core/
```

## Resetting Singletons

For testing purposes, all singletons can be reset:

```typescript
import { resetAllSingletons } from '@/core';

afterEach(() => {
  resetAllSingletons();
});
```

## Version

Current version: 1.0.0

```typescript
import { CORE_VERSION } from '@/core';
console.log(CORE_VERSION); // '1.0.0'
```

## License

Internal use only - Anthropic
