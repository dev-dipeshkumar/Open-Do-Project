// src/content/actuator.js

console.log("Open-Do Actuator initialized.");

function executeAction(actionData) {
  console.log("Executing Action:", actionData);
  // Stub for executing actions.
  // Real implementation:
  // - click: Find element by data-opendo-id, dispatch pointer/mouse/click events
  // - type: Focus element, dispatch input events or set value
  // - scroll: window.scrollBy
  
  if (actionData.action === 'click') {
    const el = document.querySelector(`[data-opendo-id="${actionData.targetId}"]`);
    if (el) {
      el.click(); // Simple click for now
      return { success: true };
    }
    return { success: false, error: 'Element not found' };
  }
  
  return { success: false, error: 'Unknown action' };
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'execute_action') {
    const result = executeAction(request.payload);
    sendResponse(result);
  }
});
