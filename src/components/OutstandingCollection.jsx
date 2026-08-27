import React, { useState, useEffect } from 'react';
import api from '../api';
import { translateShopName } from '../translations';
import { calculateOrderPaymentInfo } from '../utils/paymentUtils';

export default function OutstandingCollection({ t, lang }) {
  const [routes, setRoutes] = useState([]);
  const [shops, setShops] = useState([]);
  const [orders, setOrders] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [selectedRouteId, setSelectedRouteId] = useState('all');
  const [selectedShopId, setSelectedShopId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyOutstanding, setOnlyOutstanding] = useState(true);

  const [cashAmount, setCashAmount] = useState(0);
  const [gpayAmount, setGpayAmount] = useState(0);
  const [gpayTxn, setGpayTxn] = useState('');
  const [chequeAmount, setChequeAmount] = useState(0);
  const [chequeNo, setChequeNo] = useState('');
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [allocationTarget, setAllocationTarget] = useState('invoice'); // 'invoice' | 'outstanding'
  const [targetInvoiceId, setTargetInvoiceId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showMobileModal, setShowMobileModal] = useState(false);

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

  // Helper to calculate full outstanding breakdown for a shop (ledger balance + unpaid invoices)
  const getShopOutstandingInfo = (shop) => {
    const rawShopBal = Number(shop.outstanding_amount || 0);

    const invoices = orders
      .filter(o => o.shop_id === shop.id && o.status === 'pending')
      .map(order => {
        const info = calculateOrderPaymentInfo(order, shop, orders, payments);
        return {
          ...order,
          net_amount: info.netAmount,
          total_collected: info.totalPaid,
          remaining_outstanding: info.remainingDue
        };
      })
      .filter(o => o.remaining_outstanding > 0);

    const invoicesSum = invoices.reduce((sum, inv) => sum + inv.remaining_outstanding, 0);

    // General / Ledger Outstanding is shop balance exceeding sales invoices
    const baseOutstanding = Math.max(0, rawShopBal - invoicesSum);
    const totalOutstanding = Math.max(rawShopBal, baseOutstanding + invoicesSum);

    return {
      baseOutstanding,
      invoices,
      invoicesSum,
      totalOutstanding
    };
  };

  const selectedShopInfo = selectedShop ? getShopOutstandingInfo(selectedShop) : null;
  const shopInvoices = selectedShopInfo ? selectedShopInfo.invoices : [];

  // Filter shops for shopwise outstanding list
  const filteredShopsList = shops.map(s => ({
    ...s,
    outstandingInfo: getShopOutstandingInfo(s)
  })).filter(s => {
    if (selectedRouteId !== 'all' && s.route_id !== selectedRouteId) return false;
    if (onlyOutstanding && s.outstandingInfo.totalOutstanding <= 0) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const nameTa = (s.name_ta || '').toLowerCase();
      const nameEn = (s.name_en || s.name || '').toLowerCase();
      const mob = (s.mobile || '');
      if (!nameTa.includes(q) && !nameEn.includes(q) && !mob.includes(q)) return false;
    }
    return true;
  }).sort((a, b) => (b.outstandingInfo.totalOutstanding || 0) - (a.outstandingInfo.totalOutstanding || 0));

  const totalOutstandingSum = filteredShopsList.reduce((sum, s) => sum + (Number(s.outstandingInfo.totalOutstanding) || 0), 0);

  const totalCollected = Number(cashAmount || 0) + Number(gpayAmount || 0) + Number(chequeAmount || 0);

  // Total shop outstanding to resolve (Ledger balance + Unpaid invoices sum)
  const outstandingToResolve = selectedShopInfo ? selectedShopInfo.totalOutstanding : 0;
  const balanceOutstanding = outstandingToResolve - totalCollected;

  const handleSelectShop = (shopId) => {
    setSelectedShopId(shopId);
    setAllocationTarget('invoice');
    setTargetInvoiceId('');
    setCashAmount(0);
    setGpayAmount(0);
    setGpayTxn('');
    setChequeAmount(0);
    setChequeNo('');
    if (window.innerWidth <= 768) {
      setShowMobileModal(true);
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
      const orderIdToPass = allocationTarget === 'outstanding' ? 'LEDGER_ONLY' : (targetInvoiceId || '');
      const paymentsToSubmit = [];

      if (Number(cashAmount) > 0) {
        paymentsToSubmit.push({
          shop_id: selectedShopId,
          order_id: orderIdToPass,
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
          order_id: orderIdToPass,
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
          order_id: orderIdToPass,
          collected_amount: Number(chequeAmount),
          payment_mode: 'cheque',
          transaction_number: '',
          reference_number: chequeNo || `CHQ-${Date.now()}`,
          payment_date: new Date(paymentDate).toISOString()
        });
      }

      await api.createPayment({ payments: paymentsToSubmit });

      const successMsg = allocationTarget === 'outstanding'
        ? (lang === 'ta' ? 'பழைய கடை நிலுவை வசூல் வெற்றிகரமாக பதிவு செய்யப்பட்டது! பில்கள் திறந்தே உள்ளன.' : 'Previous outstanding payment recorded! Open sales invoices remain open.')
        : (lang === 'ta' ? 'வசூல் வெற்றிகரமாகப் பதிவு செய்யப்பட்டது!' : 'Payment collection recorded successfully!');

      alert(successMsg);

      setCashAmount(0);
      setGpayAmount(0);
      setGpayTxn('');
      setChequeAmount(0);
      setChequeNo('');
      setTargetInvoiceId('');

      // Reload dataset
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
      setShowMobileModal(false);
    } catch (err) {
      alert('Error saving payments: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const renderPaymentForm = (isMobileModal = false) => (
    <form onSubmit={handleSubmit} className={isMobileModal ? "" : "glass-card"} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {!isMobileModal && (
        <h2 style={{ fontSize: '1.25rem', color: 'var(--accent-cyan)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>💰 {lang === 'ta' ? 'கட்டண பதிவு' : 'Collect Payment'}</span>
        </h2>
      )}

      {/* Selected Shop Banner */}
      {selectedShop && selectedShopInfo ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ padding: '0.85rem 1rem', background: 'rgba(6, 182, 212, 0.08)', border: '1px solid var(--accent-cyan)', borderRadius: 'var(--radius)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
              <div>
                <span style={{ fontSize: '0.72rem', color: 'var(--accent-cyan)', fontWeight: '700', letterSpacing: '0.5px', textTransform: 'uppercase' }}>SELECTED SHOP</span>
                <strong style={{ fontSize: '1.15rem', display: 'block' }}>{translateShopName(selectedShop, lang)}</strong>
                {selectedShop.mobile && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>📞 {selectedShop.mobile}</span>}
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>Total Shop Outstanding</span>
                <strong style={{ fontSize: '1.4rem', color: 'var(--warning)' }}>₹{selectedShopInfo.totalOutstanding.toLocaleString()}</strong>
              </div>
            </div>

            {/* 3-Column Breakdown Metric Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', borderTop: '1px dashed var(--border-color)', paddingTop: '0.65rem' }}>
              <div style={{ background: 'rgba(6, 182, 212, 0.1)', padding: '0.4rem 0.6rem', borderRadius: '6px', textAlign: 'center' }}>
                <span style={{ fontSize: '0.68rem', color: 'var(--accent-cyan)', fontWeight: '600', display: 'block' }}>📄 {lang === 'ta' ? 'பில் நிலுவை' : 'Invoice Outstanding'}</span>
                <strong style={{ fontSize: '0.95rem', color: 'var(--accent-cyan)' }}>₹{selectedShopInfo.invoicesSum.toLocaleString()}</strong>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block' }}>({shopInvoices.length} {lang === 'ta' ? 'பில்கள்' : 'Bills'})</span>
              </div>

              <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: '0.4rem 0.6rem', borderRadius: '6px', textAlign: 'center' }}>
                <span style={{ fontSize: '0.68rem', color: 'var(--warning)', fontWeight: '600', display: 'block' }}>🏛️ {lang === 'ta' ? 'பழைய நிலுவை' : 'Previous Outstanding'}</span>
                <strong style={{ fontSize: '0.95rem', color: 'var(--warning)' }}>₹{selectedShopInfo.baseOutstanding.toLocaleString()}</strong>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block' }}>({lang === 'ta' ? 'கணக்கு இருப்பு' : 'Ledger Balance'})</span>
              </div>

              <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '0.4rem 0.6rem', borderRadius: '6px', textAlign: 'center' }}>
                <span style={{ fontSize: '0.68rem', color: 'var(--success)', fontWeight: '600', display: 'block' }}>💰 {lang === 'ta' ? 'மொத்த நிலுவை' : 'Total Outstanding'}</span>
                <strong style={{ fontSize: '0.95rem', color: 'var(--success)' }}>₹{selectedShopInfo.totalOutstanding.toLocaleString()}</strong>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block' }}>({lang === 'ta' ? 'செலுத்த வேண்டியது' : 'Combined Total'})</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ padding: '1rem', background: 'rgba(245, 158, 11, 0.08)', border: '1px dashed var(--warning)', borderRadius: 'var(--radius)', textAlign: 'center', color: 'var(--warning)' }}>
          👈 {lang === 'ta' ? 'பட்டியலிலிருந்து கடையைத் தேர்ந்தெடுக்கவும்' : 'Please select a shop from the list on the left to start collecting.'}
        </div>
      )}

      {/* Payment Allocation Target Option Selector */}
      {selectedShop && (
        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
          <label style={{ fontWeight: '700', fontSize: '0.88rem', display: 'block', marginBottom: '0.5rem' }}>
            🎯 {lang === 'ta' ? 'கட்டண நோக்கம் / ஒதுக்கீடு' : 'Payment Purpose / Allocation Target'}
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <button
              type="button"
              className={`language-btn ${allocationTarget === 'invoice' ? 'active' : ''}`}
              style={{
                padding: '0.5rem 0.75rem',
                fontSize: '0.8rem',
                fontWeight: '600',
                borderColor: allocationTarget === 'invoice' ? 'var(--accent-cyan)' : 'var(--border-color)',
                background: allocationTarget === 'invoice' ? 'rgba(6, 182, 212, 0.15)' : 'transparent',
                color: allocationTarget === 'invoice' ? 'var(--accent-cyan)' : 'var(--text-muted)'
              }}
              onClick={() => {
                setAllocationTarget('invoice');
              }}
            >
              📄 {lang === 'ta' ? 'பில் நிலுவை செலுத்த (Invoice Fulfill)' : 'Fulfill Sales Invoice'}
            </button>

            <button
              type="button"
              className={`language-btn ${allocationTarget === 'outstanding' ? 'active' : ''}`}
              style={{
                padding: '0.5rem 0.75rem',
                fontSize: '0.8rem',
                fontWeight: '600',
                borderColor: allocationTarget === 'outstanding' ? 'var(--warning)' : 'var(--border-color)',
                background: allocationTarget === 'outstanding' ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
                color: allocationTarget === 'outstanding' ? 'var(--warning)' : 'var(--text-muted)'
              }}
              onClick={() => {
                setAllocationTarget('outstanding');
                setTargetInvoiceId('');
              }}
            >
              🏛️ {lang === 'ta' ? 'பழைய கடை நிலுவை (Ledger Only)' : 'Previous Outstanding Only'}
            </button>
          </div>

          {/* Sub-selector when Fulfill Invoice is selected */}
          {allocationTarget === 'invoice' && (
            <div className="form-group" style={{ marginBottom: '0.5rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--accent-cyan)' }}>
                {lang === 'ta' ? 'குறிப்பிட்ட பில் தேர்ந்தெடுக்கவும்:' : 'Select Sales Invoice to Pay & Close:'}
              </label>
              <select
                className="form-select"
                style={{ fontSize: '0.85rem' }}
                value={targetInvoiceId}
                onChange={e => {
                  setTargetInvoiceId(e.target.value);
                }}
              >
                <option value="">⚡ Auto (FIFO - Oldest Invoice First)</option>
                {shopInvoices.map(inv => (
                  <option key={inv.id} value={inv.id}>
                    {inv.invoice_number} ({new Date(inv.order_date).toLocaleDateString()}) - Due: ₹{inv.remaining_outstanding.toLocaleString()} (Net: ₹{(inv.net_amount || 0).toLocaleString()})
                  </option>
                ))}
              </select>
              
              {targetInvoiceId ? (
                <div style={{ marginTop: '0.4rem', padding: '0.4rem 0.65rem', background: 'rgba(6, 182, 212, 0.1)', border: '1px solid var(--accent-cyan)', borderRadius: '4px', fontSize: '0.75rem', color: 'var(--accent-cyan)', fontWeight: '600' }}>
                  🎯 Selected Target: Invoice #{shopInvoices.find(inv => inv.id === targetInvoiceId)?.invoice_number} — Amount Due: ₹{shopInvoices.find(inv => inv.id === targetInvoiceId)?.remaining_outstanding.toLocaleString()}
                  <span style={{ display: 'block', fontSize: '0.68rem', fontWeight: 'normal', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Full payment will fulfill & close this invoice and mark its delivery as Completed. Partial payment keeps it Open.
                  </span>
                </div>
              ) : (
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.25rem' }}>
                  {shopInvoices.length > 0 
                    ? 'Payment will apply chronologically to open invoices (FIFO). Only fully paid invoices will close.'
                    : 'No open sales invoices. Payment will reduce shop ledger balance.'}
                </span>
              )}
            </div>
          )}

          {allocationTarget === 'outstanding' && (
            <div style={{ padding: '0.45rem 0.65rem', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: '4px', fontSize: '0.73rem', color: 'var(--warning)' }}>
              🏛️ {lang === 'ta' ? 'இந்த கட்டணம் பழைய கடை நிலுவையை (ரூ. ' + (selectedShopInfo ? selectedShopInfo.baseOutstanding : 0) + ') மட்டுமே குறைக்கும். பில்கள் திறந்தே இருக்கும்.' : 'Payment will clear Previous Shop Outstanding (opening ledger balance of ₹' + (selectedShopInfo ? selectedShopInfo.baseOutstanding.toLocaleString() : 0) + '). Sales invoices will NOT be closed.'}
            </div>
          )}
        </div>
      )}

      {/* Payment Collection Options (Cash, GPay, Cheque) */}
      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
        <label style={{ fontWeight: '700', fontSize: '0.9rem', display: 'block', marginBottom: '0.75rem' }}>
          💰 {t('payment_collection')}
        </label>

        <div className="collection-payment-modes-grid" style={{ display: 'grid', gap: '0.75rem', marginBottom: '0.75rem' }}>
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
          <span style={{ color: 'var(--text-muted)' }}>{lang === 'ta' ? 'மொத்த நிலுவை தொகை:' : 'Total Outstanding Amount:'}</span>
          <strong style={{ color: 'var(--warning)' }}>₹{outstandingToResolve.toLocaleString()}</strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
          <span style={{ color: 'var(--text-muted)' }}>{lang === 'ta' ? 'வசூலிக்கப்பட்ட மொத்த தொகை:' : 'Total Collected:'}</span>
          <strong style={{ color: 'var(--success)' }}>₹{totalCollected.toLocaleString()}</strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', borderTop: '1px dashed var(--border-color)', paddingTop: '0.5rem' }}>
          <span style={{ color: 'var(--text-muted)' }}>{lang === 'ta' ? 'இருப்பு நிலுவை தொகை:' : 'Balance Outstanding:'}</span>
          <strong style={{ color: balanceOutstanding > 0 ? 'var(--danger)' : 'var(--success)' }}>
            ₹{balanceOutstanding.toLocaleString()}
          </strong>
        </div>
      </div>

      {/* Form Actions */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
        {isMobileModal && (
          <button 
            type="button" 
            className="btn btn-secondary" 
            style={{ width: '30%', padding: '0.75rem' }}
            onClick={() => setShowMobileModal(false)}
          >
            ✕ {lang === 'ta' ? 'மூடு' : 'Close'}
          </button>
        )}
        <button 
          type="submit" 
          className="btn btn-primary" 
          style={{ width: isMobileModal ? '70%' : '100%', padding: '0.75rem', fontWeight: '700' }}
          disabled={submitting || !selectedShopId}
        >
          ✔ {submitting ? '...' : (lang === 'ta' ? 'வசூலைப் பதிவு செய்' : 'Record Collection')}
        </button>
      </div>
    </form>
  );

  if (loading) return <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '3rem' }}>Loading Outstanding Collection...</div>;

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>💵 {t('outstanding_collection')}</h1>
        <p style={{ color: 'var(--text-muted)' }}>
          {lang === 'ta' ? 'கடைகளின் மொத்த நிலுவை (முந்தைய நிலுவை + பில் நிலுவை) மற்றும் பில் விவரங்களைப் பார்த்து விரைவாக வசூல் பதிவு செய்யவும்.' : 'View total shopwise outstanding (ledger balance + unpaid invoice amounts) and quickly record payment collections.'}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.35fr 1.65fr', gap: '1.5rem', alignItems: 'flex-start' }} className="collection-grid">
        
        {/* Left side - Interactive Shopwise Outstanding List & Invoice Details */}
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
              <div className="collection-filter-grid" style={{ display: 'grid', gap: '0.75rem' }}>
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.68rem', maxHeight: '380px', overflowY: 'auto', paddingRight: '4px' }}>
                {filteredShopsList.map(s => {
                  const isSelected = selectedShopId === s.id;
                  const routeObj = routes.find(r => r.id === s.route_id);
                  const routeName = routeObj ? (lang === 'ta' ? routeObj.name_ta : routeObj.name_en) : 'Unassigned';
                  
                  const { baseOutstanding, invoices, invoicesSum, totalOutstanding } = s.outstandingInfo;

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

                        {/* Explicit Breakdown Pills: Invoice Amount vs Previous Outstanding */}
                        <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.35rem', flexWrap: 'wrap' }}>
                          {invoicesSum > 0 && (
                            <span style={{ background: 'rgba(6, 182, 212, 0.15)', color: 'var(--accent-cyan)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: '600' }}>
                              📄 {lang === 'ta' ? 'பில் நிலுவை' : 'Invoice Amount'}: ₹{invoicesSum.toLocaleString()} ({invoices.length})
                            </span>
                          )}
                          {baseOutstanding > 0 && (
                            <span style={{ background: 'rgba(245, 158, 11, 0.15)', color: 'var(--warning)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: '600' }}>
                              🏛️ {lang === 'ta' ? 'பழைய நிலுவை' : 'Prev Outstanding'}: ₹{baseOutstanding.toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
                        <div style={{ fontSize: '1.05rem', fontWeight: '800', color: totalOutstanding > 0 ? 'var(--warning)' : 'var(--success)' }}>
                          ₹{totalOutstanding.toLocaleString()}
                        </div>
                        <button
                          type="button"
                          className="btn"
                          style={{
                            padding: '0.2rem 0.55rem',
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

          {/* Detailed Outstanding breakdown card for selected shop */}
          {selectedShop && selectedShopInfo && (
            <div className="glass-card">
              <h2 style={{ fontSize: '1.05rem', marginBottom: '0.75rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>📄 {lang === 'ta' ? 'நிலுவை தொகையின் விவரங்கள்' : 'Outstanding Breakdown'}</span>
                <span style={{ fontSize: '0.75rem', background: 'rgba(245, 158, 11, 0.2)', color: 'var(--warning)', padding: '2px 8px', borderRadius: '10px', fontWeight: 'bold' }}>
                  Total: ₹{selectedShopInfo.totalOutstanding.toLocaleString()}
                </span>
              </h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {/* Ledger balance item if present */}
                {selectedShopInfo.baseOutstanding > 0 && (
                  <div 
                    onClick={() => {
                      setAllocationTarget('outstanding');
                      setTargetInvoiceId('');
                      setCashAmount(selectedShopInfo.baseOutstanding);
                      setGpayAmount(0);
                      setChequeAmount(0);
                    }}
                    style={{ 
                      padding: '0.75rem 0.85rem', 
                      background: allocationTarget === 'outstanding' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(245, 158, 11, 0.05)', 
                      border: allocationTarget === 'outstanding' ? '2px solid var(--warning)' : '1px dashed var(--warning)', 
                      borderRadius: 'var(--radius)', 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: '0.88rem', color: 'var(--warning)', display: 'block' }}>
                        🏛️ {lang === 'ta' ? 'முந்தைய / பழைய கணக்கு நிலுவை' : 'Previous Ledger Outstanding'}
                      </strong>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        Opening Shop Ledger Balance (Does not affect sales invoices)
                      </span>
                    </div>
                    <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.2rem' }}>
                      <div style={{ fontWeight: '800', fontSize: '1.05rem', color: 'var(--warning)' }}>
                        ₹{selectedShopInfo.baseOutstanding.toLocaleString()}
                      </div>
                      <span style={{ fontSize: '0.68rem', background: allocationTarget === 'outstanding' ? 'var(--warning)' : 'rgba(245,158,11,0.2)', color: allocationTarget === 'outstanding' ? '#0f172a' : 'var(--warning)', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>
                        {allocationTarget === 'outstanding' ? '✓ Target Selected' : '⚡ Pay Ledger'}
                      </span>
                    </div>
                  </div>
                )}

                {/* Unpaid Invoices Header */}
                {shopInvoices.length > 0 && (
                  <div style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--accent-cyan)', marginTop: '0.25rem', marginBottom: '-0.25rem' }}>
                    📄 {lang === 'ta' ? 'விற்பனை பில்கள் நிலுவை (' + shopInvoices.length + ' பில்கள்):' : 'Open Sales Invoices (' + shopInvoices.length + ' Unpaid Bills):'}
                  </div>
                )}

                {/* Unpaid Invoices Interactive Cards */}
                {shopInvoices.map(inv => {
                  const isInvTarget = allocationTarget === 'invoice' && targetInvoiceId === inv.id;
                  return (
                    <div 
                      key={inv.id} 
                      onClick={() => {
                        setAllocationTarget('invoice');
                        setTargetInvoiceId(inv.id);
                        setCashAmount(inv.remaining_outstanding);
                        setGpayAmount(0);
                        setChequeAmount(0);
                      }}
                      style={{
                        padding: '0.75rem 0.85rem',
                        background: isInvTarget ? 'rgba(6, 182, 212, 0.12)' : 'rgba(255,255,255,0.02)',
                        border: isInvTarget ? '2px solid var(--accent-cyan)' : '1px solid var(--border-color)',
                        borderRadius: 'var(--radius)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        boxShadow: isInvTarget ? '0 0 8px rgba(6, 182, 212, 0.2)' : 'none'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: '700', fontSize: '0.9rem', color: isInvTarget ? 'var(--accent-cyan)' : 'var(--text-primary)' }}>
                          Invoice #{inv.invoice_number}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                          📅 Date: {new Date(inv.order_date).toLocaleDateString()}
                        </div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                          Bill Total: ₹{(inv.net_amount || 0).toLocaleString()} | Paid: ₹{(inv.total_collected || 0).toLocaleString()}
                        </div>
                      </div>

                      <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
                        <div style={{ fontWeight: '800', fontSize: '1.05rem', color: 'var(--danger)' }}>
                          ₹{inv.remaining_outstanding.toLocaleString()} <span style={{ fontSize: '0.7rem', fontWeight: 'normal', color: 'var(--text-muted)' }}>Due</span>
                        </div>
                        <button
                          type="button"
                          className="btn"
                          style={{
                            padding: '0.2rem 0.6rem',
                            fontSize: '0.72rem',
                            fontWeight: '700',
                            background: isInvTarget ? 'var(--accent-cyan)' : 'rgba(6, 182, 212, 0.15)',
                            color: isInvTarget ? '#0f172a' : 'var(--accent-cyan)',
                            border: 'none',
                            borderRadius: '4px'
                          }}
                        >
                          {isInvTarget ? '✓ Selected to Fulfill' : '⚡ Select & Pay Invoice'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>

        {/* Right side - Payment Entry Form (Desktop View) */}
        <div className="collection-payment-panel-desktop">
          {renderPaymentForm(false)}
        </div>

      </div>

      {/* Mobile Popup Modal for Payment Entry */}
      {showMobileModal && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="glass-card modal-card" style={{ maxWidth: '500px', width: '95%', margin: 'auto', maxHeight: '90vh', overflowY: 'auto', padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
              <h2 style={{ fontSize: '1.2rem', margin: 0, color: 'var(--accent-cyan)' }}>
                💰 {lang === 'ta' ? 'கட்டண பதிவு' : 'Collect Payment'}
              </h2>
              <button 
                type="button" 
                onClick={() => setShowMobileModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.5rem', cursor: 'pointer', lineHeight: 1 }}
              >
                ✕
              </button>
            </div>
            {renderPaymentForm(true)}
          </div>
        </div>
      )}
    </div>
  );
}
