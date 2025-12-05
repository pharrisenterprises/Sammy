/**
 * useMessages Hook
 * 
 * Provides utilities for Chrome message passing.
 * Wraps chrome.runtime.sendMessage and chrome.tabs.sendMessage with timeout support.
 */

import { useCallback } from 'react';
import type { MessageResponse } from '@/core/types';

/**
 * Message listener callback type
 */
export type MessageListener = (
  message: any,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void
) => void | boolean;

/**
 * Hook return type
 */
export interface UseMessagesReturn {
  /**
   * Send message to background script
   */
  sendMessage: <T = any>(message: any, timeout?: number) => Promise<MessageResponse<T>>;
  
  /**
   * Send message to specific tab
   */
  sendToTab: <T = any>(tabId: number, message: any, timeout?: number) => Promise<MessageResponse<T>>;
  
  /**
   * Add message listener
   */
  addListener: (listener: MessageListener) => () => void;
  
  /**
   * Check if Chrome runtime is available
   */
  isAvailable: boolean;
}

/**
 * useMessages hook
 * 
 * Provides utilities for Chrome message passing with timeout support.
 * 
 * @example
 * const { sendMessage, sendToTab, addListener, isAvailable } = useMessages();
 * 
 * // Send to background
 * const response = await sendMessage({ action: 'get_projects' });
 * 
 * // Send to tab
 * const response = await sendToTab(tabId, { action: 'start_recording' });
 * 
 * // Listen for messages
 * const removeListener = addListener((message, sender, sendResponse) => {
 *   if (message.action === 'ping') {
 *     sendResponse({ success: true, data: 'pong' });
 *     return true; // Async response
 *   }
 * });
 */
export function useMessages(): UseMessagesReturn {
  const isAvailable = typeof chrome !== 'undefined' && !!chrome.runtime;

  /**
   * Send message to background script
   */
  const sendMessage = useCallback(async <T = any>(
    message: any,
    timeout: number = 5000
  ): Promise<MessageResponse<T>> => {
    if (!isAvailable) {
      return {
        success: false,
        error: 'Chrome runtime not available'
      };
    }

    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        resolve({
          success: false,
          error: `Message timeout after ${timeout}ms`
        });
      }, timeout);

      chrome.runtime.sendMessage(message, (response: MessageResponse<T>) => {
        clearTimeout(timeoutId);
        
        if (chrome.runtime.lastError) {
          resolve({
            success: false,
            error: chrome.runtime.lastError.message
          });
        } else {
          resolve(response || { success: false, error: 'No response' });
        }
      });
    });
  }, [isAvailable]);

  /**
   * Send message to specific tab
   */
  const sendToTab = useCallback(async <T = any>(
    tabId: number,
    message: any,
    timeout: number = 5000
  ): Promise<MessageResponse<T>> => {
    if (!isAvailable) {
      return {
        success: false,
        error: 'Chrome runtime not available'
      };
    }

    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        resolve({
          success: false,
          error: `Message timeout after ${timeout}ms`
        });
      }, timeout);

      chrome.tabs.sendMessage(tabId, message, (response: MessageResponse<T>) => {
        clearTimeout(timeoutId);
        
        if (chrome.runtime.lastError) {
          resolve({
            success: false,
            error: chrome.runtime.lastError.message
          });
        } else {
          resolve(response || { success: false, error: 'No response' });
        }
      });
    });
  }, [isAvailable]);

  /**
   * Add message listener
   * Returns cleanup function to remove listener
   */
  const addListener = useCallback((listener: MessageListener): (() => void) => {
    if (!isAvailable) {
      return () => {};
    }

    chrome.runtime.onMessage.addListener(listener);
    
    return () => {
      chrome.runtime.onMessage.removeListener(listener);
    };
  }, [isAvailable]);

  return {
    sendMessage,
    sendToTab,
    addListener,
    isAvailable
  };
}
