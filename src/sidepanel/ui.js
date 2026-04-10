// src/sidepanel/ui.js
import { askCloudAgent } from '../ai/cloudAgent.js';

const state = {
  status: 'OFFLINE', // OFFLINE, IDLE, THINKING, ACTING
  user: null
};

const elements = {
  authBtn: document.getElementById('auth-btn'),
  userInfo: document.getElementById('user-info'),
  usernameDisplay: document.getElementById('username-display'),
  logoutBtn: document.getElementById('logout-btn'),
  statusBar: document.getElementById('status-bar'),
  statusText: document.getElementById('status-text'),
  feed: document.getElementById('action-feed'),
  inputArea: document.getElementById('input-area'),
  taskInput: document.getElementById('task-input'),
  sendBtn: document.getElementById('send-btn'),
  killBtn: document.getElementById('kill-btn'),
  settingsBtn: document.getElementById('settings-btn'),
  settingsPanel: document.getElementById('settings-panel'),
  closeSettings: document.getElementById('close-settings'),
  saveSettings: document.getElementById('save-settings'),
  aiProvider: document.getElementById('ai-provider'),
  ollamaSettings: document.getElementById('ollama-settings'),
  ollamaUrl: document.getElementById('ollama-url'),
  ollamaModel: document.getElementById('ollama-model'),
  ollamaKey: document.getElementById('ollama-key')
};

function updateStatus(newStatus) {
  state.status = newStatus;
  elements.statusBar.dataset.status = newStatus;
  elements.statusText.textContent = newStatus;
}

function addActionCard(title, details, icon = '✨') {
  const card = document.createElement('div');
  card.className = 'card';
  card.innerHTML = `
    <h3>${icon} ${title}</h3>
    <p>${details}</p>
  `;
  elements.feed.appendChild(card);
  scrollToBottom();
}

function scrollToBottom() {
  elements.feed.scrollTop = elements.feed.scrollHeight;
}

function updateAuthState(isSignedIn, user = null) {
  if (isSignedIn) {
    elements.authBtn.style.display = 'none';
    elements.userInfo.style.display = 'flex';
    elements.usernameDisplay.textContent = user ? user.username : 'Authenticated';
    elements.inputArea.style.opacity = '1';
    elements.inputArea.style.pointerEvents = 'auto';
    updateStatus('IDLE');
    addActionCard('Connected', 'Cloud services are online and ready.', '🟢');
  } else {
    elements.authBtn.style.display = 'block';
    elements.userInfo.style.display = 'none';
    elements.inputArea.style.opacity = '0.5';
    elements.inputArea.style.pointerEvents = 'none';
    updateStatus('OFFLINE');
  }
}

// Settings Logic
async function loadSettings() {
  const settings = await chrome.storage.local.get({
    aiProvider: 'puter',
    ollamaUrl: 'http://localhost:11434',
    ollamaModel: 'llama3',
    ollamaKey: ''
  });

  elements.aiProvider.value = settings.aiProvider;
  elements.ollamaUrl.value = settings.ollamaUrl;
  elements.ollamaModel.value = settings.ollamaModel;
  elements.ollamaKey.value = settings.ollamaKey;

  toggleOllamaFields(settings.aiProvider);
  return settings;
}

function toggleOllamaFields(provider) {
  elements.ollamaSettings.style.display = provider === 'ollama' ? 'block' : 'none';
}

elements.settingsBtn.addEventListener('click', () => {
  elements.settingsPanel.style.display = 'flex';
});

elements.closeSettings.addEventListener('click', () => {
  elements.settingsPanel.style.display = 'none';
});

elements.aiProvider.addEventListener('change', (e) => {
  toggleOllamaFields(e.target.value);
});

elements.saveSettings.addEventListener('click', async () => {
  const settings = {
    aiProvider: elements.aiProvider.value,
    ollamaUrl: elements.ollamaUrl.value,
    ollamaModel: elements.ollamaModel.value,
    ollamaKey: elements.ollamaKey.value
  };
  await chrome.storage.local.set(settings);
  elements.settingsPanel.style.display = 'none';
  addActionCard('Settings Saved', `Provider: ${settings.aiProvider.toUpperCase()}`, '⚙️');
  
  if (settings.aiProvider === 'puter') {
     // Re-check puter auth if switching back
     checkPuterStatus();
  } else {
     updateStatus('IDLE');
     elements.inputArea.style.opacity = '1';
     elements.inputArea.style.pointerEvents = 'auto';
     addActionCard('Ollama Ready', `Connecting to ${settings.ollamaUrl}`, '🤖');
  }
});

async function checkPuterStatus() {
  if (typeof puter !== 'undefined') {
    const isSignedIn = puter.auth.isSignedIn();
    if (isSignedIn) {
      const user = await puter.auth.getUser();
      updateAuthState(true, user);
    } else {
      updateAuthState(false);
    }
  } else {
    addActionCard('Error', 'Puter SDK failed to load.', '❌');
  }
}

// Ensure puter is loaded
window.addEventListener('load', async () => {
  const settings = await loadSettings();
  if (settings.aiProvider === 'puter') {
    checkPuterStatus();
  } else {
    updateStatus('IDLE');
    elements.inputArea.style.opacity = '1';
    elements.inputArea.style.pointerEvents = 'auto';
    addActionCard('Ollama Mode', 'Using local reasoning engine.', '🤖');
  }
});

// Authentication Listeners
elements.authBtn.addEventListener('click', async () => {
  if (typeof puter === 'undefined') return;
  try {
    const user = await puter.auth.signIn();
    updateAuthState(true, user);
  } catch (err) {
    console.error('Sign in failed', err);
    addActionCard('Login Error', err.message || 'Failed to authenticate.', '❌');
  }
});

elements.logoutBtn.addEventListener('click', async () => {
  if (typeof puter === 'undefined') return;
  puter.auth.signOut();
  updateAuthState(false);
  addActionCard('Disconnected', 'You have been logged out.', '🔓');
});

// Action Execution Loop
elements.sendBtn.addEventListener('click', () => {
  const task = elements.taskInput.value.trim();
  if (!task) return;
  
  elements.taskInput.value = '';
  addActionCard('Task Started', `"${task}"`, '📝');
  updateStatus('THINKING');
  
  // 1. Inject content scripts to ensure they are on the page
  chrome.runtime.sendMessage({ action: 'inject_content_scripts' }, (response) => {
    if (chrome.runtime.lastError) {
      addActionCard('Comm Error', 'Background script unreachable.', '❌');
      updateStatus('IDLE');
      return;
    }

    if (response && response.success) {
      addActionCard('Target Status', 'Found active tab. Injecting logic...', '🎯');
      
      setTimeout(() => {
        addActionCard('Extracting', 'Reading page accessibility tree...', '👁️');
        
        // 2. Trigger Extraction
        chrome.runtime.sendMessage({
          action: 'send_to_content',
          payload: { action: 'extract_dom' }
        }, async (res) => {
          if (res && res.success) {
            try {
              // 3. Send tree + task to reasoning engine
              const currentSettings = await chrome.storage.local.get({ aiProvider: 'puter' });
              const providerName = currentSettings.aiProvider === 'ollama' ? 'Local Ollama' : 'Cloud AI (Puter)';
              
              addActionCard('Reasoning', `Consulting ${providerName} for the next step...`, '🧠');
              const actions = await askCloudAgent(task, res.tree);
              
              if (actions && actions.length > 0) {
                const action = actions[0]; 
                addActionCard('Deploying', `${action.action.toUpperCase()} on target ${action.targetId}`, '⚡');
                updateStatus('ACTING');
                
                // 4. Send returned action to actuator
                chrome.runtime.sendMessage({
                  action: 'send_to_content',
                  payload: { action: 'execute_action', payload: action }
                }, (actuatorRes) => {
                  if (actuatorRes && actuatorRes.success) {
                     addActionCard('Success', 'Action executed.', '✅');
                  } else {
                     addActionCard('Failed', actuatorRes ? actuatorRes.error : 'Execution timed out.', '❌');
                  }
                  updateStatus('IDLE');
                });
              } else {
                 addActionCard('No Actions', 'Agent decided to wait.', '🤷');
                 updateStatus('IDLE');
              }
            } catch (e) {
               addActionCard('AI Error', e.message || 'LLM Request failed', '❌');
               updateStatus('IDLE');
            }
          } else {
            addActionCard('Extraction Failed', res?.error || 'Could not parse the page DOM. Try refreshing the target tab.', '❌');
            updateStatus('IDLE');
          }
        });
      }, 500);
    } else {
      addActionCard('Target Missing', response?.error || 'Failed to connect to the active tab.', '❌');
      updateStatus('IDLE');
    }
  });
});

elements.killBtn.addEventListener('click', () => {
  updateStatus('IDLE');
  addActionCard('Emergency Stop', 'Process halted.', '🛑');
});
