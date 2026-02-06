let extensionEnabled = true;
let jiraBaseUrl = '';
let projectMappings = '';

chrome.storage.local.get(['extensionEnabled', 'jiraBaseUrl', 'projectMappings'], function(result) {
  extensionEnabled = result.extensionEnabled !== false;
  jiraBaseUrl = result.jiraBaseUrl || '';
  projectMappings = result.projectMappings || '';

  if (extensionEnabled) {
    initializeExtension();
  }
});

chrome.storage.onChanged.addListener(function(changes) {
  if (changes.extensionEnabled) {
    extensionEnabled = changes.extensionEnabled.newValue !== false;
    if (extensionEnabled) {
      addJiraButton();
    } else {
      removeJiraButton();
    }
  }
  if (changes.jiraBaseUrl) {
    jiraBaseUrl = changes.jiraBaseUrl.newValue || '';
  }
  if (changes.projectMappings) {
    projectMappings = changes.projectMappings.newValue || '';
  }
});

function getBasecampProjectId() {
  const match = window.location.pathname.match(/\/projects\/(\d+)/);
  return match ? match[1] : null;
}

function findJiraProjectKey(basecampProjectId) {
  if (!basecampProjectId || !projectMappings) return null;

  const lines = projectMappings.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Format: "19195753 - WBNK"
    const match = trimmed.match(/^(\d+)\s*-\s*(.+)$/);
    if (match && match[1] === basecampProjectId) {
      return match[2].trim();
    }
  }
  return null;
}

function createJiraButton() {
  const btn = document.createElement('button');
  btn.className = 'jira-task-btn';
  btn.title = 'Create JIRA task';
  btn.innerHTML = `
    <svg viewBox="0 0 24 24" width="14" height="14">
      <path d="M11.53 2c0 2.4 1.97 4.35 4.35 4.35h1.78v1.7c0 2.4 1.94 4.34 4.34 4.35V2.84a.84.84 0 0 0-.84-.84h-9.63z"/>
      <path d="M6.77 6.82a4.36 4.36 0 0 0 4.34 4.34h1.8v1.72a4.36 4.36 0 0 0 4.34 4.34V7.66a.84.84 0 0 0-.84-.84H6.77z"/>
      <path d="M2 11.65a4.35 4.35 0 0 0 4.35 4.35h1.78v1.72c0 2.4 1.94 4.34 4.34 4.35V12.5a.84.84 0 0 0-.83-.84H2z"/>
    </svg>
  `;

  btn.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    handleJiraButtonClick();
  });

  return btn;
}

function handleJiraButtonClick() {
  if (!jiraBaseUrl) {
    alert('Please set JIRA Base URL in the extension popup.');
    return;
  }

  // Extract todo title and collapse duplicate spaces
  const titleEl = document.querySelector('span.content_for_perma');
  const summary = titleEl ? titleEl.textContent.trim().replace(/\s+/g, ' ') : '';

  // Extract project name
  const projectEl = document.querySelector('.panel.sheet.project h1 a');
  const projectName = projectEl ? projectEl.textContent.trim() : '';

  // Current URL as basecamp link
  const basecampUrl = window.location.href;

  // Find JIRA project key from Basecamp project ID
  const basecampProjectId = getBasecampProjectId();
  const jiraProjectKey = findJiraProjectKey(basecampProjectId);

  // Store pending task
  chrome.storage.local.set({
    pendingJiraTask: {
      summary: summary,
      basecampUrl: basecampUrl,
      projectName: projectName,
      jiraProjectKey: jiraProjectKey,
      timestamp: Date.now()
    }
  }, function() {
    // Open JIRA in new tab
    let baseUrl = jiraBaseUrl;
    if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
      baseUrl = 'https://' + baseUrl;
    }
    if (baseUrl.endsWith('/')) {
      baseUrl = baseUrl.slice(0, -1);
    }
    window.open(baseUrl, '_blank');
  });
}

function addJiraButton() {
  if (document.querySelector('.jira-task-btn')) return;

  const titleEl = document.querySelector('span.content_for_perma');
  if (!titleEl) return;

  const btn = createJiraButton();
  titleEl.parentNode.insertBefore(btn, titleEl.nextSibling);
}

function removeJiraButton() {
  const btn = document.querySelector('.jira-task-btn');
  if (btn) btn.remove();
}

function initializeExtension() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      addJiraButton();
      observeDOM();
    });
  } else {
    addJiraButton();
    observeDOM();
  }
}

function observeDOM() {
  const observer = new MutationObserver(function() {
    if (!extensionEnabled) return;
    if (!document.querySelector('.jira-task-btn')) {
      addJiraButton();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}
