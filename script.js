/* ================= v4.1 Script =================
   Changes from v4.0:
   - Rematch ICD action now shows two fields: Old ICD and New ICD,
     output reads "New instead of Old" (e.g. "I10 instead of Z00.000")
   - PA tab PR amounts auto-format: Copay/Deductible get a leading $,
     Co-Insurance gets a trailing % (skipped if you already typed one)
   ================= v4.0 changes =================
   Same base as v3.3, with updates:
   - "Other" in Issue/Action prints only the user value (not the word "Other")
   - Added Submitted / Re-submitted on Portal / MR-Submitted / QTC options (kept old values)
   - Removed 'Submitted manually' and 'Resubmitted via Portal' options from select lists (per request)
   - "By" prints initials only (no "By:" label in output)
   - Keeps history (last 10), copy, clear, theme toggle, and conditional fields
   - NEW: Claim / PA mode switch in header
   - NEW: PA tab — dynamic CPT chip list (default G0399/95810/95811 + add-your-own,
     no code changes needed for new CPTs), PA/Coverage/PR/Referral/Ref# block builder,
     repeatable PR lines, repeatable Ref# lines, repeatable free-text "Note Blocks"
     for anything that doesn't fit the structured fields (secondary insurance notes,
     effective dates, extra ref numbers, etc.)
   - Output box is now editable so any comment can be hand-tweaked before copying
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
      <input id="callNumber" type="tel" placeholder="Number Called (required)" required />
      <input id="refNo" type="text" placeholder="Reference # (required)" />
      <input id="repName" type="text" placeholder="Rep Name (optional)" />
    `;
  } else if (action === 'Reconsideration' || action === 'Appeal') {
    div.innerHTML = `<input id="refNo" type="text" placeholder="Reference # (required)" />`;
  } else if (action === 'Rematch ICD') {
    div.innerHTML = `
      <input id="oldIcd" type="text" placeholder="Old ICD (e.g., Z00.000)" />
      <input id="newIcd" type="text" placeholder="New ICD (e.g., I10)" />
    `;
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
  const callNumber = document.getElementById('callNumber')?.value.trim();
  const refNo = document.getElementById('refNo')?.value.trim();
  const repName = document.getElementById('repName')?.value.trim();
  const oldIcd = document.getElementById('oldIcd')?.value.trim();
  const newIcd = document.getElementById('newIcd')?.value.trim();
  const otherActionInput = document.getElementById('otherActionInput')?.value.trim();

  // Call number is required when Action Taken = Call
  if (action === 'Call' && !callNumber) {
    alert('Please enter the number you called (required).');
    return;
  }

  let actionExtraText = '';
  if (action === 'Call') {
    const callPart = `Called: ${callNumber}`;
    const refPart = refNo ? `Ref#: ${refNo}` : 'Ref#: N/A';
    const repPart = repName ? `Rep: ${repName}` : '';
    actionExtraText = ` (${[callPart, refPart, repPart].filter(Boolean).join(', ')})`;
  } else if (['Reconsideration', 'Appeal'].includes(action)) {
    actionExtraText = refNo ? ` (Ref#: ${refNo})` : ' (Ref#: N/A)';
  } else if (action === 'Rematch ICD') {
    if (newIcd && oldIcd) actionExtraText = ` (${newIcd} instead of ${oldIcd})`;
    else if (newIcd) actionExtraText = ` (${newIcd})`;
    else if (oldIcd) actionExtraText = ` (${oldIcd})`;
    else actionExtraText = '';
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
  initPaForm();          // set up PA tab (chips, first rows, listeners)
});

/* ================= Claim / PA Mode Switch ================= */
const modeClaimBtn = document.getElementById('modeClaimBtn');
const modePaBtn = document.getElementById('modePaBtn');
const claimSection = document.getElementById('claimSection');
const paSection = document.getElementById('paSection');
const mainEl = document.querySelector('main');

modeClaimBtn.addEventListener('click', () => {
  modeClaimBtn.classList.add('active');
  modePaBtn.classList.remove('active');
  modeClaimBtn.setAttribute('aria-selected', 'true');
  modePaBtn.setAttribute('aria-selected', 'false');
  claimSection.style.display = '';
  paSection.style.display = 'none';
  mainEl.classList.remove('pa-mode');
});

modePaBtn.addEventListener('click', () => {
  modePaBtn.classList.add('active');
  modeClaimBtn.classList.remove('active');
  modePaBtn.setAttribute('aria-selected', 'true');
  modeClaimBtn.setAttribute('aria-selected', 'false');
  claimSection.style.display = 'none';
  paSection.style.display = '';
  mainEl.classList.add('pa-mode');
});

/* ================= PA Form: CPT Chip Management =================
   Default CPTs always present as checkboxes (can be unchecked, not removed).
   Any newly added CPT gets its own checkbox + an "x" to remove it.
   Everything downstream (PA subset list, coverage mixed list, PR "applies to")
   reads from getActiveCpts() live, so adding a new CPT never requires a code change.
*/
const DEFAULT_CPTS = ['G0399', '95810', '95811'];
let addedCpts = []; // user-added CPT codes, each removable

function renderCptChips() {
  const container = document.getElementById('cptChips');
  const allCodes = [...DEFAULT_CPTS, ...addedCpts];
  // remember which are currently checked so re-render doesn't reset user choices
  const checkedState = {};
  allCodes.forEach(code => {
    const existing = document.querySelector(`#cptChips input[data-code="${cssEscape(code)}"]`);
    checkedState[code] = existing ? existing.checked : true;
  });

  container.innerHTML = '';
  allCodes.forEach(code => {
    const label = document.createElement('label');
    label.className = 'cpt-chip';
    const isDefault = DEFAULT_CPTS.includes(code);
    label.innerHTML = `
      <input type="checkbox" data-code="${escapeHtml(code)}" ${checkedState[code] ? 'checked' : ''} />
      <span>${escapeHtml(code)}</span>
      ${isDefault ? '' : `<button type="button" class="chip-remove" data-remove-code="${escapeHtml(code)}" title="Remove ${escapeHtml(code)}">×</button>`}
    `;
    container.appendChild(label);
  });
}

function cssEscape(str) {
  return String(str).replace(/["\\]/g, '\\$&');
}
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
}

function getActiveCpts() {
  return Array.from(document.querySelectorAll('#cptChips input[type="checkbox"]:checked'))
    .map(cb => cb.dataset.code);
}
function cptListStr(codes) {
  return codes.join('/');
}

document.getElementById('cptChips').addEventListener('click', (e) => {
  const removeCode = e.target.dataset.removeCode;
  if (removeCode) {
    addedCpts = addedCpts.filter(c => c !== removeCode);
    renderCptChips();
    refreshCptDependents();
  }
});
document.getElementById('cptChips').addEventListener('change', (e) => {
  if (e.target.matches('input[type="checkbox"]')) refreshCptDependents();
});

document.getElementById('addCptBtn').addEventListener('click', () => {
  const input = document.getElementById('newCptInput');
  const code = input.value.trim().toUpperCase();
  if (!code) return;
  const existingCodes = [...DEFAULT_CPTS, ...addedCpts].map(c => c.toUpperCase());
  if (existingCodes.includes(code)) { input.value = ''; return; }
  addedCpts.push(code);
  input.value = '';
  renderCptChips();
  refreshCptDependents();
});
document.getElementById('newCptInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); document.getElementById('addCptBtn').click(); }
});

// Refresh any block whose options depend on the active CPT list (subset picker, mixed coverage rows)
function refreshCptDependents() {
  if (document.getElementById('paMode').value === 'required_subset') renderPaSubset();
  if (document.getElementById('coverageMode').value === 'mixed') renderCoverageMixed();
}

/* ================= PA / Authorization block ================= */
const paModeSelect = document.getElementById('paMode');
paModeSelect.addEventListener('change', () => {
  const val = paModeSelect.value;
  document.getElementById('paSubsetContainer').innerHTML = '';
  document.getElementById('paOtherContainer').innerHTML = '';
  if (val === 'required_subset') renderPaSubset();
  if (val === 'other') {
    document.getElementById('paOtherContainer').innerHTML =
      `<input id="paOtherText" type="text" placeholder="Custom PA line (printed exactly as typed)" />`;
  }
});

function renderPaSubset() {
  const container = document.getElementById('paSubsetContainer');
  const active = getActiveCpts();
  if (active.length === 0) { container.innerHTML = `<p class="hint-text">Select CPT codes above first.</p>`; return; }
  container.innerHTML = `<label style="margin-top:0;">Which CPTs require authorization?</label><div class="chip-row">` +
    active.map(code => `
      <label class="cpt-chip">
        <input type="checkbox" class="pa-subset-cb" data-code="${escapeHtml(code)}" />
        <span>${escapeHtml(code)}</span>
      </label>`).join('') +
    `</div>`;
}

/* ================= Coverage block ================= */
const coverageModeSelect = document.getElementById('coverageMode');
coverageModeSelect.addEventListener('change', () => {
  const val = coverageModeSelect.value;
  document.getElementById('coverageMixedContainer').innerHTML = '';
  document.getElementById('coverageOtherContainer').innerHTML = '';
  if (val === 'mixed') renderCoverageMixed();
  if (val === 'other') {
    document.getElementById('coverageOtherContainer').innerHTML =
      `<input id="coverageOtherText" type="text" placeholder="Custom coverage line (printed exactly as typed)" />`;
  }
});

function renderCoverageMixed() {
  const container = document.getElementById('coverageMixedContainer');
  const active = getActiveCpts();
  if (active.length === 0) { container.innerHTML = `<p class="hint-text">Select CPT codes above first.</p>`; return; }
  container.innerHTML = active.map(code => `
    <div class="mixed-row" data-code="${escapeHtml(code)}" style="display:flex;align-items:center;gap:8px;margin-top:6px;">
      <span style="min-width:70px;font-weight:600;">${escapeHtml(code)}</span>
      <select style="margin-top:0;">
        <option value="">-- Skip --</option>
        <option value="covered">Covered</option>
        <option value="non_covered">Non-Covered</option>
      </select>
    </div>`).join('');
}

/* ================= Plan Type / Referral "Other" ================= */
document.getElementById('planType').addEventListener('change', function () {
  document.getElementById('planOtherContainer').innerHTML = this.value === 'other'
    ? `<input id="planOtherText" type="text" placeholder="Custom plan type" />` : '';
});
document.getElementById('referralMode').addEventListener('change', function () {
  document.getElementById('referralOtherContainer').innerHTML = this.value === 'other'
    ? `<input id="referralOtherText" type="text" placeholder="Custom referral text" />` : '';
});

/* ================= PR (Patient Responsibility) repeatable rows ================= */

// Auto-format the PR amount: Copay/Deductible get a leading $, Co-Insurance gets a trailing %.
// If the user already typed a $ or % themselves, it's left as-is (no double symbols).
function formatPrAmount(type, rawAmount) {
  let amount = rawAmount.trim();
  if (!amount) return amount;
  if (type === 'Copay' || type === 'Deductible') {
    if (!amount.includes('$')) amount = `$${amount}`;
  } else if (type === 'Co-Insurance') {
    if (!amount.includes('%')) amount = `${amount}%`;
  }
  return amount;
}

function addPrRow() {
  const container = document.getElementById('prRows');
  const row = document.createElement('div');
  row.className = 'pr-row';
  row.innerHTML = `
    <div class="row-line">
      <select class="prType">
        <option value="Copay">Copay</option>
        <option value="Co-Insurance">Co-Insurance</option>
        <option value="Deductible">Deductible</option>
        <option value="other">Other (custom line)</option>
      </select>
      <input class="prAmount" type="text" placeholder="Amount (e.g., 50 or 20 — $/% added automatically)" />
    </div>
    <div class="row-line prStandardFields">
      <input class="prApplies" type="text" placeholder="Applies to CPTs" value="${escapeHtml(cptListStr(getActiveCpts()))}" />
      <input class="prReason" type="text" placeholder="Reason (optional, e.g. ded has been met)" />
    </div>
    <div class="row-line prCustomWrap" style="display:none;">
      <input class="prCustom" type="text" placeholder="Full custom PR line" />
    </div>
    <button type="button" class="remove-row-btn" title="Remove">×</button>
  `;
  container.appendChild(row);

  const typeSelect = row.querySelector('.prType');
  const standardFields = row.querySelector('.prStandardFields');
  const customWrap = row.querySelector('.prCustomWrap');
  typeSelect.addEventListener('change', () => {
    const isOther = typeSelect.value === 'other';
    standardFields.style.display = isOther ? 'none' : 'flex';
    customWrap.style.display = isOther ? 'flex' : 'none';
    const amountInput = row.querySelector('.prAmount');
    if (typeSelect.value === 'Co-Insurance') {
      amountInput.placeholder = 'Amount (e.g., 20 — % added automatically)';
    } else if (typeSelect.value === 'Copay' || typeSelect.value === 'Deductible') {
      amountInput.placeholder = 'Amount (e.g., 50 — $ added automatically)';
    }
  });
}
document.getElementById('addPrBtn').addEventListener('click', addPrRow);
document.getElementById('prRows').addEventListener('click', (e) => {
  if (e.target.matches('.remove-row-btn')) e.target.closest('.pr-row').remove();
});

/* ================= Reference # repeatable rows ================= */
const REF_LABEL_OPTIONS = [
  { value: 'Ref #.', text: 'Ref #.___' },
  { value: 'Reference Number ', text: 'Reference Number ___' },
  { value: 'Reference Number: ', text: 'Reference Number: ___' },
  { value: 'Decision ID #: ', text: 'Decision ID #: ___' },
  { value: 'other', text: 'Other (custom label)' },
];
function refLabelOptionsHtml() {
  return REF_LABEL_OPTIONS.map(o => `<option value="${escapeHtml(o.value)}">${escapeHtml(o.text)}</option>`).join('');
}

function addRefRow() {
  const container = document.getElementById('refRows');
  const row = document.createElement('div');
  row.className = 'ref-row';
  row.innerHTML = `
    <div class="row-line">
      <select class="refLabel">${refLabelOptionsHtml()}</select>
      <input class="refValue" type="text" placeholder="Reference number / value" />
    </div>
    <div class="row-line refLabelOtherWrap" style="display:none;">
      <input class="refLabelOther" type="text" placeholder="Custom label (e.g. Auth #: )" />
    </div>
    <button type="button" class="remove-row-btn" title="Remove">×</button>
  `;
  container.appendChild(row);

  const labelSelect = row.querySelector('.refLabel');
  const otherWrap = row.querySelector('.refLabelOtherWrap');
  labelSelect.addEventListener('change', () => {
    otherWrap.style.display = labelSelect.value === 'other' ? 'flex' : 'none';
  });
}
document.getElementById('addRefBtn').addEventListener('click', addRefRow);
document.getElementById('refRows').addEventListener('click', (e) => {
  if (e.target.matches('.remove-row-btn')) e.target.closest('.ref-row').remove();
});

/* ================= Additional Note Blocks (free-form paragraphs) ================= */
function addNoteBlock() {
  const container = document.getElementById('noteBlocks');
  const block = document.createElement('div');
  block.className = 'note-block';
  block.innerHTML = `
    <textarea class="noteText" rows="3" placeholder="Extra paragraph text (e.g. secondary insurance info, effective date, plan notes)..."></textarea>
    <div class="note-ref-row">
      <select class="noteRefLabel">${refLabelOptionsHtml()}</select>
      <input class="noteRefValue" type="text" placeholder="Optional ref#/value for this note (comma-separate multiple)" />
    </div>
    <div class="row-line noteRefOtherWrap" style="display:none;">
      <input class="noteRefLabelOther" type="text" placeholder="Custom label" />
    </div>
    <button type="button" class="remove-row-btn" title="Remove">×</button>
  `;
  container.appendChild(block);

  const labelSelect = block.querySelector('.noteRefLabel');
  const otherWrap = block.querySelector('.noteRefOtherWrap');
  labelSelect.addEventListener('change', () => {
    otherWrap.style.display = labelSelect.value === 'other' ? 'flex' : 'none';
  });
}
document.getElementById('addNoteBtn').addEventListener('click', addNoteBlock);
document.getElementById('noteBlocks').addEventListener('click', (e) => {
  if (e.target.matches('.remove-row-btn')) e.target.closest('.note-block').remove();
});

/* ================= Build the PA Comment ================= */
function buildPaComment() {
  const activeCpts = getActiveCpts();
  if (activeCpts.length === 0) { alert('Select at least one CPT code.'); return null; }
  const cptStr = cptListStr(activeCpts);
  const lines = [];

  // --- PA / Authorization ---
  const paMode = paModeSelect.value;
  if (!paMode) { alert('Please select a PA / Authorization status (or choose "Skip this line").'); return null; }
  if (paMode === 'not_required') {
    lines.push(`PA: Authorization is not required for CPTs ${cptStr}.`);
  } else if (paMode === 'required') {
    lines.push(`PA: Authorization is required for CPTs ${cptStr}.`);
  } else if (paMode === 'required_subset') {
    const subset = Array.from(document.querySelectorAll('.pa-subset-cb:checked')).map(cb => cb.dataset.code);
    if (subset.length === 0) { alert('Select which CPTs require authorization, or change the PA dropdown.'); return null; }
    lines.push(`PA: Authorization is required for CPTs ${cptListStr(subset)}.`);
  } else if (paMode === 'other') {
    const t = document.getElementById('paOtherText')?.value.trim();
    if (!t) { alert('Enter the custom PA text, or change the PA dropdown.'); return null; }
    lines.push(`PA: ${t}`);
  }
  // 'skip' -> add nothing

  // --- PR (Patient Responsibility) lines ---
  document.querySelectorAll('#prRows .pr-row').forEach(row => {
    const type = row.querySelector('.prType').value;
    if (type === 'other') {
      const custom = row.querySelector('.prCustom')?.value.trim();
      if (custom) lines.push(custom);
      return;
    }
    const amount = row.querySelector('.prAmount').value.trim();
    if (!amount) return; // skip untouched rows
    const formattedAmount = formatPrAmount(type, amount);
    const applies = row.querySelector('.prApplies').value.trim() || cptStr;
    const reason = row.querySelector('.prReason').value.trim();
    lines.push(`Member is responsible for ${formattedAmount} ${type} for ${applies}${reason ? ' because ' + reason : ''}.`);
  });

  // --- Coverage ---
  const covMode = coverageModeSelect.value;
  if (covMode === 'covered') {
    lines.push(`${cptStr} ${activeCpts.length > 1 ? 'are' : 'is'} covered under patient's plan.`);
  } else if (covMode === 'non_covered') {
    lines.push(`${cptStr} ${activeCpts.length > 1 ? 'are' : 'is'} not covered under patient's plan.`);
  } else if (covMode === 'mixed') {
    const covered = [], nonCovered = [];
    document.querySelectorAll('#coverageMixedContainer .mixed-row').forEach(r => {
      const code = r.dataset.code;
      const val = r.querySelector('select').value;
      if (val === 'covered') covered.push(code);
      else if (val === 'non_covered') nonCovered.push(code);
    });
    if (covered.length) lines.push(`${cptListStr(covered)} ${covered.length > 1 ? 'are' : 'is'} covered under patient's plan.`);
    if (nonCovered.length) lines.push(`${cptListStr(nonCovered)} ${nonCovered.length > 1 ? 'are' : 'is'} not covered under patient's plan.`);
  } else if (covMode === 'other') {
    const t = document.getElementById('coverageOtherText')?.value.trim();
    if (t) lines.push(t);
  }
  // '' or 'skip' -> add nothing

  // --- Plan Type / Referral ---
  let planVal = document.getElementById('planType').value;
  if (planVal === 'other') planVal = document.getElementById('planOtherText')?.value.trim() || '';
  const referralMode = document.getElementById('referralMode').value;
  let referralText = '';
  if (referralMode === 'not_required') referralText = 'Not required';
  else if (referralMode === 'required') referralText = 'Required';
  else if (referralMode === 'other') referralText = document.getElementById('referralOtherText')?.value.trim() || '';
  if (planVal || referralText) {
    const parts = [];
    if (planVal) parts.push(`Plan Type: ${planVal}`);
    if (referralText) parts.push(`Referrals: ${referralText}`);
    lines.push(parts.join(', ') + '.');
  }

  // --- Reference # rows + Rep ---
  const combineRep = document.getElementById('combineRepRef').checked;
  const repName = document.getElementById('paRepName').value.trim();
  let repUsedOnRefLine = false;
  const refRowEls = document.querySelectorAll('#refRows .ref-row');
  refRowEls.forEach((row, i) => {
    const labelSel = row.querySelector('.refLabel').value;
    const label = labelSel === 'other' ? (row.querySelector('.refLabelOther')?.value.trim() || '') : labelSel;
    const val = row.querySelector('.refValue').value.trim();
    if (!val) return;
    if (i === 0 && combineRep && repName) {
      lines.push(`Rep: ${repName} - ${label}${val}`);
      repUsedOnRefLine = true;
    } else {
      lines.push(`${label}${val}`);
    }
  });
  if (repName && !repUsedOnRefLine) lines.push(`Rep: ${repName}`);

  const mainParagraph = lines.filter(Boolean).join('\n');

  // --- Additional Note Blocks (each its own paragraph) ---
  let noteParagraphs = '';
  document.querySelectorAll('#noteBlocks .note-block').forEach(block => {
    const text = block.querySelector('.noteText').value.trim();
    if (!text) return;
    const noteLines = [text];
    const noteRefVal = block.querySelector('.noteRefValue').value.trim();
    if (noteRefVal) {
      const labelSel = block.querySelector('.noteRefLabel').value;
      const label = labelSel === 'other' ? (block.querySelector('.noteRefLabelOther')?.value.trim() || '') : labelSel;
      noteLines.push(`${label}${noteRefVal}`);
    }
    noteParagraphs += '\n\n' + noteLines.join('\n');
  });

  return mainParagraph + noteParagraphs;
}

document.getElementById('generatePaBtn').addEventListener('click', () => {
  const comment = buildPaComment();
  if (comment === null) return;

  const output = document.getElementById('generatedComment');
  output.value = comment;

  if (navigator.clipboard) {
    navigator.clipboard.writeText(comment).catch(() => {});
  } else {
    output.select();
    document.execCommand('copy');
  }

  saveToHistory(comment);
});

/* ================= PA Form Init ================= */
function initPaForm() {
  renderCptChips();
  addPrRow();
  addRefRow();
}
// ================= End of Script =================
