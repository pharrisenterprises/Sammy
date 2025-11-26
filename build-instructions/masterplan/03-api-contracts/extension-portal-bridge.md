# Extension-Portal Bridge Communication
**Project:** Chrome Extension Test Recorder  
**Document Version:** 1.0  
**Last Updated:** November 22, 2025  
**Status:** Complete Bridge Specification

## Table of Contents
1. Overview
2. Communication Architecture
3. Authentication Flow
4. Token Transfer Protocol
5. Session Management
6. Deep Linking
7. Message Passing
8. Security Considerations
9. Error Handling
10. Implementation Examples

---

## 1. Overview

### 1.1 Purpose

The **Extension-Portal Bridge** enables secure communication between the Chrome extension and the web-based portal (Next.js application). This bridge facilitates:

- **Authentication synchronization** (extension ↔ portal)
- **Token sharing** for Supabase access
- **Deep linking** from extension to portal pages
- **Session management** across contexts
- **Data synchronization** triggers

### 1.2 Communication Challenges

**Chrome Extension Context:**
- Runs in isolated environment
- Has access to chrome.* APIs
- Cannot directly access portal DOM
- Communicates via messages and storage

**Web Portal Context:**
- Runs in browser tab
- Standard web environment
- No chrome.* API access
- Cannot directly message extension

**Bridge Solution:**

```
┌─────────────────┐         ┌──────────────────┐
│ Chrome Extension│◄───────►│ chrome.storage   │
│                 │         │ (Shared Storage) │
└─────────────────┘         └──────────────────┘
        ▲                            │
        │                            │ Poll/Listen
        │                            ▼
        │                   ┌──────────────────┐
        └───────────────────│ Web Portal       │
                            │ (Next.js)        │
                            └──────────────────┘
```

---

## 2. Communication Architecture

### 2.1 Communication Channels

**Three primary communication methods:**

1. **chrome.storage.local** - Shared persistent storage
2. **Window postMessage** - Direct messaging (when portal embedded in extension)
3. **URL Parameters** - One-way data passing (extension → portal)

### 2.2 Storage-Based Communication

**Most reliable method for extension ↔ portal communication:**

```typescript
// Extension writes to storage
await chrome.storage.local.set({
  'portal:auth:token': accessToken,
  'portal:auth:timestamp': Date.now()
});

// Portal polls storage (via content script bridge)
const data = await chrome.storage.local.get('portal:auth:token');
```

**Storage Keys Convention:**

```typescript
const STORAGE_KEYS = {
  // Authentication
  AUTH_TOKEN: 'portal:auth:token',
  AUTH_USER: 'portal:auth:user',
  AUTH_TIMESTAMP: 'portal:auth:timestamp',
  
  // Navigation
  DEEP_LINK: 'portal:nav:deeplink',
  
  // Sync
  SYNC_TRIGGER: 'portal:sync:trigger',
  SYNC_STATUS: 'portal:sync:status'
};
```

### 2.3 Content Script Bridge

**Portal injects content script to access chrome.storage:**

```javascript
// public/content-script-bridge.js
// Injected into portal pages by extension

// Listen for messages from portal page
window.addEventListener('message', async (event) => {
  if (event.source !== window) return;
  if (event.data.type !== 'PORTAL_TO_EXTENSION') return;
  
  const { action, data } = event.data;
  
  switch (action) {
    case 'GET_STORAGE':
      const result = await chrome.storage.local.get(data.keys);
      window.postMessage({
        type: 'EXTENSION_TO_PORTAL',
        action: 'STORAGE_RESULT',
        data: result
      }, '*');
      break;
    
    case 'SET_STORAGE':
      await chrome.storage.local.set(data.values);
      window.postMessage({
        type: 'EXTENSION_TO_PORTAL',
        action: 'STORAGE_SET_COMPLETE'
      }, '*');
      break;
  }
});

// Notify portal that bridge is ready
window.postMessage({
  type: 'EXTENSION_TO_PORTAL',
  action: 'BRIDGE_READY'
}, '*');
```

**Portal uses bridge:**

```typescript
// Portal React component
function useChromeStorage() {
  const [bridgeReady, setBridgeReady] = useState(false);
  
  useEffect(() => {
    // Listen for bridge ready
    window.addEventListener('message', (event) => {
      if (event.data.type === 'EXTENSION_TO_PORTAL' &&
          event.data.action === 'BRIDGE_READY') {
        setBridgeReady(true);
      }
    });
  }, []);
  
  async function getStorage(keys: string[]) {
    return new Promise((resolve) => {
      // Listen for response
      const listener = (event: MessageEvent) => {
        if (event.data.type === 'EXTENSION_TO_PORTAL' &&
            event.data.action === 'STORAGE_RESULT') {
          window.removeEventListener('message', listener);
          resolve(event.data.data);
        }
      };
      window.addEventListener('message', listener);
      
      // Send request
      window.postMessage({
        type: 'PORTAL_TO_EXTENSION',
        action: 'GET_STORAGE',
        data: { keys }
      }, '*');
    });
  }
  
  return { bridgeReady, getStorage };
}
```

---

## 3. Authentication Flow

### 3.1 Initial Authentication

**User logs in via extension:**

```
┌─────────────────────────────────────────────────────────────┐
│ 1. User clicks "Login" in Extension Popup                  │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. Extension opens Portal login page in new tab            │
│    URL: https://portal.app/login?source=extension          │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. User authenticates with Supabase (email/password/SSO)   │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. Portal receives Supabase session (access_token, user)   │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. Portal writes token to chrome.storage via bridge        │
│    - portal:auth:token = access_token                       │
│    - portal:auth:user = user object                         │
│    - portal:auth:timestamp = Date.now()                     │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. Portal redirects to success page                        │
│    URL: https://portal.app/auth-success                    │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ 7. Extension polls chrome.storage, detects new token       │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ 8. Extension initializes Supabase client with token        │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ 9. Extension closes portal tab (optional)                  │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Token Storage

**Extension stores token:**

```typescript
// extension/src/services/auth.ts
export async function storeAuthToken(token: string, user: any) {
  await chrome.storage.local.set({
    'portal:auth:token': token,
    'portal:auth:user': JSON.stringify(user),
    'portal:auth:timestamp': Date.now(),
    'portal:auth:expires_at': user.expires_at
  });
  
  console.log('[Auth] Token stored successfully');
}

export async function getAuthToken(): Promise<string | null> {
  const data = await chrome.storage.local.get('portal:auth:token');
  return data['portal:auth:token'] || null;
}

export async function clearAuthToken() {
  await chrome.storage.local.remove([
    'portal:auth:token',
    'portal:auth:user',
    'portal:auth:timestamp',
    'portal:auth:expires_at'
  ]);
  
  console.log('[Auth] Token cleared');
}
```

**Portal reads token:**

```typescript
// portal/src/hooks/useExtensionAuth.ts
export function useExtensionAuth() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const { bridgeReady, getStorage } = useChromeStorage();
  
  useEffect(() => {
    if (!bridgeReady) return;
    
    async function loadAuth() {
      const data = await getStorage([
        'portal:auth:token',
        'portal:auth:user'
      ]);
      
      if (data['portal:auth:token']) {
        setToken(data['portal:auth:token']);
        setUser(JSON.parse(data['portal:auth:user']));
        
        // Initialize Supabase with token
        supabase.auth.setSession({
          access_token: data['portal:auth:token'],
          refresh_token: '' // Extension handles refresh
        });
      }
    }
    
    loadAuth();
    
    // Poll for token changes
    const interval = setInterval(loadAuth, 5000);
    return () => clearInterval(interval);
  }, [bridgeReady]);
  
  return { token, user, isAuthenticated: !!token };
}
```

### 3.3 Token Refresh

**Extension handles token refresh:**

```typescript
// extension/background.ts
async function refreshAuthToken() {
  const { data, error } = await supabase.auth.refreshSession();
  
  if (error) {
    console.error('[Auth] Token refresh failed:', error);
    await clearAuthToken();
    return;
  }
  
  if (data.session) {
    await storeAuthToken(
      data.session.access_token,
      data.session.user
    );
    console.log('[Auth] Token refreshed successfully');
  }
}

// Refresh every 30 minutes
setInterval(refreshAuthToken, 30 * 60 * 1000);
```

---

## 4. Token Transfer Protocol

### 4.1 Token Exchange Flow

**After portal authentication:**

```typescript
// portal/app/auth-success/page.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function AuthSuccessPage() {
  const router = useRouter();
  const supabase = createClientComponentClient();
  
  useEffect(() => {
    async function transferToken() {
      // Get current session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push('/login');
        return;
      }
      
      // Write to chrome.storage via bridge
      window.postMessage({
        type: 'PORTAL_TO_EXTENSION',
        action: 'SET_STORAGE',
        data: {
          values: {
            'portal:auth:token': session.access_token,
            'portal:auth:user': JSON.stringify(session.user),
            'portal:auth:timestamp': Date.now(),
            'portal:auth:expires_at': session.expires_at
          }
        }
      }, '*');
      
      // Wait for confirmation
      await new Promise(resolve => {
        const listener = (event: MessageEvent) => {
          if (event.data.type === 'EXTENSION_TO_PORTAL' &&
              event.data.action === 'STORAGE_SET_COMPLETE') {
            window.removeEventListener('message', listener);
            resolve(true);
          }
        };
        window.addEventListener('message', listener);
      });
      
      // Show success message
      setTimeout(() => {
        window.close(); // Close tab (user can close manually if this fails)
      }, 2000);
    }
    
    transferToken();
  }, []);
  
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Authentication Successful</h1>
        <p className="text-gray-600 mb-4">
          Your extension is now connected to your account.
        </p>
        <p className="text-sm text-gray-500">
          This window will close automatically...
        </p>
      </div>
    </div>
  );
}
```

### 4.2 Security Measures

**Token validation before storage:**

```typescript
// Validate token before accepting
async function validateToken(token: string): Promise<boolean> {
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    return !!user && !error;
  } catch {
    return false;
  }
}

// In content script bridge
case 'SET_STORAGE':
  if (data.values['portal:auth:token']) {
    const valid = await validateToken(data.values['portal:auth:token']);
    if (!valid) {
      window.postMessage({
        type: 'EXTENSION_TO_PORTAL',
        action: 'STORAGE_SET_ERROR',
        error: 'Invalid token'
      }, '*');
      return;
    }
  }
  await chrome.storage.local.set(data.values);
  break;
```

---

## 5. Session Management

### 5.1 Session Synchronization

**Detect session changes in extension:**

```typescript
// extension/background.ts
let lastTokenCheck = 0;
const CHECK_INTERVAL = 60000; // 1 minute

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes['portal:auth:token']) {
    console.log('[Auth] Token changed, reinitializing Supabase client');
    
    const newToken = changes['portal:auth:token'].newValue;
    
    if (newToken) {
      // Token added/updated
      initializeSupabaseClient(newToken);
      notifyPopupAuthChanged('logged_in');
    } else {
      // Token removed
      clearSupabaseClient();
      notifyPopupAuthChanged('logged_out');
    }
  }
});

function notifyPopupAuthChanged(status: 'logged_in' | 'logged_out') {
  // Broadcast to all extension contexts
  chrome.runtime.sendMessage({
    action: 'AUTH_STATUS_CHANGED',
    payload: { status }
  });
}
```

**Popup listens for auth changes:**

```typescript
// extension/popup/src/App.tsx
useEffect(() => {
  const listener = (message: any) => {
    if (message.action === 'AUTH_STATUS_CHANGED') {
      if (message.payload.status === 'logged_in') {
        loadUserData();
      } else {
        clearUserData();
      }
    }
  };
  
  chrome.runtime.onMessage.addListener(listener);
  return () => chrome.runtime.onMessage.removeListener(listener);
}, []);
```

### 5.2 Session Expiry Handling

**Check token expiry:**

```typescript
async function checkTokenExpiry(): Promise<boolean> {
  const data = await chrome.storage.local.get([
    'portal:auth:expires_at',
    'portal:auth:timestamp'
  ]);
  
  const expiresAt = data['portal:auth:expires_at'];
  if (!expiresAt) return false;
  
  const now = Date.now() / 1000; // Convert to seconds
  const expired = now >= expiresAt;
  
  if (expired) {
    console.log('[Auth] Token expired, refreshing...');
    await refreshAuthToken();
  }
  
  return !expired;
}

// Check on startup and periodically
chrome.runtime.onStartup.addListener(checkTokenExpiry);
setInterval(checkTokenExpiry, 5 * 60 * 1000); // Every 5 minutes
```

### 5.3 Logout Flow

**User logs out from extension:**

```typescript
// extension/popup/src/components/Settings.tsx
async function handleLogout() {
  // Clear local token
  await clearAuthToken();
  
  // Notify portal to logout
  const portalUrl = 'https://portal.app/api/auth/logout?source=extension';
  chrome.tabs.create({ url: portalUrl, active: false }, (tab) => {
    // Close tab after 2 seconds
    setTimeout(() => {
      if (tab.id) chrome.tabs.remove(tab.id);
    }, 2000);
  });
  
  // Update UI
  setIsAuthenticated(false);
}
```

**Portal logout endpoint:**

```typescript
// portal/app/api/auth/logout/route.ts
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const source = searchParams.get('source');
  
  // Clear portal session
  const supabase = createServerComponentClient();
  await supabase.auth.signOut();
  
  if (source === 'extension') {
    // Clear extension storage via content script
    return new Response(`
      <script>
        if (window.postMessage) {
          window.postMessage({
            type: 'PORTAL_TO_EXTENSION',
            action: 'SET_STORAGE',
            data: {
              values: {
                'portal:auth:token': null,
                'portal:auth:user': null
              }
            }
          }, '*');
        }
        setTimeout(() => window.close(), 1000);
      </script>
      <p>Logged out successfully. You can close this window.</p>
    `, {
      headers: { 'Content-Type': 'text/html' }
    });
  }
  
  return Response.redirect('/login');
}
```

---

## 6. Deep Linking

### 6.1 Extension → Portal Navigation

**Navigate from extension to specific portal page:**

```typescript
// extension/popup/src/components/RecordingCard.tsx
function openInPortal(recordingId: string) {
  const portalUrl = `https://portal.app/recordings/${recordingId}?source=extension`;
  chrome.tabs.create({ url: portalUrl });
}

// Open execution monitor
function openExecutionMonitor(jobId: string) {
  const portalUrl = `https://portal.app/executions/${jobId}?source=extension`;
  chrome.tabs.create({ url: portalUrl });
}

// Open field mapper
function openFieldMapper(recordingId: string) {
  const portalUrl = `https://portal.app/recordings/${recordingId}/map?source=extension`;
  chrome.tabs.create({ url: portalUrl });
}
```

### 6.2 Deep Link Patterns

**URL patterns for deep linking:**

```typescript
const PORTAL_ROUTES = {
  // Dashboard
  DASHBOARD: '/dashboard',
  
  // Recordings
  RECORDINGS_LIST: '/recordings',
  RECORDING_DETAIL: '/recordings/:id',
  RECORDING_EDIT: '/recordings/:id/edit',
  RECORDING_MAP: '/recordings/:id/map',
  
  // Executions
  EXECUTIONS_LIST: '/executions',
  EXECUTION_DETAIL: '/executions/:id',
  EXECUTION_MONITOR: '/executions/:id/monitor',
  
  // Settings
  SETTINGS: '/settings',
  SETTINGS_SYNC: '/settings/sync',
  
  // Auth
  LOGIN: '/login',
  AUTH_SUCCESS: '/auth-success'
};

function buildPortalUrl(route: string, params?: Record<string, string>): string {
  const BASE_URL = 'https://portal.app';
  let path = route;
  
  // Replace params
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      path = path.replace(`:${key}`, value);
    });
  }
  
  // Add source parameter
  const url = new URL(path, BASE_URL);
  url.searchParams.set('source', 'extension');
  
  return url.toString();
}

// Usage
const url = buildPortalUrl(PORTAL_ROUTES.RECORDING_DETAIL, { id: 'abc-123' });
// https://portal.app/recordings/abc-123?source=extension
```

### 6.3 Portal Handles Extension Source

**Detect extension deep link:**

```typescript
// portal/app/recordings/[id]/page.tsx
'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

export default function RecordingDetailPage({ params }: { params: { id: string } }) {
  const searchParams = useSearchParams();
  const source = searchParams.get('source');
  
  useEffect(() => {
    if (source === 'extension') {
      console.log('[Portal] Opened from extension');
      
      // Show banner: "Opened from extension"
      // Offer option to open in extension
      // Track analytics
    }
  }, [source]);
  
  return (
    <div>
      {source === 'extension' && (
        <div className="bg-blue-50 border border-blue-200 p-3 mb-4 rounded">
          <p className="text-sm text-blue-800">
            Opened from Chrome extension. 
            <button onClick={openInExtension} className="ml-2 underline">
              Open in extension
            </button>
          </p>
        </div>
      )}
      
      {/* Rest of page */}
    </div>
  );
}
```

---

## 7. Message Passing

### 7.1 Bidirectional Communication

**Extension → Portal:**

```typescript
// Extension writes message
await chrome.storage.local.set({
  'portal:message:sync_request': {
    type: 'SYNC_REQUEST',
    timestamp: Date.now(),
    recordingIds: ['abc-123', 'def-456']
  }
});
```

**Portal → Extension:**

```typescript
// Portal writes response
window.postMessage({
  type: 'PORTAL_TO_EXTENSION',
  action: 'SET_STORAGE',
  data: {
    values: {
      'portal:message:sync_response': {
        type: 'SYNC_RESPONSE',
        timestamp: Date.now(),
        success: true,
        synced: ['abc-123', 'def-456']
      }
    }
  }
}, '*');
```

### 7.2 Event Broadcasting

**Extension broadcasts event to all contexts:**

```typescript
function broadcastEvent(event: string, data: any) {
  // Store event in chrome.storage (portal can listen)
  chrome.storage.local.set({
    [`portal:event:${event}`]: {
      timestamp: Date.now(),
      data
    }
  });
  
  // Also send via chrome.runtime (extension contexts)
  chrome.runtime.sendMessage({
    action: 'BROADCAST_EVENT',
    payload: { event, data }
  });
}

// Usage
broadcastEvent('RECORDING_SAVED', { recordingId: 'abc-123' });
```

---

## 8. Security Considerations

### 8.1 Origin Validation

**Validate message origins:**

```typescript
// Content script bridge
const ALLOWED_ORIGINS = [
  'https://portal.app',
  'https://staging.portal.app',
  'http://localhost:3000' // Development only
];

window.addEventListener('message', (event) => {
  // Validate origin
  if (!ALLOWED_ORIGINS.includes(event.origin)) {
    console.warn('[Bridge] Rejected message from unauthorized origin:', event.origin);
    return;
  }
  
  // Process message
  handleMessage(event.data);
});
```

### 8.2 Token Encryption

**Encrypt token in storage (optional):**

```typescript
import { encrypt, decrypt } from './crypto';

async function storeAuthTokenSecure(token: string, user: any) {
  const encryptedToken = await encrypt(token);
  
  await chrome.storage.local.set({
    'portal:auth:token:encrypted': encryptedToken,
    'portal:auth:user': JSON.stringify(user)
  });
}

async function getAuthTokenSecure(): Promise<string | null> {
  const data = await chrome.storage.local.get('portal:auth:token:encrypted');
  
  if (!data['portal:auth:token:encrypted']) return null;
  
  return await decrypt(data['portal:auth:token:encrypted']);
}
```

### 8.3 Rate Limiting

**Prevent message flooding:**

```typescript
const MESSAGE_RATE_LIMIT = 100; // per minute
const messageCount = new Map<string, number[]>();

function checkRateLimit(origin: string): boolean {
  const now = Date.now();
  const messages = messageCount.get(origin) || [];
  
  // Remove messages older than 1 minute
  const recentMessages = messages.filter(t => now - t < 60000);
  
  if (recentMessages.length >= MESSAGE_RATE_LIMIT) {
    console.warn('[Bridge] Rate limit exceeded for origin:', origin);
    return false;
  }
  
  recentMessages.push(now);
  messageCount.set(origin, recentMessages);
  return true;
}
```

---

## 9. Error Handling

### 9.1 Connection Errors

**Handle bridge connection failures:**

```typescript
// portal/src/hooks/useChromeStorage.ts
function useChromeStorage() {
  const [bridgeReady, setBridgeReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    
    const listener = (event: MessageEvent) => {
      if (event.data.type === 'EXTENSION_TO_PORTAL' &&
          event.data.action === 'BRIDGE_READY') {
        setBridgeReady(true);
        setError(null);
      }
    };
    
    window.addEventListener('message', listener);
    
    // Timeout if bridge doesn't connect
    timeout = setTimeout(() => {
      if (!bridgeReady) {
        setError('Extension bridge not detected. Please install the Chrome extension.');
      }
    }, 5000);
    
    return () => {
      window.removeEventListener('message', listener);
      clearTimeout(timeout);
    };
  }, []);
  
  return { bridgeReady, error };
}
```

### 9.2 Graceful Degradation

**Portal works without extension:**

```typescript
// portal/src/components/Layout.tsx
export function Layout({ children }: { children: React.ReactNode }) {
  const { bridgeReady, error } = useChromeStorage();
  const [dismissed, setDismissed] = useState(false);
  
  return (
    <div>
      {error && !dismissed && (
        <div className="bg-yellow-50 border-b border-yellow-200 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-yellow-800">{error}</span>
              <a 
                href="/download-extension" 
                className="text-blue-600 underline"
              >
                Download Extension
              </a>
            </div>
            <button 
              onClick={() => setDismissed(true)}
              className="text-yellow-800"
            >
              ✕
            </button>
          </div>
        </div>
      )}
      
      {children}
    </div>
  );
}
```

---

## 10. Implementation Examples

### 10.1 Complete Authentication Flow

**Extension initiates login:**

```typescript
// extension/popup/src/components/LoginButton.tsx
import { useState } from 'react';

export function LoginButton() {
  const [isLoading, setIsLoading] = useState(false);
  
  async function handleLogin() {
    setIsLoading(true);
    
    // Open portal login page
    const loginUrl = 'https://portal.app/login?source=extension';
    chrome.tabs.create({ url: loginUrl });
    
    // Poll for token
    const interval = setInterval(async () => {
      const data = await chrome.storage.local.get('portal:auth:token');
      
      if (data['portal:auth:token']) {
        clearInterval(interval);
        setIsLoading(false);
        
        // Notify success
        console.log('[Auth] Login successful');
        window.location.reload(); // Refresh popup
      }
    }, 1000);
    
    // Timeout after 5 minutes
    setTimeout(() => {
      clearInterval(interval);
      setIsLoading(false);
    }, 5 * 60 * 1000);
  }
  
  return (
    <button 
      onClick={handleLogin}
      disabled={isLoading}
      className="btn-primary"
    >
      {isLoading ? 'Waiting for login...' : 'Login with Portal'}
    </button>
  );
}
```

**Portal completes authentication:**

```typescript
// portal/app/login/page.tsx
'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const source = searchParams.get('source');
  const supabase = createClientComponentClient();
  
  async function handleLogin(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (error) {
      console.error('[Auth] Login failed:', error);
      return;
    }
    
    if (source === 'extension') {
      // Redirect to auth success page to transfer token
      router.push('/auth-success');
    } else {
      // Regular login flow
      router.push('/dashboard');
    }
  }
  
  return (
    <div>
      {/* Login form */}
    </div>
  );
}
```

### 10.2 Real-Time Sync Notification

**Extension notifies portal of new recording:**

```typescript
// extension/background.ts
async function notifyPortalOfNewRecording(recordingId: string) {
  await chrome.storage.local.set({
    'portal:event:new_recording': {
      timestamp: Date.now(),
      recordingId
    }
  });
  
  console.log('[Bridge] Notified portal of new recording');
}
```

**Portal listens for new recordings:**

```typescript
// portal/src/components/RecordingsList.tsx
useEffect(() => {
  if (!bridgeReady) return;
  
  let lastCheck = Date.now();
  
  const interval = setInterval(async () => {
    const data = await getStorage(['portal:event:new_recording']);
    const event = data['portal:event:new_recording'];
    
    if (event && event.timestamp > lastCheck) {
      console.log('[Portal] New recording detected:', event.recordingId);
      
      // Refresh recordings list
      await refetchRecordings();
      
      // Show toast notification
      toast.success('New recording synced from extension');
      
      lastCheck = event.timestamp;
    }
  }, 5000);
  
  return () => clearInterval(interval);
}, [bridgeReady]);
```

---

## Summary

This Extension-Portal Bridge specification provides:

✅ Multiple communication channels (chrome.storage, postMessage, URL params)  
✅ Complete authentication flow with token transfer protocol  
✅ Session management with automatic refresh and expiry handling  
✅ Deep linking patterns for navigation between contexts  
✅ Bidirectional messaging for real-time updates  
✅ Security measures (origin validation, encryption, rate limiting)  
✅ Error handling with graceful degradation  
✅ Implementation examples for common scenarios

The bridge ensures seamless, secure communication between the Chrome extension and web portal while maintaining proper security boundaries.
