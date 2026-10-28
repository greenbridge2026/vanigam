import React, { useState, useEffect } from 'react';
import api from '../api';
import html2pdf from 'html2pdf.js';
import { translateProductName } from '../translations';

export default function RoughBill({ t, lang, onBack }) {
  const [products, setProducts] = useState([]);
  const [settings, setSettings] = useState({
    company_name: "GSK Agency",
    company_address: "Cooldrinks Shop - Tindivanam",
    company_gst: "33CWRPK4071L1Z2",
    company_phone: "9345463415",
    upi_mobile: "gskumar9345@okicici"
  });

  // Rough bills list for history
  const [roughBillsList, setRoughBillsList] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [viewMode, setViewMode] = useState('edit'); // 'edit' or 'print'

  // Bill header fields
  const [billNumber, setBillNumber] = useState('');
  const [billDate, setBillDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [customerName, setCustomerName] = useState('General Customer');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('Walk-in Counter');
  const [customerGst, setCustomerGst] = useState('');
  const [paymentMode, setPaymentMode] = useState('Cash');

  // Items in bill
  const [items, setItems] = useState([]);
  const [discount, setDiscount] = useState(0);
  const [manualFinalAmount, setManualFinalAmount] = useState('');
  const [isFinalAmountOverridden, setIsFinalAmountOverridden] = useState(false);

  // Quick product search & selector
  const [selectedProductId, setSelectedProductId] = useState('');
  const [catalogSearch, setCatalogSearch] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('all');

  // Load products and settings on mount
  useEffect(() => {
    async function loadInitial() {
      try {
        const [prodData, settData, billsData] = await Promise.all([
          api.getProducts(),
          api.getSettings(),
          api.getRoughBills()
        ]);
        if (prodData) setProducts(prodData);
        if (settData) setSettings(settData);
        if (billsData) {
          setRoughBillsList(billsData);
          setBillNumber(`RB-${1001 + (billsData.length || 0)}`);
        } else {
          setBillNumber(`RB-${1001}`);
        }
      } catch (err) {
        console.error('Error loading rough bill datasets:', err);
      }
    }
    loadInitial();
  }, []);

  // Quick add product
  const handleAddProduct = (prod) => {
    if (!prod) return;
    const existingIndex = items.findIndex(it => it.product_id === prod.id);
    if (existingIndex >= 0) {
      // Increment cases by 1
      const updated = [...items];
      updated[existingIndex].cases = Number(updated[existingIndex].cases || 0) + 1;
      calculateItemTotals(updated[existingIndex]);
      setItems(updated);
    } else {
      const caseQty = Number(prod.case_qty_rule || 24);
      const rate = Number(prod.wholesale_price || prod.retail_price || prod.price_per_case || 0);
      // Rough bill: GST should not be reflected for products from product management
      const displayName = lang === 'ta' ? (prod.name_ta || prod.name_en || prod.name) : (prod.name_en || prod.name_ta || prod.name);
      const newItem = {
        id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        product_id: prod.id,
        product_name: displayName,
        size: prod.size || '',
        case_qty_rule: caseQty,
        cases: 1,
        bottles: 0,
        rate: rate,
        gst_rate: 0,
        taxable_amount: 0,
        cgst_amount: 0,
        sgst_amount: 0,
        total_amount: 0
      };
      calculateItemTotals(newItem);
      setItems([...items, newItem]);
    }
    setSelectedProductId('');
  };

  // Add custom unlisted item
  const handleAddCustomItem = () => {
    const newItem = {
      id: `custom_${Date.now()}`,
      product_id: null,
      product_name: 'Custom Product',
      size: '',
      case_qty_rule: 24,
      cases: 1,
      bottles: 0,
      rate: 100,
      gst_rate: 0,
      taxable_amount: 100,
      cgst_amount: 0,
      sgst_amount: 0,
      total_amount: 100
    };
    calculateItemTotals(newItem);
    setItems([...items, newItem]);
  };

  // Recalculate item totals
  const calculateItemTotals = (item) => {
    const cases = Number(item.cases) || 0;
    const bottles = Number(item.bottles) || 0;
    const rate = Number(item.rate) || 0;
    const rule = Number(item.case_qty_rule) || 24;
    const gstRate = Number(item.gst_rate) || 0;

    // Rate is price per case (including GST by standard)
    const totalCasesEquivalent = cases + (bottles / rule);
    const grossItemTotal = totalCasesEquivalent * rate;

    // GST split
    let taxable = grossItemTotal;
    let cgst = 0;
    let sgst = 0;

    if (gstRate > 0) {
      taxable = grossItemTotal / (1 + gstRate / 100);
      const totalGst = grossItemTotal - taxable;
      cgst = totalGst / 2;
      sgst = totalGst / 2;
    }

    item.taxable_amount = Number(taxable.toFixed(2));
    item.cgst_amount = Number(cgst.toFixed(2));
    item.sgst_amount = Number(sgst.toFixed(2));
    item.total_amount = Number(grossItemTotal.toFixed(2));
  };

  // Handle line item field changes
  const handleItemChange = (index, field, value) => {
    const updated = [...items];
    const target = updated[index];
    target[field] = value;

    if (['cases', 'bottles', 'rate', 'gst_rate'].includes(field)) {
      calculateItemTotals(target);
    } else if (field === 'total_amount') {
      // If user overrides total amount directly, derive taxable
      const gross = Number(value) || 0;
      const gstRate = Number(target.gst_rate) || 0;
      let taxable = gross;
      let cgst = 0;
      let sgst = 0;
      if (gstRate > 0) {
        taxable = gross / (1 + gstRate / 100);
        const totalGst = gross - taxable;
        cgst = totalGst / 2;
        sgst = totalGst / 2;
      }
      target.taxable_amount = Number(taxable.toFixed(2));
      target.cgst_amount = Number(cgst.toFixed(2));
      target.sgst_amount = Number(sgst.toFixed(2));
      target.total_amount = Number(gross.toFixed(2));
    }

    setItems(updated);
  };

  const handleRemoveItem = (index) => {
    const updated = items.filter((_, idx) => idx !== index);
    setItems(updated);
  };

  // Financial aggregates
  const totalCases = items.reduce((sum, it) => sum + (Number(it.cases) || 0), 0);
  const totalBottles = items.reduce((sum, it) => sum + (Number(it.bottles) || 0), 0);
  const calculatedTaxable = items.reduce((sum, it) => sum + (Number(it.taxable_amount) || 0), 0);
  const calculatedCgst = items.reduce((sum, it) => sum + (Number(it.cgst_amount) || 0), 0);
  const calculatedSgst = items.reduce((sum, it) => sum + (Number(it.sgst_amount) || 0), 0);
  const calculatedTotal = items.reduce((sum, it) => sum + (Number(it.total_amount) || 0), 0);
  const calculatedNet = Math.max(0, calculatedTotal - (Number(discount) || 0));
  const hasGst = (calculatedCgst + calculatedSgst) > 0;

  const finalBillAmount = isFinalAmountOverridden && manualFinalAmount !== ''
    ? Number(manualFinalAmount)
    : Number(calculatedNet.toFixed(2));

  // Clear / Reset form
  const handleResetForm = () => {
    let maxNum = 1000;
    (roughBillsList || []).forEach(b => {
      const match = String(b.bill_number || '').match(/RB-(\d+)/i);
      if (match) {
        const n = parseInt(match[1], 10);
        if (!isNaN(n) && n > maxNum) maxNum = n;
      }
    });
    setBillNumber(`RB-${maxNum + 1}`);
    setBillDate(new Date().toISOString().split('T')[0]);
    setCustomerName('General Customer');
    setCustomerPhone('');
    setCustomerAddress('Walk-in Counter');
    setItems([]);
    setDiscount(0);
    setManualFinalAmount('');
    setIsFinalAmountOverridden(false);
    setViewMode('edit');
    setShowHistory(false);
  };

  // Save rough bill
  const handleSaveBill = async () => {
    if (items.length === 0) {
      alert(lang === 'ta' ? 'தயவுசெய்து குறைந்தது ஒரு பொருளைச் சேர்க்கவும்' : 'Please add at least one product item');
      return;
    }

    const payload = {
      bill_number: billNumber,
      bill_date: billDate,
      customer_name: customerName || 'General Customer',
      customer_phone: customerPhone,
      customer_address: customerAddress,
      customer_gst: customerGst,
      route_name: 'Walk-in / நேரடி விற்பனை',
      salesman_name: 'Counter Sales',
      items: items,
      discount: Number(discount) || 0,
      taxable_amount: Number(calculatedTaxable.toFixed(2)),
      total_cgst: Number(calculatedCgst.toFixed(2)),
      total_sgst: Number(calculatedSgst.toFixed(2)),
      total_amount: Number(calculatedTotal.toFixed(2)),
      final_amount: finalBillAmount,
      payment_mode: paymentMode
    };

    try {
      const saved = await api.saveRoughBill(payload);
      setRoughBillsList([saved, ...roughBillsList]);
      return saved;
    } catch (e) {
      console.error('Failed to save rough bill:', e);
    }
  };

  // Go to Print View
  const handleProceedToPrint = async () => {
    if (items.length === 0) {
      alert(lang === 'ta' ? 'தயவுசெய்து குறைந்தது ஒரு பொருளைச் சேர்க்கவும்' : 'Please add at least one product item before printing');
      return;
    }
    await handleSaveBill();
    setViewMode('print');
  };

  const handleTriggerPrint = () => {
    window.print();
  };

  const handleDownloadPDF = () => {
    const element = document.getElementById('printable-invoice');
    if (!element) return;
    const opt = {
      margin:       0.3,
      filename:     `Rough_Bill_${billNumber}_${(customerName || 'General_Customer').replace(/\s+/g, '_')}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true, letterRendering: true },
      jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(element).save();
  };

  // Filtered products for quick add
  const filteredProducts = products.filter(p => {
    const pName = ((p.name_en || '') + ' ' + (p.name_ta || '') + ' ' + (p.name || '')).toLowerCase();
    const pBrand = (p.brand || '').toLowerCase();
    const query = (catalogSearch || '').toLowerCase();
    const matchesSearch = !query || pName.includes(query) || pBrand.includes(query);
    const matchesBrand = selectedBrand === 'all' || p.brand === selectedBrand;
    return matchesSearch && matchesBrand;
  });

  const uniqueBrands = ['all', ...new Set(products.map(p => p.brand).filter(Boolean))];

  // UPI QR parameters
  const upiVpa = (settings?.upi_mobile && settings.upi_mobile.includes('@')) 
    ? settings.upi_mobile 
    : 'gskumar9345@okicici';
  const upiName = 'Kumar .k';
  const formattedAmount = Number(finalBillAmount > 0 ? finalBillAmount : 0).toFixed(2);
  const upiUri = `upi://pay?pa=${upiVpa}&pn=${encodeURIComponent(upiName)}&am=${formattedAmount}&mam=1.00&cu=INR&tn=${encodeURIComponent(billNumber || 'Rough Bill')}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(upiUri)}`;

  return (
    <div className="rough-bill-container" style={{ paddingBottom: '3rem' }}>
      
      {/* Top Header & Navigation Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }} className="no-print">
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '800', margin: '0 0 0.25rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>🧾</span> {lang === 'ta' ? 'ரஃப் பில் (நேரடி வாடிக்கையாளர்)' : 'Rough Bill (Walk-in Quick Billing)'}
          </h1>
          <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.9rem' }}>
            {lang === 'ta' 
              ? 'சரக்கு கையிருப்பு அல்லது அறிக்கைகளை மாற்றாமல் நேரடி வாடிக்கையாளர்களுக்கு உடனடி ரஃப் பில் உருவாக்கவும்' 
              : 'Quick temporary billing for walk-in customers. Does not reduce inventory or affect regular sales/GST reports.'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button 
            type="button" 
            className={`btn ${showHistory ? 'btn-primary' : 'btn-secondary'}`} 
            onClick={() => setShowHistory(!showHistory)}
            style={{ fontSize: '0.85rem' }}
          >
            📜 {showHistory ? (lang === 'ta' ? 'பில் உருவாக்குதலுக்கு திரும்பு' : 'Back to Billing') : (lang === 'ta' ? 'முந்தைய ரஃப் பில்கள்' : 'Past Rough Bills')}
          </button>
          
          <button 
            type="button" 
            className="btn btn-secondary" 
            onClick={handleResetForm}
            style={{ fontSize: '0.85rem' }}
          >
            🔄 {lang === 'ta' ? 'புதிய பில்' : 'New Bill'}
          </button>
        </div>
      </div>

      {/* Past Rough Bills History Modal / Panel */}
      {showHistory && (
        <div className="glass-card no-print" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: '700', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
            📜 {lang === 'ta' ? 'முந்தைய ரஃப் பில் வரலாறு' : 'Recent Rough Bills History'}
          </h2>
          {roughBillsList.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>
              {lang === 'ta' ? 'முந்தைய ரஃப் பில்கள் எதுவும் இல்லை' : 'No rough bills generated yet.'}
            </p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="custom-table" style={{ width: '100%', fontSize: '0.85rem' }}>
                <thead>
                  <tr>
                    <th>{lang === 'ta' ? 'பில் எண்' : 'Bill No'}</th>
                    <th>{lang === 'ta' ? 'தேதி' : 'Date'}</th>
                    <th>{lang === 'ta' ? 'வாடிக்கையாளர்' : 'Customer Name'}</th>
                    <th>{lang === 'ta' ? 'பொருட்கள்' : 'Items'}</th>
                    <th style={{ textAlign: 'right' }}>{lang === 'ta' ? 'தொகை' : 'Final Amount'}</th>
                    <th>{lang === 'ta' ? 'கட்டணம்' : 'Payment'}</th>
                    <th style={{ textAlign: 'center' }}>{lang === 'ta' ? 'செயல்பாடு' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody>
                  {roughBillsList.map(b => (
                    <tr key={b.id}>
                      <td style={{ fontWeight: '800' }}>{b.bill_number}</td>
                      <td>{new Date(b.bill_date).toLocaleDateString('en-GB')}</td>
                      <td style={{ fontWeight: '700' }}>{b.customer_name}</td>
                      <td>{b.items ? b.items.length : 0} items</td>
                      <td style={{ textAlign: 'right', fontWeight: '800', color: 'var(--accent-cyan)' }}>₹{b.final_amount}</td>
                      <td>{b.payment_mode || 'Cash'}</td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '2px 8px', fontSize: '0.75rem' }}
                            onClick={() => {
                              setBillNumber(b.bill_number);
                              setBillDate(b.bill_date ? b.bill_date.split('T')[0] : new Date().toISOString().split('T')[0]);
                              setCustomerName(b.customer_name || 'General Customer');
                              setCustomerPhone(b.customer_phone || '');
                              setCustomerAddress(b.customer_address || 'Walk-in Counter');
                              setCustomerGst(b.customer_gst || '');
                              setItems(b.items || []);
                              setDiscount(b.discount || 0);
                              setManualFinalAmount(b.final_amount || '');
                              setIsFinalAmountOverridden(true);
                              setViewMode('print');
                              setShowHistory(false);
                            }}
                          >
                            🖨️ {lang === 'ta' ? 'பார் / அச்சிடு' : 'View / Print'}
                          </button>
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '2px 8px', fontSize: '0.75rem', color: 'var(--danger)' }}
                            onClick={async () => {
                              if (window.confirm(lang === 'ta' ? 'இந்த ரஃப் பில்லை நீக்க விரும்புகிறீர்களா?' : 'Delete this rough bill record?')) {
                                await api.deleteRoughBill(b.id);
                                setRoughBillsList(roughBillsList.filter(rb => rb.id !== b.id));
                              }
                            }}
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* VIEW MODE: EDITING BILL */}
      {viewMode === 'edit' && !showHistory && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1fr) 340px', gap: '1.5rem', alignItems: 'start' }} className="no-print">
          
          {/* Main Editing Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            {/* Customer Header Details Card */}
            <div className="glass-card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>👤</span> {lang === 'ta' ? 'வாடிக்கையாளர் & பில் தகவல்கள்' : 'Customer & Bill Information'}
                </h3>
                <span style={{ fontSize: '0.8rem', padding: '2px 8px', background: 'rgba(234, 179, 8, 0.15)', color: '#eab308', borderRadius: '4px', fontWeight: '700' }}>
                  Temporary Walk-in
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                {/* Customer Name Field */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.35rem', color: 'var(--text-muted)' }}>
                    {lang === 'ta' ? 'வாடிக்கையாளர் பெயர் * (திருத்தக்கூடியது)' : 'Customer Name * (Editable)'}
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="General Customer"
                    style={{
                      width: '100%',
                      padding: '0.55rem 0.75rem',
                      borderRadius: '6px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1.5px solid var(--accent-cyan)',
                      color: 'var(--text-main)',
                      fontSize: '0.95rem',
                      fontWeight: '700'
                    }}
                  />
                  <small style={{ color: 'var(--accent-cyan)', fontSize: '0.72rem', display: 'block', marginTop: '3px' }}>
                    💡 {lang === 'ta' ? 'பில் அச்சிடுவதற்கு முன் இந்த பெயரை மாற்றிக்கொள்ளலாம்' : 'Defaults to General Customer, edit as needed'}
                  </small>
                </div>

                {/* Bill Number */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.35rem', color: 'var(--text-muted)' }}>
                    {lang === 'ta' ? 'பில் எண்' : 'Rough Bill No'}
                  </label>
                  <input
                    type="text"
                    value={billNumber}
                    onChange={(e) => setBillNumber(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.55rem 0.75rem',
                      borderRadius: '6px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-main)',
                      fontSize: '0.95rem'
                    }}
                  />
                </div>

                {/* Date */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.35rem', color: 'var(--text-muted)' }}>
                    {lang === 'ta' ? 'பில் தேதி' : 'Bill Date'}
                  </label>
                  <input
                    type="date"
                    value={billDate}
                    onChange={(e) => setBillDate(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.55rem 0.75rem',
                      borderRadius: '6px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-main)',
                      fontSize: '0.95rem'
                    }}
                  />
                </div>

                {/* Mobile Number */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.35rem', color: 'var(--text-muted)' }}>
                    {lang === 'ta' ? 'மொபைல் எண் (விருப்பத்தேர்வு)' : 'Customer Mobile (Optional)'}
                  </label>
                  <input
                    type="text"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="e.g. 9876543210"
                    style={{
                      width: '100%',
                      padding: '0.55rem 0.75rem',
                      borderRadius: '6px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-main)',
                      fontSize: '0.95rem'
                    }}
                  />
                </div>

                {/* Customer GST Number Field */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.35rem', color: 'var(--text-muted)' }}>
                    {lang === 'ta' ? 'ஜிஎஸ்டி எண் (விருப்பத்தேர்வு)' : 'Customer GST No (Optional)'}
                  </label>
                  <input
                    type="text"
                    value={customerGst}
                    onChange={(e) => setCustomerGst(e.target.value.toUpperCase())}
                    placeholder="e.g. 33AAAAA0000A1Z5"
                    style={{
                      width: '100%',
                      padding: '0.55rem 0.75rem',
                      borderRadius: '6px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-main)',
                      fontSize: '0.95rem',
                      textTransform: 'uppercase'
                    }}
                  />
                  <small style={{ color: 'var(--text-muted)', fontSize: '0.72rem', display: 'block', marginTop: '3px' }}>
                    {lang === 'ta' ? 'வாடிக்கையாளரின் ஜிஎஸ்டி எண்' : 'Walk-in customer GSTIN for bill'}
                  </small>
                </div>
              </div>
            </div>

            {/* Editable Bill Items Table Card */}
            <div className="glass-card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800' }}>
                    📦 {lang === 'ta' ? 'பில் பொருட்கள் (நேரடி விலை & அளவு மாற்றம்)' : 'Bill Items (Editable Prices & Quantities)'}
                  </h3>
                  <p style={{ margin: '2px 0 0 0', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                    {lang === 'ta' ? 'சரக்கு மேலாண்மையிலிருந்து பொருட்களைத் தேர்ந்தெடுத்து விலை & அளவை மாற்றலாம்' : 'Select products from Product Management, or edit price per case, cases, bottles, rate, and GST rate as desired'}
                  </p>
                </div>
              </div>

              {/* Product Management Quick Selector Bar */}
              <div style={{
                display: 'flex',
                gap: '0.75rem',
                alignItems: 'center',
                flexWrap: 'wrap',
                marginBottom: '1rem',
                padding: '0.75rem 1rem',
                background: 'rgba(6, 182, 212, 0.06)',
                borderRadius: '8px',
                border: '1.5px solid var(--accent-cyan)'
              }}>
                <div style={{ flex: 1, minWidth: '280px' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '800', marginBottom: '0.35rem', color: 'var(--accent-cyan)' }}>
                    📦 {lang === 'ta' ? 'தயாரிப்பு மேலாண்மையிலிருந்து பொருள் சேர்க்கவும்:' : 'Add Product from Product Management:'}
                  </label>
                  <select
                    className="form-select"
                    value={selectedProductId}
                    onChange={(e) => {
                      const pId = e.target.value;
                      if (!pId) return;
                      const prod = products.find(p => p.id === pId);
                      if (prod) handleAddProduct(prod);
                    }}
                    style={{
                      width: '100%',
                      padding: '0.55rem 0.75rem',
                      borderRadius: '6px',
                      background: '#ffffff',
                      color: '#0f172a',
                      fontWeight: '700',
                      fontSize: '0.9rem',
                      border: '1.5px solid var(--accent-cyan)'
                    }}
                  >
                    <option value="">{lang === 'ta' ? '-- தயாரிப்பைத் தேர்ந்தெடுக்கவும் (Product Management) --' : '-- Choose Product from Product Management --'}</option>
                    {products.map(p => {
                      const pName = lang === 'ta' ? (p.name_ta || p.name_en || p.name) : (p.name_en || p.name_ta || p.name);
                      const pRate = p.wholesale_price || p.retail_price || 0;
                      return (
                        <option key={p.id} value={p.id}>
                          {pName} {p.size ? `(${p.size})` : ''} — Rate: ₹{pRate}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div style={{ alignSelf: 'flex-end' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleAddCustomItem}
                    style={{ fontSize: '0.85rem', padding: '0.55rem 0.85rem', whiteSpace: 'nowrap' }}
                  >
                    ➕ {lang === 'ta' ? '+ தனிப்பயன் பொருள்' : '+ Add Custom Product'}
                  </button>
                </div>
              </div>

              {items.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2.5rem 1rem', border: '1.5px dashed var(--border-color)', borderRadius: '8px' }}>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', margin: '0 0 0.75rem 0' }}>
                    {lang === 'ta' ? 'பில்லில் பொருட்கள் எதுவும் இல்லை. மேலே உள்ள பட்டியலில் இருந்து தயாரிப்பைத் தேர்ந்தெடுக்கவும்.' : 'No items added yet. Select a product from Product Management above or add a custom product.'}
                  </p>
                  <button type="button" className="btn btn-primary" onClick={handleAddCustomItem} style={{ fontSize: '0.85rem' }}>
                    ➕ {lang === 'ta' ? 'பொருள் சேர்க்கவும்' : 'Add First Item'}
                  </button>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--border-color)', color: 'var(--text-muted)', textAlign: 'left' }}>
                        <th style={{ padding: '6px 4px', width: '30px' }}>#</th>
                        <th style={{ padding: '6px 6px', minWidth: '170px' }}>{lang === 'ta' ? 'பொருள் பெயர்' : 'Product Name'}</th>
                        <th style={{ padding: '6px 6px', width: '70px' }}>{lang === 'ta' ? 'அளவு' : 'Size'}</th>
                        <th style={{ padding: '6px 6px', width: '65px', textAlign: 'center' }}>{lang === 'ta' ? 'பெட்டி' : 'Cases'}</th>
                        <th style={{ padding: '6px 6px', width: '65px', textAlign: 'center' }}>{lang === 'ta' ? 'பாட்டில்' : 'Bottles'}</th>
                        <th style={{ padding: '6px 6px', width: '80px', textAlign: 'right' }}>{lang === 'ta' ? 'விலை (₹)' : 'Rate (₹)'}</th>
                        <th style={{ padding: '6px 6px', width: '75px', textAlign: 'center' }}>GST %</th>
                        <th style={{ padding: '6px 6px', width: '85px', textAlign: 'right' }}>{lang === 'ta' ? 'மொத்தம் (₹)' : 'Total (₹)'}</th>
                        <th style={{ padding: '6px 4px', width: '40px', textAlign: 'center' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, idx) => (
                        <tr key={item.id || idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '6px 4px', color: 'var(--text-muted)', fontWeight: '700' }}>{idx + 1}</td>
                          
                          {/* Product Name Input & Selector */}
                          <td style={{ padding: '6px 4px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                              <select
                                className="form-select"
                                value={item.product_id || ''}
                                onChange={(e) => {
                                  const pId = e.target.value;
                                  if (pId) {
                                    const p = products.find(prod => prod.id === pId);
                                    if (p) {
                                      const pName = lang === 'ta' ? (p.name_ta || p.name_en || p.name) : (p.name_en || p.name_ta || p.name);
                                      const updated = [...items];
                                      updated[idx].product_id = p.id;
                                      updated[idx].product_name = pName;
                                      updated[idx].size = p.size || '';
                                      updated[idx].case_qty_rule = Number(p.case_qty_rule || 24);
                                      updated[idx].rate = Number(p.wholesale_price || p.retail_price || 0);
                                      updated[idx].gst_rate = 0;
                                      calculateItemTotals(updated[idx]);
                                      setItems(updated);
                                    }
                                  } else {
                                    const updated = [...items];
                                    updated[idx].product_id = null;
                                    setItems(updated);
                                  }
                                }}
                                style={{
                                  fontSize: '0.74rem',
                                  padding: '2px 4px',
                                  borderRadius: '3px',
                                  background: 'rgba(255, 255, 255, 0.08)',
                                  color: 'var(--accent-cyan)',
                                  border: '1px solid var(--border-color)',
                                  width: '100%'
                                }}
                              >
                                <option value="">{item.product_id ? '🔄 Switch Product...' : '✍️ Custom / Unlisted'}</option>
                                {products.map(p => {
                                  const pName = lang === 'ta' ? (p.name_ta || p.name_en || p.name) : (p.name_en || p.name_ta || p.name);
                                  return (
                                    <option key={p.id} value={p.id}>
                                      {pName} {p.size ? `(${p.size})` : ''} - ₹{p.wholesale_price || p.retail_price || 0}
                                    </option>
                                  );
                                })}
                              </select>
                              <input
                                type="text"
                                value={item.product_name}
                                onChange={(e) => handleItemChange(idx, 'product_name', e.target.value)}
                                style={{
                                  width: '100%',
                                  padding: '4px 6px',
                                  borderRadius: '4px',
                                  background: 'rgba(255, 255, 255, 0.05)',
                                  border: '1px solid var(--border-color)',
                                  color: 'var(--text-main)',
                                  fontWeight: '700',
                                  fontSize: '0.85rem'
                                }}
                              />
                            </div>
                          </td>

                          {/* Size Input */}
                          <td style={{ padding: '6px 4px' }}>
                            <input
                              type="text"
                              value={item.size || ''}
                              onChange={(e) => handleItemChange(idx, 'size', e.target.value)}
                              placeholder="Size"
                              style={{
                                width: '100%',
                                padding: '4px 6px',
                                borderRadius: '4px',
                                background: 'rgba(255, 255, 255, 0.05)',
                                border: '1px solid var(--border-color)',
                                color: 'var(--text-main)',
                                fontSize: '0.8rem',
                                textAlign: 'center'
                              }}
                            />
                          </td>

                          {/* Cases Input */}
                          <td style={{ padding: '6px 4px' }}>
                            <input
                              type="number"
                              min="0"
                              value={item.cases}
                              onChange={(e) => handleItemChange(idx, 'cases', e.target.value)}
                              style={{
                                width: '100%',
                                padding: '4px 6px',
                                borderRadius: '4px',
                                background: 'rgba(255, 255, 255, 0.05)',
                                border: '1px solid var(--border-color)',
                                color: 'var(--text-main)',
                                fontWeight: '700',
                                fontSize: '0.85rem',
                                textAlign: 'center'
                              }}
                            />
                          </td>

                          {/* Bottles Input */}
                          <td style={{ padding: '6px 4px' }}>
                            <input
                              type="number"
                              min="0"
                              value={item.bottles}
                              onChange={(e) => handleItemChange(idx, 'bottles', e.target.value)}
                              style={{
                                width: '100%',
                                padding: '4px 6px',
                                borderRadius: '4px',
                                background: 'rgba(255, 255, 255, 0.05)',
                                border: '1px solid var(--border-color)',
                                color: 'var(--text-main)',
                                fontWeight: '700',
                                fontSize: '0.85rem',
                                textAlign: 'center'
                              }}
                            />
                          </td>

                          {/* Rate Input */}
                          <td style={{ padding: '6px 4px' }}>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={item.rate}
                              onChange={(e) => handleItemChange(idx, 'rate', e.target.value)}
                              style={{
                                width: '100%',
                                padding: '4px 6px',
                                borderRadius: '4px',
                                background: 'rgba(255, 255, 255, 0.05)',
                                border: '1px solid var(--border-color)',
                                color: 'var(--accent-cyan)',
                                fontWeight: '800',
                                fontSize: '0.85rem',
                                textAlign: 'right'
                              }}
                            />
                          </td>

                          {/* GST Rate Select */}
                          <td style={{ padding: '6px 4px' }}>
                            <select
                              value={item.gst_rate}
                              onChange={(e) => handleItemChange(idx, 'gst_rate', Number(e.target.value))}
                              style={{
                                width: '100%',
                                padding: '4px 2px',
                                borderRadius: '4px',
                                background: 'rgba(255, 255, 255, 0.05)',
                                border: '1px solid var(--border-color)',
                                color: 'var(--text-main)',
                                fontSize: '0.8rem',
                                textAlign: 'center'
                              }}
                            >
                              <option value="0">0%</option>
                              <option value="5">5%</option>
                              <option value="12">12%</option>
                              <option value="18">18%</option>
                              <option value="28">28%</option>
                              <option value="40">40%</option>
                            </select>
                          </td>

                          {/* Editable Total Amount */}
                          <td style={{ padding: '6px 4px' }}>
                            <input
                              type="number"
                              step="0.01"
                              value={item.total_amount}
                              onChange={(e) => handleItemChange(idx, 'total_amount', e.target.value)}
                              style={{
                                width: '100%',
                                padding: '4px 6px',
                                borderRadius: '4px',
                                background: 'rgba(255, 255, 255, 0.05)',
                                border: '1px solid var(--border-color)',
                                color: 'var(--text-main)',
                                fontWeight: '800',
                                fontSize: '0.85rem',
                                textAlign: 'right'
                              }}
                            />
                          </td>

                          {/* Delete Item */}
                          <td style={{ padding: '6px 4px', textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--danger)',
                                cursor: 'pointer',
                                fontSize: '1rem',
                                padding: '2px 4px'
                              }}
                              title="Remove item"
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>

          {/* Right Sidebar: Quick Product Catalog & Bill Totals */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            {/* Bill Summary & Final Amount Controls */}
            <div className="glass-card" style={{ padding: '1.25rem' }}>
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', fontWeight: '800', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                💰 {lang === 'ta' ? 'தொகை சுருக்கம்' : 'Bill Summary'}
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.88rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>{lang === 'ta' ? 'மொத்த சரக்கு:' : 'Total Qty:'}</span>
                  <strong>{totalCases} cases, {totalBottles} bottles</strong>
                </div>

                {hasGst && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>{lang === 'ta' ? 'வரித்தொகை:' : 'Taxable Amount:'}</span>
                      <strong>₹{calculatedTaxable.toFixed(2)}</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>CGST + SGST:</span>
                      <strong>₹{(calculatedCgst + calculatedSgst).toFixed(2)}</strong>
                    </div>
                  </>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>{lang === 'ta' ? 'துணைத்தொகை:' : 'Subtotal:'}</span>
                  <strong>₹{calculatedTotal.toFixed(2)}</strong>
                </div>

                {/* Discount */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-muted)' }}>{lang === 'ta' ? 'தள்ளுபடி (-):' : 'Discount (-):'}</span>
                  <div style={{ width: '110px' }}>
                    <input
                      type="number"
                      min="0"
                      value={discount}
                      onChange={(e) => setDiscount(Number(e.target.value) || 0)}
                      style={{
                        width: '100%',
                        padding: '3px 6px',
                        borderRadius: '4px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid var(--border-color)',
                        color: 'var(--danger)',
                        fontWeight: '700',
                        fontSize: '0.85rem',
                        textAlign: 'right'
                      }}
                    />
                  </div>
                </div>

                {/* Final Amount Override Control */}
                <div style={{ borderTop: '1.5px solid var(--border-color)', paddingTop: '0.75rem', marginTop: '0.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                    <span style={{ fontSize: '0.95rem', fontWeight: '800', color: 'var(--text-main)' }}>
                      {lang === 'ta' ? 'இறுதித் தொகை:' : 'Final Amount:'}
                    </span>
                    <strong style={{ fontSize: '1.25rem', color: 'var(--accent-cyan)', fontWeight: '900' }}>
                      ₹{finalBillAmount}
                    </strong>
                  </div>

                  {/* Checkbox to manually override final amount */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: 'var(--text-muted)', cursor: 'pointer', marginTop: '4px' }}>
                    <input
                      type="checkbox"
                      checked={isFinalAmountOverridden}
                      onChange={(e) => {
                        setIsFinalAmountOverridden(e.target.checked);
                        if (e.target.checked && manualFinalAmount === '') {
                          setManualFinalAmount(calculatedNet);
                        }
                      }}
                    />
                    <span>{lang === 'ta' ? 'இறுதித் தொகையை நேரடியாக மாற்றவும்' : 'Manually override final amount'}</span>
                  </label>

                  {isFinalAmountOverridden && (
                    <div style={{ marginTop: '0.4rem' }}>
                      <input
                        type="number"
                        step="1"
                        value={manualFinalAmount}
                        onChange={(e) => setManualFinalAmount(e.target.value)}
                        placeholder="Custom amount"
                        style={{
                          width: '100%',
                          padding: '0.5rem 0.75rem',
                          borderRadius: '6px',
                          background: 'rgba(6, 182, 212, 0.08)',
                          border: '1.5px solid var(--accent-cyan)',
                          color: 'var(--accent-cyan)',
                          fontWeight: '800',
                          fontSize: '1rem',
                          textAlign: 'right'
                        }}
                      />
                      <small style={{ color: 'var(--text-muted)', fontSize: '0.7rem', display: 'block', marginTop: '2px' }}>
                        {lang === 'ta' ? 'பில்லில் இந்த தொகை நேரடியாக காட்டப்படும்' : 'This custom final amount will be printed on the bill'}
                      </small>
                    </div>
                  )}
                </div>

                {/* Payment Mode Selector */}
                <div style={{ marginTop: '0.5rem' }}>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                    {lang === 'ta' ? 'கட்டண முறை' : 'Payment Mode'}
                  </label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.45rem',
                      borderRadius: '4px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-main)',
                      fontSize: '0.85rem'
                    }}
                  >
                    <option value="Cash">Cash (ரொக்கம்)</option>
                    <option value="GPay / UPI">GPay / UPI (ஆன்லைன்)</option>
                    <option value="Credit">Credit (கடன் / நிலுவை)</option>
                  </select>
                </div>

                {/* Main Action Buttons */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '1rem' }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleProceedToPrint}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      fontSize: '0.95rem',
                      fontWeight: '800',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem'
                    }}
                  >
                    🖨️ {lang === 'ta' ? 'பில் பார் & அச்சிடு' : 'Preview & Print Rough Bill'}
                  </button>

                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleSaveBill}
                    style={{ width: '100%', padding: '0.55rem', fontSize: '0.85rem' }}
                  >
                    💾 {lang === 'ta' ? 'பில் சேமி' : 'Save Rough Bill'}
                  </button>
                </div>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* VIEW MODE: PRINT BILL PREVIEW (EXACT SAME PRINT LAYOUT AS EXISTING BILL) */}
      {viewMode === 'print' && !showHistory && (
        <div>
          {/* Action Header in Preview Mode */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', background: 'rgba(255,255,255,0.02)', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }} className="no-print">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => setViewMode('edit')}
                style={{ fontSize: '0.85rem' }}
              >
                ← {lang === 'ta' ? 'திருத்துதல் (Edit Bill)' : 'Back to Edit Items'}
              </button>
              
              {/* Direct Quick Customer Name Edit on Print Preview */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '700' }}>
                  {lang === 'ta' ? 'வாடிக்கையாளர் பெயர்:' : 'Customer Name:'}
                </span>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    border: '1.5px solid var(--accent-cyan)',
                    background: 'rgba(0,0,0,0.4)',
                    color: '#fff',
                    fontWeight: '800',
                    fontSize: '0.85rem'
                  }}
                  title="Directly edit customer name before printing"
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleResetForm}
                style={{ fontSize: '0.9rem' }}
              >
                🔄 {lang === 'ta' ? 'புதிய பில்' : 'New Bill'}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleTriggerPrint}
                style={{ fontSize: '0.9rem', fontWeight: '800' }}
              >
                🖨️ {lang === 'ta' ? 'அச்சிடு (Print Bill)' : 'Print Bill Now'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleDownloadPDF}
                style={{ fontSize: '0.9rem' }}
              >
                📥 {lang === 'ta' ? 'PDF பதிவிறக்கு' : 'Download PDF'}
              </button>
            </div>
          </div>

          {/* EXACT SAME PRINT BILL LAYOUT AS BILLING.JSX */}
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            
            <div 
              className="invoice-card" 
              id="printable-invoice" 
              style={{
                border: '1.5px solid #000000',
                padding: '16px 20px',
                background: '#ffffff',
                color: '#000000',
                width: '100%',
                maxWidth: '7.8in',
                margin: '0 auto',
                boxSizing: 'border-box',
                fontFamily: '"Outfit", "Noto Sans Tamil", "Inter", sans-serif',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}
            >
              {/* Company Branding & Tax Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2.5px solid #000000', paddingBottom: '8px' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  {/* Wholesale Logo Symbol */}
                  <div style={{
                    background: '#000000',
                    color: '#ffffff',
                    fontWeight: '900',
                    fontSize: '18px',
                    width: '40px',
                    height: '40px',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                  }}>
                    GSK
                  </div>
                  <div>
                    <h2 style={{ fontSize: '20px', fontWeight: '900', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#000000' }}>
                      {settings.company_name}
                    </h2>
                    <p style={{ fontSize: '10px', color: '#000000', margin: '3px 0 1px 0', fontWeight: '700' }}>
                      📍 {settings.company_address}
                    </p>
                    <div style={{ display: 'flex', gap: '10px', fontSize: '10px', color: '#000000', fontWeight: '700' }}>
                      <span>📞 Mob: {settings.company_phone || settings.company_mobile || "9345463415"}</span>
                      <span>|</span>
                      <span>GSTIN: <strong style={{ color: '#000000', fontWeight: '900' }}>{settings.company_gst}</strong></span>
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <h1 style={{ fontSize: '18px', fontWeight: '900', color: '#000000', margin: 0, letterSpacing: '0.5px' }}>
                    {hasGst ? 'TAX INVOICE' : (lang === 'ta' ? 'ரஃப் பில்' : 'ROUGH BILL')}
                  </h1>
                  <p style={{ fontSize: '10px', fontWeight: '900', color: '#000000', margin: '3px 0 0 0', textTransform: 'uppercase' }}>
                    {hasGst ? (lang === 'ta' ? 'வரி விலைப்பட்டியல்' : 'TAX INVOICE') : (lang === 'ta' ? 'நேரடி விற்பனை பில்' : 'ESTIMATE / ROUGH BILL')}
                  </p>
                  <span style={{ fontSize: '8px', color: '#000000', border: '1.5px solid #000000', padding: '2px 6px', borderRadius: '3px', display: 'inline-block', marginTop: '6px', fontWeight: '800' }}>
                    {lang === 'ta' ? 'அசல் நகல்' : 'ORIGINAL COPY'}
                  </span>
                </div>
              </div>

              {/* Invoice Information structured table */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1.1fr',
                border: '2px solid #000000',
                borderRadius: '4px',
                overflow: 'hidden',
                fontSize: '11px'
              }}>
                {/* Left side details */}
                <div style={{ padding: '8px 10px', borderRight: '2px solid #000000', display: 'flex', flexDirection: 'column', gap: '5px', background: '#f8fafc' }}>
                  <div style={{ display: 'flex' }}>
                    <span style={{ width: lang === 'ta' ? '120px' : '90px', color: '#000000', fontWeight: '700', flexShrink: 0 }}>{lang === 'ta' ? 'பில் எண்:' : 'Invoice No:'}</span>
                    <strong style={{ color: '#000000', fontWeight: '900' }}>{billNumber}</strong>
                  </div>
                  <div style={{ display: 'flex' }}>
                    <span style={{ width: lang === 'ta' ? '120px' : '90px', color: '#000000', fontWeight: '700', flexShrink: 0 }}>{lang === 'ta' ? 'பில் தேதி:' : 'Invoice Date:'}</span>
                    <strong style={{ color: '#000000', fontWeight: '900' }}>{new Date(billDate).toLocaleDateString('en-GB')}</strong>
                  </div>
                  <div style={{ display: 'flex' }}>
                    <span style={{ width: lang === 'ta' ? '120px' : '90px', color: '#000000', fontWeight: '700', flexShrink: 0 }}>{lang === 'ta' ? 'வழித்தடம்:' : 'Route:'}</span>
                    <strong style={{ color: '#000000', fontWeight: '900' }}>{lang === 'ta' ? 'நேரடி விற்பனை / கவுண்டர்' : 'Walk-in / Counter'}</strong>
                  </div>
                  <div style={{ display: 'flex' }}>
                    <span style={{ width: lang === 'ta' ? '120px' : '90px', color: '#000000', fontWeight: '700', flexShrink: 0 }}>{lang === 'ta' ? 'விற்பனையாளர்:' : 'Salesman:'}</span>
                    <strong style={{ color: '#000000', fontWeight: '900' }}>{lang === 'ta' ? 'கவுண்டர் விற்பனை' : 'Counter Sales'}</strong>
                  </div>
                </div>

                {/* Right side Customer details - DYNAMIC EDITED CUSTOMER NAME */}
                <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <div style={{ display: 'flex' }}>
                    <span style={{ width: lang === 'ta' ? '120px' : '100px', color: '#000000', fontWeight: '700', flexShrink: 0 }}>{lang === 'ta' ? 'வாடிக்கையாளர்:' : 'Customer Name:'}</span>
                    <strong style={{ color: '#000000', fontWeight: '950', fontSize: '11.5px' }}>{customerName || 'General Customer'}</strong>
                  </div>
                  <div style={{ display: 'flex' }}>
                    <span style={{ width: lang === 'ta' ? '120px' : '100px', color: '#000000', fontWeight: '700', flexShrink: 0 }}>{lang === 'ta' ? 'தொடர்பு எண்:' : 'Mobile No:'}</span>
                    <strong style={{ color: '#000000', fontWeight: '900' }}>{customerPhone || 'N/A'}</strong>
                  </div>
                  {(customerGst || hasGst) && (
                    <div style={{ display: 'flex' }}>
                      <span style={{ width: lang === 'ta' ? '120px' : '100px', color: '#000000', fontWeight: '700', flexShrink: 0 }}>{lang === 'ta' ? 'ஜிஎஸ்டி எண்:' : 'Customer GSTIN:'}</span>
                      <strong style={{ color: '#000000', fontWeight: '900' }}>{customerGst || 'N/A'}</strong>
                    </div>
                  )}
                  <div style={{ display: 'flex' }}>
                    <span style={{ width: lang === 'ta' ? '120px' : '100px', color: '#000000', fontWeight: '700', flexShrink: 0 }}>{lang === 'ta' ? 'முகவரி:' : 'Shop Address:'}</span>
                    <strong style={{ color: '#000000', fontWeight: '900' }}>{customerAddress || 'Walk-in Counter'}</strong>
                  </div>
                </div>
              </div>

              {/* Product Details Tabular Format */}
              <div style={{ border: '2px solid #000000', borderRadius: '4px', overflow: 'hidden' }}>
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '11px',
                  textAlign: 'left'
                }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', color: '#000000', borderBottom: '2px solid #000000' }}>
                      <th style={{ padding: '5px 6px', width: '30px', fontWeight: '900', color: '#000000', borderBottom: '2px solid #000000' }}>#</th>
                      <th style={{ padding: '5px 6px', fontWeight: '900', color: '#000000', borderBottom: '2px solid #000000' }}>
                        {lang === 'ta' ? 'பொருட்களின் விபரம்' : 'Product Name'}
                      </th>
                      <th style={{ padding: '5px 6px', width: '55px', fontWeight: '900', color: '#000000', borderBottom: '2px solid #000000', textAlign: 'center' }}>
                        {lang === 'ta' ? 'அளவு' : 'Size'}
                      </th>
                      <th style={{ padding: '5px 6px', width: '45px', textAlign: 'center', fontWeight: '900', color: '#000000', borderBottom: '2px solid #000000' }}>
                        {lang === 'ta' ? 'பெட்டி' : 'Cases'}
                      </th>
                      <th style={{ padding: '5px 6px', width: '45px', textAlign: 'center', fontWeight: '900', color: '#000000', borderBottom: '2px solid #000000' }}>
                        {lang === 'ta' ? 'பாட்டில்' : 'Bottles'}
                      </th>
                      <th style={{ padding: '5px 6px', width: '65px', textAlign: 'right', fontWeight: '900', color: '#000000', borderBottom: '2px solid #000000' }}>
                        {lang === 'ta' ? 'விகிதம்' : 'Rate'}
                      </th>
                      {hasGst && (
                        <>
                          <th style={{ padding: '5px 6px', width: '75px', textAlign: 'right', fontWeight: '900', color: '#000000', borderBottom: '2px solid #000000' }}>
                            {lang === 'ta' ? 'வரித்தொகை' : 'Taxable'}
                          </th>
                          <th style={{ padding: '5px 6px', width: '50px', textAlign: 'center', fontWeight: '900', color: '#000000', borderBottom: '2px solid #000000' }}>
                            GST
                          </th>
                          <th style={{ padding: '5px 6px', width: '65px', textAlign: 'right', fontWeight: '900', color: '#000000', borderBottom: '2px solid #000000' }}>
                            CGST
                          </th>
                          <th style={{ padding: '5px 6px', width: '65px', textAlign: 'right', fontWeight: '900', color: '#000000', borderBottom: '2px solid #000000' }}>
                            SGST
                          </th>
                        </>
                      )}
                      <th style={{ padding: '5px 6px', width: '80px', textAlign: 'right', fontWeight: '950', color: '#000000', borderBottom: '2px solid #000000' }}>
                        {lang === 'ta' ? 'மொத்தம்' : 'Total'}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => (
                      <tr key={item.id || idx} style={{
                        background: idx % 2 === 0 ? '#ffffff' : '#f8fafc',
                        borderBottom: '1px solid #000000'
                      }}>
                        <td style={{ padding: '5px 6px', color: '#000000', fontWeight: '800', textAlign: 'center' }}>{idx + 1}</td>
                        <td style={{ padding: '5px 6px', fontWeight: '800', color: '#000000' }}>{item.product_name}</td>
                        <td style={{ padding: '5px 6px', color: '#000000', textAlign: 'center', fontWeight: '700' }}>{item.size || '-'}</td>
                        <td style={{ padding: '5px 6px', textAlign: 'center', fontWeight: '800', color: '#000000' }}>{item.cases || 0}</td>
                        <td style={{ padding: '5px 6px', textAlign: 'center', fontWeight: '800', color: '#000000' }}>{item.bottles || 0}</td>
                        <td style={{ padding: '5px 6px', textAlign: 'right', color: '#000000', fontWeight: '800' }}>₹{item.rate}</td>
                        {hasGst && (
                          <>
                            <td style={{ padding: '5px 6px', textAlign: 'right', color: '#000000', fontWeight: '800' }}>₹{item.taxable_amount}</td>
                            <td style={{ padding: '5px 6px', textAlign: 'center', fontWeight: '800', color: '#000000' }}>{item.gst_rate}%</td>
                            <td style={{ padding: '5px 6px', textAlign: 'right', color: '#000000', fontWeight: '800' }}>₹{item.cgst_amount}</td>
                            <td style={{ padding: '5px 6px', textAlign: 'right', color: '#000000', fontWeight: '800' }}>₹{item.sgst_amount}</td>
                          </>
                        )}
                        <td style={{ padding: '5px 6px', textAlign: 'right', fontWeight: '950', color: '#000000' }}>₹{item.total_amount}</td>
                      </tr>
                    ))}

                    {/* Total Row */}
                    <tr style={{
                      background: '#ffffff',
                      borderTop: '2.5px solid #000000',
                      borderBottom: '2.5px solid #000000',
                      fontWeight: '900'
                    }}>
                      <td style={{ padding: '5px 6px' }}></td>
                      <td style={{ padding: '5px 6px', color: '#000000', fontWeight: '950' }}>{lang === 'ta' ? 'மொத்தம்' : 'Total'}</td>
                      <td style={{ padding: '5px 6px' }}></td>
                      <td style={{ padding: '5px 6px', textAlign: 'center', color: '#000000', fontWeight: '950' }}>{totalCases}</td>
                      <td style={{ padding: '5px 6px', textAlign: 'center', color: '#000000', fontWeight: '950' }}>{totalBottles}</td>
                      <td style={{ padding: '5px 6px', textAlign: 'right' }}></td>
                      {hasGst && (
                        <>
                          <td style={{ padding: '5px 6px', textAlign: 'right', color: '#000000', fontWeight: '950' }}>₹{calculatedTaxable.toFixed(2)}</td>
                          <td style={{ padding: '5px 6px' }}></td>
                          <td style={{ padding: '5px 6px', textAlign: 'right', color: '#000000', fontWeight: '950' }}>₹{calculatedCgst.toFixed(2)}</td>
                          <td style={{ padding: '5px 6px', textAlign: 'right', color: '#000000', fontWeight: '950' }}>₹{calculatedSgst.toFixed(2)}</td>
                        </>
                      )}
                      <td style={{ padding: '5px 6px', textAlign: 'right', fontWeight: '950', color: '#000000' }}>₹{calculatedTotal.toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Bottom Summary Section & UPI QR Section */}
              <div style={{ marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                
                {/* Horizontal Financial Ledger & GST Breakdown Summary */}
                <div style={{
                  border: '2px solid #000000',
                  borderRadius: '4px',
                  overflow: 'hidden',
                  background: '#ffffff',
                  fontSize: '10px'
                }}>
                  {/* Row 1: Financial & GST Breakdown (Horizontal) */}
                  {hasGst ? (
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: discount > 0 ? 'repeat(6, 1fr)' : 'repeat(5, 1fr)',
                      background: '#f8fafc',
                      borderBottom: '1.5px solid #000000',
                      textAlign: 'center'
                    }}>
                      {discount > 0 && (
                        <div style={{ padding: '4px 6px', borderRight: '1px solid #000000' }}>
                          <span style={{ color: '#000000', fontSize: '8px', textTransform: 'uppercase', fontWeight: '800', display: 'block' }}>
                            {lang === 'ta' ? 'தள்ளுபடி' : 'Discount (-)'}
                          </span>
                          <strong style={{ color: '#000000', fontSize: '10.5px', fontWeight: '900' }}>-₹{discount}</strong>
                        </div>
                      )}

                      <div style={{ padding: '4px 6px', borderRight: '1px solid #000000', background: '#f1f5f9' }}>
                        <span style={{ color: '#000000', fontSize: '8px', textTransform: 'uppercase', fontWeight: '900', display: 'block' }}>
                          {lang === 'ta' ? 'வரிக்கு உட்பட்டது' : 'Taxable Amount'}
                        </span>
                        <strong style={{ color: '#000000', fontSize: '11px', fontWeight: '950' }}>₹{calculatedTaxable.toFixed(2)}</strong>
                      </div>

                      <div style={{ padding: '4px 6px', borderRight: '1px solid #000000' }}>
                        <span style={{ color: '#000000', fontSize: '8px', textTransform: 'uppercase', fontWeight: '800', display: 'block' }}>
                          Total CGST
                        </span>
                        <strong style={{ color: '#000000', fontSize: '10.5px', fontWeight: '900' }}>₹{calculatedCgst.toFixed(2)}</strong>
                      </div>

                      <div style={{ padding: '4px 6px', borderRight: '1px solid #000000' }}>
                        <span style={{ color: '#000000', fontSize: '8px', textTransform: 'uppercase', fontWeight: '800', display: 'block' }}>
                          Total SGST
                        </span>
                        <strong style={{ color: '#000000', fontSize: '10.5px', fontWeight: '900' }}>₹{calculatedSgst.toFixed(2)}</strong>
                      </div>

                      <div style={{ padding: '4px 6px', borderRight: '1px solid #000000' }}>
                        <span style={{ color: '#000000', fontSize: '8px', textTransform: 'uppercase', fontWeight: '800', display: 'block' }}>
                          Total GST
                        </span>
                        <strong style={{ color: '#000000', fontSize: '10.5px', fontWeight: '900' }}>₹{(calculatedCgst + calculatedSgst).toFixed(2)}</strong>
                      </div>

                      <div style={{ padding: '4px 6px', background: '#e2e8f0' }}>
                        <span style={{ color: '#000000', fontSize: '8px', textTransform: 'uppercase', fontWeight: '900', display: 'block' }}>
                          {lang === 'ta' ? 'ஜிஎஸ்டி மொத்தம்' : 'Grand Total (Inc. GST)'}
                        </span>
                        <strong style={{ color: '#000000', fontSize: '11.5px', fontWeight: '950' }}>₹{calculatedTotal.toFixed(2)}</strong>
                      </div>
                    </div>
                  ) : (
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: discount > 0 ? '1fr 1fr 1fr' : '1fr 1fr',
                      background: '#f8fafc',
                      borderBottom: '1.5px solid #000000',
                      textAlign: 'center'
                    }}>
                      <div style={{ padding: '4px 6px', borderRight: '1px solid #000000' }}>
                        <span style={{ color: '#000000', fontSize: '8px', textTransform: 'uppercase', fontWeight: '800', display: 'block' }}>
                          {lang === 'ta' ? 'மொத்த சரக்கு' : 'Total Items / Qty'}
                        </span>
                        <strong style={{ color: '#000000', fontSize: '10.5px', fontWeight: '900' }}>{totalCases} cases, {totalBottles} btls</strong>
                      </div>

                      {discount > 0 && (
                        <div style={{ padding: '4px 6px', borderRight: '1px solid #000000' }}>
                          <span style={{ color: '#000000', fontSize: '8px', textTransform: 'uppercase', fontWeight: '800', display: 'block' }}>
                            {lang === 'ta' ? 'தள்ளுபடி' : 'Discount (-)'}
                          </span>
                          <strong style={{ color: '#000000', fontSize: '10.5px', fontWeight: '900' }}>-₹{discount}</strong>
                        </div>
                      )}

                      <div style={{ padding: '4px 6px', background: '#e2e8f0' }}>
                        <span style={{ color: '#000000', fontSize: '8px', textTransform: 'uppercase', fontWeight: '900', display: 'block' }}>
                          {lang === 'ta' ? 'மொத்தத் தொகை' : 'Grand Total'}
                        </span>
                        <strong style={{ color: '#000000', fontSize: '11.5px', fontWeight: '950' }}>₹{calculatedTotal.toFixed(2)}</strong>
                      </div>
                    </div>
                  )}

                  {/* Row 2: Outstanding & Settlement (Horizontal) */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr 1.3fr',
                    background: '#ffffff',
                    textAlign: 'center',
                    alignItems: 'center'
                  }}>
                    <div style={{ padding: '6px 8px', borderRight: '1px solid #000000' }}>
                      <span style={{ color: '#000000', fontSize: '8.5px', textTransform: 'uppercase', fontWeight: '800', display: 'block' }}>
                        {lang === 'ta' ? 'பழைய நிலுவை' : 'Old Balance'}
                      </span>
                      <strong style={{ color: '#000000', fontSize: '11px', fontWeight: '900' }}>₹0</strong>
                    </div>

                    <div style={{ padding: '6px 8px', borderRight: '1px solid #000000' }}>
                      <span style={{ color: '#000000', fontSize: '8.5px', textTransform: 'uppercase', fontWeight: '800', display: 'block' }}>
                        {lang === 'ta' ? 'தற்போதைய பில்' : 'Current Bill Total'}
                      </span>
                      <strong style={{ color: '#000000', fontSize: '11px', fontWeight: '900' }}>₹{finalBillAmount}</strong>
                    </div>

                    <div style={{ padding: '6px 8px', borderRight: '1px solid #000000' }}>
                      <span style={{ color: '#000000', fontSize: '8.5px', textTransform: 'uppercase', fontWeight: '800', display: 'block' }}>
                        {lang === 'ta' ? 'வசூலிக்கப்பட்ட தொகை' : 'Amount Collected'}
                      </span>
                      <strong style={{ color: '#000000', fontSize: '11px', fontWeight: '900' }}>
                        {paymentMode === 'Credit' ? '₹0' : `₹${finalBillAmount}`}
                      </strong>
                    </div>

                    <div style={{
                      padding: '6px 10px',
                      background: '#ffffff',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <span style={{
                        color: '#000000',
                        fontWeight: '950',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        fontSize: '11px'
                      }}>
                        {lang === 'ta' ? 'செலுத்த வேண்டியது:' : 'AMOUNT DUE:'}
                      </span>
                      <strong style={{
                        color: '#000000',
                        fontWeight: '950',
                        fontSize: '13.5px'
                      }}>
                        {paymentMode === 'Credit' ? `₹${finalBillAmount}` : '₹0'}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Payment Details & GPay QR Section */}
                <div style={{
                  border: '2px solid #000000',
                  borderRadius: '4px',
                  padding: '6px 10px',
                  background: '#ffffff',
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  boxSizing: 'border-box'
                }}>
                  {/* Payment Breakup List */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '3px', justifyContent: 'center' }}>
                    <strong style={{ fontSize: '10.5px', color: '#000000', fontWeight: '900', textTransform: 'uppercase', borderBottom: '1.5px solid #000000', paddingBottom: '2px', marginBottom: '2px' }}>
                      {lang === 'ta' ? 'கட்டண விவரங்கள்' : 'PAYMENT BREAKUP'}
                    </strong>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                      <div style={{ fontSize: '9.5px', color: '#000000' }}>
                        <span style={{ textTransform: 'uppercase', fontWeight: '800' }}>{paymentMode}:</span>
                        <strong style={{ color: '#000000', fontWeight: '900', marginLeft: '4px' }}>₹{finalBillAmount}</strong>
                      </div>
                    </div>
                  </div>

                  {/* GPay / UPI QR Code Box */}
                  <div style={{
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: '8px',
                    borderLeft: '1.5px solid #000000',
                    paddingLeft: '10px'
                  }}>
                    <img 
                      src={qrUrl} 
                      alt="GPay QR Code" 
                      style={{ 
                        width: '56px', 
                        height: '56px', 
                        border: '1.5px solid #000000', 
                        padding: '1px', 
                        borderRadius: '4px',
                        background: '#ffffff'
                      }} 
                    />
                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      <span style={{ fontSize: '9.5px', fontWeight: '950', color: '#000000' }}>
                        📱 {upiName}
                      </span>
                      <span style={{ fontSize: '8px', fontWeight: '900', color: '#000000', wordBreak: 'break-all' }}>
                        {upiVpa}
                      </span>
                      <span style={{ fontSize: '8.5px', fontWeight: '950', color: '#000000', marginTop: '1px' }}>
                        {lang === 'ta' ? `தொகை: ₹${finalBillAmount}` : `Scan & Pay: ₹${finalBillAmount}`}
                      </span>
                    </div>
                  </div>

                </div>
              </div>

              {/* Signature Sign-Off Areas */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: '35px',
                padding: '0 12px'
              }}>
                <div style={{ textAlign: 'center', width: '200px' }}>
                  <div style={{ borderTop: '1.5px dashed #000000', paddingTop: '6px', fontSize: '9.5px', fontWeight: '900', color: '#000000', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {lang === 'ta' ? 'வாடிக்கையாளர் கையொப்பம்' : 'CUSTOMER SIGNATURE'}
                  </div>
                </div>
                <div style={{ textAlign: 'center', width: '200px' }}>
                  <div style={{ borderTop: '1.5px dashed #000000', paddingTop: '6px', fontSize: '9.5px', fontWeight: '900', color: '#000000', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {lang === 'ta' ? 'அங்கீகரிக்கப்பட்ட கையொப்பம்' : 'AUTHORISED SIGNATORY'}
                  </div>
                </div>
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}
