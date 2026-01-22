/**
 * Morning Scene — Script
 *
 * Handles:
 * - Balance display from state
 * - Transaction list rendering
 * - Yield modal interactions
 * - Simulated coffee payment
 */

// ==========================================================================
// Scene Initialization
// ==========================================================================

document.addEventListener('DOMContentLoaded', async () => {
  // Initialize page and load state
  const state = await initPage('morning');

  // Populate UI with state data
  renderBalances(state);
  renderTransactions(state);
  renderYieldInfo(state);

  // Set up event listeners
  setupEventListeners();

  // Update header time
  updateHeaderTime('6:47 AM');
});

// ==========================================================================
// Balance Display
// ==========================================================================

/**
 * Render balance information from state
 * @param {Object} state - Application state
 */
function renderBalances(state) {
  const { balances } = state;

  // Total balance
  const totalUsdEl = document.getElementById('total-usd');
  const totalBtcEl = document.getElementById('total-btc');
  if (totalUsdEl) totalUsdEl.textContent = formatUSD(balances.total.usd, false);
  if (totalBtcEl) totalBtcEl.textContent = formatBTC(balances.total.btc);

  // Checking
  const checkingUsdEl = document.getElementById('checking-usd');
  const checkingBtcEl = document.getElementById('checking-btc');
  if (checkingUsdEl) checkingUsdEl.textContent = formatUSD(balances.checking.usd, false);
  if (checkingBtcEl) checkingBtcEl.textContent = formatBTC(balances.checking.btc);

  // Vault
  const vaultUsdEl = document.getElementById('vault-usd');
  const vaultBtcEl = document.getElementById('vault-btc');
  if (vaultUsdEl) vaultUsdEl.textContent = formatUSD(balances.vault.usd, false);
  if (vaultBtcEl) vaultBtcEl.textContent = formatBTC(balances.vault.btc);
}

// ==========================================================================
// Transaction List
// ==========================================================================

/**
 * Render recent transactions
 * @param {Object} state - Application state
 */
function renderTransactions(state) {
  const { transactions } = state;
  const listEl = document.getElementById('transaction-list');

  if (!listEl) return;

  // Clear existing content
  listEl.innerHTML = '';

  // Filter to show only yesterday's and today's transactions
  // For demo, we show the first 5
  const recentTransactions = transactions.slice(0, 5);

  recentTransactions.forEach((tx, index) => {
    const li = document.createElement('li');
    li.className = 'transaction-item';
    li.setAttribute('data-tx-id', tx.id);

    // Determine icon based on network
    const iconSvg = tx.network === 'lightning'
      ? Icons.lightning
      : Icons.payment;

    li.innerHTML = `
      <div class="transaction-item__icon">
        ${iconSvg}
      </div>
      <div class="transaction-item__details">
        <div class="transaction-item__description">${tx.description}</div>
        <div class="transaction-item__meta">${tx.merchant} • ${formatTime(tx.timestamp)}</div>
      </div>
      <div class="transaction-item__amount">
        <div class="transaction-item__amount-value">-${formatUSD(tx.amount.usd)}</div>
        <div class="transaction-item__amount-btc">${formatBTC(tx.amount.btc)}</div>
      </div>
    `;

    // Add click handler for expansion (optional detail view)
    li.addEventListener('click', () => {
      showTransactionDetail(tx);
    });

    listEl.appendChild(li);
  });
}

/**
 * Show transaction detail (simple toast for now)
 * @param {Object} tx - Transaction object
 */
function showTransactionDetail(tx) {
  const message = `${tx.description}: ${formatUSD(tx.amount.usd)} via ${tx.network === 'lightning' ? 'Lightning' : 'Bitcoin'}. Settlement: ${tx.settlementTime}`;
  showToast(message, 4000);
}

// ==========================================================================
// Yield Information
// ==========================================================================

/**
 * Render yield information
 * @param {Object} state - Application state
 */
function renderYieldInfo(state) {
  const { vault } = state;

  // Update yield button text
  const yieldTextEl = document.getElementById('yield-text');
  if (yieldTextEl) {
    yieldTextEl.textContent = `+${formatBTC(vault.lastYield.btc)} overnight`;
  }

  // Update modal rate
  const modalRateEl = document.getElementById('modal-yield-rate');
  if (modalRateEl) {
    modalRateEl.textContent = formatPercent(vault.yieldRate);
  }
}

// ==========================================================================
// Event Listeners
// ==========================================================================

function setupEventListeners() {
  // Yield button opens modal
  const yieldBtn = document.getElementById('yield-btn');
  if (yieldBtn) {
    yieldBtn.addEventListener('click', () => {
      openModal('yield-modal');
    });
  }

  // Simulate payment button
  const simulateBtn = document.getElementById('simulate-payment-btn');
  if (simulateBtn) {
    simulateBtn.addEventListener('click', simulateCoffeePayment);
  }
}

// ==========================================================================
// Payment Simulation
// ==========================================================================

/**
 * Simulate the coffee shop payment
 * Updates UI to show confirmed state
 */
function simulateCoffeePayment() {
  const card = document.getElementById('coffee-payment-card');
  const btn = document.getElementById('simulate-payment-btn');

  if (!card || !btn) return;

  // Disable button
  btn.disabled = true;
  btn.textContent = 'Processing...';

  // Simulate brief delay (Lightning is fast but not instant to the eye)
  setTimeout(() => {
    // Update card opacity to show confirmed
    card.style.opacity = '1';

    // Update button
    btn.textContent = 'Payment Confirmed';
    btn.classList.remove('btn--primary');
    btn.classList.add('btn--secondary');

    // Show toast
    showToast('Payment confirmed in 0.8 seconds');

    // Update time in header to reflect coffee shop time
    updateHeaderTime('8:45 AM');

    // Update state (in memory)
    const state = getState();
    const coffeeAmount = 5.80;
    const coffeeBtc = 0.0000664;

    state.balances.checking.usd -= coffeeAmount;
    state.balances.checking.btc -= coffeeBtc;
    state.balances.total.usd -= coffeeAmount;
    state.balances.total.btc -= coffeeBtc;

    // Re-render balances
    renderBalances(state);
  }, 800);
}

// ==========================================================================
// Exports (if needed)
// ==========================================================================

// Functions are available globally for this demo
