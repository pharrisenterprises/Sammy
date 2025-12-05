/**
 * Components Barrel Export
 * @module src/components
 * @version 1.0.0
 * 
 * Re-exports all UI components for the Sammy extension.
 */

// =============================================================================
// DASHBOARD COMPONENTS
// =============================================================================

export {
  ProjectList,
  ProjectCard,
  CreateProjectDialog,
  ProjectStats,
  RecentActivity,
} from './Dashboard';

// =============================================================================
// RECORDER COMPONENTS
// =============================================================================

export {
  StepsTable,
  StepRow,
  RecorderToolbar,
  RecordingIndicator,
  StepEditor,
  DragDropContext,
} from './Recorder';

// =============================================================================
// FIELD MAPPER COMPONENTS
// =============================================================================

export {
  FieldMappingTable,
  MappingRow,
  AutoMapButton,
  CsvPreview,
  FieldSelector,
  MappingStats,
} from './Mapper';

// =============================================================================
// TEST RUNNER COMPONENTS
// =============================================================================

export {
  TestConsole,
  TestResults,
  ProgressBar,
  ControlPanel,
  StepResultRow,
  ExecutionStats,
} from './Runner';

// =============================================================================
// SHARED COMPONENTS
// =============================================================================

export {
  // Layout
  MainLayout,
  Header,
  Footer,
  Sidebar,
  
  // Feedback
  ErrorBoundary,
  LoadingSpinner,
  LoadingOverlay,
  
  // UI Primitives
  Button,
  Input,
  Select,
  Checkbox,
  Dialog,
  Dropdown,
  Tabs,
  Tooltip,
  Badge,
  Card,
  
  // Icons
  Icon,
  
  // Typography
  Heading,
  Text,
  Code,
} from './shared';

// =============================================================================
// UI UTILITIES
// =============================================================================

export {
  cn,
  formatDate,
  formatDuration,
  truncate,
} from './utils';
