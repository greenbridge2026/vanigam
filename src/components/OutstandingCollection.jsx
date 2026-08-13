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
  const [paymentRows, setPaymentRows] = useState([
    {
      payment_mode: 'cash',
      collected_amount: 0,
      transaction_number: '',
      reference_number: '',
      payment_date: new Date().toISOString().split('T')[0]
    }
  ]);
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

  // Filter shops by route
  const filteredShops = shops.filter(s => {
    if (selectedRouteId !== 'all' && s.route_id !== selectedRouteId) return false;
    return s.status === 'active';
  });

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

  const totalCollected = paymentRows.reduce((sum, row) => sum + Number(row.collected_amount || 0), 0);

  // Total outstanding to resolve (either shop outstanding or specific invoice remaining)
  const outstandingToResolve = targetInvoiceId 
    ? (shopInvoices.find(inv => inv.id === targetInvoiceId)?.remaining_outstanding || 0)
    : (selectedShop ? selectedShop.outstanding_amount : 0);

  const balanceOutstanding = outstandingToResolve - totalCollected;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedShopId) {
      alert('Please select a shop / கடையைத் தேர்ந்தெடுக்கவும்.');
      return;
    }
    if (totalCollected <= 0) {
      alert('Total collected amount must be greater than 0 / வசூலிக்கப்பட்ட தொகை பூஜ்ஜியத்தை விட அதிகமாக இருக்க வேண்டும்.');
      return;
    }

    const invalidRow = paymentRows.find(row => !row.collected_amount || Number(row.collected_amount) <= 0);
    if (invalidRow) {
      alert('Please enter a valid amount for all payment rows / அனைத்து வரிசைகளிலும் சரியான தொகையை உள்ளிடவும்.');
      return;
    }

    setSubmitting(true);
    try {
      // Map rows for submission
      const paymentsToSubmit = paymentRows.map(row => ({
        shop_id: selectedShopId,
        order_id: targetInvoiceId || '',
        collected_amount: Number(row.collected_amount),
        payment_mode: row.payment_mode,
        transaction_number: row.transaction_number,
        reference_number: row.reference_number,
        payment_date: new Date(row.payment_date).toISOString()
      }));

      // Submit payment
      await api.createPayment({ payments: paymentsToSubmit });

      alert(lang === 'ta' ? 'வசூல் வெற்றிகரமாகப் பதிவு செய்யப்பட்டது!' : 'Outstanding collection recorded successfully!');

      // Reset form
      setPaymentRows([
        {
          payment_mode: 'cash',
          collected_amount: 0,
          transaction_number: '',
          reference_number: '',
          payment_date: new Date().toISOString().split('T')[0]
        }
      ]);
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
      if (selectedInvoice && paymentRows.length === 1 && paymentRows[0].collected_amount === 0) {
        // Autofill first row with remaining balance
        const updated = [...paymentRows];
        updated[0].collected_amount = selectedInvoice.remaining_outstanding;
        setPaymentRows(updated);
      }
    }
  };

  if (loading) return <div style={{ color: 'var(--text-muted)', textAlign: 'center' }}>Loading Outstanding Collection...</div>;

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>💵 {t('outstanding_collection')}</h1>
        <p style={{ color: 'var(--text-muted)' }}>
          {lang === 'ta' ? 'கடைகளின் முந்தைய நிலுவைத் தொகைகளை வசூலித்து பற்று வைக்கவும்.' : 'Record partial or full payment collections for general shop outstanding or specific invoices.'}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '1.5rem', alignItems: 'flex-start' }} className="collection-grid">
        
        {/* Left side - shop selector and invoice listing */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="glass-card">
            <h2 style={{ fontSize: '1.15rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
              🎯 {lang === 'ta' ? 'கடை தேர்வு' : 'Select Customer'}
            </h2>

            <div className="form-group" style={{ marginBottom: '0.75rem' }}>
              <label>{lang === 'ta' ? 'வழித்தடம்' : 'Filter Route'}</label>
              <select 
                className="form-select" 
                value={selectedRouteId} 
                onChange={e => {
                  setSelectedRouteId(e.target.value);
                  setSelectedShopId('');
                  setTargetInvoiceId('');
                }}
              >
                <option value="all">{lang === 'ta' ? 'அனைத்து வழித்தடங்கள்' : 'All Routes'}</option>
                {routes.map(r => (
                  <option key={r.id} value={r.id}>{lang === 'ta' ? r.name_ta : r.name_en}</option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: '0.5rem' }}>
              <label>{lang === 'ta' ? 'கடை' : 'Select Shop'}</label>
              <select 
                className="form-select" 
                value={selectedShopId} 
                onChange={e => {
                  setSelectedShopId(e.target.value);
                  setTargetInvoiceId('');
                }}
              >
                <option value="">-- {lang === 'ta' ? 'கடையைத் தேர்ந்தெடுக்கவும்' : 'Choose Shop'} --</option>
                {filteredShops.map(s => (
                  <option key={s.id} value={s.id}>
                    {translateShopName(s, lang)} {s.outstanding_amount > 0 ? `(₹${s.outstanding_amount})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedShop && (
            <div className="glass-card" style={{ borderLeft: '4px solid var(--warning)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1rem' }}>{translateShopName(selectedShop, lang)}</h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Mob: {selectedShop.mobile}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block' }}>Total Outstanding</span>
                  <strong style={{ fontSize: '1.4rem', color: 'var(--warning)' }}>₹{selectedShop.outstanding_amount}</strong>
                </div>
              </div>
            </div>
          )}

          {selectedShopId && (
            <div className="glass-card">
              <h2 style={{ fontSize: '1.15rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                📄 {lang === 'ta' ? 'நிலுவை பில்கள்' : 'Unpaid Invoices'} ({shopInvoices.length})
              </h2>
              {shopInvoices.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', margin: '1rem 0' }}>
                  {lang === 'ta' ? 'நிலுவை பில்கள் எதுவும் இல்லை.' : 'No unpaid invoices found for this shop.'}
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '250px', overflowY: 'auto' }}>
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

          {/* Target application toggle */}
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

          {/* Dynamic Payment Rows */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <label style={{ fontWeight: '700', fontSize: '0.9rem' }}>📬 {t('split_payment')}</label>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={handleAddRow}
                style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
              >
                ➕ {t('add_payment_row')}
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {paymentRows.map((row, index) => {
                const isMetadataRequired = ['gpay', 'bank', 'upi', 'cheque'].includes(row.payment_mode);
                return (
                  <div 
                    key={index} 
                    style={{ 
                      padding: '0.75rem', 
                      background: 'rgba(255,255,255,0.01)', 
                      border: '1px solid var(--border-color)', 
                      borderRadius: 'var(--radius)',
                      position: 'relative'
                    }}
                  >
                    {paymentRows.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveRow(index)}
                        style={{
                          position: 'absolute',
                          top: '0.5rem',
                          right: '0.5rem',
                          background: 'none',
                          border: 'none',
                          color: 'var(--danger)',
                          fontSize: '1rem',
                          cursor: 'pointer'
                        }}
                        title="Remove Row"
                      >
                        ✕
                      </button>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '0.75rem', marginBottom: '0.5rem' }}>
                      <div className="form-group">
                        <label style={{ fontSize: '0.75rem' }}>{t('payment_mode')}</label>
                        <select
                          className="form-select"
                          value={row.payment_mode}
                          onChange={e => handleRowChange(index, 'payment_mode', e.target.value)}
                        >
                          <option value="cash">{t('cash')}</option>
                          <option value="cheque">{t('cheque')}</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label style={{ fontSize: '0.75rem' }}>{lang === 'ta' ? 'தொகை (₹)' : 'Amount (₹)'}</label>
                        <input
                          type="number"
                          className="form-input"
                          value={row.collected_amount || ''}
                          onChange={e => handleRowChange(index, 'collected_amount', Math.max(0, parseInt(e.target.value) || 0))}
                          required
                        />
                      </div>
                    </div>

                    {isMetadataRequired && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginTop: '0.5rem' }}>
                        <div className="form-group">
                          <label style={{ fontSize: '0.7rem' }}>{t('transaction_id')}</label>
                          <input
                            type="text"
                            className="form-input"
                            style={{ fontSize: '0.75rem', padding: '0.3rem' }}
                            value={row.transaction_number || ''}
                            onChange={e => handleRowChange(index, 'transaction_number', e.target.value)}
                            placeholder="TXN ID"
                          />
                        </div>
                        <div className="form-group">
                          <label style={{ fontSize: '0.7rem' }}>{t('ref_number')}</label>
                          <input
                            type="text"
                            className="form-input"
                            style={{ fontSize: '0.75rem', padding: '0.3rem' }}
                            value={row.reference_number || ''}
                            onChange={e => handleRowChange(index, 'reference_number', e.target.value)}
                            placeholder="Ref No"
                          />
                        </div>
                        <div className="form-group">
                          <label style={{ fontSize: '0.7rem' }}>{t('payment_date')}</label>
                          <input
                            type="date"
                            className="form-input"
                            style={{ fontSize: '0.75rem', padding: '0.2rem' }}
                            value={row.payment_date}
                            onChange={e => handleRowChange(index, 'payment_date', e.target.value)}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
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
