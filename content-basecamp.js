let extensionEnabled = true;
let jiraBaseUrl = '';
let projectMappings = '';

const ISSUE_TYPES = [
  { label: 'Bug', jiraType: 'Bug' },
  { label: 'Feature', jiraType: 'New Feature' },
  { label: 'Pricing', jiraType: 'Pricing' },
];

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
      addJiraButtons();
    } else {
      removeJiraButtons();
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

    const match = trimmed.match(/^(\d+)\s*-\s*(.+)$/);
    if (match && match[1] === basecampProjectId) {
      return match[2].trim();
    }
  }
  return null;
}

function createJiraButtons() {
  const container = document.createElement('span');
  container.className = 'jira-task-buttons';

  ISSUE_TYPES.forEach(function(type) {
    const btn = document.createElement('button');
    btn.className = 'jira-task-btn';
    btn.title = 'Create JIRA ' + type.jiraType;
    btn.textContent = type.label;

    btn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      handleJiraButtonClick(type.jiraType);
    });

    container.appendChild(btn);
  });

  return container;
}

function handleJiraButtonClick(issueType) {
  if (!jiraBaseUrl) {
    alert('Please set JIRA Base URL in the extension popup.');
    return;
  }

  // Extract todo title, strip JIRA key prefix and collapse duplicate spaces
  const titleEl = document.querySelector('span.content_for_perma');
  const summary = titleEl ? titleEl.textContent.trim().replace(/\b[A-Z]{2,10}-\d+\b\s*[-:]\s*/g, '').replace(/\s+/g, ' ').trim() : '';

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
      issueType: issueType,
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

function addJiraButtons() {
  if (document.querySelector('.jira-task-buttons')) return;

  const titleEl = document.querySelector('span.content_for_perma');
  if (!titleEl) return;

  const buttons = createJiraButtons();
  titleEl.parentNode.insertBefore(buttons, titleEl.nextSibling);
}

function removeJiraButtons() {
  const container = document.querySelector('.jira-task-buttons');
  if (container) container.remove();
}

function initializeExtension() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      addJiraButtons();
      observeDOM();
    });
  } else {
    addJiraButtons();
    observeDOM();
  }
}

function observeDOM() {
  const observer = new MutationObserver(function() {
    if (!extensionEnabled) return;
    if (!document.querySelector('.jira-task-buttons')) {
      addJiraButtons();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}
