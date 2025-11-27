# Test Orchestrator - Component Breakdown

## 1. Purpose
Coordinates test execution workflow in TestRunner page: retrieve recorded steps, iterate through CSV rows (if applicable), execute replay for each row, track progress, report results, handle errors/timeouts.

## 2. Inputs
- Project ID from URL hash
- Recorded steps from projects.recorded_steps
- Optional CSV data rows
- Replay configuration (timeout, retry interval)

## 3. Outputs
- Real-time progress updates (current step, percentage complete)
- Test results per row (passed/failed steps, errors)
- Final summary (total rows, passed, failed, duration)

## 4. Internal Architecture
- Located in src/pages/TestRunner.tsx (610 lines)
- Main function: runTest() orchestrates execution loop
- Progress tracking: setProgress((currentStep / totalSteps) * 100)
- Error handling: try/catch per step, continue or abort on failure

## 5. Critical Dependencies
- Content script replay engine (findElementFromBundle, executeStep)
- chrome.runtime.sendMessage for start_replay command
- TestRuns storage for result persistence

## 6. Hidden Assumptions
- Steps execute sequentially (no parallel execution)
- Single test run per project at a time
- Test execution completes within browser session (no resume after crash)

## 7. Stability Concerns
- No checkpoint/resume mechanism if replay fails mid-execution
- Long-running tests (1000+ steps) may exceed service worker timeout
- Progress updates flood message bus (1 message per step)

## 8. Edge Cases
- CSV with 10,000 rows: total execution time >10 hours (browser may close)
- Step timeout mid-execution: remaining steps skipped or continued (configurable?)

## 9. Developer-Must-Know Notes
- Test orchestration is UI-driven (TestRunner.tsx), not background script
- Use chrome.alarms to keep background alive during long replays
- Batch progress updates: send every 10 steps instead of per-step
