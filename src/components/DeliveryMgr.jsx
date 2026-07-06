import React, { useState, useEffect } from 'react';
import api from '../api';

export default function DeliveryMgr({ t, lang, onBillSelected }) {
  const [deliveries, setDeliveries] = useState([]);
  const [orders, setOrders] = useState([]);
  const [shops, setShops] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Delivery marking states
  const [activeDelivery, setActiveDelivery] = useState(null);
  const [remarks, setRemarks] = useState('');
  
  // Outstanding Collection states
  const [collectAmount, setCollectAmount] = useState(0);
  const [paymentMode, setPaymentMode] = useState('cash');
  const [txnNumber, setTxnNumber] = useState('');
  const [showQR, setShowQR] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const [dData, oData, sData, rData] = await Promise.all([
          api.getDeliveries(),
          api.getOrders(),
          api.getShops(),
          api.getRoutes()
        ]);
        setDeliveries(dData);
        setOrders(oData);
        setShops(sData);
        setRoutes(rData);
      } catch (err) {
        console.error('Failed to load logistics datasets', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleSelectDelivery = (del) => {
    const order = orders.find(o => o.id === del.order_id);
    const shop = order ? shops.find(s => s.id === order.shop_id) : null;
    
    setActiveDelivery({ del, order, shop });
    setRemarks('');
    setCollectAmount(order ? order.net_amount : 0); // Default collection is order amount
    setPaymentMode('cash');
    setTxnNumber('');
    setShowQR(false);
  };

  const handleCompleteDelivery = async () => {
    if (!activeDelivery) return;
    setSubmitting(true);

    try {
      const { del, order, shop } = activeDelivery;
      
      // 1. Process Collection Payment if any amount is collected
      if (Number(collectAmount) > 0) {
        await api.createPayment({
          shop_id: shop.id,
          order_id: order.id,
          collected_amount: Number(collectAmount),
          payment_mode: paymentMode,
          transaction_number: txnNumber || `TXN-${Date.now()}`
        });
      }

      // 2. Mark Delivery complete
      await api.completeDelivery(del.id, remarks);

      alert('Delivery recorded successfully! / விநியோகம் பதிவு செய்யப்பட்டது!');

      // Reload dataset
      const [dData, oData, sData] = await Promise.all([
        api.getDeliveries(),
        api.getOrders(),
        api.getShops()
      ]);
      setDeliveries(dData);
      setOrders(oData);
      setShops(sData);
      
      setActiveDelivery(null);
    } catch (err) {
      alert('Error updating delivery logistics');
    } finally {
      setSubmitting(false);
    }
  };

  const generateUPILink = (pa, pn, am, tn) => {
    // UPI payment URI template
    return `upi://pay?pa=${encodeURIComponent(pa)}&pn=${encodeURIComponent(pn)}&am=${am}&cu=INR&tn=${encodeURIComponent(tn)}`;
  };

  if (loading) return <div style={{ color: 'var(--text-muted)', textAlign: 'center' }}>Loading Delivery Logistics...</div>;

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>🚚 {t('deliveries')}</h1>
        <p style={{ color: 'var(--text-muted)' }}>Fulfill orders, collect outstanding payments, and issue final shop receipts</p>
      </div>

      <div className={`delivery-mgr-grid ${activeDelivery ? 'has-panel' : ''}`}>
        
        {/* Deliveries list */}
        <div className="glass-card">
          <h2 style={{ marginBottom: '1.25rem', fontSize: '1.25rem' }}>{t('assigned_orders')}</h2>
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Invoice No</th>
                  <th>Shop & Route</th>
                  <th>Delivery Person</th>
                  <th>Amount Due</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {deliveries.map(d => {
                  const order = orders.find(o => o.id === d.order_id);
                  if (!order) return null;
                  const shop = shops.find(s => s.id === order.shop_id);
                  const route = routes.find(r => r.id === order.route_id);
                  const isCompleted = d.status === 'delivered';

                  return (
                    <tr key={d.id} style={{ opacity: isCompleted ? 0.7 : 1 }}>
                      <td><strong>{order.invoice_number}</strong></td>
                      <td>
                        <div style={{ fontWeight: '700' }}>{shop ? (lang === 'ta' ? shop.name_ta : shop.name_en) : 'Shop'}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Route: {route ? (lang === 'ta' ? route.name_ta : route.name_en) : ''}
                        </div>
                      </td>
                      <td>{t('delivery_man')}</td>
                      <td>₹{order.net_amount}</td>
                      <td>
                        <span style={{
                          fontSize: '0.75rem',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          background: isCompleted ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                          color: isCompleted ? 'var(--success)' : 'var(--warning)',
                          border: `1px solid ${isCompleted ? 'var(--success)' : 'var(--warning)'}`
                        }}>
                          {isCompleted ? t('delivered') : t('pending')}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {isCompleted ? (
                          <button className="language-btn" onClick={() => onBillSelected(order.id)}>
                            📄 View Bill
                          </button>
                        ) : (
                          <button className="btn btn-primary" style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }} onClick={() => handleSelectDelivery(d)}>
                            ⚡ Complete
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Complete delivery sidebar details */}
        {activeDelivery && (
          <div className="glass-card" style={{ border: '1px solid var(--accent-cyan)' }}>
            <h2 style={{ marginBottom: '1.25rem', fontSize: '1.25rem', color: 'var(--accent-cyan)' }}>Fulfill Invoice: {activeDelivery.order.invoice_number}</h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <strong style={{ fontSize: '1rem' }}>{lang === 'ta' ? activeDelivery.shop.name_ta : activeDelivery.shop.name_en}</strong>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Address: {activeDelivery.shop.address}</p>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Contact No: {activeDelivery.shop.mobile}</p>
              </div>

              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '0.35rem' }}>
                  <span>Shop Outstanding:</span>
                  <strong style={{ color: 'var(--warning)' }}>₹{activeDelivery.shop.outstanding_amount}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                  <span>Current Order Amount:</span>
                  <strong style={{ color: 'var(--accent-cyan)' }}>₹{activeDelivery.order.net_amount}</strong>
                </div>
              </div>

              {/* Outstanding collections input */}
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
                <h3 style={{ fontSize: '0.95rem', marginBottom: '0.75rem' }}>💵 {t('payment_collection')}</h3>
                
                <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                  <label>{t('collected_amount')}</label>
                  <input
                    type="number"
                    className="form-input"
                    value={collectAmount || ''}
                    onChange={e => setCollectAmount(Math.max(0, parseInt(e.target.value) || 0))}
                    max={activeDelivery.shop.outstanding_amount}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                  <label>{t('payment_mode')}</label>
                  <select
                    className="form-select"
                    value={paymentMode}
                    onChange={e => {
                      setPaymentMode(e.target.value);
                      setShowQR(e.target.value === 'gpay');
                    }}
                  >
                    <option value="cash">{t('cash')}</option>
                    <option value="gpay">{t('gpay')}</option>
                    <option value="bank">{t('bank')}</option>
                  </select>
                </div>

                {paymentMode === 'gpay' && (
                  <div style={{ margin: '1rem 0' }}>
                    <button
                      type="button"
                      className="language-btn"
                      style={{ width: '100%', borderStyle: 'dashed' }}
                      onClick={() => setShowQR(!showQR)}
                    >
                      📱 Toggle GPay QR Code
                    </button>
                    
                    {showQR && (
                      <div className="qr-container">
                        <span>{t('scan_pay')}</span>
                        <div className="qr-placeholder">
                          {/* Generate dynamic QR Code mockup vector */}
                          <svg viewBox="0 0 100 100">
                            <rect width="100" height="100" fill="white" />
                            {/* Simple mock QR pattern */}
                            <rect x="10" y="10" width="20" height="20" fill="black" />
                            <rect x="15" y="15" width="10" height="10" fill="white" />
                            <rect x="70" y="10" width="20" height="20" fill="black" />
                            <rect x="75" y="15" width="10" height="10" fill="white" />
                            <rect x="10" y="70" width="20" height="20" fill="black" />
                            <rect x="15" y="75" width="10" height="10" fill="white" />
                            <rect x="40" y="40" width="20" height="20" fill="black" />
                            {/* Inner lines */}
                            <path d="M 35 15 H 65 V 25 H 35 Z M 15 35 H 25 V 65 H 15 Z M 45 75 H 85 V 85 H 45 Z" fill="black" />
                            <circle cx="50" cy="50" r="4" fill="red" />
                          </svg>
                        </div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          UPI: <strong>vasantham@okaxis</strong>
                        </span>
                      </div>
                    )}

                    <div className="form-group" style={{ marginTop: '0.75rem' }}>
                      <label>{t('transaction_id')}</label>
                      <input
                        type="text"
                        className="form-input"
                        value={txnNumber}
                        onChange={e => setTxnNumber(e.target.value)}
                        placeholder="UPI Ref ID"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Remarks */}
              <div className="form-group">
                <label>{t('remarks')}</label>
                <input
                  type="text"
                  className="form-input"
                  value={remarks}
                  onChange={e => setRemarks(e.target.value)}
                  placeholder="e.g. Received intact, signature verified"
                />
              </div>

              <div className="btn-group" style={{ marginTop: '1rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setActiveDelivery(null)}>
                  {t('cancel')}
                </button>
                <button type="button" className="btn btn-primary" onClick={handleCompleteDelivery} disabled={submitting}>
                  ✔ {submitting ? '...' : t('mark_delivered')}
                </button>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}
