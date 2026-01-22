/**
 * Afternoon Scene — Script
 *
 * Handles:
 * - Credit line overview display
 * - Draw amount simulation
 * - Collateral ratio calculations
 * - Stress test scenarios
 */

// ==========================================================================
// Scene State
// ==========================================================================

let vaultValueUSD = 164800;
let currentBorrowed = 0;
let interestRate = 4.2;
let maxLTV = 50;

// ==========================================================================
// Scene Initialization
// ==========================================================================

document.addEventListener('DOMContentLoaded', async () => {
  // Initialize page and load state
  const state = await initPage('afternoon');

  // Store values from state
  vaultValueUSD = state.balances.vault.usd;
  currentBorrowed = state.credit.borrowed;
  interestRate = state.credit.interestRate;
  maxLTV = state.credit.maxLTV;

  // Populate initial UI
  renderCreditOverview(state);

  // Set up event listeners
  setupEventListeners();

  // Run initial simulation with default value
  runSimulation();

  // Update header time
  updateHeaderTime('2:30 PM');
});

// ==========================================================================
// Credit Overview
// ==========================================================================

/**
 * Render credit overview from state
 * @param {Object} state - Application state
 */
function renderCreditOverview(state) {
  const { credit, balances } = state;

  // Available credit
  const availableEl = document.getElementById('available-credit');
  if (availableEl) availableEl.textContent = formatUSD(credit.available, false);

  // Borrowed amount
  const borrowedEl = document.getElementById('borrowed-amount');
  if (borrowedEl) borrowedEl.textContent = formatUSD(credit.borrowed, false);

  // Interest rate
  const rateEl = document.getElementById('interest-rate');
  if (rateEl) rateEl.textContent = `${credit.interestRate}% APY`;

  // Collateral value - show sats as primary, USD as secondary
  const collateralSatsEl = document.getElementById('collateral-sats');
  if (collateralSatsEl) collateralSatsEl.textContent = formatSats(balances.vault.btc);

  const collateralUsdEl = document.getElementById('collateral-usd');
  if (collateralUsdEl) collateralUsdEl.textContent = formatUSD(balances.vault.usd, false);
}

// ==========================================================================
// Simulation Logic
// ==========================================================================

/**
 * Run simulation with current input value
 */
function runSimulation() {
  const input = document.getElementById('draw-amount');
  if (!input) return;

  const drawAmount = parseFloat(input.value) || 0;

  // Calculate projected values
  const projectedBorrowed = currentBorrowed + drawAmount;
  const projectedRatio = drawAmount > 0
    ? (vaultValueUSD / projectedBorrowed) * 100
    : null;
  const monthlyInterest = (projectedBorrowed * (interestRate / 100)) / 12;
  const yearlyRepayment = projectedBorrowed * (1 + interestRate / 100);

  // Update results
  updateSimulationResults({
    borrowed: projectedBorrowed,
    ratio: projectedRatio,
    monthlyInterest: monthlyInterest,
    yearlyRepayment: yearlyRepayment
  });

  // Update gauge
  updateCollateralGauge(projectedRatio);

  // Run stress test with current scenario
  runStressTest();
}

/**
 * Update simulation result display
 * @param {Object} results - Calculated results
 */
function updateSimulationResults(results) {
  const borrowedEl = document.getElementById('result-borrowed');
  const ratioEl = document.getElementById('result-ratio');
  const monthlyEl = document.getElementById('result-monthly');
  const repaymentEl = document.getElementById('result-repayment');

  if (borrowedEl) borrowedEl.textContent = formatUSD(results.borrowed, false);

  if (ratioEl) {
    if (results.ratio === null) {
      ratioEl.textContent = '∞ (no debt)';
    } else {
      ratioEl.textContent = `${Math.round(results.ratio).toLocaleString()}%`;
    }
  }

  if (monthlyEl) monthlyEl.textContent = `~${formatUSD(results.monthlyInterest)}`;
  if (repaymentEl) repaymentEl.textContent = formatUSD(results.yearlyRepayment, false);
}

/**
 * Update collateral gauge visualization
 * @param {number|null} ratio - Current ratio percentage
 */
function updateCollateralGauge(ratio) {
  const fillEl = document.getElementById('gauge-fill');
  const ratioTextEl = document.getElementById('gauge-ratio');

  if (!fillEl || !ratioTextEl) return;

  if (ratio === null) {
    // No debt = infinite ratio
    fillEl.style.width = '100%';
    fillEl.style.background = 'var(--color-success)';
    ratioTextEl.textContent = '∞';
    return;
  }

  // Calculate fill percentage (cap display at 200% for visual purposes)
  const displayRatio = Math.min(ratio, 200);
  const fillPercent = Math.max(0, Math.min(100, (displayRatio / 200) * 100));

  fillEl.style.width = `${fillPercent}%`;

  // Color based on ratio
  if (ratio < 110) {
    fillEl.style.background = 'var(--color-danger)';
  } else if (ratio < 120) {
    fillEl.style.background = 'var(--color-warning)';
  } else {
    fillEl.style.background = 'var(--color-success)';
  }

  // Update text
  ratioTextEl.textContent = `${Math.round(ratio).toLocaleString()}%`;
}

// ==========================================================================
// Stress Test
// ==========================================================================

/**
 * Run stress test with selected scenario
 */
function runStressTest() {
  const scenarioSelect = document.getElementById('stress-scenario');
  const resultsEl = document.getElementById('stress-results');

  if (!scenarioSelect || !resultsEl) return;

  const priceDecline = parseFloat(scenarioSelect.value) || 0;
  const input = document.getElementById('draw-amount');
  const drawAmount = parseFloat(input?.value) || 0;
  const projectedBorrowed = currentBorrowed + drawAmount;

  // Calculate stressed values
  const stressedVaultValue = vaultValueUSD * (1 - priceDecline / 100);
  const stressedRatio = projectedBorrowed > 0
    ? (stressedVaultValue / projectedBorrowed) * 100
    : null;
  const stressedAvailableCredit = calculateAvailableCredit(stressedVaultValue, maxLTV, projectedBorrowed);

  // Determine risk level
  let riskLevel = 'safe';
  let riskColor = 'var(--color-success)';
  let riskMessage = 'No liquidation risk';

  if (stressedRatio !== null) {
    if (stressedRatio < 110) {
      riskLevel = 'liquidation';
      riskColor = 'var(--color-danger)';
      riskMessage = 'Auto-liquidation would trigger';
    } else if (stressedRatio < 120) {
      riskLevel = 'warning';
      riskColor = 'var(--color-warning)';
      riskMessage = 'Warning zone — consider adding collateral';
    }
  }

  // Render results
  resultsEl.innerHTML = `
    <div style="display: grid; gap: var(--space-2);">
      <div style="display: flex; justify-content: space-between;">
        <span style="color: var(--color-text-secondary);">Projected vault value</span>
        <span style="font-weight: var(--font-weight-medium);">${formatUSD(stressedVaultValue, false)}</span>
      </div>
      <div style="display: flex; justify-content: space-between;">
        <span style="color: var(--color-text-secondary);">Collateral ratio</span>
        <span style="font-weight: var(--font-weight-medium);">${stressedRatio ? Math.round(stressedRatio).toLocaleString() + '%' : '∞'}</span>
      </div>
      <div style="display: flex; justify-content: space-between;">
        <span style="color: var(--color-text-secondary);">Remaining credit</span>
        <span style="font-weight: var(--font-weight-medium);">${formatUSD(Math.max(0, stressedAvailableCredit), false)}</span>
      </div>
      <div style="padding: var(--space-2); background: ${riskColor}20; border-radius: var(--radius-sm); margin-top: var(--space-2);">
        <span style="color: ${riskColor}; font-weight: var(--font-weight-medium);">${riskMessage}</span>
      </div>
    </div>
  `;
}

// ==========================================================================
// UI Helpers
// ==========================================================================

/**
 * Set draw amount from preset button
 * @param {number} amount - Amount to set
 */
function setDrawAmount(amount) {
  const input = document.getElementById('draw-amount');
  if (input) {
    input.value = amount;
    runSimulation();
  }
}

/**
 * Reset simulation to default
 */
function resetSimulation() {
  const input = document.getElementById('draw-amount');
  const scenarioSelect = document.getElementById('stress-scenario');

  if (input) input.value = 0;
  if (scenarioSelect) scenarioSelect.value = '0';

  runSimulation();
  showToast('Simulation reset');
}

// Make functions globally available
window.setDrawAmount = setDrawAmount;
window.resetSimulation = resetSimulation;

// ==========================================================================
// Event Listeners
// ==========================================================================

function setupEventListeners() {
  // Draw amount input
  const drawInput = document.getElementById('draw-amount');
  if (drawInput) {
    drawInput.addEventListener('input', debounce(runSimulation, 150));
    drawInput.addEventListener('change', runSimulation);
  }

  // Stress test scenario
  const scenarioSelect = document.getElementById('stress-scenario');
  if (scenarioSelect) {
    scenarioSelect.addEventListener('change', runStressTest);
  }
}

/**
 * Simple debounce helper
 * @param {Function} fn - Function to debounce
 * @param {number} delay - Delay in ms
 */
function debounce(fn, delay) {
  let timer = null;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}
