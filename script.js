/* ================= v3.2 Script =================
   Same base as v3.1, with updates:
   - "Other" in Issue/Action prints only the user value (not the word "Other")
   - Added Submitted / Re-submitted on Portal / MR-Submitted / QTC options (kept old values)
   - Removed 'Submitted manually' and 'Resubmitted via Portal' options from select lists (per request)
   - "By" prints initials only (no "By:" label in output)
   - Keeps history (last 10), copy, clear, theme toggle, and conditional fields
*/

// ---- Theme & Logo setup ----
const themeToggle = document.getElementById('themeToggle');
const body = document.body;
const themeLogo = document.getElementById('themeLogo');

// Logos (place files in same folder)
const LOGO_DARK = 'arkansas_logo.png';
const LOGO_LIGHT = 'blue_logo.png';

// Initialize theme text and logo on load
function initTheme() {
  if (body.classList.contains('dark-mode')) {
    themeToggle.textContent = 'Switch to Light Mode';
    themeLogo.src = LOGO_DARK;
    themeLogo.style.height = '56px';
  } else {
    themeToggle.textContent = 'Switch to Dark Mode';
    themeLogo.src = LOGO_LIGHT;
    themeLogo.style.height = '56px';
  }
}
initTheme();

themeToggle.addEventListener('click', () => {
  if (body.classList.contains('dark-mode')) {
    body.classList.replace('dark-mode', 'light-mode');
  } else {
    body.classList.replace('light-mode', 'dark-mode');
  }
  initTheme();
});

// ---- Dynamic Issue Field ----
function toggleIssueFields() {
  const issueType = document.getElementById('issueType').value;
  const issueExtra = document.getElementById('issueExtraField');
  const placeholder = (issueType === 'CPT Denied') ? 'Enter CPT code(s), e.g. 96372, 99416' : 'Enter Claim number(s), e.g. 250909Q1ACC8';
  issueExtra.innerHTML = `<textarea id="extraIssue" placeholder="${placeholder}" rows="2" style="min-height:60px;max-height:120px;resize:vertical;"></textarea>`;
}

// ---- Action Taken Conditional Fields ----
function toggleActionFields() {
  const action = document.getElementById('actionTaken').value;
  const div = document.getElementById('actionExtraFields');
  div.innerHTML = ''; // clear

  if (action === 'Call') {
    div.innerHTML = `
      <input id="refNo" type="text" placeholder="Reference # (required)" />
      <input id="repName" type="text" placeholder="Rep Name (optional)" />
    `;
  } else if (action === 'Reconsideration' || action === 'Appeal') {
    div.innerHTML = `<input id="refNo" type="text" placeholder="Reference # (required)" />`;
  } else if (action === 'Rematch ICD') {
    div.innerHTML = `<input id="rematchComment" type="text" placeholder="ICD update (e.g., Added I10 for CPT 99416)" />`;
  } else if (action === 'Other') {
    div.innerHTML = `<input id="otherActionInput" type="text" placeholder="Specify other action" />`;
  } else {
    div.innerHTML = '';
  }
}

// ---- Generate Comment Logic ----
document.getElementById('generateBtn').addEventListener('click', () => {
  // Collect fields
  const payer = document.getElementById('payer').value.trim();
  const claimStatus = document.getElementById('claimStatus').value;
  const issueType = document.getElementById('issueType').value;
  const extraIssue = document.getElementById('extraIssue')?.value.trim() || '';
  const action = document.getElementById('actionTaken').value;
  const outcome = document.getElementById('outcome').value.trim();
  const claimId = document.getElementById('claimId').value.trim();
  const by = document.getElementById('by').value.trim();

  // small validation for required core fields
  if (!payer) { alert('Please enter Payer.'); return; }
  if (!claimStatus) { alert('Please select Claim Status.'); return; }
  if (!issueType) { alert('Please select Issue Type.'); return; }
  if (!action) { alert('Please select Action Taken.'); return; }
  if (!outcome) { alert('Please enter Outcome.'); return; }

  // action extras
  const refNo = document.getElementById('refNo')?.value.trim();
  const repName = document.getElementById('repName')?.value.trim();
  const rematchComment = document.getElementById('rematchComment')?.value.trim();
  const otherActionInput = document.getElementById('otherActionInput')?.value.trim();

  let actionExtraText = '';
  if (action === 'Call') {
    actionExtraText = refNo ? ` (Ref#: ${refNo}${repName ? `, Rep: ${repName}` : ''})` : ' (Ref#: N/A)';
  } else if (['Reconsideration', 'Appeal'].includes(action)) {
    actionExtraText = refNo ? ` (Ref#: ${refNo})` : ' (Ref#: N/A)';
  } else if (action === 'Rematch ICD') {
    actionExtraText = rematchComment ? ` (${rematchComment})` : '';
  } else if (action === 'Other') {
    actionExtraText = '';
  }

  // Build the final comment string (plain text, no markdown)
  const parts = [];
  parts.push(`Payer: ${payer}`);
  parts.push(`Claim Status: ${claimStatus}`);

  // Issue: if Other selected => print the user's text only (no "Other")
  if (issueType === 'Other') {
    parts.push(`Issue: ${extraIssue}`);
  } else {
    parts.push(`Issue: ${issueType}${extraIssue ? ' (' + extraIssue + ')' : ''}`);
  }

  // Action: if Other selected => print the custom text; else print selected action (with extras)
  if (action === 'Other') {
    if (otherActionInput) {
      parts.push(`Action Taken: ${otherActionInput}`);
    } else {
      parts.push(`Action Taken: Other`);
    }
  } else {
    parts.push(`Action Taken: ${action}${actionExtraText}`);
  }

  parts.push(`Outcome: ${outcome}`);
  if (claimId) parts.push(`Claim ID: ${claimId}`);

  // By field: print initials ONLY (no "By:")
  if (by) parts.push(`${by}`);

  const comment = parts.join('\n');

  // Output to textarea and copy to clipboard
  const output = document.getElementById('generatedComment');
  output.value = comment;

  // copy to clipboard (navigator API)
  if (navigator.clipboard) {
    navigator.clipboard.writeText(comment).catch(()=>{/* ignore copy errors */});
  } else {
    // fallback: select and execCommand
    output.select();
    document.execCommand('copy');
  }

  // Save in history
  saveToHistory(comment);
});

// ---- History (localStorage, keep last 10) ----
function saveToHistory(comment) {
  const raw = localStorage.getItem('commentHistory') || '[]';
  const history = JSON.parse(raw);
  const item = { text: comment, time: new Date().toLocaleString() };
  history.unshift(item);
  if (history.length > 10) history.length = 10;
  localStorage.setItem('commentHistory', JSON.stringify(history));
  renderHistory();
}

function renderHistory() {
  const raw = localStorage.getItem('commentHistory') || '[]';
  const history = JSON.parse(raw);
  const list = document.getElementById('historyList');
  list.innerHTML = '';
  history.forEach(h => {
    const li = document.createElement('li');
    li.innerHTML = `<strong>${h.time}</strong><div style="margin-top:6px;">${h.text.replace(/\n/g,'<br>')}</div>`;
    list.appendChild(li);
  });
}

// ---- Copy / Clear Buttons ----
document.getElementById('copyBtn').addEventListener('click', () => {
  const text = document.getElementById('generatedComment').value;
  if (!text) { alert('Nothing to copy'); return; }
  if (navigator.clipboard) navigator.clipboard.writeText(text);
  else {
    const out = document.getElementById('generatedComment');
    out.select();
    document.execCommand('copy');
  }
  alert('Comment copied!');
});

document.getElementById('clearBtn').addEventListener('click', () => {
  document.getElementById('generatedComment').value = '';
});

document.getElementById('clearHistoryBtn').addEventListener('click', () => {
  if (confirm('Clear comment history?')) {
    localStorage.removeItem('commentHistory');
    renderHistory();
  }
});

// Render history on load and setup initial form fields
window.addEventListener('load', () => {
  renderHistory();
  toggleIssueFields();   // create initial issue textarea
  toggleActionFields();  // ensure action extras are empty
});
// ================= End of Script =================
