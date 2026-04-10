// src/background.js

// Allow users to open the side panel by clicking on the action toolbar icon
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionIconClick: true })
  .catch((error) => console.error(error));

// Listen for messages from the side panel or other parts of the extension
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'inject_content_scripts') {
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      console.log('Open-Do: Found active tab for injection:', activeTab?.id, activeTab?.url);
      if (activeTab) {
        // Inject extractor and actuator into the active tab
        chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          files: ['src/content/extractor.js', 'src/content/actuator.js']
        }).then(() => {
          sendResponse({ success: true, message: 'Content scripts injected.' });
        }).catch(err => {
          console.error('Script injection failed:', err);
          sendResponse({ success: false, error: err.toString() });
        });
      } else {
        sendResponse({ success: false, error: 'No active tab found.' });
      }
    });
    return true; // Keep channel open for async response
  }

  if (request.action === 'send_to_content') {
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      console.log('Open-Do: Found active tab for message:', activeTab?.id);
      if (activeTab) {
        chrome.tabs.sendMessage(activeTab.id, request.payload, (response) => {
          sendResponse(response);
        });
      } else {
         sendResponse({ success: false, error: 'No active tab found. Ensure the extension has incognito access if testing there.' });
      }
    });
    return true; // Keep channel open for async response
  }
});

console.log("Open-Do background service worker initialized.");
