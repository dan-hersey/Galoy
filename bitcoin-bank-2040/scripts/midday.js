/**
 * Midday Scene — Script
 *
 * Handles:
 * - Invoice settlement display
 * - Settlement detail expansion
 * - International payment conversion info
 */

// ==========================================================================
// Scene Initialization
// ==========================================================================

document.addEventListener('DOMContentLoaded', async () => {
  // Initialize page and load state
  const state = await initPage('midday');

  // Populate invoices from state
  renderInvoices(state);

  // Update header time
  updateHeaderTime('12:15 PM');
});

// ==========================================================================
// Invoice Rendering
// ==========================================================================

/**
 * Render invoice information from state
 * @param {Object} state - Application state
 */
function renderInvoices(state) {
  const { invoices } = state;

  // Indianapolis invoice
  renderIndyInvoice(invoices.indianapolis);

  // Rotterdam invoice
  renderRotterdamInvoice(invoices.rotterdam);
}

/**
 * Render Indianapolis invoice
 * @param {Object} invoice - Invoice data
 */
function renderIndyInvoice(invoice) {
  const amountUsd = document.getElementById('indy-amount-usd');
  const amountBtc = document.getElementById('indy-amount-btc');

  if (amountUsd) amountUsd.textContent = formatUSD(invoice.amount.usd, false);
  if (amountBtc) amountBtc.textContent = formatBTC(invoice.amount.btc);
}

/**
 * Render Rotterdam invoice
 * @param {Object} invoice - Invoice data
 */
function renderRotterdamInvoice(invoice) {
  const amountUsd = document.getElementById('rotterdam-amount-usd');
  const amountBtc = document.getElementById('rotterdam-amount-btc');

  if (amountUsd) amountUsd.textContent = formatUSD(invoice.amount.usd, false);
  if (amountBtc) amountBtc.textContent = formatBTC(invoice.amount.btc);
}

// ==========================================================================
// Toggle Enhancement
// ==========================================================================

// Override toggleExpand for better UX in this scene
const originalToggle = window.toggleExpand;
window.toggleExpand = function(elementId) {
  const element = document.getElementById(elementId);
  if (element) {
    const isExpanded = element.classList.toggle('is-expanded');

    // Update button text
    const btnId = elementId.replace('details', 'toggle-btn');
    const btn = document.getElementById(btnId);
    if (btn) {
      btn.textContent = isExpanded ? 'Hide Details' : 'View Details';
    }
  }
};
