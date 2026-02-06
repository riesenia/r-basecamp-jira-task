document.addEventListener('DOMContentLoaded', function() {
  const toggleSwitch = document.getElementById('toggleSwitch');
  const statusText = document.getElementById('statusText');
  const optionsSection = document.getElementById('optionsSection');
  const jiraBaseUrl = document.getElementById('jiraBaseUrl');
  const projectMappings = document.getElementById('projectMappings');

  // Load current state
  chrome.storage.local.get(['extensionEnabled', 'jiraBaseUrl', 'projectMappings'], function(result) {
    const isEnabled = result.extensionEnabled !== false;
    const baseUrl = result.jiraBaseUrl || '';
    const mappings = result.projectMappings || '';

    updateMainToggle(isEnabled);
    jiraBaseUrl.value = baseUrl;
    projectMappings.value = mappings;
  });

  // Handle main toggle click
  toggleSwitch.addEventListener('click', function() {
    chrome.storage.local.get(['extensionEnabled'], function(result) {
      const currentState = result.extensionEnabled !== false;
      const newState = !currentState;

      chrome.storage.local.set({extensionEnabled: newState}, function() {
        updateMainToggle(newState);
      });
    });
  });

  // Handle JIRA base URL input changes
  jiraBaseUrl.addEventListener('input', function() {
    const baseUrl = jiraBaseUrl.value.trim();
    chrome.storage.local.set({jiraBaseUrl: baseUrl});
  });

  // Handle project mappings changes
  projectMappings.addEventListener('input', function() {
    const mappings = projectMappings.value;
    chrome.storage.local.set({projectMappings: mappings});
  });

  function updateMainToggle(enabled) {
    if (enabled) {
      toggleSwitch.classList.add('enabled');
      statusText.textContent = 'Extension is enabled';
      optionsSection.classList.remove('disabled');
    } else {
      toggleSwitch.classList.remove('enabled');
      statusText.textContent = 'Extension is disabled';
      optionsSection.classList.add('disabled');
    }
  }
});
