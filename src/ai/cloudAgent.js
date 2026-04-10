/**
 * src/ai/cloudAgent.js
 * Reasoning engine that can use Puter.js (Cloud) or Ollama (Local).
 */

export async function askCloudAgent(task, extractedDOM) {
  const settings = await chrome.storage.local.get({
    aiProvider: 'puter',
    ollamaUrl: 'http://localhost:11434',
    ollamaModel: 'llama3',
    ollamaKey: ''
  });

  const baseSystemPrompt = `You are a strict JSON-only autonomous browser agent. Your job is to decide the next action based on the user's task and the current page's simplified Accessibility Tree.
The JSON must be an array of action objects.

Supported actions:
- click: { "action": "click", "targetId": <number>, "reason": <string> }
- type: { "action": "type", "targetId": <number>, "text": <string>, "reason": <string> }
- scroll: { "action": "scroll", "direction": "down" | "up", "reason": <string> }

Current Task: ${task}
Page URL: ${extractedDOM.url}
Page Title: ${extractedDOM.title}

Accessibility Tree:
${JSON.stringify(extractedDOM.interactables, null, 2)}`;

  let textResponse = "";

  if (settings.aiProvider === 'ollama') {
    const ollamaPrompt = `${baseSystemPrompt}\n\nIMPORTANT: OUTPUT ONLY VALID JSON. If you wrapper it in an object, use the key "actions". Example: {"actions": [{"action": "click", ...}]}`;
    
    console.log(`Asking Ollama (${settings.ollamaModel}) at ${settings.ollamaUrl}`);
    
    // Create a controller for the timeout
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 45000); // 45s timeout

    try {
      const response = await fetch(`${settings.ollamaUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(settings.ollamaKey ? { 'Authorization': `Bearer ${settings.ollamaKey}` } : {})
        },
        body: JSON.stringify({
          model: settings.ollamaModel,
          messages: [
            { role: 'system', content: 'You are a technical browser automation expert. You respond ONLY with JSON.' },
            { role: 'user', content: ollamaPrompt }
          ],
          stream: false,
          format: 'json'
        }),
        signal: controller.signal
      });

      clearTimeout(id);

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Ollama API returned ${response.status}: ${errText}`);
      }

      const data = await response.json();
      textResponse = data.message?.content || "";
      console.log("Ollama Raw Response Content:", textResponse);
    } catch (err) {
      clearTimeout(id);
      if (err.name === 'AbortError') {
        throw new Error("Ollama request timed out (45s). Check if your model is too large for your hardware.");
      }
      console.error('Ollama Request Failed:', err);
      throw new Error(`Ollama Connection Failed: ${err.message}. Ensure Ollama is running and OLLAMA_ORIGINS is set.`);
    }
  } else {
    // Default: Puter
    if (typeof puter === 'undefined') {
      throw new Error('Puter SDK is not loaded. Please ensuring you are logged in.');
    }

    try {
      const response = await puter.ai.chat(baseSystemPrompt, { model: 'claude-3-5-sonnet' });
      textResponse = response?.text || response?.message?.content || response?.toString() || "";
      if (typeof response === 'string') textResponse = response;
    } catch (error) {
      console.error('Puter AI Error:', error);
      throw error;
    }
  }

  return parseActions(textResponse);
}

function parseActions(text) {
  if (!text || text.trim().length === 0) {
    throw new Error("AI returned an empty response. Try again.");
  }

  let jsonString = text.trim();
  
  // Strip markdown code blocks if any
  if (jsonString.includes('```json')) {
    jsonString = jsonString.split('```json')[1].split('```')[0].trim();
  } else if (jsonString.includes('```')) {
    jsonString = jsonString.split('```')[1].split('```')[0].trim();
  }
  
  try {
    const parsed = JSON.parse(jsonString);
    
    // Case 1: Bare array [{}, {}]
    if (Array.isArray(parsed)) return parsed;
    
    // Case 2: Wrapped in object {"actions": []}
    if (parsed.actions && Array.isArray(parsed.actions)) return parsed.actions;
    
    // Case 3: Single object {}
    if (typeof parsed === 'object' && parsed !== null) return [parsed];
    
    throw new Error("Invalid JSON structure returned by AI.");
  } catch (parseErr) {
    // Fallback: search for brackets if JSON.parse fails due to prefix/suffix text
    const startIndex = jsonString.indexOf('[');
    const endIndex = jsonString.lastIndexOf(']');
    
    if (startIndex !== -1 && endIndex !== -1) {
      try {
        const sliced = jsonString.slice(startIndex, endIndex + 1);
        return JSON.parse(sliced);
      } catch (e) {
         console.error("Bracket extraction failed", e);
      }
    }
    
    console.error('Failed to parse AI JSON:', jsonString);
    throw new Error("AI returned invalid JSON format. Check console for details.");
  }
}
