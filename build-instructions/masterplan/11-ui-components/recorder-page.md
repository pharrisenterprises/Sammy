# Recorder Page
**Project:** Chrome Extension Test Recorder - UI Components  
**Document Version:** 1.0  
**Last Updated:** November 25, 2025  
**Status:** Complete Technical Specification

## Table of Contents
1. Overview
2. Data Interfaces
3. Page Layout
4. Recorder Toolbar
5. Steps Table
6. Drag and Drop
7. Step Editing
8. Log Panel
9. State Management
10. Testing Strategy

---

## 1. Overview

### 1.1 Purpose

The Recorder page (626 lines) provides the interface for viewing, editing, and managing recorded test steps with drag-and-drop reordering.

### 1.2 File Location
```
src/pages/Recorder.tsx (626 lines)
```

### 1.3 Key Features

- Steps table with inline editing
- Drag-and-drop reordering
- Add/edit/delete steps
- Recording status indicator
- Log panel for events
- Web preview iframe

---

## 2. Data Interfaces

### 2.1 Step Interface (CRITICAL - Must Match Existing)
```typescript
// CRITICAL: This interface MUST match existing system exactly
interface Step {
  id: string;
  name: string;
  event: 'click' | 'input' | 'enter' | 'open';  // Limited event types only
  path: string;           // XPath - REQUIRED field
  value: string;
  label: string;
  x: number;              // X coordinate - REQUIRED
  y: number;              // Y coordinate - REQUIRED
  bundle?: LocatorBundle; // Optional locator bundle
}

interface LocatorBundle {
  id?: string;
  className?: string;
  tag: string;
  textContent?: string;
  attributes: Record<string, string>;
  xpath: string;
  bounding?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}
```

### 2.2 Event Type Labels
```typescript
// Display labels for event types
const EVENT_LABELS: Record<string, string> = {
  click: 'Click',
  input: 'Input',
  enter: 'Enter',
  open: 'Open URL'
};

const EVENT_ICONS: Record<string, React.ComponentType> = {
  click: MousePointerClick,
  input: Type,
  enter: CornerDownLeft,
  open: ExternalLink
};
```

### 2.3 Recorder State
```typescript
interface RecorderState {
  projectId: number | null;
  projectName: string;
  steps: Step[];
  selectedStepId: string | null;
  isRecording: boolean;
  isPaused: boolean;
  logs: LogEntry[];
}

interface LogEntry {
  id: string;
  timestamp: string;
  type: 'info' | 'event' | 'error' | 'warning';
  message: string;
}
```

---

## 3. Page Layout

### 3.1 Component Structure
```typescript
// src/pages/Recorder.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Play, Square, Pause, Plus, Trash2, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RecorderToolbar } from '@/components/Recorder/RecorderToolbar';
import { StepsTable } from '@/components/Recorder/StepsTable';
import { LogPanel } from '@/components/Recorder/LogPanel';

export function Recorder() {
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('id');

  const [project, setProject] = useState<Project | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [editingStep, setEditingStep] = useState<Step | null>(null);

  // Load project on mount
  useEffect(() => {
    if (projectId) {
      loadProject(parseInt(projectId));
    }
  }, [projectId]);

  // Listen for recorded events
  useEffect(() => {
    const handleMessage = (message: any) => {
      if (message.action === 'step_recorded') {
        handleNewStep(message.step);
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Toolbar */}
      <RecorderToolbar
        projectName={project?.name || 'Untitled'}
        isRecording={isRecording}
        isPaused={isPaused}
        onStartRecording={handleStartRecording}
        onStopRecording={handleStopRecording}
        onPauseRecording={handlePauseRecording}
        onSave={handleSave}
      />

      {/* Main Content */}
      <div className="flex h-[calc(100vh-64px)]">
        {/* Steps Panel */}
        <div className="flex-1 overflow-auto p-6">
          <StepsTable
            steps={steps}
            onReorder={handleReorder}
            onEditStep={setEditingStep}
            onDeleteStep={handleDeleteStep}
            onAddStep={handleAddStep}
          />
        </div>

        {/* Log Panel */}
        <div className="w-96 border-l border-gray-200 bg-white">
          <LogPanel
            logs={logs}
            onClear={() => setLogs([])}
          />
        </div>
      </div>

      {/* Edit Step Modal */}
      {editingStep && (
        <EditStepModal
          step={editingStep}
          onClose={() => setEditingStep(null)}
          onSave={handleUpdateStep}
        />
      )}
    </div>
  );
}
```

---

## 4. Recorder Toolbar

### 4.1 Toolbar Component
```typescript
// src/components/Recorder/RecorderToolbar.tsx
interface RecorderToolbarProps {
  projectName: string;
  isRecording: boolean;
  isPaused: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onPauseRecording: () => void;
  onSave: () => void;
}

export function RecorderToolbar({
  projectName,
  isRecording,
  isPaused,
  onStartRecording,
  onStopRecording,
  onPauseRecording,
  onSave
}: RecorderToolbarProps) {
  return (
    <div className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Left: Project Name */}
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-gray-900">
            {projectName}
          </h1>
          {isRecording && (
            <span className="flex items-center gap-2 text-sm">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              {isPaused ? 'Paused' : 'Recording'}
            </span>
          )}
        </div>

        {/* Right: Controls */}
        <div className="flex items-center gap-2">
          {!isRecording ? (
            <Button onClick={onStartRecording} variant="primary">
              <Play className="w-4 h-4 mr-2" />
              Start Recording
            </Button>
          ) : (
            <>
              <Button onClick={onPauseRecording} variant="outline">
                <Pause className="w-4 h-4 mr-2" />
                {isPaused ? 'Resume' : 'Pause'}
              </Button>
              <Button onClick={onStopRecording} variant="destructive">
                <Square className="w-4 h-4 mr-2" />
                Stop
              </Button>
            </>
          )}

          <div className="w-px h-6 bg-gray-300 mx-2" />

          <Button onClick={onSave} variant="outline">
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
```

---

## 5. Steps Table

### 5.1 Table Component
```typescript
// src/components/Recorder/StepsTable.tsx
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

interface StepsTableProps {
  steps: Step[];
  onReorder: (startIndex: number, endIndex: number) => void;
  onEditStep: (step: Step) => void;
  onDeleteStep: (stepId: string) => void;
  onAddStep: () => void;
}

export function StepsTable({
  steps,
  onReorder,
  onEditStep,
  onDeleteStep,
  onAddStep
}: StepsTableProps) {
  const handleDragEnd = (result: any) => {
    if (!result.destination) return;
    onReorder(result.source.index, result.destination.index);
  };

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Header */}
      <div className="grid grid-cols-[auto_50px_120px_1fr_1fr_120px] gap-4 px-4 py-3 border-b border-gray-200 bg-gray-50 font-medium text-sm text-gray-700">
        <div className="w-6" />
        <div>#</div>
        <div>Event</div>
        <div>Label</div>
        <div>Value</div>
        <div>Actions</div>
      </div>

      {/* Body */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="steps">
          {(provided) => (
            <div ref={provided.innerRef} {...provided.droppableProps}>
              {steps.map((step, index) => (
                <Draggable key={step.id} draggableId={step.id} index={index}>
                  {(provided, snapshot) => (
                    <StepRow
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                      step={step}
                      index={index}
                      isDragging={snapshot.isDragging}
                      onEdit={() => onEditStep(step)}
                      onDelete={() => onDeleteStep(step.id)}
                    />
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {/* Add Step Button */}
      <div className="p-4 border-t border-gray-200">
        <Button onClick={onAddStep} variant="outline" className="w-full">
          <Plus className="w-4 h-4 mr-2" />
          Add Step
        </Button>
      </div>
    </div>
  );
}
```

### 5.2 Step Row
```typescript
interface StepRowProps {
  step: Step;
  index: number;
  isDragging: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

const StepRow = React.forwardRef<HTMLDivElement, StepRowProps>(
  ({ step, index, isDragging, onEdit, onDelete, ...props }, ref) => {
    const EventIcon = EVENT_ICONS[step.event];

    return (
      <div
        ref={ref}
        {...props}
        className={`grid grid-cols-[auto_50px_120px_1fr_1fr_120px] gap-4 px-4 py-3 border-b border-gray-200 hover:bg-gray-50 ${
          isDragging ? 'bg-blue-50 shadow-lg' : ''
        }`}
      >
        {/* Drag Handle */}
        <div className="flex items-center text-gray-400 cursor-grab">
          <GripVertical className="w-4 h-4" />
        </div>

        {/* Step Number */}
        <div className="flex items-center text-sm text-gray-600">
          {index + 1}
        </div>

        {/* Event Type */}
        <div className="flex items-center gap-2 text-sm">
          <EventIcon className="w-4 h-4 text-gray-500" />
          {EVENT_LABELS[step.event]}
        </div>

        {/* Label */}
        <div className="flex items-center text-sm text-gray-900">
          {step.label || step.name || '—'}
        </div>

        {/* Value */}
        <div className="flex items-center text-sm text-gray-600 truncate">
          {step.value || '—'}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onEdit}>
            Edit
          </Button>
          <Button variant="ghost" size="sm" onClick={onDelete}>
            <Trash2 className="w-4 h-4 text-red-600" />
          </Button>
        </div>
      </div>
    );
  }
);
```

---

## 6. Drag and Drop

### 6.1 Reorder Handler
```typescript
// Using @hello-pangea/dnd (fork of react-beautiful-dnd)
function handleReorder(startIndex: number, endIndex: number): void {
  setSteps(prevSteps => {
    const result = Array.from(prevSteps);
    const [removed] = result.splice(startIndex, 1);
    result.splice(endIndex, 0, removed);
    return result;
  });

  // Mark as dirty for save
  setHasUnsavedChanges(true);
}
```

### 6.2 Drag Styles
```typescript
const getDragStyle = (isDragging: boolean, draggableStyle: any) => ({
  ...draggableStyle,
  ...(isDragging && {
    background: '#EFF6FF',
    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
    borderRadius: '4px'
  })
});
```

---

## 7. Step Editing

### 7.1 Edit Step Modal
```typescript
// src/components/Recorder/EditStepModal.tsx
interface EditStepModalProps {
  step: Step;
  onClose: () => void;
  onSave: (step: Step) => void;
}

export function EditStepModal({ step, onClose, onSave }: EditStepModalProps) {
  const [formData, setFormData] = useState(step);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <Dialog.Content>
        <Dialog.Header>
          <Dialog.Title>
            Edit Step
          </Dialog.Title>
        </Dialog.Header>

        <form onSubmit={handleSubmit}>
          {/* Event Type */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Event Type
              </label>
              <select
                value={formData.event}
                onChange={(e) => setFormData({
                  ...formData,
                  event: e.target.value as Step['event']
                })}
                className="mt-1 block w-full rounded-md border-gray-300"
              >
                <option value="click">Click</option>
                <option value="input">Input</option>
                <option value="enter">Enter</option>
                <option value="open">Open URL</option>
              </select>
            </div>

            {/* Label */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Label
              </label>
              <Input
                value={formData.label}
                onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                placeholder="e.g., Submit Button"
                className="mt-1"
              />
            </div>

            {/* Value (for input events) */}
            {formData.event === 'input' && (
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Value
                </label>
                <Input
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                  placeholder="Text to input"
                  className="mt-1"
                />
              </div>
            )}

            {/* XPath (Advanced) */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                XPath
              </label>
              <Input
                value={formData.path}
                onChange={(e) => setFormData({ ...formData, path: e.target.value })}
                className="mt-1 font-mono text-xs"
                placeholder="//button[@id='submit']"
              />
              <p className="mt-1 text-xs text-gray-500">
                Advanced: Modify the element selector
              </p>
            </div>

            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit">
                Save Changes
              </Button>
            </div>
          </div>
        </form>
      </Dialog.Content>
    </Dialog>
  );
}
```

### 7.2 Add New Step
```typescript
function handleAddStep(): void {
  const newStep: Step = {
    id: generateId(),
    name: `Step ${steps.length + 1}`,
    event: 'click',
    path: '',
    value: '',
    label: '',
    x: 0,
    y: 0
  };

  setSteps(prev => [...prev, newStep]);
  setEditingStep(newStep);
}
```

---

## 8. Log Panel

### 8.1 Log Panel Component
```typescript
// src/components/Recorder/LogPanel.tsx
interface LogPanelProps {
  logs: LogEntry[];
  onClear: () => void;
}

export function LogPanel({ logs, onClear }: LogPanelProps) {
  const logEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h3 className="font-medium text-gray-900">Event Log</h3>
        <Button variant="ghost" size="sm" onClick={onClear}>
          Clear
        </Button>
      </div>

      {/* Log Entries */}
      <div className="flex-1 overflow-auto p-4 space-y-2 font-mono text-xs">
        {logs.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            No events recorded yet
          </div>
        ) : (
          logs.map((log) => (
            <LogEntry key={log.id} log={log} />
          ))
        )}
        <div ref={logEndRef} />
      </div>
    </div>
  );
}

function LogEntry({ log }: { log: LogEntry }) {
  const typeColors = {
    info: 'text-gray-500',
    event: 'text-blue-600',
    error: 'text-red-600',
    warning: 'text-yellow-600'
  };

  return (
    <div className="flex gap-2 text-xs">
      <span className="text-gray-400">
        {new Date(log.timestamp).toLocaleTimeString()}
      </span>
      <span className={typeColors[log.type]}>
        [{log.type.toUpperCase()}]
      </span>
      <span className="text-gray-700">
        {log.message}
      </span>
    </div>
  );
}
```

---

## 9. State Management

### 9.1 Save Steps
```typescript
async function handleSave(): Promise<void> {
  if (!project) return;

  try {
    // CRITICAL: Use lowercase snake_case action
    const response = await chrome.runtime.sendMessage({
      action: 'update_project_steps',  // NOT 'UPDATE_PROJECT_STEPS'
      data: {
        id: project.id,
        steps: steps
      }
    });

    if (response.success) {
      setHasUnsavedChanges(false);
      addLog('info', 'Steps saved successfully');
    }
  } catch (error) {
    addLog('error', 'Failed to save steps');
  }
}
```

### 9.2 Handle New Step from Recording
```typescript
function handleNewStep(stepData: Partial<Step>): void {
  const newStep: Step = {
    id: generateId(),
    name: stepData.name || `Step ${steps.length + 1}`,
    event: stepData.event || 'click',
    path: stepData.path || '',
    value: stepData.value || '',
    label: stepData.label || '',
    x: stepData.x || 0,
    y: stepData.y || 0,
    bundle: stepData.bundle
  };

  setSteps(prev => [...prev, newStep]);
  addLog('event', `Recorded: ${EVENT_LABELS[newStep.event]} on "${newStep.label}"`);
}
```

---

## 10. Testing Strategy

### 10.1 Component Tests
```typescript
describe('StepsTable', () => {
  it('renders steps with correct event types', () => {
    const steps: Step[] = [
      { id: '1', name: 'Step 1', event: 'click', path: '//btn', value: '', label: 'Submit', x: 0, y: 0 },
      { id: '2', name: 'Step 2', event: 'input', path: '//input', value: 'test', label: 'Email', x: 0, y: 0 }
    ];

    render(<StepsTable steps={steps} onReorder={jest.fn()} onEditStep={jest.fn()} onDeleteStep={jest.fn()} onAddStep={jest.fn()} />);

    expect(screen.getByText('Click')).toBeInTheDocument();
    expect(screen.getByText('Input')).toBeInTheDocument();
  });

  it('supports drag and drop reordering', async () => {
    // Test drag-drop with @hello-pangea/dnd
  });
});
```

---

## Summary

Recorder Page provides:
- ✅ **Correct Step interface** with `path`, `x`, `y`, `bundle` fields
- ✅ **Correct event types** (`click`, `input`, `enter`, `open`)
- ✅ **RecorderToolbar** with recording controls
- ✅ **StepsTable** with drag-and-drop (@hello-pangea/dnd)
- ✅ **EditStepModal** for step editing
- ✅ **LogPanel** for event logging
- ✅ **Correct message actions** (lowercase snake_case)
- ✅ **Testing strategy** for components

Aligns with existing project knowledge base interfaces.
