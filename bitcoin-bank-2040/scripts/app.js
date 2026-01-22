/**
 * Bitcoin Bank 2040 — Core Application Logic
 *
 * This file provides:
 * - State management (loading and updating user-state.json)
 * - Utility functions (formatting, calculations)
 * - Shared UI components (toasts, modals)
 * - Navigation helpers
 *
 * Design Philosophy:
 * - No frameworks, just vanilla JavaScript
 * - State is loaded once and managed in memory
 * - All scene-specific logic lives in separate files
 */

// ==========================================================================
// Global State
// ==========================================================================

/**
 * Application state container
 * Loaded from user-state.json on page load
 */
let AppState = null;

/**
 * Load state from JSON file
 * Returns a promise that resolves when state is ready
 */
async function loadState() {
  try {
    const response = await fetch('./data/user-state.json');
    if (!response.ok) {
      throw new Error('Failed to load state');
    }
    AppState = await response.json();
    console.log('[App] State loaded:', AppState);
    return AppState;
  } catch (error) {
    console.error('[App] Error loading state:', error);
    console.warn('[App] Using fallback state. For full functionality, run via local server: python3 -m http.server 8000');
    // Return fallback state matching user-state.json for demo purposes
    // This allows the demo to work even when opened directly (without a server)
    AppState = {
      user: { name: 'Elena Vasquez', location: 'Columbus, Ohio' },
      balances: {
        total: { btc: 0.0682, usd: 187420 },
        checking: { btc: 0.0026, usd: 7150 },
        vault: { btc: 0.06, usd: 164800 }
      },
      vault: {
        yieldRate: 2.4,
        lastYield: { btc: 0.00000127, usd: 3.49 }
      },
      transactions: [
        { id: 'tx_001', description: 'Streaming service', amount: { btc: 0.0000051, usd: 14.00 }, timestamp: '2040-03-11T23:43:00Z', network: 'lightning', merchant: 'StreamFlow Entertainment', settlementTime: 'instant' },
        { id: 'tx_002', description: 'School lunch deposit', amount: { btc: 0.0000437, usd: 120.00 }, timestamp: '2040-03-11T23:43:00Z', network: 'lightning', merchant: 'Columbus City Schools', settlementTime: 'instant' },
        { id: 'tx_003', description: 'Grocery delivery', amount: { btc: 0.00000226, usd: 6.20 }, timestamp: '2040-03-11T23:44:00Z', network: 'lightning', merchant: 'FreshCart', settlementTime: 'instant' },
        { id: 'tx_004', description: 'Bus fare', amount: { btc: 0.000001, usd: 2.75 }, timestamp: '2040-03-12T07:22:00Z', network: 'lightning', merchant: 'COTA Transit', settlementTime: 'instant' },
        { id: 'tx_005', description: 'Coffee - flat white', amount: { btc: 0.00000211, usd: 5.80 }, timestamp: '2040-03-12T08:45:00Z', network: 'lightning', merchant: 'Third Wave Coffee', settlementTime: 'instant' }
      ],
      invoices: {
        indianapolis: { amount: { btc: 0.001238, usd: 3400 } },
        rotterdam: { amount: { btc: 0.00295, usd: 8100, eur: 7450 } }
      },
      credit: { available: 82400, borrowed: 0, interestRate: 4.2, maxLTV: 50 },
      custodialAccounts: [
        { name: 'Sofia Vasquez', balance: { btc: 0.00534, usd: 14650 } },
        { name: 'Marco Vasquez', balance: { btc: 0.00394, usd: 10820 } }
      ],
      inheritance: { secondaryVerification: true },
      btcPrice: { usd: 2746000 }
    };
    return AppState;
  }
}

/**
 * Get current state (synchronous)
 * Throws if state hasn't been loaded yet
 */
function getState() {
  if (!AppState) {
    throw new Error('State not loaded. Call loadState() first.');
  }
  return AppState;
}

/**
 * Update state (in memory only — this is a demo)
 * @param {string} path - Dot-notation path to update (e.g., 'credit.borrowed')
 * @param {*} value - New value
 */
function updateState(path, value) {
  const keys = path.split('.');
  let current = AppState;

  for (let i = 0; i < keys.length - 1; i++) {
    if (current[keys[i]] === undefined) {
      current[keys[i]] = {};
    }
    current = current[keys[i]];
  }

  current[keys[keys.length - 1]] = value;
  console.log(`[App] State updated: ${path} =`, value);
}

// ==========================================================================
// Formatting Utilities
// ==========================================================================

/**
 * Format USD amount with proper separators
 * @param {number} amount - Amount in USD
 * @param {boolean} showCents - Whether to show cents (default: true for small amounts)
 * @returns {string} Formatted string like "$1,234.56" or "$1,234"
 */
function formatUSD(amount, showCents = null) {
  // Auto-determine whether to show cents
  if (showCents === null) {
    showCents = Math.abs(amount) < 100;
  }

  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: showCents ? 2 : 0,
    maximumFractionDigits: showCents ? 2 : 0
  });

  return formatter.format(amount);
}

/**
 * Format BTC amount
 * @param {number} amount - Amount in BTC
 * @param {number} decimals - Decimal places to show (default: 8, or fewer if trailing zeros)
 * @returns {string} Formatted string like "0.00042 BTC"
 */
function formatBTC(amount, decimals = 8) {
  // Remove unnecessary trailing zeros but keep at least 2 decimal places
  let formatted = amount.toFixed(decimals);

  // Trim trailing zeros, but keep minimum precision
  while (formatted.endsWith('0') && formatted.split('.')[1]?.length > 2) {
    formatted = formatted.slice(0, -1);
  }

  return `${formatted} BTC`;
}

/**
 * Format sats (satoshis) - PRIMARY denomination for display
 * @param {number} btc - Amount in BTC
 * @param {boolean} showUnit - Whether to show "sats" suffix (default: true)
 * @returns {string} Formatted string like "42,000 sats" or "42,000"
 */
function formatSats(btc, showUnit = true) {
  const sats = Math.round(btc * 100_000_000);
  const formatted = sats.toLocaleString();
  return showUnit ? `${formatted} sats` : formatted;
}

/**
 * Convert USD to sats at current price
 * @param {number} usd - Amount in USD
 * @param {number} btcPriceUsd - Current BTC price in USD
 * @returns {number} Amount in sats
 */
function usdToSats(usd, btcPriceUsd) {
  const btc = usd / btcPriceUsd;
  return Math.round(btc * 100_000_000);
}

/**
 * Format percentage
 * @param {number} value - Percentage value (e.g., 4.2 for 4.2%)
 * @param {number} decimals - Decimal places (default: 1)
 * @returns {string} Formatted string like "4.2%"
 */
function formatPercent(value, decimals = 1) {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Format a timestamp as relative time (e.g., "2 hours ago")
 * @param {string} isoString - ISO timestamp
 * @returns {string} Relative time string
 */
function formatRelativeTime(isoString) {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  return `${diffDays} days ago`;
}

/**
 * Format timestamp as time only (e.g., "11:52 AM")
 * @param {string} isoString - ISO timestamp
 * @returns {string} Time string
 */
function formatTime(isoString) {
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

/**
 * Format timestamp as date (e.g., "Mar 12, 2040")
 * @param {string} isoString - ISO timestamp
 * @returns {string} Date string
 */
function formatDate(isoString) {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

// ==========================================================================
// Calculation Utilities
// ==========================================================================

/**
 * Calculate collateral ratio
 * @param {number} vaultValueUSD - Value of vault in USD
 * @param {number} borrowedUSD - Amount borrowed in USD
 * @returns {number|null} Ratio as percentage (e.g., 1098 for 1098%), or null if no debt
 */
function calculateCollateralRatio(vaultValueUSD, borrowedUSD) {
  if (borrowedUSD <= 0) return null;
  return (vaultValueUSD / borrowedUSD) * 100;
}

/**
 * Calculate available credit based on vault value and LTV
 * @param {number} vaultValueUSD - Value of vault in USD
 * @param {number} maxLTV - Maximum loan-to-value percentage (e.g., 50)
 * @param {number} currentBorrowed - Current borrowed amount
 * @returns {number} Available credit in USD
 */
function calculateAvailableCredit(vaultValueUSD, maxLTV, currentBorrowed = 0) {
  const maxBorrow = vaultValueUSD * (maxLTV / 100);
  return Math.max(0, maxBorrow - currentBorrowed);
}

/**
 * Simulate stress test on vault value
 * @param {number} vaultValueUSD - Current vault value
 * @param {number} priceDeclinePercent - Price decline percentage (e.g., 30 for 30%)
 * @returns {number} Projected vault value after decline
 */
function simulateStressTest(vaultValueUSD, priceDeclinePercent) {
  return vaultValueUSD * (1 - priceDeclinePercent / 100);
}

// ==========================================================================
// UI Components
// ==========================================================================

/**
 * Show a toast notification
 * @param {string} message - Message to display
 * @param {number} duration - Duration in ms (default: 3000)
 */
function showToast(message, duration = 3000) {
  // Remove existing toast if present
  const existing = document.querySelector('.toast');
  if (existing) {
    existing.remove();
  }

  // Create toast element
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => {
    toast.classList.add('is-visible');
  });

  // Remove after duration
  setTimeout(() => {
    toast.classList.remove('is-visible');
    setTimeout(() => toast.remove(), 200);
  }, duration);
}

/**
 * Open a modal by ID
 * @param {string} modalId - ID of the modal overlay element
 */
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('is-active');
    document.body.style.overflow = 'hidden';
  }
}

/**
 * Close a modal by ID
 * @param {string} modalId - ID of the modal overlay element
 */
function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('is-active');
    document.body.style.overflow = '';
  }
}

/**
 * Close any open modal (for close buttons)
 * @param {Event} event - Click event
 */
function closeAnyModal(event) {
  const overlay = event.target.closest('.modal-overlay');
  if (overlay) {
    overlay.classList.remove('is-active');
    document.body.style.overflow = '';
  }
}

/**
 * Toggle expansion of a card or details section
 * @param {string} elementId - ID of the element to toggle
 */
function toggleExpand(elementId) {
  const element = document.getElementById(elementId);
  if (element) {
    element.classList.toggle('is-expanded');
  }
}

// ==========================================================================
// Navigation
// ==========================================================================

/**
 * Navigate to a scene
 * @param {string} scene - Scene name ('morning', 'midday', 'afternoon', 'evening')
 */
function navigateToScene(scene) {
  window.location.href = `./${scene}.html`;
}

/**
 * Set active state on navigation links
 * Call this on each page to highlight the current scene
 * @param {string} currentScene - Current scene name
 */
function setActiveNav(currentScene) {
  const navLinks = document.querySelectorAll('.scene-nav__link');
  navLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (href && href.includes(currentScene)) {
      link.classList.add('is-active');
    } else {
      link.classList.remove('is-active');
    }
  });
}

// ==========================================================================
// Time Display
// ==========================================================================

/**
 * Update the header time display
 * Uses state time for demo purposes
 * @param {string} timeString - Time to display (e.g., "6:47 AM")
 */
function updateHeaderTime(timeString) {
  const timeEl = document.querySelector('.app-header__time');
  if (timeEl) {
    timeEl.textContent = timeString;
  }
}

// ==========================================================================
// Initialization Helpers
// ==========================================================================

/**
 * Standard page initialization
 * Call this at the start of each scene's script
 * @param {string} sceneName - Name of the current scene
 * @returns {Promise} Resolves when state is loaded
 */
async function initPage(sceneName) {
  // Load state
  await loadState();

  // Set navigation state
  setActiveNav(sceneName);

  // Close modals on overlay click
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeAnyModal(e);
      }
    });
  });

  // Close modals on escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.is-active').forEach(modal => {
        modal.classList.remove('is-active');
      });
      document.body.style.overflow = '';
    }
  });

  console.log(`[App] Page initialized: ${sceneName}`);
  return AppState;
}

// ==========================================================================
// SVG Icons
// ==========================================================================

/**
 * Common SVG icons used across the app
 * Returns SVG markup as a string
 */
const Icons = {
  payment: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
    <path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>`,

  lightning: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
    <path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>`,

  check: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
    <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
  </svg>`,

  clock: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
    <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>`,

  creditCard: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
    <path stroke-linecap="round" stroke-linejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
  </svg>`,

  users: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
    <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>`,

  sun: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
    <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>`,

  moon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
    <path stroke-linecap="round" stroke-linejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
  </svg>`,

  close: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>`,

  chevronRight: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
    <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
  </svg>`,

  globe: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
    <path stroke-linecap="round" stroke-linejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>`,

  shield: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
    <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>`
};

// ==========================================================================
// Export for modules (if using module system)
// ==========================================================================

// For non-module scripts, these are available globally
// For ES modules, uncomment:
// export { loadState, getState, updateState, formatUSD, formatBTC, ... };
