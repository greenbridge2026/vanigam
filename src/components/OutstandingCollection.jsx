import React, { useState, useEffect } from 'react';
import api from '../api';
import { translateShopName } from '../translations';

export default function OutstandingCollection({ t, lang }) {
  const [routes, setRoutes] = useState([]);
  const [shops, setShops] = useState([]);
  const [orders, setOrders] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [selectedRouteId, setSelectedRouteId] = useState('all');
  const [selectedShopId, setSelectedShopId] = useState('');
  const [targetInvoiceId, setTargetInvoiceId] = useState(''); // Empty means General Outstanding
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyOutstanding, setOnlyOutstanding] = useState(true);

  const [cashAmount, setCashAmount] = useState(0);
  const [gpayAmount, setGpayAmount] = useState(0);
  const [gpayTxn, setGpayTxn] = useState('');
  const [chequeAmount, setChequeAmount] = useState(0);
  const [chequeNo, setChequeNo] = useState('');
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const [rData, sData, oData, pData] = await Promise.all([
          api.getRoutes(),
          api.getShops(),
          api.getOrders(),
          api.getPayments()
        ]);
        setRoutes(rData);
        setShops(sData);
        setOrders(oData);
        setPayments(pData);
      } catch (err) {
        console.error('Failed to load collections data', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const selectedShop = shops.find(s => s.id === selectedShopId);

  // Get all unpaid or partially paid invoices for the selected shop
  const shopInvoices = orders
    .filter(o => o.shop_id === selectedShopId && (o.status === 'delivered' || o.status === 'pending'))
    .map(order => {
      const orderPayments = payments.filter(p => p.order_id === order.id);
      const totalCollected = orderPayments.reduce((sum, p) => sum + p.collected_amount, 0);
      const remaining = order.net_amount - totalCollected;
      return {
        ...order,
        total_collected: totalCollected,
        remaining_outstanding: remaining
      };
    })
    .filter(o => o.remaining_outstanding > 0);

  // Filter shops for shopwise outstanding list
  const filteredShopsList = shops.filter(s => {
    if (s.status !== 'active') return false;
    if (selectedRouteId !== 'all' && s.route_id !== selectedRouteId) return false;
    if (onlyOutstanding && (!s.outstanding_amount || s.outstanding_amount <= 0)) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const nameTa = (s.name_ta || '').toLowerCase();
      const nameEn = (s.name_en || s.name || '').toLowerCase();
      const mob = (s.mobile || '');
      if (!nameTa.includes(q) && !nameEn.includes(q) && !mob.includes(q)) return false;
    }
    return true;
  }).sort((a, b) => (b.outstanding_amount || 0) - (a.outstanding_amount || 0));

  const totalOutstandingSum = filteredShopsList.reduce((sum, s) => sum + (Number(s.outstanding_amount) || 0), 0);

  const handleAddRow = () => {
    setPaymentRows([
      ...paymentRows,
      {
        payment_mode: 'cash',
        collected_amount: 0,
        transaction_number: '',
        reference_number: '',
        payment_date: new Date().toISOString().split('T')[0]
      }
    ]);
  };

  const handleRemoveRow = (index) => {
    if (paymentRows.length === 1) return;
    setPaymentRows(paymentRows.filter((_, idx) => idx !== index));
  };

  const handleRowChange = (index, field, value) => {
    const updated = [...paymentRows];
    updated[index][field] = value;
    setPaymentRows(updated);
  };

  const totalCollected = Number(cashAmount || 0) + Number(gpayAmount || 0) + Number(chequeAmount || 0);

  // Total outstanding to resolve (either shop outstanding or specific invoice remaining)
  const outstandingToResolve = targetInvoiceId 
    ? (shopInvoices.find(inv => inv.id === targetInvoiceId)?.remaining_outstanding || 0)
    : (selectedShop ? selectedShop.outstanding_amount : 0);

  const balanceOutstanding = outstandingToResolve - totalCollected;

  const handleSelectShop = (shopId) => {
    setSelectedShopId(shopId);
    setTargetInvoiceId('');
    const targetShop = shops.find(s => s.id === shopId);
    if (targetShop && targetShop.outstanding_amount > 0) {
      setCashAmount(targetShop.outstanding_amount);
      setGpayAmount(0);
      setGpayTxn('');
      setChequeAmount(0);
      setChequeNo('');
    } else {
      setCashAmount(0);
      setGpayAmount(0);
      setGpayTxn('');
      setChequeAmount(0);
      setChequeNo('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedShopId) {
      alert(lang === 'ta' ? 'தயவுசெய்து பட்டியலிலிருந்து கடையைத் தேர்ந்தெடுக்கவும்.' : 'Please select a shop from the list.');
      return;
    }
    if (totalCollected <= 0) {
      alert(lang === 'ta' ? 'வசூலிக்கப்பட்ட தொகை பூஜ்ஜியத்தை விட அதிகமாக இருக்க வேண்டும்.' : 'Total collected amount must be greater than 0.');
      return;
    }

    setSubmitting(true);
    try {
      const paymentsToSubmit = [];
      if (Number(cashAmount) > 0) {
        paymentsToSubmit.push({
          shop_id: selectedShopId,
          order_id: targetInvoiceId || '',
          collected_amount: Number(cashAmount),
          payment_mode: 'cash',
          transaction_number: '',
          reference_number: '',
          payment_date: new Date(paymentDate).toISOString()
        });
      }
      if (Number(gpayAmount) > 0) {
        paymentsToSubmit.push({
          shop_id: selectedShopId,
          order_id: targetInvoiceId || '',
          collected_amount: Number(gpayAmount),
          payment_mode: 'gpay',
          transaction_number: gpayTxn || `TXN-${Date.now()}`,
          reference_number: '',
          payment_date: new Date(paymentDate).toISOString()
        });
      }
      if (Number(chequeAmount) > 0) {
        paymentsToSubmit.push({
          shop_id: selectedShopId,
          order_id: targetInvoiceId || '',
          collected_amount: Number(chequeAmount),
          payment_mode: 'cheque',
          transaction_number: '',
          reference_number: chequeNo || `CHQ-${Date.now()}`,
          payment_date: new Date(paymentDate).toISOString()
        });
      }

      await api.createPayment({ payments: paymentsToSubmit });

      alert(lang === 'ta' ? 'வசூல் வெற்றிகரமாகப் பதிவு செய்யப்பட்டது!' : 'Outstanding collection recorded successfully!');

      setCashAmount(0);
      setGpayAmount(0);
      setGpayTxn('');
      setChequeAmount(0);
      setChequeNo('');
      setTargetInvoiceId('');

      // Reload dataset
      const [sData, oData, pData] = await Promise.all([
        api.getShops(),
        api.getOrders(),
        api.getPayments()
      ]);
      setShops(sData);
      setOrders(oData);
      setPayments(pData);
    } catch (err) {
      alert('Error saving payments: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleInvoiceSelect = (invoiceId) => {
    setTargetInvoiceId(invoiceId);
    if (invoiceId) {
      const selectedInvoice = shopInvoices.find(inv => inv.id === invoiceId);
      if (selectedInvoice) {
        setCashAmount(selectedInvoice.remaining_outstanding);
        setGpayAmount(0);
        setGpayTxn('');
        setChequeAmount(0);
        setChequeNo('');
      }
    }
  };

  if (loading) return <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '3rem' }}>Loading Outstanding Collection...</div>;

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>💵 {t('outstanding_collection')}</h1>
        <p style={{ color: 'var(--text-muted)' }}>
          {lang === 'ta' ? 'கடைகளின் நிலுவைத் தொகையை நேரடியாகப் பார்த்து விரைவாக வசூல் தொகையைப் பதிவு செய்யவும்.' : 'View shopwise outstanding balances and quickly record partial or full payment collections.'}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.35fr 1.65fr', gap: '1.5rem', alignItems: 'flex-start' }} className="collection-grid">
        
        {/* Left side - Interactive Shopwise Outstanding List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          <div className="glass-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
              <h2 style={{ fontSize: '1.15rem', margin: 0 }}>
                🏬 {lang === 'ta' ? 'கடைவாரி நிலுவை பட்டியல்' : 'Shopwise Outstanding List'}
              </h2>
              <span style={{ fontSize: '0.75rem', background: 'rgba(245, 158, 11, 0.15)', color: 'var(--warning)', padding: '2px 8px', borderRadius: '12px', fontWeight: '600' }}>
                {filteredShopsList.length} {lang === 'ta' ? 'கடைகள்' : 'Shops'}
              </span>
            </div>

            {/* Filter and Search controls */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label style={{ fontSize: '0.75rem' }}>{lang === 'ta' ? 'வழித்தடம்' : 'Filter Route'}</label>
                  <select 
                    className="form-select" 
                    value={selectedRouteId} 
                    onChange={e => {
                      setSelectedRouteId(e.target.value);
                    }}
                    style={{ fontSize: '0.85rem' }}
                  >
                    <option value="all">{lang === 'ta' ? 'அனைத்து வழித்தடங்கள்' : 'All Routes'}</option>
                    {routes.map(r => (
                      <option key={r.id} value={r.id}>{lang === 'ta' ? r.name_ta : r.name_en}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label style={{ fontSize: '0.75rem' }}>{lang === 'ta' ? 'தேடல்' : 'Search Shop'}</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder={lang === 'ta' ? 'கடை பெயர் / மொபைல்...' : 'Shop name / mobile...'}
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    style={{ fontSize: '0.85rem' }}
                  />
                </div>
              </div>

              {/* Filter toggle */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                <label style={{ fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={onlyOutstanding}
                    onChange={e => setOnlyOutstanding(e.target.checked)}
                  />
                  <span>{lang === 'ta' ? 'நிலுவை உள்ள கடைகள் மட்டும்' : 'Shops with Outstanding Only'}</span>
                </label>
                <div style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--warning)' }}>
                  Total: ₹{totalOutstandingSum.toLocaleString()}
                </div>
              </div>
            </div>

            {/* Shopwise Scrollable List */}
            {filteredShopsList.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', margin: '2rem 0' }}>
                {lang === 'ta' ? 'கடைகள் எதுவும் கிடைக்கவில்லை.' : 'No shops found matching filter criteria.'}
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '420px', overflowY: 'auto', paddingRight: '4px' }}>
                {filteredShopsList.map(s => {
                  const isSelected = selectedShopId === s.id;
                  const routeObj = routes.find(r => r.id === s.route_id);
                  const routeName = routeObj ? (lang === 'ta' ? routeObj.name_ta : routeObj.name_en) : 'Unassigned';

                  return (
                    <div 
                      key={s.id}
                      onClick={() => handleSelectShop(s.id)}
                      style={{
                        padding: '0.75rem',
                        background: isSelected ? 'rgba(6, 182, 212, 0.12)' : 'rgba(255,255,255,0.02)',
                        border: isSelected ? '2px solid var(--accent-cyan)' : '1px solid var(--border-color)',
                        borderRadius: 'var(--radius)',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        transition: 'all 0.2s ease',
                        boxShadow: isSelected ? '0 0 10px rgba(6, 182, 212, 0.2)' : 'none'
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0, paddingRight: '0.5rem' }}>
                        <div style={{ fontWeight: '700', fontSize: '0.95rem', color: isSelected ? 'var(--accent-cyan)' : 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {translateShopName(s, lang)}
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.2rem', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.7rem', background: 'rgba(255,255,255,0.06)', padding: '1px 6px', borderRadius: '4px', color: 'var(--text-muted)' }}>
                            🗺️ {routeName}
                          </span>
                          {s.mobile && (
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                              📞 {s.mobile}
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
                        <div style={{ fontSize: '1.05rem', fontWeight: '800', color: s.outstanding_amount > 0 ? 'var(--warning)' : 'var(--success)' }}>
                          ₹{(s.outstanding_amount || 0).toLocaleString()}
                        </div>
                        <button
                          type="button"
                          className="btn"
                          style={{
                            padding: '0.2rem 0.5rem',
                            fontSize: '0.75rem',
                            fontWeight: '600',
                            background: isSelected ? 'var(--accent-cyan)' : 'rgba(255,255,255,0.08)',
                            color: isSelected ? '#0f172a' : 'var(--text-primary)',
                            border: 'none',
                            borderRadius: '4px'
                          }}
                        >
                          {isSelected ? '✓ Selected' : '⚡ Collect'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Unpaid Invoices card for selected shop */}
          {selectedShopId && (
            <div className="glass-card">
              <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                📄 {lang === 'ta' ? 'நிலுவை பில்கள்' : 'Unpaid Invoices'} ({shopInvoices.length})
              </h2>
              {shopInvoices.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', margin: '0.75rem 0' }}>
                  {lang === 'ta' ? 'நிலுவை பில்கள் எதுவும் இல்லை.' : 'No specific unpaid invoices found for this shop.'}
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '200px', overflowY: 'auto' }}>
                  {shopInvoices.map(inv => (
                    <div 
                      key={inv.id} 
                      onClick={() => handleInvoiceSelect(inv.id)}
                      style={{
                        padding: '0.6rem 0.8rem',
                        background: targetInvoiceId === inv.id ? 'rgba(6, 182, 212, 0.1)' : 'rgba(255,255,255,0.02)',
                        border: targetInvoiceId === inv.id ? '1px solid var(--accent-cyan)' : '1px solid var(--border-color)',
                        borderRadius: 'var(--radius)',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        transition: 'all 0.2s'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: '700', fontSize: '0.85rem' }}>Invoice: {inv.invoice_number}</div>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          {new Date(inv.order_date).toLocaleDateString()}
                        </span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: '700', fontSize: '0.9rem', color: 'var(--danger)' }}>₹{inv.remaining_outstanding}</div>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Total: ₹{inv.net_amount}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Right side - Payment Entry Form */}
        <form onSubmit={handleSubmit} className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <h2 style={{ fontSize: '1.25rem', color: 'var(--accent-cyan)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>💰 {lang === 'ta' ? 'கட்டண பதிவு' : 'Collect Payment'}</span>
            {targetInvoiceId ? (
              <span style={{ fontSize: '0.75rem', background: 'rgba(6, 182, 212, 0.2)', color: 'var(--accent-cyan)', padding: '2px 8px', borderRadius: '4px' }}>
                Invoice Specific
              </span>
            ) : (
              <span style={{ fontSize: '0.75rem', background: 'rgba(245, 158, 11, 0.2)', color: 'var(--warning)', padding: '2px 8px', borderRadius: '4px' }}>
                General Account Pay
              </span>
            )}
          </h2>

          {/* Selected Shop Banner */}
          {selectedShop ? (
            <div style={{ padding: '0.75rem 1rem', background: 'rgba(6, 182, 212, 0.1)', border: '1px solid var(--accent-cyan)', borderRadius: 'var(--radius)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)', fontWeight: '600', display: 'block' }}>SELECTED SHOP</span>
                <strong style={{ fontSize: '1.1rem' }}>{translateShopName(selectedShop, lang)}</strong>
                {selectedShop.mobile && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>📞 {selectedShop.mobile}</span>}
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Shop Outstanding</span>
                <strong style={{ fontSize: '1.25rem', color: 'var(--warning)' }}>₹{selectedShop.outstanding_amount}</strong>
              </div>
            </div>
          ) : (
            <div style={{ padding: '1rem', background: 'rgba(245, 158, 11, 0.08)', border: '1px dashed var(--warning)', borderRadius: 'var(--radius)', textAlign: 'center', color: 'var(--warning)' }}>
              👈 {lang === 'ta' ? 'பட்டியலிலிருந்து கடையைத் தேர்ந்தெடுக்கவும்' : 'Please select a shop from the list on the left to start collecting.'}
            </div>
          )}

          {/* Target application toggle */}
          {selectedShopId && (
            <div>
              <label style={{ fontWeight: '600', fontSize: '0.85rem', display: 'block', marginBottom: '0.4rem' }}>
                {lang === 'ta' ? 'வசூல் வகை' : 'Apply Collection To'}
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  className={`language-btn ${!targetInvoiceId ? 'active' : ''}`}
                  style={{ flex: 1, padding: '0.5rem', background: !targetInvoiceId ? 'var(--accent-cyan)' : '', color: !targetInvoiceId ? '#0f172a' : '' }}
                  onClick={() => setTargetInvoiceId('')}
                >
                  💼 {lang === 'ta' ? 'பொது கணக்கு வசூல்' : 'General Account Outstanding'}
                </button>
                {shopInvoices.length > 0 && (
                  <button
                    type="button"
                    className={`language-btn ${targetInvoiceId ? 'active' : ''}`}
                    style={{ flex: 1, padding: '0.5rem', background: targetInvoiceId ? 'var(--accent-cyan)' : '', color: targetInvoiceId ? '#0f172a' : '' }}
                    onClick={() => handleInvoiceSelect(shopInvoices[0].id)}
                  >
                    📄 {lang === 'ta' ? 'குறிப்பிட்ட பில்' : 'Specific Invoice'}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Payment Collection Options (Cash, GPay, Cheque) */}
          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
            <label style={{ fontWeight: '700', fontSize: '0.9rem', display: 'block', marginBottom: '0.75rem' }}>
              💰 {t('payment_collection')}
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
              {/* Cash Option */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '0.95rem', display: 'block', fontWeight: 700, color: 'var(--success)', marginBottom: '0.4rem' }}>
                  💵 {t('cash')} (₹)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  className="form-input"
                  style={{ width: '100%', boxSizing: 'border-box', fontWeight: 700, fontSize: '1.25rem', padding: '0.6rem 0.75rem' }}
                  value={cashAmount === '' || cashAmount === 0 ? (cashAmount === '' ? '' : '0') : cashAmount}
                  onChange={e => {
                    const val = e.target.value.replace(/\D/g, '');
                    setCashAmount(val === '' ? '' : parseInt(val, 10));
                  }}
                  placeholder="0"
                />
              </div>

              {/* GPay Option */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '0.95rem', display: 'block', fontWeight: 700, color: '#34a853', marginBottom: '0.4rem' }}>
                  📱 {t('gpay')} (₹)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  className="form-input"
                  style={{ width: '100%', boxSizing: 'border-box', fontWeight: 700, fontSize: '1.25rem', padding: '0.6rem 0.75rem' }}
                  value={gpayAmount === '' || gpayAmount === 0 ? (gpayAmount === '' ? '' : '0') : gpayAmount}
                  onChange={e => {
                    const val = e.target.value.replace(/\D/g, '');
                    setGpayAmount(val === '' ? '' : parseInt(val, 10));
                  }}
                  placeholder="0"
                />
              </div>

              {/* Cheque Option */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '0.95rem', display: 'block', fontWeight: 700, color: 'var(--accent-cyan)', marginBottom: '0.4rem' }}>
                  🏦 {t('cheque')} (₹)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  className="form-input"
                  style={{ width: '100%', boxSizing: 'border-box', fontWeight: 700, fontSize: '1.25rem', padding: '0.6rem 0.75rem' }}
                  value={chequeAmount === '' || chequeAmount === 0 ? (chequeAmount === '' ? '' : '0') : chequeAmount}
                  onChange={e => {
                    const val = e.target.value.replace(/\D/g, '');
                    setChequeAmount(val === '' ? '' : parseInt(val, 10));
                  }}
                  placeholder="0"
                />
              </div>
            </div>

            {/* Optional reference numbers & date */}
            <div style={{ display: 'grid', gridTemplateColumns: Number(gpayAmount) > 0 && Number(chequeAmount) > 0 ? '1fr 1fr 1fr' : (Number(gpayAmount) > 0 || Number(chequeAmount) > 0 ? '1.5fr 1fr' : '1fr'), gap: '0.5rem', marginBottom: '0.75rem' }}>
              {Number(gpayAmount) > 0 && (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: '0.7rem' }}>{t('transaction_id')}</label>
                  <input
                    type="text"
                    className="form-input"
                    style={{ width: '100%', boxSizing: 'border-box', fontSize: '0.8rem' }}
                    value={gpayTxn}
                    onChange={e => setGpayTxn(e.target.value)}
                    placeholder="GPay / UPI Txn No (optional)"
                  />
                </div>
              )}
              {Number(chequeAmount) > 0 && (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: '0.7rem' }}>{t('ref_number')}</label>
                  <input
                    type="text"
                    className="form-input"
                    style={{ width: '100%', boxSizing: 'border-box', fontSize: '0.8rem' }}
                    value={chequeNo}
                    onChange={e => setChequeNo(e.target.value)}
                    placeholder="Cheque No / Bank Ref (optional)"
                  />
                </div>
              )}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '0.7rem' }}>{t('payment_date')}</label>
                <input
                  type="date"
                  className="form-input"
                  style={{ width: '100%', boxSizing: 'border-box', fontSize: '0.8rem' }}
                  value={paymentDate}
                  onChange={e => setPaymentDate(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Summary / Calculations */}
          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>{lang === 'ta' ? 'நிலுவை தொகை:' : 'Outstanding to Resolve:'}</span>
              <strong style={{ color: 'var(--warning)' }}>₹{outstandingToResolve}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>{lang === 'ta' ? 'வசூலிக்கப்பட்ட மொத்த தொகை:' : 'Total Collected:'}</span>
              <strong style={{ color: 'var(--success)' }}>₹{totalCollected}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', borderTop: '1px dashed var(--border-color)', paddingTop: '0.5rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>{lang === 'ta' ? 'இருப்பு நிலுவை தொகை:' : 'Balance Outstanding:'}</span>
              <strong style={{ color: balanceOutstanding > 0 ? 'var(--danger)' : 'var(--success)' }}>
                ₹{balanceOutstanding}
              </strong>
            </div>
          </div>

          {/* Form Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button 
              type="submit" 
              className="btn btn-primary" 
              style={{ width: '100%', padding: '0.75rem', fontWeight: '700' }}
              disabled={submitting || !selectedShopId}
            >
              ✔ {submitting ? '...' : (lang === 'ta' ? 'வசூலைப் பதிவு செய்' : 'Record Collection')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
