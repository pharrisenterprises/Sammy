/**
 * Opens a new browser tab with the specified URL.
 *
 * @param {string} url - The URL to open in a new tab.
 * @returns {void}
 */
export const openWindowTab = (url: string): void => {
    window.open(url, '_blank');
};

/**
 * Gets the full URL for an extension resource.
 *
 * @param {string} path - Relative path to the extension resource (e.g., "icon.png").
 * @returns {string} Full URL to the resource within the extension.
 */
export const getIconUrl = (path: any): string => chrome.runtime.getURL(path);

/**
 * Encodes a string into Base64 format and removes padding characters (=).
 *
 * @param {string} value - The string to encode.
 * @returns {string} Base64 encoded string without padding.
 */
export const encodeBase64 = (value: string): string => {
    if (!value) return "";
    return btoa(value).replace(/=/g, "");
};

/**
 * Decodes a Base64 encoded string.
 *
 * @param {string} value - The Base64 encoded string.
 * @returns {string} Decoded string.
 */
export const decodeBase64 = (value: string): string => {
    if (!value) return "";
    return atob(value);
};

export const soundPlayPush = async (updatedState: boolean) => {
    if (updatedState) {
        await chrome.runtime.sendMessage({ type: 'play' });
    }
    if (updatedState == false) {
        await chrome.runtime.sendMessage({ type: 'pause' });
    }
}

export const opneDashBoard = () => {
    chrome.runtime.sendMessage(
        { action: "openDashBoard" },
        (__response) => {

        });
}