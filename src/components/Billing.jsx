import React, { useState, useEffect } from 'react';
import api from '../api';
import html2pdf from 'html2pdf.js';
import * as XLSX from 'xlsx';
import { calculateOrderGstBreakdown } from '../utils/gstUtils';
import { translateShopName, translateRouteName, translateProductName, translateAddress } from '../translations';

export default function Billing({ orderId, initialData, t, lang, onBack }) {
  const [order, setOrder] = useState(() => initialData?.order || null);
  const [orderItems, setOrderItems] = useState(() => initialData?.items || []);
  const [products, setProducts] = useState([]);
  const [shop, setShop] = useState(null);
  const [route, setRoute] = useState(null);
  const [payments, setPayments] = useState([]);
  const [allOrders, setAllOrders] = useState([]);
  const [allPayments, setAllPayments] = useState([]);
  const [loading, setLoading] = useState(!initialData?.order);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [modalPaymentRows, setModalPaymentRows] = useState([
    {
      payment_mode: 'cash',
      collected_amount: 0,
      transaction_number: '',
      reference_number: '',
      payment_date: new Date().toISOString().split('T')[0]
    }
  ]);
  const [settings, setSettings] = useState({
    company_name: "GSK Agency",
    company_address: "Cooldrinks Shop - Tindivanam",
    company_gst: "33CWRPK4071L1Z2",
    company_phone: "9345463415",
    upi_mobile: "gskumar9345@okicici"
  });

  useEffect(() => {
    async function loadSettings() {
      try {
        const data = await api.getSettings();
        if (data) setSettings(data);
      } catch (err) {
        console.error('Failed to load settings in billing', err);
      }
    }
    loadSettings();
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadInvoiceData(retryCount = 0) {
      if (!orderId) return;
      try {
        const results = await Promise.allSettled([
          api.getOrders(),
          api.getOrderItems(),
          api.getProducts(),
          api.getShops(),
          api.getRoutes(),
          api.getPayments()
        ]);

        if (!isMounted) return;

        const ordData = results[0].status === 'fulfilled' ? results[0].value || [] : [];
        const itemData = results[1].status === 'fulfilled' ? results[1].value || [] : [];
        const prodData = results[2].status === 'fulfilled' ? results[2].value || [] : [];
        const shopData = results[3].status === 'fulfilled' ? results[3].value || [] : [];
        const routeData = results[4].status === 'fulfilled' ? results[4].value || [] : [];
        const payData = results[5].status === 'fulfilled' ? results[5].value || [] : [];

        setAllOrders(ordData);
        setAllPayments(payData);
        setProducts(prodData);

        let currentOrder = ordData.find(o => o.id === orderId);
        let items = itemData.filter(oi => oi.order_id === orderId);

        // Fallback 1: Try single order direct fetch from backend if not found in list yet
        if (!currentOrder && api.getOrder) {
          try {
            const directFetch = await api.getOrder(orderId);
            if (directFetch && directFetch.order) {
              currentOrder = directFetch.order;
              if ((!items || items.length === 0) && directFetch.items) {
                items = directFetch.items;
              }
            }
          } catch (e) {
            console.warn('Direct order lookup failed:', e);
          }
        }

        // Fallback 2: Check initialData passed directly from creation
        if (!currentOrder && initialData?.order && initialData.order.id === orderId) {
          currentOrder = initialData.order;
          if (!items || items.length === 0) {
            items = initialData.items || [];
          }
        }

        // Auto-retry up to 3 times with 500ms delay to accommodate live cloud database replication
        if (!currentOrder && retryCount < 3) {
          setTimeout(() => {
            if (isMounted) loadInvoiceData(retryCount + 1);
          }, 500);
          return;
        }

        if (currentOrder) {
          setOrder(currentOrder);
          setOrderItems(items);

          const currentShop = shopData.find(s => s.id === currentOrder.shop_id);
          setShop(currentShop);

          const currentRoute = routeData.find(r => r.id === currentOrder.route_id);
          setRoute(currentRoute);

          // Find payment for this order
          const paymentList = payData.filter(p => p.order_id === orderId);
          setPayments(paymentList);
        }
      } catch (err) {
        console.error('Failed to load invoice details', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadInvoiceData();

    return () => {
      isMounted = false;
    };
  }, [orderId, initialData]);

  const reloadInvoicePayments = async () => {
    try {
      const [shopData, payData, ordData] = await Promise.all([
        api.getShops(),
        api.getPayments(),
        api.getOrders()
      ]);
      const currentShop = shopData.find(s => s.id === order.shop_id);
      setShop(currentShop);
      setAllOrders(ordData || []);
      setAllPayments(payData || []);
      
      const paymentList = payData.filter(p => p.order_id === orderId);
      setPayments(paymentList);
    } catch (err) {
      console.error('Failed to reload payments after collection', err);
    }
  };

  const handleOpenPaymentModal = () => {
    const remaining = order.net_amount - totalCollected;
    setModalPaymentRows([
      {
        payment_mode: 'cash',
        collected_amount: Math.max(0, remaining),
        transaction_number: '',
        reference_number: '',
        payment_date: new Date().toISOString().split('T')[0]
      }
    ]);
    setShowPaymentModal(true);
  };

  const handleModalPaymentSubmit = async (e) => {
    e.preventDefault();
    const totalCollectedAmt = modalPaymentRows.reduce((sum, row) => sum + Number(row.collected_amount || 0), 0);
    if (totalCollectedAmt <= 0) {
      alert('Total collected amount must be greater than 0 / வசூலிக்கப்பட்ட தொகை பூஜ்ஜியத்தை விட அதிகமாக இருக்க வேண்டும்.');
      return;
    }

    const invalidRow = modalPaymentRows.find(row => !row.collected_amount || Number(row.collected_amount) <= 0);
    if (invalidRow) {
      alert('Please enter a valid amount for all payment rows / அனைத்து வரிசைகளிலும் சரியான தொகையை உள்ளிடவும்.');
      return;
    }

    try {
      const paymentsToSubmit = modalPaymentRows.map(row => ({
        shop_id: shop.id,
        order_id: order.id,
        collected_amount: Number(row.collected_amount),
        payment_mode: row.payment_mode,
        transaction_number: row.transaction_number,
        reference_number: row.reference_number,
        payment_date: new Date(row.payment_date).toISOString()
      }));

      await api.createPayment({ payments: paymentsToSubmit });
      alert(lang === 'ta' ? 'கட்டணம் வெற்றிகரமாகச் சேர்க்கப்பட்டது!' : 'Payment added successfully!');
      setShowPaymentModal(false);
      await reloadInvoicePayments();
    } catch (err) {
      alert('Failed to register payment: ' + err.message);
    }
  };

  if (loading) {
    return (
      <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '4rem 1rem' }}>
        <p style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>
          {lang === 'ta' ? 'விலைப்பட்டியல் ஏற்றப்படுகிறது...' : 'Loading Invoice...'}
        </p>
      </div>
    );
  }

  if (!order) {
    return (
      <div style={{ color: 'var(--danger)', textAlign: 'center', padding: '4rem 1rem' }}>
        <p style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.5rem' }}>
          {lang === 'ta' ? 'விலைப்பட்டியல் கிடைக்கவில்லை' : 'Invoice not found'}
        </p>
        {onBack && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onBack}
            style={{ padding: '0.6rem 1.4rem', cursor: 'pointer' }}
          >
            {lang === 'ta' ? '← பின்செல்க' : '← Back'}
          </button>
        )}
      </div>
    );
  }

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = () => {
    const element = document.getElementById('printable-invoice');
    if (!element) return;

    const opt = {
      margin:       0.3,
      filename:     `Invoice_${order.invoice_number}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true, letterRendering: true },
      jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(element).save();
  };

  // Compute live GST breakdown for the order
  const gstBreakdown = calculateOrderGstBreakdown({
    items: orderItems,
    products,
    discount: order?.discount || 0,
    customerGstin: shop?.gst_number || '',
    companyGstin: settings?.company_gst || '33CWRPK4071L1Z2'
  });

  // Export Invoice to Excel (.xlsx)
  const handleExportExcel = () => {
    if (!order) return;
    const wb = XLSX.utils.book_new();
    const rows = [
      [`INVOICE - ${order.invoice_number}`],
      ['Company:', settings.company_name, 'GSTIN:', settings.company_gst],
      ['Address:', settings.company_address, 'Phone:', settings.company_phone],
      ['Date:', new Date(order.order_date).toLocaleString(), 'Route:', route ? (route.name_en || route.name) : '-'],
      ['Customer:', shop ? (lang === 'ta' ? shop.name_ta || shop.name_en : shop.name_en) : '-', 'Customer GSTIN:', shop?.gst_number || 'N/A'],
      [''],
      ['S.No', 'Product Name', 'Size', 'Cases', 'Bottles', 'Rate (₹)', 'Taxable (₹)', 'GST %', 'CGST (₹)', 'SGST (₹)', 'Total (₹)']
    ];

    gstBreakdown.items.forEach((it, idx) => {
      const p = it.product;
      const rawName = p ? (lang === 'ta' ? p.name_ta || p.name_en : p.name_en) : (it.product_name || 'Product');
      rows.push([
        idx + 1,
        rawName,
        p?.size || '-',
        it.cases,
        it.bottles,
        it.rate,
        it.taxableAmount,
        `${it.gstRate}%`,
        it.cgstAmount,
        it.sgstAmount,
        it.grandTotal
      ]);
    });

    rows.push([
      'TOTAL', '', '',
      gstBreakdown.items.reduce((s, it) => s + it.cases, 0),
      gstBreakdown.items.reduce((s, it) => s + it.bottles, 0),
      '',
      gstBreakdown.taxableAmount,
      '',
      gstBreakdown.totalCgst,
      gstBreakdown.totalSgst,
      gstBreakdown.grandTotalIncGst
    ]);

    rows.push(['']);
    rows.push(['--- FINANCIAL SUMMARY ---']);
    if (gstBreakdown.discount > 0) rows.push(['Discount (-):', -gstBreakdown.discount]);
    rows.push(['Taxable Amount Before GST (₹):', gstBreakdown.taxableAmount]);
    rows.push(['Total CGST (₹):', gstBreakdown.totalCgst]);
    rows.push(['Total SGST (₹):', gstBreakdown.totalSgst]);
    rows.push(['Total GST (₹):', gstBreakdown.totalGst]);
    rows.push(['Grand Total Including GST (₹):', gstBreakdown.grandTotalIncGst]);
    rows.push(['Old Balance (₹):', outstandingBeforeOrder]);
    rows.push(['Amount Collected (₹):', totalCollected]);
    rows.push(['Total Balance Due (₹):', remainingOutstanding]);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 6 }, { wch: 28 }, { wch: 12 }, { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 14 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Invoice');
    XLSX.writeFile(wb, `Invoice_${order.invoice_number}.xlsx`);
  };

  // Export Invoice to CSV (.csv)
  const handleExportCSV = () => {
    if (!order) return;
    const csvRows = [
      `"INVOICE ${order.invoice_number} - ${settings.company_name}"`,
      `"Customer:","${shop ? (shop.name_en || '').replace(/"/g, '""') : ''}","GSTIN:","${shop?.gst_number || ''}"`,
      `"Date:","${new Date(order.order_date).toLocaleDateString()}"`,
      '',
      'S.No,Product_Name,Size,Cases,Bottles,Rate,Taxable_Amount,GST_Rate,CGST_Amount,SGST_Amount,Total_Amount'
    ];

    gstBreakdown.items.forEach((it, idx) => {
      const p = it.product;
      const rawName = p ? p.name_en : (it.product_name || 'Product');
      csvRows.push([
        idx + 1,
        `"${rawName.replace(/"/g, '""')}"`,
        `"${p?.size || ''}"`,
        it.cases,
        it.bottles,
        it.rate,
        it.taxableAmount,
        `${it.gstRate}%`,
        it.cgstAmount,
        it.sgstAmount,
        it.grandTotal
      ].join(','));
    });

    csvRows.push([
      '"TOTAL"', '""', '""',
      gstBreakdown.items.reduce((s, it) => s + it.cases, 0),
      gstBreakdown.items.reduce((s, it) => s + it.bottles, 0),
      '""',
      gstBreakdown.taxableAmount,
      '""',
      gstBreakdown.totalCgst,
      gstBreakdown.totalSgst,
      gstBreakdown.grandTotalIncGst
    ].join(','));

    csvRows.push('');
    if (gstBreakdown.discount > 0) csvRows.push(`"Discount:","-${gstBreakdown.discount}"`);
    csvRows.push(`"Taxable Amount:","${gstBreakdown.taxableAmount}"`);
    csvRows.push(`"Total CGST:","${gstBreakdown.totalCgst}"`);
    csvRows.push(`"Total SGST:","${gstBreakdown.totalSgst}"`);
    csvRows.push(`"Total GST:","${gstBreakdown.totalGst}"`);
    csvRows.push(`"Grand Total Inc. GST:","${gstBreakdown.grandTotalIncGst}"`);
    csvRows.push(`"Old Balance:","${outstandingBeforeOrder}"`);
    csvRows.push(`"Amount Collected:","${totalCollected}"`);
    csvRows.push(`"Amount Due:","${remainingOutstanding}"`);

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Invoice_${order.invoice_number}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Compile WhatsApp text
  const getWhatsAppLink = () => {
    if (!shop) return '#';
    const shopName = lang === 'ta' ? shop.name_ta : shop.name_en;
    const collected = payments.reduce((sum, p) => sum + p.collected_amount, 0);
    const balance = shop.outstanding_amount;
    const itemsStr = orderItems.map(item => {
      const p = products.find(prod => prod.id === item.product_id);
      const name = p ? (lang === 'ta' ? p.name_ta : p.name_en) : '';
      return `${name} (${item.cases}C, ${item.bottles}B)`;
    }).join(', ');

    const message = `*${settings.company_name}*\n` +
      `Invoice No: ${order.invoice_number}\n` +
      `Date: ${new Date(order.order_date).toLocaleDateString()}\n` +
      `Shop: ${shopName}\n` +
      `Items: ${itemsStr}\n` +
      `Net Total: ₹${order.net_amount}\n` +
      `Collected Payment: ₹${collected}\n` +
      `Outstanding Balance: ₹${balance}\n` +
      `Thank you for your business!`;

    return `https://api.whatsapp.com/send?phone=${shop.mobile}&text=${encodeURIComponent(message)}`;
  };

  const totalCollected = payments.reduce((sum, p) => sum + p.collected_amount, 0);

  // Filter orders and payments for current shop
  const shopOrders = (allOrders || []).filter(o => o.shop_id === order.shop_id && o.status !== 'cancelled');
  const shopPayments = (allPayments || []).filter(p => p.shop_id === order.shop_id);

  const currentOrderDate = new Date(order.order_date).getTime();

  // Future orders created strictly AFTER current order
  const futureOrders = shopOrders.filter(o => {
    if (o.id === order.id) return false;
    const oDate = new Date(o.order_date).getTime();
    if (oDate > currentOrderDate) return true;
    if (oDate === currentOrderDate) {
      const numA = parseInt((String(o.invoice_number).match(/\d+/) || [0])[0], 10);
      const numB = parseInt((String(order.invoice_number).match(/\d+/) || [0])[0], 10);
      return numA > numB;
    }
    return false;
  });

  // Calculate unpaid net amount of FUTURE orders
  const futureUnpaidNet = futureOrders.reduce((sum, futOrd) => {
    const futPayments = shopPayments.filter(p => p.order_id === futOrd.id);
    const futPaid = futPayments.reduce((pSum, p) => pSum + (Number(p.collected_amount) || 0), 0);
    return sum + Math.max(0, (Number(futOrd.net_amount) || 0) - futPaid);
  }, 0);

  // Shop total outstanding balance today
  const shopCurrentBal = shop ? Number(shop.outstanding_amount || 0) : 0;

  // Balance of shop AT THE TIME of current order (excluding future orders)
  const shopBalAtOrderTime = Math.max(0, shopCurrentBal - futureUnpaidNet);

  // Current order unpaid remaining balance
  const currentInvoiceUnpaid = Math.max(0, order.net_amount - totalCollected);

  // Previous Outstanding BEFORE current order = shop balance at order time minus current invoice unpaid
  const outstandingBeforeOrder = Math.max(0, shopBalAtOrderTime - currentInvoiceUnpaid);

  // Total AMOUNT DUE for this invoice view
  const remainingOutstanding = currentInvoiceUnpaid + outstandingBeforeOrder;
  const isCompact = orderItems.length <= 5;

  return (
    <div className="billing-container">
      <div style={{ marginBottom: '2rem' }} className="no-print">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>📄 {t('invoice')}</h1>
            <p style={{ color: 'var(--text-muted)' }}>
              {lang === 'ta' ? 'முன்னோட்டம், பில் அச்சிடவும், பிடிஎஃப் பதிவிறக்கவும், அல்லது வாட்ஸ்அப்பில் பகிரவும்' : 'Preview, print receipt, download PDF, or share via WhatsApp'}
            </p>
          </div>
          <button className="btn btn-secondary" onClick={onBack}>
            {lang === 'ta' ? '⬅ பின்னால்' : '⬅ Back'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem' }}>
        
        {/* Printable Invoice Container */}
        <div className="invoice-card" id="printable-invoice" style={{
              border: '1.5px solid #1e293b',
              padding: isCompact ? '12px' : '20px',
              background: '#ffffff',
              color: '#0f172a',
              width: '100%',
              maxWidth: '7.8in',
              margin: '0 auto',
              boxSizing: 'border-box',
              fontFamily: '"Outfit", "Noto Sans Tamil", "Inter", sans-serif',
              display: 'flex',
              flexDirection: 'column',
              gap: isCompact ? '6px' : '12px',
              minHeight: isCompact ? '5.2in' : 'auto',
              maxHeight: isCompact ? '5.5in' : 'auto'
            }}>
              
              {/* Company Branding & Tax Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: isCompact ? '1.5px solid #1e293b' : '2.5px solid #1e293b', paddingBottom: isCompact ? '6px' : '10px' }}>
                <div style={{ display: 'flex', gap: isCompact ? '8px' : '12px', alignItems: 'center' }}>
                  {/* Wholesale Logo Symbol */}
                  <div style={{
                    background: '#1e293b',
                    color: '#ffffff',
                    fontWeight: '800',
                    fontSize: isCompact ? '14px' : '18px',
                    width: isCompact ? '32px' : '40px',
                    height: isCompact ? '32px' : '40px',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                  }}>
                    GSK
                  </div>
                  <div>
                    <h2 style={{ fontSize: isCompact ? '16px' : '20px', fontWeight: '800', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#1e293b' }}>
                      {settings.company_name}
                    </h2>
                    <p style={{ fontSize: isCompact ? '9px' : '10px', color: '#475569', margin: isCompact ? '1px 0' : '3px 0 1px 0', fontWeight: '500' }}>
                      📍 {settings.company_address}
                    </p>
                    <div style={{ display: 'flex', gap: '10px', fontSize: isCompact ? '9px' : '10px', color: '#475569', fontWeight: '600' }}>
                      <span>📞 Mob: {settings.company_phone || settings.company_mobile || "9345463415"}</span>
                      <span>|</span>
                      <span>GSTIN: <strong style={{ color: '#0f172a', fontWeight: '800' }}>{settings.company_gst}</strong></span>
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <h1 style={{ fontSize: isCompact ? '15px' : '18px', fontWeight: '900', color: '#1e293b', margin: 0, letterSpacing: '0.5px' }}>
                    TAX INVOICE
                  </h1>
                  <p style={{ fontSize: isCompact ? '8.5px' : '10px', fontWeight: 'bold', color: '#475569', margin: '3px 0 0 0', textTransform: 'uppercase' }}>
                    வரி விலைப்பட்டியல்
                  </p>
                  <span style={{ fontSize: isCompact ? '7px' : '8px', color: '#64748b', border: '1px solid #cbd5e1', padding: '2px 6px', borderRadius: '3px', display: 'inline-block', marginTop: isCompact ? '4px' : '6px', fontWeight: '600' }}>
                    {lang === 'ta' ? 'அசல் நகல்' : 'ORIGINAL COPY'}
                  </span>
                </div>
              </div>

              {/* Invoice Information structured table */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1.1fr',
                border: '1.5px solid #1e293b',
                borderRadius: '4px',
                overflow: 'hidden',
                fontSize: isCompact ? '10px' : '11px'
              }}>
                {/* Left side details */}
                <div style={{ padding: isCompact ? '5px 8px' : '8px 10px', borderRight: '1.5px solid #1e293b', display: 'flex', flexDirection: 'column', gap: isCompact ? '3px' : '5px', background: '#f8fafc' }}>
                  <div style={{ display: 'flex' }}>
                    <span style={{ width: lang === 'ta' ? '120px' : '90px', color: '#475569', fontWeight: '600', flexShrink: 0 }}>{lang === 'ta' ? 'பில் எண்:' : 'Invoice No:'}</span>
                    <strong style={{ color: '#0f172a', fontWeight: '800' }}>{order.invoice_number}</strong>
                  </div>
                  <div style={{ display: 'flex' }}>
                    <span style={{ width: lang === 'ta' ? '120px' : '90px', color: '#475569', fontWeight: '600', flexShrink: 0 }}>{lang === 'ta' ? 'பில் தேதி:' : 'Invoice Date:'}</span>
                    <span style={{ color: '#0f172a', fontWeight: '800' }}>{new Date(order.order_date).toLocaleDateString('en-GB')}</span>
                  </div>
                  <div style={{ display: 'flex' }}>
                    <span style={{ width: lang === 'ta' ? '120px' : '90px', color: '#475569', fontWeight: '600', flexShrink: 0 }}>{lang === 'ta' ? 'வழித்தடம்:' : 'Route:'}</span>
                    <span style={{ color: '#0f172a', fontWeight: '800' }}>{translateRouteName(route, lang)}</span>
                  </div>
                  <div style={{ display: 'flex' }}>
                    <span style={{ width: lang === 'ta' ? '120px' : '90px', color: '#475569', fontWeight: '600', flexShrink: 0 }}>{lang === 'ta' ? 'விற்பனையாளர்:' : 'Salesman:'}</span>
                    <span style={{ color: '#0f172a', fontWeight: '800' }}>{lang === 'ta' ? 'விநியோக நபர்' : 'Delivery Person'}</span>
                  </div>
                </div>
                {/* Right side Customer details */}
                <div style={{ padding: isCompact ? '5px 8px' : '8px 10px', display: 'flex', flexDirection: 'column', gap: isCompact ? '3px' : '5px' }}>
                  <div style={{ display: 'flex' }}>
                    <span style={{ width: lang === 'ta' ? '120px' : '100px', color: '#475569', fontWeight: '600', flexShrink: 0 }}>{lang === 'ta' ? 'வாடிக்கையாளர்:' : 'Customer Name:'}</span>
                    <strong style={{ color: '#0f172a', fontWeight: '800' }}>{translateShopName(shop, lang)}</strong>
                  </div>
                  <div style={{ display: 'flex' }}>
                    <span style={{ width: lang === 'ta' ? '120px' : '100px', color: '#475569', fontWeight: '600', flexShrink: 0 }}>{lang === 'ta' ? 'தொடர்பு எண்:' : 'Mobile No:'}</span>
                    <span style={{ color: '#0f172a', fontWeight: '800' }}>{shop ? shop.mobile : ''}</span>
                  </div>
                  <div style={{ display: 'flex' }}>
                    <span style={{ width: lang === 'ta' ? '120px' : '100px', color: '#475569', fontWeight: '600', flexShrink: 0 }}>{lang === 'ta' ? 'ஜிஎஸ்டி எண்:' : 'Customer GSTIN:'}</span>
                    <span style={{ color: '#0f172a', fontWeight: '800' }}>{shop ? shop.gst_number || 'N/A' : 'N/A'}</span>
                  </div>
                  <div style={{ display: 'flex' }}>
                    <span style={{ width: lang === 'ta' ? '120px' : '100px', color: '#475569', fontWeight: '600', flexShrink: 0 }}>{lang === 'ta' ? 'முகவரி:' : 'Shop Address:'}</span>
                    <span style={{ color: '#0f172a', fontWeight: '800' }}>{shop ? translateAddress(shop.address, lang) || 'N/A' : 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* Product Details Tabular Format */}
              <div style={{ border: '1.5px solid #1e293b', borderRadius: '4px', overflow: 'hidden' }}>
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: isCompact ? '10.5px' : '11px',
                  textAlign: 'left'
                }}>
                  <thead>
                    <tr style={{ background: '#ffffff', color: '#475569', borderBottom: '1.5px solid #1e293b' }}>
                      <th style={{ padding: isCompact ? '4px 6px' : '5px 6px', width: '30px', fontWeight: '700', color: '#475569', borderBottom: '1.5px solid #1e293b' }}>#</th>
                      <th style={{ padding: isCompact ? '4px 6px' : '5px 6px', fontWeight: '700', color: '#475569', borderBottom: '1.5px solid #1e293b' }}>
                        {lang === 'ta' ? 'பொருட்களின் விபரம்' : 'Product Name'}
                      </th>
                      <th style={{ padding: isCompact ? '4px 6px' : '5px 6px', width: '55px', fontWeight: '700', color: '#475569', borderBottom: '1.5px solid #1e293b', textAlign: 'center' }}>
                        {lang === 'ta' ? 'அளவு' : 'Size'}
                      </th>
                      <th style={{ padding: isCompact ? '4px 6px' : '5px 6px', width: '45px', textAlign: 'center', fontWeight: '700', color: '#475569', borderBottom: '1.5px solid #1e293b' }}>
                        {lang === 'ta' ? 'பெட்டி' : 'Cases'}
                      </th>
                      <th style={{ padding: isCompact ? '4px 6px' : '5px 6px', width: '45px', textAlign: 'center', fontWeight: '700', color: '#475569', borderBottom: '1.5px solid #1e293b' }}>
                        {lang === 'ta' ? 'பாட்டில்' : 'Bottles'}
                      </th>
                      <th style={{ padding: isCompact ? '4px 6px' : '5px 6px', width: '65px', textAlign: 'right', fontWeight: '700', color: '#475569', borderBottom: '1.5px solid #1e293b' }}>
                        {lang === 'ta' ? 'விகிதம்' : 'Rate'}
                      </th>
                      <th style={{ padding: isCompact ? '4px 6px' : '5px 6px', width: '75px', textAlign: 'right', fontWeight: '700', color: '#0284c7', borderBottom: '1.5px solid #1e293b' }}>
                        {lang === 'ta' ? 'வரித்தொகை' : 'Taxable'}
                      </th>
                      <th style={{ padding: isCompact ? '4px 6px' : '5px 6px', width: '50px', textAlign: 'center', fontWeight: '700', color: '#475569', borderBottom: '1.5px solid #1e293b' }}>
                        GST
                      </th>
                      <th style={{ padding: isCompact ? '4px 6px' : '5px 6px', width: '65px', textAlign: 'right', fontWeight: '700', color: '#0891b2', borderBottom: '1.5px solid #1e293b' }}>
                        CGST
                      </th>
                      <th style={{ padding: isCompact ? '4px 6px' : '5px 6px', width: '65px', textAlign: 'right', fontWeight: '700', color: '#16a34a', borderBottom: '1.5px solid #1e293b' }}>
                        SGST
                      </th>
                      <th style={{ padding: isCompact ? '4px 6px' : '5px 6px', width: '80px', textAlign: 'right', fontWeight: '800', color: '#0f172a', borderBottom: '1.5px solid #1e293b' }}>
                        {lang === 'ta' ? 'மொத்தம்' : 'Total'}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {gstBreakdown.items.map((item, idx) => {
                      const prod = item.product;
                      const rawName = prod ? translateProductName(prod, lang) : (item.product_name || 'Product');
                      const pSize = prod ? prod.size : (item.size || '');
                      const pName = pSize && !rawName.toLowerCase().includes(pSize.toLowerCase()) ? `${rawName} (${pSize})` : rawName;

                      return (
                        <tr key={item.id || idx} style={{
                          background: idx % 2 === 0 ? '#ffffff' : '#f8fafc',
                          borderBottom: '1px solid #cbd5e1'
                        }}>
                          <td style={{ padding: isCompact ? '3px 6px' : '5px 6px', color: '#0f172a', fontWeight: '700', textAlign: 'center' }}>{idx + 1}</td>
                          <td style={{ padding: isCompact ? '3px 6px' : '5px 6px', fontWeight: '800', color: '#0f172a' }}>{pName}</td>
                          <td style={{ padding: isCompact ? '3px 6px' : '5px 6px', color: '#475569', textAlign: 'center' }}>{pSize || '-'}</td>
                          <td style={{ padding: isCompact ? '3px 6px' : '5px 6px', textAlign: 'center', fontWeight: '700', color: '#0f172a' }}>{item.cases || 0}</td>
                          <td style={{ padding: isCompact ? '3px 6px' : '5px 6px', textAlign: 'center', fontWeight: '700', color: '#0f172a' }}>{item.bottles || 0}</td>
                          <td style={{ padding: isCompact ? '3px 6px' : '5px 6px', textAlign: 'right', color: '#0f172a', fontWeight: '600' }}>₹{item.rate}</td>
                          <td style={{ padding: isCompact ? '3px 6px' : '5px 6px', textAlign: 'right', color: '#0284c7', fontWeight: '700' }}>₹{item.taxableAmount}</td>
                          <td style={{ padding: isCompact ? '3px 6px' : '5px 6px', textAlign: 'center', fontWeight: '700', color: '#475569' }}>{item.gstRate}%</td>
                          <td style={{ padding: isCompact ? '3px 6px' : '5px 6px', textAlign: 'right', color: '#0891b2', fontWeight: '600' }}>₹{item.cgstAmount}</td>
                          <td style={{ padding: isCompact ? '3px 6px' : '5px 6px', textAlign: 'right', color: '#16a34a', fontWeight: '600' }}>₹{item.sgstAmount}</td>
                          <td style={{ padding: isCompact ? '3px 6px' : '5px 6px', textAlign: 'right', fontWeight: '800', color: '#0f172a' }}>₹{item.grandTotal}</td>
                        </tr>
                      );
                    })}
                    {/* Total Row */}
                    <tr style={{
                      background: '#ffffff',
                      borderTop: '2px solid #1e293b',
                      borderBottom: '2px solid #1e293b',
                      fontWeight: '800'
                    }}>
                      <td style={{ padding: isCompact ? '3px 6px' : '5px 6px' }}></td>
                      <td style={{ padding: isCompact ? '3px 6px' : '5px 6px', color: '#0f172a', fontWeight: '800' }}>{lang === 'ta' ? 'மொத்தம்' : 'Total'}</td>
                      <td style={{ padding: isCompact ? '3px 6px' : '5px 6px' }}></td>
                      <td style={{ padding: isCompact ? '3px 6px' : '5px 6px', textAlign: 'center', color: '#0f172a', fontWeight: '800' }}>
                        {gstBreakdown.items.reduce((sum, item) => sum + (Number(item.cases) || 0), 0)}
                      </td>
                      <td style={{ padding: isCompact ? '3px 6px' : '5px 6px', textAlign: 'center', color: '#0f172a', fontWeight: '800' }}>
                        {gstBreakdown.items.reduce((sum, item) => sum + (Number(item.bottles) || 0), 0)}
                      </td>
                      <td style={{ padding: isCompact ? '3px 6px' : '5px 6px', textAlign: 'right' }}></td>
                      <td style={{ padding: isCompact ? '3px 6px' : '5px 6px', textAlign: 'right', color: '#0284c7', fontWeight: '800' }}>
                        ₹{gstBreakdown.taxableAmount}
                      </td>
                      <td style={{ padding: isCompact ? '3px 6px' : '5px 6px' }}></td>
                      <td style={{ padding: isCompact ? '3px 6px' : '5px 6px', textAlign: 'right', color: '#0891b2', fontWeight: '800' }}>
                        ₹{gstBreakdown.totalCgst}
                      </td>
                      <td style={{ padding: isCompact ? '3px 6px' : '5px 6px', textAlign: 'right', color: '#16a34a', fontWeight: '800' }}>
                        ₹{gstBreakdown.totalSgst}
                      </td>
                      <td style={{ padding: isCompact ? '3px 6px' : '5px 6px', textAlign: 'right', fontWeight: '900', color: '#0f172a' }}>
                        ₹{gstBreakdown.grandTotalIncGst}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Bottom Summary Section & UPI QR Section */}
              {(() => {
                const upiVpa = (settings?.upi_mobile && settings.upi_mobile.includes('@')) 
                  ? settings.upi_mobile 
                  : 'gskumar9345@okicici';
                const upiName = 'Kumar .k';
                const billAmount = remainingOutstanding > 0 ? remainingOutstanding : (order.net_amount || 0);
                const formattedAmount = Number(billAmount > 0 ? billAmount : 0).toFixed(2);
                const upiUri = `upi://pay?pa=${upiVpa}&pn=${encodeURIComponent(upiName)}&am=${formattedAmount}&mam=1.00&cu=INR&tn=${encodeURIComponent(order.invoice_number || 'Bill')}`;
                const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(upiUri)}`;

                return (
                  <div style={{ marginTop: '4px', display: 'flex', flexDirection: 'column', gap: isCompact ? '6px' : '8px' }}>
                    
                    {/* Horizontal Financial Ledger & GST Breakdown Summary */}
                    <div style={{
                      border: '1.5px solid #1e293b',
                      borderRadius: '4px',
                      overflow: 'hidden',
                      background: '#ffffff',
                      fontSize: isCompact ? '9px' : '10px'
                    }}>
                      {/* Row 1: GST Breakdown (Horizontal) */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: gstBreakdown.discount > 0 
                          ? (gstBreakdown.totalIgst > 0 ? 'repeat(7, 1fr)' : 'repeat(6, 1fr)') 
                          : (gstBreakdown.totalIgst > 0 ? 'repeat(6, 1fr)' : 'repeat(5, 1fr)'),
                        background: '#f8fafc',
                        borderBottom: '1px solid #cbd5e1',
                        textAlign: 'center'
                      }}>
                        {gstBreakdown.discount > 0 && (
                          <div style={{ padding: isCompact ? '3px 4px' : '4px 6px', borderRight: '1px solid #cbd5e1' }}>
                            <span style={{ color: '#ef4444', fontSize: '8px', textTransform: 'uppercase', fontWeight: '700', display: 'block' }}>
                              {lang === 'ta' ? 'தள்ளுபடி' : 'Discount (-)'}
                            </span>
                            <strong style={{ color: '#ef4444', fontSize: isCompact ? '9.5px' : '10.5px' }}>-₹{gstBreakdown.discount}</strong>
                          </div>
                        )}

                        <div style={{ padding: isCompact ? '3px 4px' : '4px 6px', borderRight: '1px solid #cbd5e1', background: 'rgba(2, 132, 199, 0.08)' }}>
                          <span style={{ color: '#0284c7', fontSize: '8px', textTransform: 'uppercase', fontWeight: '800', display: 'block' }}>
                            {lang === 'ta' ? 'வரிக்கு உட்பட்டது' : 'Taxable Amount'}
                          </span>
                          <strong style={{ color: '#0284c7', fontSize: isCompact ? '10px' : '11px' }}>₹{gstBreakdown.taxableAmount}</strong>
                        </div>

                        <div style={{ padding: isCompact ? '3px 4px' : '4px 6px', borderRight: '1px solid #cbd5e1' }}>
                          <span style={{ color: '#0891b2', fontSize: '8px', textTransform: 'uppercase', fontWeight: '700', display: 'block' }}>
                            Total CGST
                          </span>
                          <strong style={{ color: '#0891b2', fontSize: isCompact ? '9.5px' : '10.5px' }}>₹{gstBreakdown.totalCgst}</strong>
                        </div>

                        <div style={{ padding: isCompact ? '3px 4px' : '4px 6px', borderRight: '1px solid #cbd5e1' }}>
                          <span style={{ color: '#16a34a', fontSize: '8px', textTransform: 'uppercase', fontWeight: '700', display: 'block' }}>
                            Total SGST
                          </span>
                          <strong style={{ color: '#16a34a', fontSize: isCompact ? '9.5px' : '10.5px' }}>₹{gstBreakdown.totalSgst}</strong>
                        </div>

                        {gstBreakdown.totalIgst > 0 && (
                          <div style={{ padding: isCompact ? '3px 4px' : '4px 6px', borderRight: '1px solid #cbd5e1' }}>
                            <span style={{ color: '#f59e0b', fontSize: '8px', textTransform: 'uppercase', fontWeight: '700', display: 'block' }}>
                              Total IGST
                            </span>
                            <strong style={{ color: '#f59e0b', fontSize: isCompact ? '9.5px' : '10.5px' }}>₹{gstBreakdown.totalIgst}</strong>
                          </div>
                        )}

                        <div style={{ padding: isCompact ? '3px 4px' : '4px 6px', borderRight: '1px solid #cbd5e1' }}>
                          <span style={{ color: '#d97706', fontSize: '8px', textTransform: 'uppercase', fontWeight: '700', display: 'block' }}>
                            Total GST
                          </span>
                          <strong style={{ color: '#d97706', fontSize: isCompact ? '9.5px' : '10.5px' }}>₹{gstBreakdown.totalGst}</strong>
                        </div>

                        <div style={{ padding: isCompact ? '3px 4px' : '4px 6px', background: 'rgba(15, 23, 42, 0.05)' }}>
                          <span style={{ color: '#0f172a', fontSize: '8px', textTransform: 'uppercase', fontWeight: '800', display: 'block' }}>
                            {lang === 'ta' ? 'ஜிஎஸ்டி மொத்தம்' : 'Grand Total (Inc. GST)'}
                          </span>
                          <strong style={{ color: '#0f172a', fontSize: isCompact ? '10.5px' : '11.5px' }}>₹{gstBreakdown.grandTotalIncGst}</strong>
                        </div>
                      </div>

                      {/* Row 2: Outstanding & Settlement (Horizontal) */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr 1fr 1.3fr',
                        background: '#ffffff',
                        textAlign: 'center',
                        alignItems: 'center'
                      }}>
                        <div style={{ padding: isCompact ? '4px 6px' : '6px 8px', borderRight: '1px solid #cbd5e1' }}>
                          <span style={{ color: '#475569', fontSize: '8.5px', textTransform: 'uppercase', fontWeight: '700', display: 'block' }}>
                            {lang === 'ta' ? 'பழைய நிலுவை' : 'Old Balance'}
                          </span>
                          <strong style={{ color: '#0f172a', fontSize: isCompact ? '10px' : '11px' }}>₹{outstandingBeforeOrder}</strong>
                        </div>

                        <div style={{ padding: isCompact ? '4px 6px' : '6px 8px', borderRight: '1px solid #cbd5e1' }}>
                          <span style={{ color: '#475569', fontSize: '8.5px', textTransform: 'uppercase', fontWeight: '700', display: 'block' }}>
                            {lang === 'ta' ? 'தற்போதைய பில்' : 'Current Bill Total'}
                          </span>
                          <strong style={{ color: '#0f172a', fontSize: isCompact ? '10px' : '11px' }}>₹{gstBreakdown.grandTotalIncGst}</strong>
                        </div>

                        <div style={{ padding: isCompact ? '4px 6px' : '6px 8px', borderRight: '1px solid #cbd5e1' }}>
                          <span style={{ color: '#16a34a', fontSize: '8.5px', textTransform: 'uppercase', fontWeight: '700', display: 'block' }}>
                            {lang === 'ta' ? 'வசூலிக்கப்பட்ட தொகை' : 'Amount Collected'}
                          </span>
                          <strong style={{ color: '#16a34a', fontSize: isCompact ? '10px' : '11px' }}>₹{totalCollected}</strong>
                        </div>

                        <div style={{
                          padding: isCompact ? '4px 8px' : '6px 10px',
                          background: remainingOutstanding > 0 ? '#fef2f2' : '#f0fdf4',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <span style={{
                            color: remainingOutstanding > 0 ? '#b91c1c' : '#15803d',
                            fontWeight: '900',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            fontSize: isCompact ? '9.5px' : '11px'
                          }}>
                            {lang === 'ta' ? 'செலுத்த வேண்டியது:' : 'AMOUNT DUE:'}
                          </span>
                          <strong style={{
                            color: remainingOutstanding > 0 ? '#b91c1c' : '#15803d',
                            fontWeight: '950',
                            fontSize: isCompact ? '12px' : '13.5px'
                          }}>
                            ₹{remainingOutstanding}
                          </strong>
                        </div>
                      </div>
                    </div>

                    {/* Payment Details & GPay QR Section */}
                    <div style={{
                      border: '1.5px solid #1e293b',
                      borderRadius: '4px',
                      padding: isCompact ? '4px 8px' : '6px 10px',
                      background: '#f8fafc',
                      display: 'flex',
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                      boxSizing: 'border-box'
                    }}>
                      {/* Payment Breakup List */}
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '3px', justifyContent: 'center' }}>
                        <strong style={{ fontSize: isCompact ? '9.5px' : '10.5px', color: '#1e293b', fontWeight: '800', textTransform: 'uppercase', borderBottom: '1px solid #cbd5e1', paddingBottom: '2px', marginBottom: '2px' }}>
                          {lang === 'ta' ? 'கட்டண விவரங்கள்' : 'PAYMENT BREAKUP'}
                        </strong>
                        {payments.length === 0 ? (
                          <span style={{ fontSize: isCompact ? '8.5px' : '9.5px', color: '#ef4444', fontWeight: '800' }}>
                            {lang === 'ta' ? 'நிலுவை (No payments collected)' : 'UNPAID / ON CREDIT'}
                          </span>
                        ) : (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                            {payments.map(p => (
                              <div key={p.id} style={{ fontSize: isCompact ? '8.5px' : '9.5px', color: '#0f172a' }}>
                                <span style={{ textTransform: 'uppercase', fontWeight: '700' }}>{p.payment_mode}:</span>
                                <strong style={{ color: '#0f172a', fontWeight: '800', marginLeft: '4px' }}>₹{p.collected_amount}</strong>
                                {p.transaction_number && <span style={{ color: '#64748b', fontSize: '8px', marginLeft: '2px' }}>({p.transaction_number})</span>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* GPay / UPI QR Code Box */}
                      <div style={{
                        display: 'flex',
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: '8px',
                        borderLeft: '1.5px dashed #cbd5e1',
                        paddingLeft: '10px'
                      }}>
                        <img 
                          src={qrUrl} 
                          alt="GPay QR Code" 
                          style={{ 
                            width: isCompact ? '48px' : '56px', 
                            height: isCompact ? '48px' : '56px', 
                            border: '1px solid #0f172a', 
                            padding: '1px', 
                            borderRadius: '4px',
                            background: '#ffffff'
                          }} 
                        />
                        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                          <span style={{ fontSize: isCompact ? '8.5px' : '9.5px', fontWeight: '900', color: '#0f172a' }}>
                            📱 {upiName}
                          </span>
                          <span style={{ fontSize: isCompact ? '7px' : '8px', fontWeight: '800', color: '#0284c7', wordBreak: 'break-all' }}>
                            {upiVpa}
                          </span>
                          <span style={{ fontSize: isCompact ? '7.5px' : '8.5px', fontWeight: '900', color: '#16a34a', marginTop: '1px' }}>
                            {lang === 'ta' ? `தொகை: ₹${billAmount}` : `Scan & Pay: ₹${billAmount}`}
                          </span>
                        </div>
                      </div>

                    </div>
                  </div>
                );
              })()}

              {/* Signature Sign-Off Areas */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: isCompact ? '20px' : '35px',
                padding: '0 12px'
              }}>
                <div style={{ textAlign: 'center', width: '200px' }}>
                  <div style={{ borderTop: '1px dashed #475569', paddingTop: '6px', fontSize: isCompact ? '8.5px' : '9.5px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {lang === 'ta' ? 'வாடிக்கையாளர் கையொப்பம்' : 'CUSTOMER SIGNATURE'}
                  </div>
                </div>
                <div style={{ textAlign: 'center', width: '200px' }}>
                  <div style={{ borderTop: '1px dashed #475569', paddingTop: '6px', fontSize: isCompact ? '8.5px' : '9.5px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {lang === 'ta' ? 'அங்கீகரிக்கப்பட்ட கையொப்பம்' : 'AUTHORISED SIGNATORY'}
                  </div>
                </div>
              </div>
            </div>

        {/* Buttons Controls */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }} className="no-print">
          {totalCollected < order.net_amount && (
            <button className="btn btn-primary" onClick={handleOpenPaymentModal} style={{ background: '#10b981', borderColor: '#10b981' }}>
              💵 {lang === 'ta' ? 'வசூல் செய் (Record Payment)' : 'Record Payment'}
            </button>
          )}

          <button className="btn btn-primary" onClick={handlePrint}>
            🖨️ {t('print_invoice')}
          </button>
          
          <button className="btn btn-secondary" onClick={handleDownloadPDF}>
            📥 {t('download_pdf')}
          </button>

          <button className="btn btn-secondary" onClick={handleExportExcel} style={{ color: 'var(--success)', borderColor: 'var(--success)' }}>
            📊 Excel Export
          </button>

          <button className="btn btn-secondary" onClick={handleExportCSV}>
            📑 CSV Export
          </button>

          <a className="btn btn-secondary" href={getWhatsAppLink()} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', background: '#128C7E', color: 'white', borderColor: '#128C7E' }}>
            💬 {t('share_whatsapp')}
          </a>
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
          <form onSubmit={handleModalPaymentSubmit} className="glass-card modal-card" style={{ maxWidth: '500px', width: '95%', margin: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: '700', margin: 0 }}>
                💵 {lang === 'ta' ? 'கட்டணம் வசூலித்தல்' : 'Collect Payment'} - {order.invoice_number}
              </h3>
              <button 
                type="button" 
                onClick={() => setShowPaymentModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.5rem', cursor: 'pointer', lineHeight: 1 }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', fontSize: '0.9rem' }}>
              <span>Invoice Net Amount:</span>
              <strong>₹{order.net_amount}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', fontSize: '0.9rem' }}>
              <span>Collected So Far:</span>
              <strong style={{ color: 'var(--success)' }}>₹{totalCollected}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', fontSize: '0.95rem', borderBottom: '1px dashed var(--border-color)', paddingBottom: '0.75rem' }}>
              <span>Remaining Balance:</span>
              <strong style={{ color: 'var(--danger)' }}>₹{order.net_amount - totalCollected}</strong>
            </div>

            {/* Split Payment Dynamic Rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontWeight: '700', fontSize: '0.85rem' }}>{t('split_payment')}</label>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem' }}
                  onClick={() => setModalPaymentRows([...modalPaymentRows, { payment_mode: 'gpay', collected_amount: 0, transaction_number: '', reference_number: '', payment_date: new Date().toISOString().split('T')[0] }])}
                >
                  ➕ Add Mode
                </button>
              </div>

              {modalPaymentRows.map((row, idx) => {
                const showMeta = ['gpay', 'bank', 'upi', 'cheque'].includes(row.payment_mode);
                return (
                  <div key={idx} style={{ padding: '0.5rem', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', position: 'relative' }}>
                    {modalPaymentRows.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setModalPaymentRows(modalPaymentRows.filter((_, i) => i !== idx))}
                        style={{ position: 'absolute', top: '0.25rem', right: '0.25rem', background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '0.85rem' }}
                      >
                        ✕
                      </button>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '0.5rem' }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ fontSize: '0.7rem' }}>{t('payment_mode')}</label>
                        <select
                          className="form-select"
                          style={{ padding: '0.3rem', fontSize: '0.8rem' }}
                          value={row.payment_mode}
                          onChange={e => {
                            const updated = [...modalPaymentRows];
                            updated[idx].payment_mode = e.target.value;
                            setModalPaymentRows(updated);
                          }}
                        >
                          <option value="cash">💵 {t('cash') || 'Cash'}</option>
                          <option value="gpay">📱 {t('gpay') || 'GPay / UPI'}</option>
                          <option value="cheque">🏦 {t('cheque') || 'Cheque'}</option>
                        </select>
                      </div>

                      <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ fontSize: '0.7rem' }}>Amount (₹)</label>
                        <input
                          type="number"
                          className="form-input"
                          style={{ padding: '0.3rem', fontSize: '0.8rem' }}
                          value={row.collected_amount || ''}
                          onChange={e => {
                            const updated = [...modalPaymentRows];
                            updated[idx].collected_amount = Math.max(0, parseInt(e.target.value) || 0);
                            setModalPaymentRows(updated);
                          }}
                        />
                      </div>
                    </div>

                    {showMeta && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.4rem', marginTop: '0.4rem' }}>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label style={{ fontSize: '0.65rem' }}>{t('transaction_id')}</label>
                          <input
                            type="text"
                            className="form-input"
                            style={{ padding: '0.25rem', fontSize: '0.75rem' }}
                            value={row.transaction_number || ''}
                            onChange={e => {
                              const updated = [...modalPaymentRows];
                              updated[idx].transaction_number = e.target.value;
                              setModalPaymentRows(updated);
                            }}
                            placeholder="TXN ID"
                          />
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label style={{ fontSize: '0.65rem' }}>{t('ref_number')}</label>
                          <input
                            type="text"
                            className="form-input"
                            style={{ padding: '0.25rem', fontSize: '0.75rem' }}
                            value={row.reference_number || ''}
                            onChange={e => {
                              const updated = [...modalPaymentRows];
                              updated[idx].reference_number = e.target.value;
                              setModalPaymentRows(updated);
                            }}
                            placeholder="Ref No"
                          />
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label style={{ fontSize: '0.65rem' }}>{t('payment_date')}</label>
                          <input
                            type="date"
                            className="form-input"
                            style={{ padding: '0.2rem', fontSize: '0.75rem' }}
                            value={row.payment_date}
                            onChange={e => {
                              const updated = [...modalPaymentRows];
                              updated[idx].payment_date = e.target.value;
                              setModalPaymentRows(updated);
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => setShowPaymentModal(false)}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="btn btn-primary"
              >
                Record Payment
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
