export const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BTC Loan Monitor</title>
  <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background-color: #0a0a0f;
      color: #e0e0e0;
      overflow-x: hidden;
    }

    .container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 24px;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 32px;
      padding-bottom: 24px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    }

    .header-left {
      display: flex;
      gap: 24px;
      align-items: center;
    }

    .header-title {
      font-size: 28px;
      font-weight: 600;
    }

    .status-indicator {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
    }

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      animation: pulse 2s infinite;
    }

    .status-dot.online {
      background-color: #00c853;
    }

    .status-dot.offline {
      background-color: #ff1744;
      animation: none;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    .token-display {
      font-family: 'Courier New', monospace;
      font-size: 12px;
      background: rgba(255, 255, 255, 0.03);
      padding: 8px 12px;
      border-radius: 4px;
      border: 1px solid rgba(255, 255, 255, 0.06);
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 24px;
      margin-bottom: 32px;
    }

    .grid-2col {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 24px;
      margin-bottom: 32px;
    }

    @media (max-width: 768px) {
      .grid-2col {
        grid-template-columns: 1fr;
      }
    }

    .card {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 8px;
      padding: 24px;
      backdrop-filter: blur(10px);
    }

    .card-title {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 16px;
      color: #fff;
    }

    .metric {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
      padding-bottom: 12px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.03);
    }

    .metric:last-child {
      margin-bottom: 0;
      border-bottom: none;
      padding-bottom: 0;
    }

    .metric-label {
      font-size: 14px;
      color: #b0b0b0;
    }

    .metric-value {
      font-size: 16px;
      font-weight: 600;
      color: #e0e0e0;
      font-family: 'Courier New', monospace;
    }

    .tier-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
    }

    .tier-green { background-color: rgba(0, 200, 83, 0.2); color: #00c853; }
    .tier-yellow { background-color: rgba(255, 214, 0, 0.2); color: #ffd600; }
    .tier-orange { background-color: rgba(255, 145, 0, 0.2); color: #ff9100; }
    .tier-red { background-color: rgba(255, 23, 68, 0.2); color: #ff1744; }
    .tier-liquidation { background-color: rgba(213, 0, 0, 0.2); color: #d50000; }

    .gauge-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px 0;
    }

    .gauge-svg {
      width: 200px;
      height: 200px;
      margin-bottom: 16px;
    }

    .gauge-text {
      text-align: center;
    }

    .gauge-value {
      font-size: 36px;
      font-weight: 700;
      color: #e0e0e0;
      font-family: 'Courier New', monospace;
    }

    .gauge-label {
      font-size: 14px;
      color: #b0b0b0;
      margin-top: 4px;
    }

    .stress-cards {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-bottom: 24px;
    }

    .stress-card {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 8px;
      padding: 16px;
      text-align: center;
    }

    .stress-drop {
      font-size: 16px;
      font-weight: 600;
      color: #ff1744;
      margin-bottom: 12px;
    }

    .stress-ltv {
      font-size: 24px;
      font-weight: 700;
      color: #e0e0e0;
      font-family: 'Courier New', monospace;
      margin-bottom: 8px;
    }

    .stress-tier {
      font-size: 12px;
      font-weight: 600;
      color: #b0b0b0;
    }

    @media (max-width: 768px) {
      .stress-cards {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    .form-group {
      margin-bottom: 16px;
      display: flex;
      gap: 8px;
    }

    .form-group.full {
      margin-bottom: 24px;
    }

    .form-group input,
    .form-group select {
      flex: 1;
      padding: 8px 12px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 4px;
      color: #e0e0e0;
      font-size: 14px;
    }

    .form-group input::placeholder {
      color: #707070;
    }

    .form-group input:focus,
    .form-group select:focus {
      outline: none;
      border-color: #f7931a;
      background: rgba(255, 255, 255, 0.08);
    }

    .btn {
      padding: 8px 16px;
      background-color: #f7931a;
      color: #000;
      border: none;
      border-radius: 4px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: background-color 0.2s;
    }

    .btn:hover {
      background-color: #ffb100;
    }

    .btn-danger {
      background-color: #ff1744;
      color: #fff;
      padding: 4px 8px;
      font-size: 12px;
    }

    .btn-danger:hover {
      background-color: #d50000;
    }

    .slider-container {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 24px;
    }

    .slider-container input[type="range"] {
      flex: 1;
      height: 6px;
      border-radius: 3px;
      background: linear-gradient(to right, #00c853 0%, #ffd600 50%, #ff1744 100%);
      outline: none;
      -webkit-appearance: none;
      appearance: none;
    }

    .slider-container input[type="range"]::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: #f7931a;
      cursor: pointer;
      border: 2px solid #0a0a0f;
    }

    .slider-container input[type="range"]::-moz-range-thumb {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: #f7931a;
      cursor: pointer;
      border: 2px solid #0a0a0f;
    }

    .slider-price {
      font-family: 'Courier New', monospace;
      font-size: 16px;
      font-weight: 600;
      color: #f7931a;
      min-width: 100px;
    }

    .alerts-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .alert-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px;
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid rgba(255, 255, 255, 0.04);
      border-radius: 4px;
      font-size: 14px;
    }

    .alert-type {
      color: #b0b0b0;
      margin-right: 8px;
    }

    .alert-value {
      color: #f7931a;
      font-weight: 600;
      margin-right: 16px;
      font-family: 'Courier New', monospace;
    }

    .empty-state {
      text-align: center;
      padding: 32px 0;
      color: #707070;
    }

    .error-message {
      background: rgba(255, 23, 68, 0.2);
      border: 1px solid rgba(255, 23, 68, 0.4);
      color: #ff1744;
      padding: 16px;
      border-radius: 4px;
      margin-bottom: 24px;
      font-size: 14px;
    }

    .loading {
      text-align: center;
      padding: 48px 0;
      color: #707070;
    }
  </style>
</head>
<body>
  <div id="root"><div style="color:#707070;text-align:center;padding:48px">Loading BTC Loan Monitor...</div></div>

  <script>
    window.onerror = function(msg, url, line, col, error) {
      var root = document.getElementById('root');
      root.innerHTML = '<div style="color:#ff1744;padding:24px;font-family:monospace">' +
        '<h3>Dashboard Error</h3>' +
        '<p>' + msg + '</p>' +
        '<p>Line: ' + line + ', Col: ' + col + '</p>' +
        '<p>' + (error && error.stack ? error.stack : '') + '</p>' +
        '</div>';
      return false;
    };
  </script>

  <script type="text/babel" data-presets="env,react">
    const { useState, useEffect, useRef, useCallback } = React;

    const COLOR_THRESHOLDS = {
      GREEN: { max: 45, color: '#00c853' },
      YELLOW: { min: 45, max: 60, color: '#ffd600' },
      ORANGE: { min: 60, max: 75, color: '#ff9100' },
      RED: { min: 75, max: 90, color: '#ff1744' },
      LIQUIDATION: { min: 90, color: '#d50000' }
    };

    function getTierColor(ltv) {
      if (ltv < 45) return COLOR_THRESHOLDS.GREEN.color;
      if (ltv < 60) return COLOR_THRESHOLDS.YELLOW.color;
      if (ltv < 75) return COLOR_THRESHOLDS.ORANGE.color;
      if (ltv < 90) return COLOR_THRESHOLDS.RED.color;
      return COLOR_THRESHOLDS.LIQUIDATION.color;
    }

    function getTierBadge(ltv) {
      if (ltv < 45) return 'tier-green';
      if (ltv < 60) return 'tier-yellow';
      if (ltv < 75) return 'tier-orange';
      if (ltv < 90) return 'tier-red';
      return 'tier-liquidation';
    }

    function getTierName(ltv) {
      if (ltv < 45) return 'Safe';
      if (ltv < 60) return 'Caution';
      if (ltv < 75) return 'Warning';
      if (ltv < 90) return 'Critical';
      return 'Liquidation';
    }

    function CircularGauge({ ltv, size = 200 }) {
      const radius = size / 2 - 10;
      const circumference = 2 * Math.PI * radius;
      const strokeDashoffset = circumference - (ltv / 100) * circumference;
      const color = getTierColor(ltv);

      return (
        <svg width={size} height={size} className="gauge-svg">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(255, 255, 255, 0.1)"
            strokeWidth="8"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.3s ease, stroke 0.3s ease' }}
          />
        </svg>
      );
    }

    function Header({ lenderName, token, isOnline, priceSource }) {
      return (
        <div className="header">
          <div className="header-left">
            <div className="header-title">BTC Loan Monitor</div>
            {lenderName && (
              <div style={{ fontSize: '16px', color: '#b0b0b0' }}>
                {lenderName}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
            <div className="token-display">
              {token ? token.substring(0, 12) + '...' : 'Loading'}
            </div>
            <div className="status-indicator">
              <div className={\`status-dot \${isOnline ? 'online' : 'offline'}\`}></div>
              <span>{isOnline ? 'Live' : 'Offline'}</span>
              {priceSource && <span style={{ color: '#707070' }}>({priceSource} source)</span>}
            </div>
          </div>
        </div>
      );
    }

    function LoanOverview({ data }) {
      if (!data) return null;

      const ltv = data.ltv || 0;

      return (
        <div className="card">
          <div className="card-title">Loan Status</div>
          <div className="gauge-container">
            <CircularGauge ltv={ltv} size={200} />
            <div className="gauge-text">
              <div className="gauge-value">{ltv.toFixed(2)}%</div>
              <div className="gauge-label">
                <span className={\`tier-badge \${getTierBadge(ltv)}\`}>
                  {getTierName(ltv)}
                </span>
              </div>
            </div>
          </div>
          <div className="metric">
            <span className="metric-label">Collateral</span>
            <span className="metric-value">₿ {(data.collateralValue || 0).toFixed(4)} (\${(data.collateralUsd || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })})</span>
          </div>
          <div className="metric">
            <span className="metric-label">Loan Amount</span>
            <span className="metric-value">\${(data.loanAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <div className="metric">
            <span className="metric-label">Current BTC Price</span>
            <span className="metric-value">\${(data.currentPrice || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <div className="metric">
            <span className="metric-label">Margin Call Price</span>
            <span className="metric-value">\${(data.marginCallPrice || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <div className="metric">
            <span className="metric-label">Liquidation Price</span>
            <span className="metric-value">\${(data.liquidationPrice || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        </div>
      );
    }

    function StressTest({ data }) {
      if (!data) return null;

      const stressKeys = [
        { key: '5pct_drop', label: '-5%' },
        { key: '10pct_drop', label: '-10%' },
        { key: '20pct_drop', label: '-20%' },
        { key: '30pct_drop', label: '-30%' },
      ];

      // If we have server-computed stress test, use that
      if (data.stressTest) {
        return (
          <div className="card">
            <div className="card-title">Stress Test</div>
            <div className="stress-cards">
              {stressKeys.map(({ key, label }) => {
                const s = data.stressTest[key];
                if (!s) return null;
                const ltvPct = (s.ltv || 0) * 100;
                return (
                  <div key={key} className="stress-card">
                    <div className="stress-drop">{label}</div>
                    <div className="stress-price">\${Math.round(s.price).toLocaleString()}</div>
                    <div className="stress-ltv">{ltvPct.toFixed(1)}%</div>
                    <div className="stress-tier">
                      <span className={\`tier-badge \${getTierBadge(ltvPct)}\`}>
                        {getTierName(ltvPct)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      }

      // Fallback: compute locally
      const drops = [-5, -10, -20, -30];
      const currentPrice = data.currentPrice || 0;
      const btcCollateral = data.collateralValue || 0;
      const loanAmount = data.loanAmount || 0;

      return (
        <div className="card">
          <div className="card-title">Stress Test</div>
          <div className="stress-cards">
            {drops.map((drop) => {
              const simPrice = currentPrice * (1 + drop / 100);
              const collUsd = btcCollateral * simPrice;
              const ltv = collUsd > 0 ? (loanAmount / collUsd) * 100 : 0;
              return (
                <div key={drop} className="stress-card">
                  <div className="stress-drop">{drop}%</div>
                  <div className="stress-price">\${Math.round(simPrice).toLocaleString()}</div>
                  <div className="stress-ltv">{Math.min(ltv, 999).toFixed(1)}%</div>
                  <div className="stress-tier">
                    <span className={\`tier-badge \${getTierBadge(ltv)}\`}>
                      {getTierName(ltv)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    function PriceSimulator({ token, data }) {
      const [simulatedPrice, setSimulatedPrice] = useState((data && data.currentPrice) || 50000);
      const [simulatedLtv, setSimulatedLtv] = useState((data && data.ltv) || 0);
      const [loading, setLoading] = useState(false);

      const handleSliderChange = useCallback((e) => {
        const price = parseFloat(e.target.value);
        setSimulatedPrice(price);

        setLoading(true);
        fetch(\`/api/loan/\${token}/simulate?price=\${price}\`)
          .then(res => res.json())
          .then(result => {
            setSimulatedLtv((result.current_ltv || 0) * 100);
            setLoading(false);
          })
          .catch(() => setLoading(false));
      }, [token]);

      return (
        <div className="card">
          <div className="card-title">Price Simulator</div>
          <div className="slider-container">
            <input
              type="range"
              min="10000"
              max="200000"
              step="100"
              value={simulatedPrice}
              onChange={handleSliderChange}
              disabled={loading}
            />
            <div className="slider-price">\${simulatedPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>
          <div className="metric">
            <span className="metric-label">Simulated LTV</span>
            <span className="metric-value">{simulatedLtv.toFixed(2)}%</span>
          </div>
          <div className="metric">
            <span className="metric-label">Tier</span>
            <span className="metric-value">
              <span className={\`tier-badge \${getTierBadge(simulatedLtv)}\`}>
                {getTierName(simulatedLtv)}
              </span>
            </span>
          </div>
        </div>
      );
    }

    function AlertSettings({ token }) {
      const [alerts, setAlerts] = useState([]);
      const [loading, setLoading] = useState(true);
      const [priceThreshold, setPriceThreshold] = useState('');
      const [priceDirection, setPriceDirection] = useState('ABOVE');
      const [ltvThreshold, setLtvThreshold] = useState('');
      const [ltvDirection, setLtvDirection] = useState('ABOVE');
      const [submitting, setSubmitting] = useState(false);

      useEffect(() => {
        fetchAlerts();
      }, [token]);

      const fetchAlerts = () => {
        setLoading(true);
        fetch(\`/api/loan/\${token}/alerts\`)
          .then(res => res.json())
          .then(data => {
            setAlerts(Array.isArray(data) ? data : []);
            setLoading(false);
          })
          .catch(() => {
            setAlerts([]);
            setLoading(false);
          });
      };

      const handleCreatePriceAlert = async (e) => {
        e.preventDefault();
        if (!priceThreshold) return;

        setSubmitting(true);
        try {
          const response = await fetch(\`/api/loan/\${token}/alerts\`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'PRICE',
              threshold: parseFloat(priceThreshold),
              direction: priceDirection
            })
          });
          if (response.ok) {
            setPriceThreshold('');
            fetchAlerts();
          }
        } finally {
          setSubmitting(false);
        }
      };

      const handleCreateLtvAlert = async (e) => {
        e.preventDefault();
        if (!ltvThreshold) return;

        setSubmitting(true);
        try {
          const response = await fetch(\`/api/loan/\${token}/alerts\`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'LTV',
              threshold: parseFloat(ltvThreshold),
              direction: ltvDirection
            })
          });
          if (response.ok) {
            setLtvThreshold('');
            fetchAlerts();
          }
        } finally {
          setSubmitting(false);
        }
      };

      const handleDeleteAlert = async (alertId) => {
        try {
          const response = await fetch(\`/api/loan/\${token}/alerts/\${alertId}\`, {
            method: 'DELETE'
          });
          if (response.ok) {
            fetchAlerts();
          }
        } catch (err) {
          console.error('Delete failed:', err);
        }
      };

      return (
        <div className="card">
          <div className="card-title">Alert Settings</div>

          <div style={{ marginBottom: '24px' }}>
            <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: '#fff' }}>
              Price Alert
            </div>
            <form onSubmit={handleCreatePriceAlert} style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <input
                type="number"
                placeholder="Price (USD)"
                value={priceThreshold}
                onChange={(e) => setPriceThreshold(e.target.value)}
                disabled={submitting}
              />
              <select value={priceDirection} onChange={(e) => setPriceDirection(e.target.value)} disabled={submitting}>
                <option value="ABOVE">Above</option>
                <option value="BELOW">Below</option>
              </select>
              <button className="btn" type="submit" disabled={submitting}>
                {submitting ? 'Adding...' : 'Add'}
              </button>
            </form>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: '#fff' }}>
              LTV Alert
            </div>
            <form onSubmit={handleCreateLtvAlert} style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <input
                type="number"
                placeholder="LTV %"
                value={ltvThreshold}
                onChange={(e) => setLtvThreshold(e.target.value)}
                disabled={submitting}
              />
              <select value={ltvDirection} onChange={(e) => setLtvDirection(e.target.value)} disabled={submitting}>
                <option value="ABOVE">Above</option>
                <option value="BELOW">Below</option>
              </select>
              <button className="btn" type="submit" disabled={submitting}>
                {submitting ? 'Adding...' : 'Add'}
              </button>
            </form>
          </div>

          <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: '#fff' }}>
            Active Alerts
          </div>

          {loading ? (
            <div className="loading">Loading alerts...</div>
          ) : alerts.length === 0 ? (
            <div className="empty-state">No alerts configured</div>
          ) : (
            <div className="alerts-list">
              {alerts.map((alert) => (
                <div key={alert.id} className="alert-item">
                  <span>
                    {alert.type === 'PRICE' ? 'Price' : 'LTV'}
                    <span className="alert-type">{alert.direction}</span>
                    <span className="alert-value">
                      {alert.type === 'PRICE' ? '\$' : ''}{alert.threshold}{alert.type === 'LTV' ? '%' : ''}
                    </span>
                  </span>
                  <button
                    className="btn-danger"
                    onClick={() => handleDeleteAlert(alert.id)}
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    function LoanDetails({ data }) {
      if (!data) return null;

      const endDate = new Date(data.endDate || Date.now());
      const now = new Date();
      const daysRemaining = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
      const createdDate = new Date(data.createdAt || Date.now());

      return (
        <div className="card">
          <div className="card-title">Loan Details</div>
          <div className="metric">
            <span className="metric-label">Interest Rate</span>
            <span className="metric-value">{(data.interestRate || 0).toFixed(2)}% p.a.</span>
          </div>
          <div className="metric">
            <span className="metric-label">Created</span>
            <span className="metric-value">{createdDate.toLocaleDateString()}</span>
          </div>
          <div className="metric">
            <span className="metric-label">End Date</span>
            <span className="metric-value">{endDate.toLocaleDateString()}</span>
          </div>
          <div className="metric">
            <span className="metric-label">Days Remaining</span>
            <span className="metric-value">{Math.max(0, daysRemaining)} days</span>
          </div>
          <div className="metric">
            <span className="metric-label">Lender</span>
            <span className="metric-value">{data.lenderName || 'Not specified'}</span>
          </div>
        </div>
      );
    }

    function Dashboard() {
      const [loanData, setLoanData] = useState(null);
      const [error, setError] = useState(null);
      const [isOnline, setIsOnline] = useState(false);
      const [priceSource, setPriceSource] = useState('API');
      const wsRef = useRef(null);

      const token = window.__TOKEN__;

      // Transform API snake_case response to what components expect
      function transformApiData(raw) {
        if (!raw) return null;
        return {
          ltv: (raw.current_ltv || 0) * 100,
          currentPrice: raw.btc_price || 0,
          collateralValue: raw.btc_collateral || 0,
          collateralUsd: raw.collateral_usd || 0,
          loanAmount: raw.loan_amount_usd || 0,
          marginCallPrice: raw.margin_call_price || 0,
          liquidationPrice: raw.liquidation_price || 0,
          riskTier: raw.risk_tier || 'GREEN',
          interestRate: raw.interest_rate || 0,
          endDate: raw.end_date || null,
          daysRemaining: raw.days_remaining,
          lenderName: raw.lender_name || null,
          createdAt: raw.created_at || Date.now(),
          marginCallLtv: raw.margin_call_ltv || 0.75,
          liquidationLtv: raw.liquidation_ltv || 0.90,
          stressTest: raw.stress_test || null,
        };
      }

      const fetchLoanData = useCallback(() => {
        if (!token) return;

        fetch(\`/api/loan/\${token}\`)
          .then(res => {
            if (res.status === 401) {
              setError('Unauthorized: Invalid or expired token');
              return null;
            }
            if (!res.ok) throw new Error(\`HTTP \${res.status}\`);
            return res.json();
          })
          .then(data => {
            if (data) {
              setLoanData(transformApiData(data));
              setError(null);
            }
          })
          .catch(err => {
            setError(\`Failed to fetch loan data: \${err.message}\`);
          });
      }, [token]);

      useEffect(() => {
        if (!token) {
          setError('No token provided');
          return;
        }

        fetchLoanData();
        const interval = setInterval(fetchLoanData, 10000);

        return () => clearInterval(interval);
      }, [token, fetchLoanData]);

      useEffect(() => {
        if (!token) return;

        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = \`\${wsProtocol}//\${window.location.host}/ws\`;

        const connectWs = () => {
          try {
            wsRef.current = new WebSocket(wsUrl);

            wsRef.current.onopen = () => {
              setIsOnline(true);
              setPriceSource('WebSocket');
            };

            wsRef.current.onmessage = (event) => {
              try {
                const msg = JSON.parse(event.data);
                if (msg.type === 'price' && msg.data) {
                  setLoanData(prev => prev ? { ...prev, currentPrice: msg.data.price } : null);
                  // Also re-fetch full data for accurate LTV
                  fetchLoanData();
                }
              } catch (err) {
                console.error('WS message parse error:', err);
              }
            };

            wsRef.current.onerror = (err) => {
              console.error('WS error:', err);
              setIsOnline(false);
              setPriceSource('API');
            };

            wsRef.current.onclose = () => {
              setIsOnline(false);
              setPriceSource('API');
              setTimeout(connectWs, 3000);
            };
          } catch (err) {
            console.error('WS connection error:', err);
            setIsOnline(false);
            setTimeout(connectWs, 3000);
          }
        };

        connectWs();

        return () => {
          if (wsRef.current) {
            wsRef.current.close();
          }
        };
      }, [token]);

      return (
        <div className="container">
          <Header
            lenderName={loanData && loanData.lenderName}
            token={token}
            isOnline={isOnline}
            priceSource={priceSource}
          />

          {error && <div className="error-message">{error}</div>}

          {!loanData ? (
            <div className="loading">Loading loan data...</div>
          ) : (
            <>
              <div className="grid">
                <LoanOverview data={loanData} />
                <LoanDetails data={loanData} />
              </div>

              <StressTest data={loanData} />

              <div className="grid-2col">
                <PriceSimulator token={token} data={loanData} />
                <AlertSettings token={token} />
              </div>
            </>
          )}
        </div>
      );
    }

    try {
      const root = ReactDOM.createRoot(document.getElementById('root'));
      root.render(<Dashboard />);
    } catch (err) {
      document.getElementById('root').innerHTML =
        '<div style="color:#ff1744;padding:24px;font-family:monospace">' +
        '<h3>Render Error</h3><p>' + err.message + '</p></div>';
    }
  </script>
</body>
</html>
`;
