# Real-Time Logs Component
**Project:** Chrome Extension Test Recorder  
**Document Version:** 1.0  
**Last Updated:** November 25, 2025  
**Status:** Complete Technical Specification

## Table of Contents
1. Overview
2. Log Entry Structure
3. Color-Coded Display
4. Auto-Scroll Behavior
5. Log Filtering
6. Export Functionality
7. Performance Optimization
8. Syntax Highlighting
9. Search and Jump
10. Testing Strategy

---

## 1. Overview

### 1.1 Purpose

The Real-Time Logs component streams execution events to the user with color-coded, timestamped entries that provide complete visibility into test execution.

### 1.2 Key Features

- **Live Streaming**: Logs appear instantly as steps execute
- **Color Coding**: 4 log levels (info, success, error, warning)
- **Timestamps**: Precise execution timing (HH:mm:ss.ms format)
- **Auto-Scroll**: Follows latest entry automatically
- **Filtering**: Show/hide by log level
- **Search**: Find specific log entries
- **Export**: Download logs as .txt or .json
- **Virtual Scrolling**: Handle 10,000+ log entries efficiently

### 1.3 Design Goals
```
Priority 1: READABILITY
- Clear visual hierarchy
- Distinct colors for each level
- Monospace font for timestamps

Priority 2: PERFORMANCE
- Render only visible entries (virtual scroll)
- Limit buffer to last N entries
- Throttle updates during bursts

Priority 3: USABILITY
- One-click filtering
- Keyboard shortcuts (Ctrl+F search, Ctrl+L clear)
- Copy-to-clipboard
```

---

## 2. Log Entry Structure

### 2.1 TypeScript Interface
```typescript
interface LogEntry {
  id: string;                    // Unique identifier
  timestamp: number;             // Unix timestamp (ms)
  level: LogLevel;               // info | success | error | warning
  message: string;               // Log message text
  category?: LogCategory;        // step | navigation | system | user
  stepIndex?: number;            // Associated step (if applicable)
  metadata?: Record<string, any>; // Additional context
}

type LogLevel = 'info' | 'success' | 'error' | 'warning';
type LogCategory = 'step' | 'navigation' | 'system' | 'user';
```

### 2.2 Example Log Entries
```typescript
// Info log
{
  id: 'log_1732556401234_1',
  timestamp: 1732556401234,
  level: 'info',
  message: 'Starting test execution...',
  category: 'system'
}

// Success log
{
  id: 'log_1732556402345_2',
  timestamp: 1732556402345,
  level: 'success',
  message: '✓ Step 1: Navigate to https://example.com - SUCCESS',
  category: 'step',
  stepIndex: 0
}

// Error log
{
  id: 'log_1732556403456_3',
  timestamp: 1732556403456,
  level: 'error',
  message: '✗ Step 3: Click button - ERROR: Element not found',
  category: 'step',
  stepIndex: 2,
  metadata: {
    selector: '#submit-button',
    error: 'Element not found after 2000ms'
  }
}

// Warning log
{
  id: 'log_1732556404567_4',
  timestamp: 1732556404567,
  level: 'warning',
  message: '⚠️ CSV row 5 skipped: No matching fields',
  category: 'user'
}
```

---

## 3. Color-Coded Display

### 3.1 TestConsole Component
```tsx
import React, { useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Info, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

interface TestConsoleProps {
  logs: LogEntry[];
  autoScroll?: boolean;
  maxHeight?: number;
  showTimestamps?: boolean;
  showIcons?: boolean;
}

export function TestConsole({ 
  logs, 
  autoScroll = true,
  maxHeight = 600,
  showTimestamps = true,
  showIcons = true
}: TestConsoleProps) {
  const consoleRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  return (
    <div 
      ref={consoleRef}
      className="bg-gray-900 rounded-md p-4 overflow-y-auto font-mono text-sm"
      style={{ maxHeight: `${maxHeight}px` }}
      role="log"
    >
      {logs.length === 0 ? (
        <div className="text-gray-500 text-center py-8">
          No logs yet. Start a test to see execution details.
        </div>
      ) : (
        <div className="space-y-1">
          {logs.map((log) => (
            <LogEntryRow 
              key={log.id} 
              log={log} 
              showTimestamp={showTimestamps}
              showIcon={showIcons}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

### 3.2 Log Entry Row
```tsx
interface LogEntryRowProps {
  log: LogEntry;
  showTimestamp: boolean;
  showIcon: boolean;
}

function LogEntryRow({ log, showTimestamp, showIcon }: LogEntryRowProps) {
  const config = getLogConfig(log.level);
  const Icon = config.icon;

  const formattedTime = new Date(log.timestamp).toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  return (
    <div 
      className={cn(
        "flex items-start gap-2 px-2 py-1 rounded hover:bg-gray-800/50 transition-colors",
        config.bgColor
      )}
    >
      {showTimestamp && (
        <span className="text-gray-500 text-xs whitespace-nowrap">
          [{formattedTime}]
        </span>
      )}
      
      {showIcon && (
        <Icon className={cn("h-4 w-4 flex-shrink-0 mt-0.5", config.iconColor)} />
      )}
      
      <span className={cn("flex-1", config.textColor)}>
        {log.message}
      </span>
    </div>
  );
}
```

### 3.3 Log Level Configuration
```typescript
function getLogConfig(level: LogLevel) {
  const configs = {
    info: {
      icon: Info,
      iconColor: 'text-blue-400',
      textColor: 'text-gray-100',
      bgColor: 'hover:bg-blue-900/20'
    },
    success: {
      icon: CheckCircle,
      iconColor: 'text-green-400',
      textColor: 'text-green-200',
      bgColor: 'hover:bg-green-900/20'
    },
    error: {
      icon: XCircle,
      iconColor: 'text-red-400',
      textColor: 'text-red-200',
      bgColor: 'hover:bg-red-900/20'
    },
    warning: {
      icon: AlertTriangle,
      iconColor: 'text-yellow-400',
      textColor: 'text-yellow-200',
      bgColor: 'hover:bg-yellow-900/20'
    }
  };

  return configs[level];
}
```

---

## 4. Auto-Scroll Behavior

### 4.1 Smart Auto-Scroll
```typescript
export function useSmartAutoScroll(
  consoleRef: React.RefObject<HTMLDivElement>,
  logs: LogEntry[]
) {
  const [autoScroll, setAutoScroll] = useState(true);
  const isUserScrolling = useRef(false);

  // Detect manual scroll
  useEffect(() => {
    const element = consoleRef.current;
    if (!element) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = element;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;

      if (!isAtBottom && !isUserScrolling.current) {
        // User scrolled up
        setAutoScroll(false);
      } else if (isAtBottom) {
        // User scrolled back to bottom
        setAutoScroll(true);
      }
    };

    element.addEventListener('scroll', handleScroll);
    return () => element.removeEventListener('scroll', handleScroll);
  }, [consoleRef]);

  // Auto-scroll when enabled and new logs arrive
  useEffect(() => {
    if (autoScroll && consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [logs, autoScroll, consoleRef]);

  return { autoScroll, setAutoScroll };
}

// Usage:
const { autoScroll, setAutoScroll } = useSmartAutoScroll(consoleRef, logs);
```

### 4.2 Manual Scroll Control
```tsx
export function ScrollControls({ 
  autoScroll, 
  onToggleAutoScroll,
  onScrollToTop,
  onScrollToBottom 
}: ScrollControlsProps) {
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={onToggleAutoScroll}
        className={cn(autoScroll && "bg-blue-500/20")}
      >
        {autoScroll ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        {autoScroll ? 'Pause Auto-Scroll' : 'Resume Auto-Scroll'}
      </Button>
      
      <Button
        variant="ghost"
        size="sm"
        onClick={onScrollToTop}
      >
        <ArrowUp className="h-4 w-4" />
      </Button>
      
      <Button
        variant="ghost"
        size="sm"
        onClick={onScrollToBottom}
      >
        <ArrowDown className="h-4 w-4" />
      </Button>
    </div>
  );
}
```

---

## 5. Log Filtering

### 5.1 Filter Component
```tsx
interface LogFilterProps {
  enabledLevels: Set<LogLevel>;
  onToggleLevel: (level: LogLevel) => void;
  logCounts: Record<LogLevel, number>;
}

export function LogFilter({ 
  enabledLevels, 
  onToggleLevel, 
  logCounts 
}: LogFilterProps) {
  const levels: LogLevel[] = ['info', 'success', 'error', 'warning'];

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-400">Show:</span>
      {levels.map(level => {
        const config = getLogConfig(level);
        const Icon = config.icon;
        const isEnabled = enabledLevels.has(level);

        return (
          <Button
            key={level}
            variant={isEnabled ? 'default' : 'outline'}
            size="sm"
            onClick={() => onToggleLevel(level)}
            className={cn(
              "gap-1",
              isEnabled && config.bgColor
            )}
          >
            <Icon className={cn("h-3 w-3", config.iconColor)} />
            {level.charAt(0).toUpperCase() + level.slice(1)}
            <Badge variant="secondary" className="ml-1">
              {logCounts[level]}
            </Badge>
          </Button>
        );
      })}
    </div>
  );
}
```

### 5.2 Filter Logic
```typescript
export function useLogFiltering(logs: LogEntry[]) {
  const [enabledLevels, setEnabledLevels] = useState<Set<LogLevel>>(
    new Set(['info', 'success', 'error', 'warning'])
  );

  const filteredLogs = useMemo(() => {
    return logs.filter(log => enabledLevels.has(log.level));
  }, [logs, enabledLevels]);

  const logCounts = useMemo(() => {
    return logs.reduce((acc, log) => {
      acc[log.level] = (acc[log.level] || 0) + 1;
      return acc;
    }, {} as Record<LogLevel, number>);
  }, [logs]);

  const toggleLevel = (level: LogLevel) => {
    setEnabledLevels(prev => {
      const updated = new Set(prev);
      if (updated.has(level)) {
        updated.delete(level);
      } else {
        updated.add(level);
      }
      return updated;
    });
  };

  return { filteredLogs, enabledLevels, toggleLevel, logCounts };
}
```

---

## 6. Export Functionality

### 6.1 Export as Text
```typescript
export function exportLogsAsText(logs: LogEntry[]): string {
  return logs.map(log => {
    const time = new Date(log.timestamp).toISOString();
    const level = log.level.toUpperCase().padEnd(8);
    return `[${time}] ${level} ${log.message}`;
  }).join('\n');
}

function handleExportText() {
  const text = exportLogsAsText(logs);
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `test-logs-${Date.now()}.txt`;
  link.click();
  URL.revokeObjectURL(url);
}
```

### 6.2 Export as JSON
```typescript
export function exportLogsAsJSON(logs: LogEntry[]): string {
  return JSON.stringify(logs, null, 2);
}

function handleExportJSON() {
  const json = exportLogsAsJSON(logs);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `test-logs-${Date.now()}.json`;
  link.click();
  URL.revokeObjectURL(url);
}
```

### 6.3 Export Button Component
```tsx
export function ExportLogsButton({ logs }: { logs: LogEntry[] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" />
          Export Logs
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={() => handleExportText()}>
          <FileText className="h-4 w-4 mr-2" />
          Export as Text
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExportJSON()}>
          <FileJson className="h-4 w-4 mr-2" />
          Export as JSON
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleCopyToClipboard()}>
          <Copy className="h-4 w-4 mr-2" />
          Copy to Clipboard
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

---

## 7. Performance Optimization

### 7.1 Log Buffer Limit
```typescript
const MAX_LOGS = 1000;

export function useLogBuffer(maxSize: number = MAX_LOGS) {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const addLog = useCallback((log: Omit<LogEntry, 'id' | 'timestamp'>) => {
    const newLog: LogEntry = {
      ...log,
      id: `log_${Date.now()}_${Math.random()}`,
      timestamp: Date.now()
    };

    setLogs(prev => {
      const updated = [...prev, newLog];
      if (updated.length > maxSize) {
        return updated.slice(-maxSize);
      }
      return updated;
    });
  }, [maxSize]);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  return { logs, addLog, clearLogs };
}
```

### 7.2 Virtual Scrolling
```tsx
import { FixedSizeList } from 'react-window';

export function VirtualLogConsole({ logs }: { logs: LogEntry[] }) {
  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => (
    <div style={style}>
      <LogEntryRow log={logs[index]} showTimestamp showIcon />
    </div>
  );

  return (
    <FixedSizeList
      height={600}
      itemCount={logs.length}
      itemSize={32}
      width="100%"
    >
      {Row}
    </FixedSizeList>
  );
}
```

### 7.3 Throttled Updates
```typescript
export function useThrottledLogs(
  realTimeLogs: LogEntry[],
  throttleMs: number = 100
) {
  const [displayedLogs, setDisplayedLogs] = useState<LogEntry[]>([]);
  const pendingLogs = useRef<LogEntry[]>([]);

  useEffect(() => {
    pendingLogs.current = realTimeLogs;
  }, [realTimeLogs]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (pendingLogs.current.length > displayedLogs.length) {
        setDisplayedLogs([...pendingLogs.current]);
      }
    }, throttleMs);

    return () => clearInterval(interval);
  }, [throttleMs, displayedLogs.length]);

  return displayedLogs;
}
```

---

## 8. Syntax Highlighting

### 8.1 Highlight Keywords
```typescript
export function highlightLogMessage(message: string): React.ReactNode {
  // Highlight important keywords
  const patterns = [
    { regex: /\b(SUCCESS|PASSED|COMPLETED)\b/g, className: 'text-green-400 font-bold' },
    { regex: /\b(ERROR|FAILED|FAILURE)\b/g, className: 'text-red-400 font-bold' },
    { regex: /\b(WARNING|WARN)\b/g, className: 'text-yellow-400 font-bold' },
    { regex: /"([^"]+)"/g, className: 'text-cyan-300' }, // Quoted strings
    { regex: /\b\d+\b/g, className: 'text-purple-300' }, // Numbers
    { regex: /https?:\/\/[^\s]+/g, className: 'text-blue-300 underline' } // URLs
  ];

  let result: React.ReactNode[] = [message];

  patterns.forEach(({ regex, className }) => {
    result = result.flatMap(part => {
      if (typeof part !== 'string') return part;

      const segments: React.ReactNode[] = [];
      let lastIndex = 0;

      part.replace(regex, (match, ...args) => {
        const index = args[args.length - 2];
        
        if (index > lastIndex) {
          segments.push(part.slice(lastIndex, index));
        }
        
        segments.push(
          <span key={`${index}-${match}`} className={className}>
            {match}
          </span>
        );
        
        lastIndex = index + match.length;
        return match;
      });

      if (lastIndex < part.length) {
        segments.push(part.slice(lastIndex));
      }

      return segments.length > 0 ? segments : [part];
    });
  });

  return <>{result}</>;
}
```

---

## 9. Search and Jump

### 9.1 Log Search Component
```tsx
export function LogSearch({ 
  logs, 
  onResultSelect 
}: { 
  logs: LogEntry[]; 
  onResultSelect: (index: number) => void;
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentResultIndex, setCurrentResultIndex] = useState(0);

  const searchResults = useMemo(() => {
    if (!searchTerm) return [];
    
    return logs
      .map((log, index) => ({ log, index }))
      .filter(({ log }) => 
        log.message.toLowerCase().includes(searchTerm.toLowerCase())
      );
  }, [logs, searchTerm]);

  const handleNext = () => {
    if (searchResults.length === 0) return;
    const nextIndex = (currentResultIndex + 1) % searchResults.length;
    setCurrentResultIndex(nextIndex);
    onResultSelect(searchResults[nextIndex].index);
  };

  const handlePrevious = () => {
    if (searchResults.length === 0) return;
    const prevIndex = (currentResultIndex - 1 + searchResults.length) % searchResults.length;
    setCurrentResultIndex(prevIndex);
    onResultSelect(searchResults[prevIndex].index);
  };

  return (
    <div className="flex items-center gap-2">
      <Input
        type="text"
        placeholder="Search logs..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="w-64"
      />
      
      {searchResults.length > 0 && (
        <>
          <span className="text-sm text-gray-400">
            {currentResultIndex + 1} / {searchResults.length}
          </span>
          <Button variant="ghost" size="sm" onClick={handlePrevious}>
            <ChevronUp className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={handleNext}>
            <ChevronDown className="h-4 w-4" />
          </Button>
        </>
      )}
    </div>
  );
}
```

### 9.2 Keyboard Shortcuts
```typescript
export function useLogShortcuts(
  onClear: () => void,
  onToggleSearch: () => void
) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+L: Clear logs
      if (e.ctrlKey && e.key === 'l') {
        e.preventDefault();
        onClear();
      }
      
      // Ctrl+F: Focus search
      if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        onToggleSearch();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClear, onToggleSearch]);
}
```

---

## 10. Testing Strategy

### 10.1 Unit Tests
```typescript
describe('TestConsole', () => {
  it('renders logs with correct colors', () => {
    const logs: LogEntry[] = [
      { id: '1', timestamp: Date.now(), level: 'info', message: 'Info message' },
      { id: '2', timestamp: Date.now(), level: 'error', message: 'Error message' }
    ];

    render(<TestConsole logs={logs} />);

    expect(screen.getByText('Info message')).toHaveClass('text-gray-100');
    expect(screen.getByText('Error message')).toHaveClass('text-red-200');
  });

  it('auto-scrolls to bottom when new logs arrive', () => {
    const { rerender } = render(<TestConsole logs={[]} />);
    const console = screen.getByRole('log');

    const newLogs = [
      { id: '1', timestamp: Date.now(), level: 'info', message: 'Test' }
    ];
    rerender(<TestConsole logs={newLogs} />);

    expect(console.scrollTop).toBe(console.scrollHeight - console.clientHeight);
  });
});
```

### 10.2 Integration Tests
```typescript
describe('Log Filtering', () => {
  it('filters logs by level', () => {
    const logs: LogEntry[] = [
      { id: '1', timestamp: Date.now(), level: 'info', message: 'Info 1' },
      { id: '2', timestamp: Date.now(), level: 'error', message: 'Error 1' },
      { id: '3', timestamp: Date.now(), level: 'info', message: 'Info 2' }
    ];

    render(<TestConsoleWithFilters logs={logs} />);

    // Click to hide info logs
    fireEvent.click(screen.getByText(/Info/));

    expect(screen.queryByText('Info 1')).not.toBeInTheDocument();
    expect(screen.getByText('Error 1')).toBeInTheDocument();
  });
});
```

---

## Summary

The Real-Time Logs Component provides:
- ✅ **Live streaming** with instant updates as steps execute
- ✅ **4-level color coding** (info, success, error, warning)
- ✅ **Precise timestamps** in HH:mm:ss format
- ✅ **Smart auto-scroll** that pauses when user scrolls up
- ✅ **Level filtering** with click-to-toggle buttons
- ✅ **Export options** (text, JSON, clipboard)
- ✅ **Performance optimization** (1000-log buffer, virtual scrolling, throttling)
- ✅ **Syntax highlighting** for keywords, numbers, URLs
- ✅ **Search functionality** with prev/next navigation
- ✅ **Keyboard shortcuts** (Ctrl+L clear, Ctrl+F search)

This provides comprehensive execution visibility with responsive UI even for long-running tests.
