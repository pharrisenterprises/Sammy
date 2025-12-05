/**
 * Global Type Declarations
 * @module types/global.d.ts
 * @version 1.0.0
 * 
 * Global type declarations for the Sammy Chrome Extension.
 */

// ============================================================================
// CHROME EXTENSION TYPES
// ============================================================================

/**
 * Extended Window interface for extension context
 */
interface ExtendedWindow extends Window {
  /** Content script loaded flag */
  __sammyContentScript?: boolean;
  /** Page interceptor loaded flag */
  __sammyInterceptorLoaded?: boolean;
  /** Page replay loaded flag */
  __sammyReplayLoaded?: boolean;
}

/**
 * Extended Element interface for shadow DOM exposure
 */
interface ExtendedElement extends Element {
  /** Exposed closed shadow root */
  __realShadowRoot?: ShadowRoot;
  /** Autocomplete input reference */
  __autocompleteInput?: HTMLInputElement;
  /** Shadow mode (open or closed) */
  __shadowMode?: 'open' | 'closed';
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Make all properties mutable (remove readonly)
 */
type Mutable<T> = {
  -readonly [P in keyof T]: T[P];
};

/**
 * Make specific properties required
 */
type RequireProps<T, K extends keyof T> = T & Required<Pick<T, K>>;

/**
 * Make specific properties optional
 */
type OptionalProps<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Extract keys of type
 */
type KeysOfType<T, V> = {
  [K in keyof T]: T[K] extends V ? K : never;
}[keyof T];

/**
 * Deep partial type
 */
type DeepPartial<T> = T extends object
  ? {
      [P in keyof T]?: DeepPartial<T[P]>;
    }
  : T;

/**
 * Deep required type
 */
type DeepRequired<T> = T extends object
  ? {
      [P in keyof T]-?: DeepRequired<T[P]>;
    }
  : T;

/**
 * Non-nullable recursive type
 */
type DeepNonNullable<T> = T extends object
  ? {
      [P in keyof T]: DeepNonNullable<NonNullable<T[P]>>;
    }
  : NonNullable<T>;

// ============================================================================
// FUNCTION TYPES
// ============================================================================

/**
 * Generic async function type
 */
type AsyncFunction<T = void> = () => Promise<T>;

/**
 * Generic callback type
 */
type Callback<T = void> = (value: T) => void;

/**
 * Error callback type
 */
type ErrorCallback = (error: Error) => void;

/**
 * Cleanup function type
 */
type CleanupFunction = () => void;

// ============================================================================
// EVENT TYPES
// ============================================================================

/**
 * Generic event handler
 */
type EventHandler<E extends Event = Event> = (event: E) => void;

/**
 * Chrome message handler
 */
type ChromeMessageHandler<T = unknown, R = unknown> = (
  message: T,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: R) => void
) => boolean | void;

// ============================================================================
// REACT TYPES
// ============================================================================

/**
 * React children prop
 */
type WithChildren<T = object> = T & { children?: React.ReactNode };

/**
 * React className prop
 */
type WithClassName<T = object> = T & { className?: string };

/**
 * React testId prop
 */
type WithTestId<T = object> = T & { testId?: string };

/**
 * Common component props
 */
type CommonProps = WithClassName & WithTestId;

// ============================================================================
// CHROME API AUGMENTATION
// ============================================================================

declare namespace chrome {
  namespace scripting {
    type ExecutionWorld = 'ISOLATED' | 'MAIN';
  }
}

// ============================================================================
// TESTING LIBRARY AUGMENTATION
// ============================================================================

declare namespace jest {
  interface Matchers<R> {
    toBeWithinRange(floor: number, ceiling: number): R;
  }
}

// ============================================================================
// GLOBAL DECLARATIONS
// ============================================================================

declare global {
  interface Window extends ExtendedWindow {}
  interface Element extends ExtendedElement {}
}

export {};
