// src/content/extractor.js

console.log("Open-Do Extractor initialized.");

function extractDOM() {
  console.log("Extracting Accessibility Tree...");
  // Stub for accessibility tree extraction.
  // In a real implementation, this would:
  // 1. Walk the DOM tree
  // 2. Identify interactive elements (a, button, input, textarea, select, [role="button"], etc.)
  // 3. Assign unique data attributes (e.g. data-opendo-id="1") to them
  // 4. Return a simplified JSON representation for the LLM
  
  const interactables = document.querySelectorAll('a, button, input, textarea, select');
  const items = [];
  
  interactables.forEach((el, index) => {
    const id = index + 1;
    el.setAttribute('data-opendo-id', id);
    items.push({
      id: id,
      tag: el.tagName.toLowerCase(),
      text: el.innerText || el.value || el.placeholder || '',
      type: el.type || undefined
    });
  });
  
  return {
    url: window.location.href,
    title: document.title,
    interactables: items.slice(0, 50) // limit to top 50 for prototype
  };
}

// Listen for commands from the side panel
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extract_dom') {
    const tree = extractDOM();
    sendResponse({ success: true, tree });
  }
});
