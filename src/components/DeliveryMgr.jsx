import React, { useState, useEffect } from 'react';
import api from '../api';
import ConfirmModal from './ConfirmModal';
import { translateShopName } from '../translations';

export default function DeliveryMgr({ t, lang, onBillSelected, session, onBulkPrint }) {
  const [deliveries, setDeliveries] = useState([]);
  const [orders, setOrders] = useState([]);
  const [shops, setShops] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDeliveryIds, setSelectedDeliveryIds] = useState([]);
  const [statusFilter, setStatusFilter] = useState(() => {
    const saved = localStorage.getItem('deliveryStatusFilter');
    localStorage.removeItem('deliveryStatusFilter');
    return saved || 'all';
  });
  const [routeFilter, setRouteFilter] = useState(() => {
    const saved = localStorage.getItem('deliveryRouteFilter');
    localStorage.removeItem('deliveryRouteFilter');
    return saved || 'all';
  });

  const handleToggleSelect = (id) => {
    setSelectedDeliveryIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    if (selectedDeliveryIds.length === filteredDeliveries.length && filteredDeliveries.length > 0) {
      setSelectedDeliveryIds([]);
    } else {
      setSelectedDeliveryIds(filteredDeliveries.map(d => d.id));
    }
  };

  const handleBulkPrintTrigger = () => {
    const selectedOrders = selectedDeliveryIds.map(dId => {
      const del = filteredDeliveries.find(d => d.id === dId);
      return del ? del.order_id : null;
    }).filter(Boolean);
    
    if (selectedOrders.length > 0 && onBulkPrint) {
      onBulkPrint(selectedOrders);
    }
  };

  // Delivery marking states
  const [activeDelivery, setActiveDelivery] = useState(null);
  const [remarks, setRemarks] = useState('');
  
  // Outstanding Collection states
  const [collectAmount, setCollectAmount] = useState(0);
  const [paymentMode, setPaymentMode] = useState('cash');
  const [txnNumber, setTxnNumber] = useState('');
  const [showQR, setShowQR] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Order Deletion states
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState(null);

  // Non-Delivery & Returns states
  const [fulfillmentType, setFulfillmentType] = useState('delivered'); // 'delivered' | 'not_delivered' | 'returned'
  const [reason, setReason] = useState('');
  const [nonDeliveryModalOpen, setNonDeliveryModalOpen] = useState(false);
  const [nonDeliveryType, setNonDeliveryType] = useState('not_delivered'); // 'not_delivered' | 'returned'


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
        // Auto-select order if passed from dashboard
        const selectId = localStorage.getItem('deliverySelectOrderId');
        if (selectId) {
          localStorage.removeItem('deliverySelectOrderId');
          const matchedDelivery = dData.find(d => d.order_id === selectId);
          if (matchedDelivery) {
            const matchedOrder = oData.find(o => o.id === selectId);
            const matchedShop = matchedOrder ? sData.find(s => s.id === matchedOrder.shop_id) : null;
            setActiveDelivery({ del: matchedDelivery, order: matchedOrder, shop: matchedShop });
            setRemarks('');
            setCollectAmount(matchedOrder ? matchedOrder.net_amount : 0);
            setPaymentMode('cash');
            setTxnNumber('');
            setShowQR(false);
            setFulfillmentType('delivered');
            setReason('');
          }
        }
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
    setFulfillmentType('delivered');
    setReason('');
  };

  const handleFulfillOrder = async (status, selectedReason, customRemarks) => {
    if (!activeDelivery) return;
    setSubmitting(true);
    try {
      const { del, order, shop } = activeDelivery;
      
      // 1. Process Collection Payment if status is delivered and collected amount is entered
      if (status === 'delivered' && Number(collectAmount) > 0) {
        await api.createPayment({
          shop_id: shop.id,
          order_id: order.id,
          collected_amount: Number(collectAmount),
          payment_mode: paymentMode,
          transaction_number: txnNumber || `TXN-${Date.now()}`
        });
      }

      // 2. Mark Delivery complete on backend
      await api.completeDelivery(del.id, {
        status,
        reason: selectedReason,
        remarks: customRemarks
      });

      alert(
        status === 'delivered'
          ? 'Delivery recorded successfully! / விநியோகம் பதிவு செய்யப்பட்டது!'
          : status === 'returned'
          ? 'Order marked as Returned. Stock and outstanding reverted. / ஆர்டர் திரும்பப் பெறப்பட்டது.'
          : 'Order marked as Not Delivered. Stock and outstanding reverted. / ஆர்டர் விநியோகிக்கப்படவில்லை.'
      );

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
      setNonDeliveryModalOpen(false);
    } catch (err) {
      alert('Error updating delivery logistics: ' + (err.message || err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteOrderTrigger = (orderId) => {
    setOrderToDelete(orderId);
    setConfirmDeleteOpen(true);
  };

  const executeDeleteOrder = async () => {
    setConfirmDeleteOpen(false);
    if (!orderToDelete) return;
    try {
      await api.deleteOrder(orderToDelete);
      alert(lang === 'ta' ? 'ஆர்டர் வெற்றிகரமாக நீக்கப்பட்டது!' : 'Order deleted successfully!');
      
      const [dData, oData, sData] = await Promise.all([
        api.getDeliveries(),
        api.getOrders(),
        api.getShops()
      ]);
      setDeliveries(dData);
      setOrders(oData);
      setShops(sData);

      if (activeDelivery && activeDelivery.order.id === orderToDelete) {
        setActiveDelivery(null);
      }
    } catch (err) {
      alert(err.message || 'Failed to delete order');
    } finally {
      setOrderToDelete(null);
    }
  };


  const generateUPILink = (pa, pn, am, tn) => {
    // UPI payment URI template
    return `upi://pay?pa=${encodeURIComponent(pa)}&pn=${encodeURIComponent(pn)}&am=${am}&cu=INR&tn=${encodeURIComponent(tn)}`;
  };

  const filteredDeliveries = deliveries.filter(d => {
    if (statusFilter !== 'all' && d.status !== statusFilter) return false;
    if (routeFilter !== 'all') {
      const order = orders.find(o => o.id === d.order_id);
      if (!order || order.route_id !== routeFilter) return false;
    }
    return true;
  });

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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem' }}>{t('assigned_orders')}</h2>
              <select
                className="form-select"
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                style={{ width: '150px', padding: '0.4rem 0.75rem', fontSize: '0.9rem', margin: 0 }}
              >
                <option value="all">{lang === 'ta' ? 'அனைத்து நிலை' : 'All Statuses'}</option>
                <option value="pending">{lang === 'ta' ? 'நிலுவையில் உள்ளவை' : 'Pending'}</option>
                <option value="delivered">{lang === 'ta' ? 'விநியோகிக்கப்பட்டவை' : 'Delivered'}</option>
                <option value="not_delivered">{lang === 'ta' ? 'விநியோகிக்கப்படாதவை' : 'Not Delivered'}</option>
                <option value="returned">{lang === 'ta' ? 'திரும்பப் பெறப்பட்டவை' : 'Returned'}</option>
              </select>

              <select
                className="form-select"
                value={routeFilter}
                onChange={e => setRouteFilter(e.target.value)}
                style={{ width: '180px', padding: '0.4rem 0.75rem', fontSize: '0.9rem', margin: 0 }}
              >
                <option value="all">{lang === 'ta' ? 'அனைத்து வழிகள்' : 'All Routes'}</option>
                {routes.map(r => (
                  <option key={r.id} value={r.id}>
                    {lang === 'ta' ? r.name_ta : r.name_en}
                  </option>
                ))}
              </select>
            </div>
            {selectedDeliveryIds.length > 0 && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleBulkPrintTrigger}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.4rem 1rem',
                  fontSize: '0.85rem'
                }}
              >
                🖨️ {lang === 'ta' ? 'தேர்ந்தெடுக்கப்பட்டவற்றை அச்சிடு' : 'Print Selected'} ({selectedDeliveryIds.length})
              </button>
            )}
          </div>
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th style={{ width: '40px', padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      className="form-checkbox"
                      checked={filteredDeliveries.length > 0 && selectedDeliveryIds.length === filteredDeliveries.length}
                      onChange={handleToggleSelectAll}
                      style={{ cursor: 'pointer', transform: 'scale(1.2)' }}
                    />
                  </th>
                  <th>Invoice No</th>
                  <th>Shop & Route</th>
                  <th>Delivery Person</th>
                  <th>Amount Due</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredDeliveries.map(d => {
                  const order = orders.find(o => o.id === d.order_id);
                  if (!order) return null;
                  const shop = shops.find(s => s.id === order.shop_id);
                  const route = routes.find(r => r.id === order.route_id);
                  
                  let statusBg = 'rgba(245, 158, 11, 0.1)';
                  let statusColor = 'var(--warning)';
                  let statusLabel = t('pending');

                  if (d.status === 'delivered') {
                    statusBg = 'rgba(16, 185, 129, 0.1)';
                    statusColor = 'var(--success)';
                    statusLabel = t('delivered');
                  } else if (d.status === 'not_delivered') {
                    statusBg = 'rgba(239, 68, 68, 0.1)';
                    statusColor = 'var(--danger)';
                    statusLabel = t('not_delivered');
                  } else if (d.status === 'returned') {
                    statusBg = 'rgba(59, 130, 246, 0.1)';
                    statusColor = 'var(--accent-blue)';
                    statusLabel = t('returned');
                  }

                  return (
                    <tr key={d.id} style={{ opacity: d.status !== 'pending' ? 0.7 : 1 }}>
                      <td style={{ textAlign: 'center', padding: '0.75rem 0.5rem' }}>
                        <input
                          type="checkbox"
                          className="form-checkbox"
                          checked={selectedDeliveryIds.includes(d.id)}
                          onChange={() => handleToggleSelect(d.id)}
                          style={{ cursor: 'pointer', transform: 'scale(1.2)' }}
                        />
                      </td>
                      <td><strong>{order.invoice_number}</strong></td>
                      <td>
                        <div style={{ fontWeight: '700' }}>{translateShopName(shop, lang) || 'Shop'}</div>
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
                          background: statusBg,
                          color: statusColor,
                          border: `1px solid ${statusColor}`
                        }}>
                          {statusLabel}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.5rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                          {d.status === 'pending' ? (
                            <>
                              <button 
                                className="language-btn" 
                                style={{ padding: '0.4rem 0.6rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} 
                                onClick={() => onBillSelected(order.id)}
                                title={lang === 'ta' ? 'பில் பார்க்க' : 'View Bill'}
                              >
                                👁️
                              </button>
                              <button className="btn btn-primary" style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }} onClick={() => handleSelectDelivery(d)}>
                                ⚡ Fulfill
                              </button>
                            </>
                          ) : (
                            <>
                              <button className="language-btn" onClick={() => onBillSelected(order.id)}>
                                📄 View Bill
                              </button>
                              {d.status === 'not_delivered' && (
                                <span style={{ fontSize: '0.8rem', color: 'var(--danger)', fontStyle: 'italic', marginRight: '0.5rem' }}>
                                  ({d.reason})
                                </span>
                              )}
                              {d.status === 'returned' && (
                                <span style={{ fontSize: '0.8rem', color: 'var(--accent-blue)', fontStyle: 'italic', marginRight: '0.5rem' }}>
                                  ({d.reason})
                                </span>
                              )}
                            </>
                          )}
                          {session?.role === 'admin' && (
                            <button
                              type="button"
                              className="btn btn-danger"
                              onClick={() => handleDeleteOrderTrigger(order.id)}
                              style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                              title={t('delete_order')}
                            >
                              🗑️
                            </button>
                          )}
                        </div>
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
            
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <button
                type="button"
                className="language-btn"
                style={{
                  flex: 1,
                  padding: '0.4rem',
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--accent-cyan)',
                  background: fulfillmentType === 'delivered' ? 'rgba(6, 182, 212, 0.1)' : 'none',
                  color: fulfillmentType === 'delivered' ? 'var(--accent-cyan)' : 'var(--text-muted)',
                  fontSize: '0.8rem'
                }}
                onClick={() => setFulfillmentType('delivered')}
              >
                ✓ {t('delivered')}
              </button>
              <button
                type="button"
                className="language-btn"
                style={{
                  flex: 1,
                  padding: '0.4rem',
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--danger)',
                  background: fulfillmentType === 'not_delivered' ? 'rgba(239, 68, 68, 0.1)' : 'none',
                  color: fulfillmentType === 'not_delivered' ? 'var(--danger)' : 'var(--text-muted)',
                  fontSize: '0.8rem'
                }}
                onClick={() => {
                  setFulfillmentType('not_delivered');
                  setNonDeliveryType('not_delivered');
                  setReason('Shop Closed');
                  setNonDeliveryModalOpen(true);
                }}
              >
                ✗ {t('not_delivered')}
              </button>
              <button
                type="button"
                className="language-btn"
                style={{
                  flex: 1,
                  padding: '0.4rem',
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--accent-blue)',
                  background: fulfillmentType === 'returned' ? 'rgba(59, 130, 246, 0.1)' : 'none',
                  color: fulfillmentType === 'returned' ? 'var(--accent-blue)' : 'var(--text-muted)',
                  fontSize: '0.8rem'
                }}
                onClick={() => {
                  setFulfillmentType('returned');
                  setNonDeliveryType('returned');
                  setReason('Wrong Item');
                  setNonDeliveryModalOpen(true);
                }}
              >
                ↺ {t('returned')}
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <strong style={{ fontSize: '1rem' }}>{translateShopName(activeDelivery.shop, lang)}</strong>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.2rem 0' }}>Address: {activeDelivery.shop.address}</p>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.2rem 0' }}>Contact No: {activeDelivery.shop.mobile}</p>
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

              {fulfillmentType === 'delivered' ? (
                <>
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
                              <svg viewBox="0 0 100 100">
                                <rect width="100" height="100" fill="white" />
                                <rect x="10" y="10" width="20" height="20" fill="black" />
                                <rect x="15" y="15" width="10" height="10" fill="white" />
                                <rect x="70" y="10" width="20" height="20" fill="black" />
                                <rect x="75" y="15" width="10" height="10" fill="white" />
                                <rect x="10" y="70" width="20" height="20" fill="black" />
                                <rect x="15" y="75" width="10" height="10" fill="white" />
                                <rect x="40" y="40" width="20" height="20" fill="black" />
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

                  <div className="form-group" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
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
                    <button type="button" className="btn btn-primary" onClick={() => handleFulfillOrder('delivered', '', remarks)} disabled={submitting}>
                      ✔ {submitting ? '...' : t('mark_delivered')}
                    </button>
                  </div>
                </>
              ) : (
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', textAlign: 'center' }}>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
                    {fulfillmentType === 'not_delivered'
                      ? 'Mark order as Not Delivered due to a problem (e.g. shop closed).'
                      : 'Mark order as Returned (e.g. damaged goods).'}
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <button
                      type="button"
                      className="btn"
                      style={{
                        background: fulfillmentType === 'not_delivered' ? 'var(--danger)' : 'var(--accent-blue)',
                        color: '#fff',
                        width: '100%',
                        fontSize: '0.85rem'
                      }}
                      onClick={() => setNonDeliveryModalOpen(true)}
                    >
                      ⚙️ Configure {fulfillmentType === 'not_delivered' ? 'Non-Delivery' : 'Return'} Details
                    </button>
                    <button type="button" className="btn btn-secondary" style={{ width: '100%' }} onClick={() => setActiveDelivery(null)}>
                      {t('cancel')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      <ConfirmModal
        isOpen={confirmDeleteOpen}
        title={t('confirm_title')}
        message={t('delete_order_confirm')}
        confirmText={t('confirm_ok')}
        cancelText={t('confirm_cancel')}
        onConfirm={executeDeleteOrder}
        onCancel={() => setConfirmDeleteOpen(false)}
      />

      {/* Non-Delivery / Return Modal */}
      {nonDeliveryModalOpen && activeDelivery && (
        <div className="modal-overlay">
          <div className="glass-card modal-card" style={{ maxWidth: '480px', width: '95%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: '700', margin: 0 }}>
                {nonDeliveryType === 'not_delivered' ? '✗ Record Non-Delivery' : '↺ Record Return'}
              </h3>
              <button 
                type="button" 
                onClick={() => setNonDeliveryModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.5rem', cursor: 'pointer', lineHeight: 1 }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <strong>Shop:</strong> {lang === 'ta' ? activeDelivery.shop.name_ta : activeDelivery.shop.name_en}
              </div>
              
              <div className="form-group">
                <label style={{ fontWeight: '600' }}>Reason (Mandatory) / காரணம்</label>
                <select 
                  className="form-select" 
                  value={reason} 
                  onChange={e => setReason(e.target.value)}
                  style={{ width: '100%', marginTop: '0.25rem' }}
                >
                  {nonDeliveryType === 'not_delivered' ? (
                    <>
                      <option value="Shop Closed">{lang === 'ta' ? 'கடை மூடப்பட்டுள்ளது' : 'Shop Closed'}</option>
                      <option value="Payment Issue">{lang === 'ta' ? 'பணம் செலுத்துவதில் சிக்கல்' : 'Payment Issue'}</option>
                      <option value="Other">{lang === 'ta' ? 'மற்றவை' : 'Other'}</option>
                    </>
                  ) : (
                    <>
                      <option value="Wrong Item">{lang === 'ta' ? 'தவறான பொருள்' : 'Wrong Item'}</option>
                      <option value="Damaged Goods">{lang === 'ta' ? 'சேதமடைந்த பொருட்கள்' : 'Damaged Goods'}</option>
                      <option value="Expired">{lang === 'ta' ? 'காலாவதியானது' : 'Expired'}</option>
                      <option value="Other">{lang === 'ta' ? 'மற்றவை' : 'Other'}</option>
                    </>
                  )}
                </select>
              </div>

              {nonDeliveryType === 'not_delivered' && reason === 'Payment Issue' && (
                <div style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '0.75rem', borderRadius: 'var(--radius)', marginTop: '0.5rem' }}>
                  <div style={{ color: 'var(--danger)', fontWeight: '700', marginBottom: '0.25rem' }}>
                    Current Outstanding: ₹{activeDelivery.shop.outstanding_amount}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Customer did not clear outstanding.
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ flex: 1, fontSize: '0.75rem', padding: '0.35rem' }}
                      onClick={() => {
                        setNonDeliveryModalOpen(false);
                        setFulfillmentType('delivered');
                      }}
                    >
                      💵 Collect Payment
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger"
                      style={{ flex: 1, fontSize: '0.75rem', padding: '0.35rem', background: 'var(--danger)', color: '#fff' }}
                      onClick={() => handleFulfillOrder('not_delivered', 'Payment Issue', remarks)}
                      disabled={submitting}
                    >
                      ✗ Mark Not Delivered
                    </button>
                  </div>
                </div>
              )}

              <div className="form-group">
                <label style={{ fontWeight: '600' }}>Remarks / குறிப்புகள்</label>
                <textarea
                  className="form-input"
                  style={{ width: '100%', height: '80px', marginTop: '0.25rem', padding: '0.5rem', resize: 'vertical' }}
                  value={remarks}
                  onChange={e => setRemarks(e.target.value)}
                  placeholder="Enter remarks..."
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => setNonDeliveryModalOpen(false)}
              >
                Cancel
              </button>
              {!(nonDeliveryType === 'not_delivered' && reason === 'Payment Issue') && (
                <button 
                  type="button" 
                  className="btn" 
                  style={{ background: nonDeliveryType === 'not_delivered' ? 'var(--danger)' : 'var(--accent-blue)', color: '#fff' }}
                  onClick={() => handleFulfillOrder(nonDeliveryType, reason || (nonDeliveryType === 'not_delivered' ? 'Shop Closed' : 'Wrong Item'), remarks)}
                  disabled={submitting}
                >
                  {submitting ? '...' : 'Confirm'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
