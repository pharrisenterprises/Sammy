export const StorageHelper = {
    get: async <T>(key: string): Promise<T | null> => {
        return new Promise((resolve) => {
            chrome.storage.sync.get([key], (result) => {
                if (chrome.runtime.lastError) {
                    console.log(`Error getting key '${key}':`, chrome.runtime.lastError);
                    resolve(null);
                } else {
                    resolve(result[key] ?? null);
                }
            });
        });
    },

    set: async (key: string, value: any): Promise<void> => {
        return new Promise((resolve, reject) => {
            chrome.storage.sync.set({ [key]: value }, () => {
                if (chrome.runtime.lastError) {
                    console.log(`Error setting key '${key}':`, chrome.runtime.lastError);
                    reject(chrome.runtime.lastError);
                } else {
                    resolve();
                }
            });
        });
    },

    remove: async (key: string): Promise<void> => {
        return new Promise((resolve, reject) => {
            chrome.storage.sync.remove([key], () => {
                if (chrome.runtime.lastError) {
                    console.log(`Error removing key '${key}':`, chrome.runtime.lastError);
                    reject(chrome.runtime.lastError);
                } else {
                    resolve();
                }
            });
        });
    },

    getAll: async (): Promise<{ [key: string]: any }> => {
        return new Promise((resolve) => {
            chrome.storage.sync.get(null, (items) => {
                if (chrome.runtime.lastError) {
                    console.log("Error getting all keys:", chrome.runtime.lastError);
                    resolve({});
                } else {
                    resolve(items);
                }
            });
        });
    },

    clear: async (): Promise<void> => {
        return new Promise((resolve, reject) => {
            chrome.storage.sync.clear(() => {
                if (chrome.runtime.lastError) {
                    console.log("Error clearing storage:", chrome.runtime.lastError);
                    reject(chrome.runtime.lastError);
                } else {
                    resolve();
                }
            });
        });
    },
};
