const MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes
const MAX_WAIT_MS = 15000; // 15 seconds
const POLL_INTERVAL_MS = 500;

function log(msg) {
  console.log('[Basecamp→JIRA]', msg);
}

function processPendingTask() {
  chrome.storage.local.get(['pendingJiraTask'], function(result) {
    const task = result.pendingJiraTask;
    if (!task) {
      log('No pending task found');
      return;
    }

    // Check if task is too old
    if (Date.now() - task.timestamp > MAX_AGE_MS) {
      log('Pending task expired, removing');
      chrome.storage.local.remove('pendingJiraTask');
      return;
    }

    log('Found pending task: ' + task.summary);

    waitForJiraReady().then(function() {
      log('JIRA is ready, opening create dialog...');
      openCreateDialog().then(function() {
        log('Create dialog opened, filling form...');
        fillCreateForm(task);
        chrome.storage.local.remove('pendingJiraTask');
      });
    });
  });
}

// Run on initial load only
processPendingTask();

function waitForJiraReady() {
  return new Promise(function(resolve) {
    function isReady() {
      return document.querySelector('[data-testid="atlassian-navigation"]') ||
             document.querySelector('nav[aria-label="Primary"]') ||
             document.querySelector('#jira-frontend') ||
             document.querySelector('[data-testid="global-navigation"]') ||
             findCreateButton();
    }

    if (isReady()) {
      log('JIRA already ready');
      setTimeout(resolve, 1500);
      return;
    }

    log('Waiting for JIRA to become ready...');
    const observer = new MutationObserver(function() {
      if (isReady()) {
        observer.disconnect();
        log('JIRA became ready');
        setTimeout(resolve, 1500);
      }
    });

    observer.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true
    });

    setTimeout(function() {
      observer.disconnect();
      log('JIRA ready timeout, proceeding anyway');
      resolve();
    }, MAX_WAIT_MS);
  });
}

function findCreateButton() {
  const selectors = [
    'button[data-testid="atlassian-navigation--create-button"]',
    'button[data-testid="createGlobalItem"]',
    'button[data-testid="navigation-apps-sidebar-global-create.ui.create-button--button"]',
    'button[data-testid="global-create-button"]',
    'a[data-testid="createGlobalItem"]',
    'button[aria-label="Create"]',
    'button[aria-label="Create issue"]',
  ];

  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (el) {
      log('Found Create button with selector: ' + selector);
      return el;
    }
  }

  const nav = document.querySelector('[data-testid="atlassian-navigation"]') ||
              document.querySelector('nav[aria-label="Primary"]') ||
              document.querySelector('nav') ||
              document.body;

  const buttons = nav.querySelectorAll('button');
  for (const btn of buttons) {
    if (btn.textContent.trim() === 'Create') {
      log('Found Create button by text content');
      return btn;
    }
  }

  return null;
}

function isCreateFormOpen() {
  // Detect form by the presence of summary input (most reliable)
  return !!document.querySelector('input[name="summary"]');
}

function openCreateDialog() {
  return new Promise(function(resolve) {
    if (isCreateFormOpen()) {
      log('Create form already open');
      setTimeout(resolve, 500);
      return;
    }

    const createBtn = findCreateButton();
    if (createBtn) {
      log('Clicking Create button');
      createBtn.click();
    } else {
      log('Create button not found, will keep polling...');
    }

    let elapsed = 0;
    let retryClick = true;
    const interval = setInterval(function() {
      elapsed += POLL_INTERVAL_MS;

      if (isCreateFormOpen()) {
        clearInterval(interval);
        log('Create form detected');
        setTimeout(resolve, 1500);
        return;
      }

      if (retryClick && elapsed >= 3000) {
        retryClick = false;
        const btn = findCreateButton();
        if (btn) {
          log('Retrying Create button click');
          btn.click();
        } else {
          log('Create button still not found at ' + elapsed + 'ms');
        }
      }

      if (elapsed >= MAX_WAIT_MS) {
        clearInterval(interval);
        log('Timed out waiting for Create form');
        resolve();
      }
    }, POLL_INTERVAL_MS);
  });
}

function fillCreateForm(task) {
  var delay = 0;

  // Select project first if we have a mapping
  if (task.jiraProjectKey) {
    selectProject(task.jiraProjectKey);
    delay += 2000;
  }

  // Select issue type after project (project change may reload type options)
  if (task.issueType) {
    setTimeout(function() {
      selectIssueType(task.issueType);
    }, delay);
    delay += 2000;
  }

  // Fill summary after project + type selection
  setTimeout(function() {
    fillSummary(task.summary);

    // Fill External URL after summary
    setTimeout(function() {
      fillExternalUrl(task.basecampUrl);
    }, 500);
  }, delay);
}

function fillSummary(summary) {
  const summaryInput = document.querySelector('input[name="summary"]');

  if (summaryInput) {
    setNativeInputValue(summaryInput, summary);
    log('Summary filled');
  } else {
    log('Summary input not found');
  }
}

function selectProject(projectKey) {
  log('Selecting project: ' + projectKey);

  // Project picker has dynamic id starting with "project-"
  const projectInput = document.querySelector('input[id^="project-"]');

  if (!projectInput) {
    log('Project input not found');
    return;
  }

  log('Found project input: id="' + projectInput.id + '"');

  // Focus and type the project key
  projectInput.focus();
  setNativeInputValue(projectInput, projectKey);

  // Wait for dropdown options to appear, then click the first match
  setTimeout(function() {
    const option = document.querySelector('[role="option"]');
    if (option) {
      log('Clicking project option: ' + option.textContent.trim());
      option.click();
    } else {
      log('No project option found after filtering');
    }
  }, 1000);
}

function selectIssueType(issueType) {
  log('Selecting issue type: ' + issueType);

  // Issue type picker has dynamic id starting with "type-picker-"
  const typeInput = document.querySelector('input[id^="type-picker-"]');

  if (!typeInput) {
    log('Issue type input not found');
    return;
  }

  log('Found issue type input: id="' + typeInput.id + '"');

  typeInput.focus();
  setNativeInputValue(typeInput, issueType);

  // Wait for dropdown options to appear, then click the first match
  setTimeout(function() {
    const option = document.querySelector('[role="option"]');
    if (option) {
      log('Clicking issue type option: ' + option.textContent.trim());
      option.click();
    } else {
      log('No issue type option found after filtering');
    }
  }, 1000);
}

function fillExternalUrl(url) {
  // Search for External URL field by label text
  const labels = document.querySelectorAll('label');
  for (const label of labels) {
    const text = label.textContent.trim().toLowerCase();
    if (text.includes('external') && text.includes('url')) {
      const fieldId = label.getAttribute('for');
      if (fieldId) {
        const input = document.getElementById(fieldId);
        if (input) {
          log('Found External URL input via label for="' + fieldId + '"');
          setNativeInputValue(input, url);
          log('External URL filled');
          return;
        }
      }

      // Try finding input near the label
      const container = label.closest('[data-testid]') || label.parentElement;
      const input = container.querySelector('input');
      if (input) {
        log('Found External URL input near label');
        setNativeInputValue(input, url);
        log('External URL filled');
        return;
      }
    }
  }

  // Fallback: search by data-testid or name containing "url"
  const urlInput = document.querySelector('input[name*="url" i]') ||
                   document.querySelector('input[data-testid*="url" i]');
  if (urlInput) {
    log('Found URL input by name/testid');
    setNativeInputValue(urlInput, url);
    log('External URL filled');
    return;
  }

  // Debug: log all labels on page to help find the right field
  log('External URL field not found. Labels on page:');
  labels.forEach(function(label) {
    const text = label.textContent.trim();
    if (text.length > 0 && text.length < 50) {
      log('  label: "' + text + '" for="' + (label.getAttribute('for') || '') + '"');
    }
  });
}

function setNativeInputValue(input, value) {
  input.focus();
  const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  nativeSetter.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}
