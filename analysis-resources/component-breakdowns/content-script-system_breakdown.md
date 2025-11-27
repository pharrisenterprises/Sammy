# Content Script System - Component Breakdown

## 1. Purpose
Dual-mode coordinator running in web page context, handling both recording (event capture) and replay (action execution), with iframe/shadow DOM support and page context interception coordination.

## 2. Inputs
- DOM events (click, input, change) for recording mode
- chrome.runtime.sendMessage({ action: "execute_replay" }) for replay mode
- window.postMessage from page-interceptor.tsx for shadow DOM events
- LocatorBundles from recorded_steps for replay

## 3. Outputs
- Recorded steps via chrome.runtime.sendMessage({ type: "logEvent" })
- Step execution results via chrome.runtime.sendMessage({ action: "step_result" })
- Visual feedback (element highlighting during recording)

## 4. Internal Architecture
- src/contentScript/content.tsx (1,446 lines monolith)
- Lines 1-850: Recording engine (event handlers, label detection, bundle generation)
- Lines 850-1446: Replay engine (findElementFromBundle, humanClick, humanInput)
- Dual-mode toggle: isRecording flag from chrome.storage.local

## 5. Critical Dependencies
- xpath 0.0.34 for XPath generation/resolution
- string-similarity 4.0.4 for fuzzy text matching
- page-interceptor.tsx for shadow DOM exposure
- Background script for message routing

## 6. Hidden Assumptions
- Content script injected before page load (timing-dependent)
- Single content script instance per tab (no duplicate injections)
- isRecording and replay state mutually exclusive (no concurrent record+replay)

## 7. Stability Concerns
- 1,446-line monolith hard to test/maintain
- Recording and replay logic tightly coupled (should be separate modules)
- Memory leaks: event listeners not cleaned up when recording stops

## 8. Edge Cases
- Content script re-injected mid-recording (state lost)
- Page navigation during recording (listeners must re-attach)
- Replay started before page fully loaded (elements not found)

## 9. Developer-Must-Know Notes
- Content script runs in isolated world (cannot access page's JavaScript objects directly)
- Use page-interceptor.tsx for closed shadow root access (must inject before page load)
- Split content.tsx into separate recording.ts and replay.ts modules (Phase 3 priority)
