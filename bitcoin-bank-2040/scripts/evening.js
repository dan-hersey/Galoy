/**
 * Evening Scene — Script
 *
 * Handles:
 * - Family account display
 * - Inheritance configuration
 * - Save configuration action
 */

// ==========================================================================
// Scene Initialization
// ==========================================================================

document.addEventListener('DOMContentLoaded', async () => {
  // Initialize page and load state
  const state = await initPage('evening');

  // Populate UI with state data
  renderFamilyAccounts(state);
  renderInheritanceConfig(state);

  // Set up event listeners
  setupEventListeners();

  // Update header time
  updateHeaderTime('8:15 PM');
});

// ==========================================================================
// Family Accounts
// ==========================================================================

/**
 * Render family account information from state
 * @param {Object} state - Application state
 */
function renderFamilyAccounts(state) {
  const { custodialAccounts } = state;

  // Find Sofia and Marco's accounts
  const sofia = custodialAccounts.find(a => a.name === 'Sofia Vasquez');
  const marco = custodialAccounts.find(a => a.name === 'Marco Vasquez');

  if (sofia) {
    const sofiaUsd = document.getElementById('sofia-usd');
    const sofiaBtc = document.getElementById('sofia-btc');
    if (sofiaUsd) sofiaUsd.textContent = formatUSD(sofia.balance.usd, false);
    if (sofiaBtc) sofiaBtc.textContent = formatBTC(sofia.balance.btc);
  }

  if (marco) {
    const marcoUsd = document.getElementById('marco-usd');
    const marcoBtc = document.getElementById('marco-btc');
    if (marcoUsd) marcoUsd.textContent = formatUSD(marco.balance.usd, false);
    if (marcoBtc) marcoBtc.textContent = formatBTC(marco.balance.btc);
  }
}

// ==========================================================================
// Inheritance Configuration
// ==========================================================================

/**
 * Render inheritance configuration from state
 * @param {Object} state - Application state
 */
function renderInheritanceConfig(state) {
  const { inheritance } = state;

  // Set secondary verification toggle state
  const toggle = document.getElementById('secondary-verification');
  if (toggle) {
    toggle.checked = inheritance.secondaryVerification;
  }
}

/**
 * Save inheritance configuration
 */
function saveConfiguration() {
  const toggle = document.getElementById('secondary-verification');
  const state = getState();

  if (toggle && state) {
    // Update state
    state.inheritance.secondaryVerification = toggle.checked;
    state.inheritance.lastUpdated = new Date().toISOString();

    // Show confirmation
    showToast('Configuration saved');

    console.log('[Evening] Inheritance config saved:', {
      secondaryVerification: state.inheritance.secondaryVerification,
      lastUpdated: state.inheritance.lastUpdated
    });
  }
}

// ==========================================================================
// Event Listeners
// ==========================================================================

function setupEventListeners() {
  // Save configuration button
  const saveBtn = document.getElementById('save-config-btn');
  if (saveBtn) {
    saveBtn.addEventListener('click', saveConfiguration);
  }

  // Secondary verification toggle (for immediate feedback)
  const toggle = document.getElementById('secondary-verification');
  if (toggle) {
    toggle.addEventListener('change', () => {
      // Visual feedback on toggle
      const label = toggle.closest('.toggle');
      if (label) {
        label.style.opacity = '0.7';
        setTimeout(() => {
          label.style.opacity = '1';
        }, 150);
      }
    });
  }
}
