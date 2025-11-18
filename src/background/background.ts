import { DB } from "../common/services/indexedDB";

async function ensurePersistentStorage() {
  if ('storage' in navigator && navigator.storage && navigator.storage.persist) {
    const isPersisted = await navigator.storage.persisted();
    console.log("Storage persisted?", isPersisted);
    if (!isPersisted) {
      const granted = await navigator.storage.persist();
      console.log("Persistence granted:", granted);
    }
  } else {
    console.log("navigator.storage.persist not available in this context");
  }
}


//Call this ONCE when service worker starts
ensurePersistentStorage();

let openedTabId: number | null = null;
const trackedTabs = new Set<number>();
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message.action) return false;
  try {
    //const senderTabId = sender?.tab?.id;
    if (message.action === "add_project") {
      const newProject = {
        ...message.payload,
        recorded_steps: [],
        parsed_fields: [],
        csv_data: []
      };
      DB.addProject(newProject)
        .then(id => sendResponse({ success: true, id }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
    }

    if (message.action === "update_project") {
      DB.updateProject(message.payload.id, {
        name: message.payload.name,
        description: message.payload.description,
        target_url: message.payload.target_url,
      })
        .then(() => sendResponse({ success: true }))
        .catch(error =>
          sendResponse({ success: false, error: error.message })
        );
      return true;
    }

    if (message.action === "get_all_projects") {
      DB.getAllProjects()
        .then(projects => sendResponse({ success: true, projects }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
    }

    if (message.action === "delete_project") {
      const projectId = message.payload?.projectId;
      DB.deleteProject(projectId)
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
    }

    if (message.action === "get_project_by_id") {
      const id = message.payload?.id;
      DB.projects.get(id)
        .then((project) => {
          if (project) {
            sendResponse({ success: true, project });
          } else {
            sendResponse({ success: false, error: "Process  not found" });
          }
        })
        .catch((error) => {
          sendResponse({ success: false, error: error.message });
        });
      return true;
    }

    if (message.action === "open_project_url_and_inject") {
      const projectId = message.payload?.id;
      DB.getAllProjects()
        .then((projects) => {
          const project = projects.find(p => p.id === projectId);
          if (!project || !project.target_url) {
            sendResponse({ success: false, error: "Process not found or missing URL" });
            return;
          }

          // Open new tab with target_url
          // chrome.tabs.create({ url: project.target_url }, (tab) => {
          //   if (tab?.id) {
          //     openedTabId = tab.id;
          //     //Try injecting main.js dynamically
          //     chrome.scripting.executeScript(
          //       {
          //         target: { tabId: tab.id },
          //         files: ["js/main.js"]
          //       },
          //       () => {
          //         if (chrome.runtime.lastError) {
          //           //Injection failed → close the tab
          //           if (typeof tab.id === "number") {
          //             chrome.tabs.remove(tab.id);
          //           }
          //           sendResponse({ success: false, error: chrome.runtime.lastError.message });
          //         } else {
          //           //Script injected → tab is valid
          //           sendResponse({ success: true, tabId: tab.id });
          //         }
          //       }
          //     );
          //   } else {
          //     sendResponse({ success: false });
          //   }
          // });

          chrome.tabs.create({ url: project.target_url }, (tab) => {
            if (tab?.id) {
              openedTabId = tab.id;
              trackedTabs.add(tab.id);
              injectMain(tab.id);
            }
          });
        })
        .catch((err) => {
          sendResponse({ success: false, error: err.message });
        });
      return true;
    }

    if (message.action === "update_project_steps") {
      const { id, recorded_steps } = message.payload;

      DB.projects.update(id, { recorded_steps })
        .then(() => {
          sendResponse({ success: true });
        })
        .catch((error) => {
          sendResponse({ success: false, error: error.message });
        });
      return true;
    }

    if (message.action === "update_project_fields") {
      const { id, parsed_fields, status } = message.payload;

      DB.projects.update(id, { parsed_fields, status })
        .then(() => {
          sendResponse({ success: true });
        })
        .catch((error) => {
          sendResponse({ success: false, error: error.message });
        });

      return true;
    }

    if (message.action === "update_project_csv") {
      const { id, csv_data } = message.payload;

      DB.projects.update(id, { csv_data })
        .then(() => {
          sendResponse({ success: true });
        })
        .catch((error) => {
          sendResponse({ success: false, error: error.message });
        });

      return true;
    }

    if (message.action === 'createTestRun') {
      (async () => {
        try {
          const id = await DB.testRuns.add(message.payload);
          const testRun = await DB.testRuns.get(id);
          sendResponse({ success: true, testRun });
        } catch (err) {
          //console.error("Error creating test run:", err);
          sendResponse({ success: false, error: err });
        }
      })();
      return true;
    }

    if (message.action === 'updateTestRun') {
      (async () => {
        try {
          await DB.testRuns.update(message.id, message.payload);
          sendResponse({ success: true });
        } catch (err) {
          sendResponse({ success: false, error: err });
        }
      })();
      return true;
    }

    if (message.action === "getTestRunsByProject") {
      const projectId = message.projectId;

      DB.getTestRunsByProject(projectId)
        .then((runs) => {
          sendResponse({ success: true, data: runs });
        })
        .catch((error) => {
          //console.error("Error fetching test runs:", error);
          sendResponse({ success: false, error: error.message });
        });

      return true;
    }

    if (message.action === "openTab") {
      const target_url = message.url;

      // Create new tab
      chrome.tabs.create({ url: target_url }, (tab) => {
        if (chrome.runtime.lastError) {
          console.error("Failed to create tab:", chrome.runtime.lastError.message);
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
          return;
        }

        if (!tab?.id) {
          sendResponse({ success: false, error: "No tab ID returned" });
          return;
        }

        // Once tab is created, inject your content script
        injectMain(tab.id, (result) => {
          if (result.success) {
            console.log("Injected into tab", tab.id);
            if (tab?.id) {
              openedTabId = tab.id;
              trackedTabs.add(tab.id);
              sendResponse({ success: true, tabId: tab.id });
            }
          } else {
            console.error("Injection failed:", result.error);
            sendResponse({ success: false, error: result.error });
          }
        });
      });

      // Return true so sendResponse stays alive (async)
      return true;
    }
    if (message.action === "close_opened_tab") {
      if (openedTabId !== null) {
        chrome.tabs.remove(openedTabId, () => {
          openedTabId = null;
          sendResponse({ success: true });
        });
      } else {
        sendResponse({ success: false, error: "No opened tab to close" });
      }
      return true;
    }

    if (message.action === "openDashBoard") {
      chrome.tabs.create({ url: chrome.runtime.getURL("pages.html") }, () => {
        sendResponse({ success: true });
      });
      return true;
    }

  } catch (err: any) {
    sendResponse({ success: false, error: err.message });
    return false;
  }
});

chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({
    url: chrome.runtime.getURL("pages.html"),
  });
});

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.tabs.create({
      url: chrome.runtime.getURL("pages.html#dashboard"),
    });
  }
});

// helper function
function injectMain(tabId: number, cb?: (result: any) => void) {
  chrome.scripting.executeScript(
    {
      target: { tabId, allFrames: true },
      files: ["js/main.js"]
    },
    () => {
      if (chrome.runtime.lastError) {
        console.warn("Inject failed:", chrome.runtime.lastError.message);
        cb?.({ success: false });
      } else {
        console.log("Injected main.js into tab", tabId);
        cb?.({ success: true });
      }
    }
  );
}

// Reinjection on navigation (main or iframe)
chrome.webNavigation.onCommitted.addListener((details) => {
  if (trackedTabs.has(details.tabId)) {
    console.log("Frame navigated:", details.frameId, details.url);
    injectMain(details.tabId);
  }
});

// Optional: handle iframe load (for Jotform dynamic frames)
chrome.webNavigation.onCompleted.addListener((details) => {
  if (trackedTabs.has(details.tabId)) {
    injectMain(details.tabId);
  }
});