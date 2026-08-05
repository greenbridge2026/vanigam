import React, { useState, useEffect } from 'react';
import api from '../api';
import html2pdf from 'html2pdf.js';

export default function Billing({ orderId, t, lang, onBack }) {
  const [order, setOrder] = useState(null);
  const [orderItems, setOrderItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [shop, setShop] = useState(null);
  const [route, setRoute] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState({
    company_name: "GSK Agency",
    company_address: "Cooldrinks Shop - Tindivanam",
    company_gst: "33CWRPK4071L1Z2",
    upi_mobile: "9345463415"
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
    async function loadInvoiceData() {
      if (!orderId) return;
      try {
        const [ordData, itemData, prodData, shopData, routeData, payData] = await Promise.all([
          api.getOrders(),
          api.getOrderItems(),
          api.getProducts(),
          api.getShops(),
          api.getRoutes(),
          api.getPayments()
        ]);

        const currentOrder = ordData.find(o => o.id === orderId);
        if (currentOrder) {
          setOrder(currentOrder);
          
          const items = itemData.filter(oi => oi.order_id === orderId);
          setOrderItems(items);

          const currentShop = shopData.find(s => s.id === currentOrder.shop_id);
          setShop(currentShop);

          const currentRoute = routeData.find(r => r.id === currentOrder.route_id);
          setRoute(currentRoute);

          // Find payment for this order
          const paymentList = payData.filter(p => p.order_id === orderId);
          setPayments(paymentList);
        }
        setProducts(prodData);
      } catch (err) {
        console.error('Failed to load invoice details', err);
      } finally {
        setLoading(false);
      }
    }
    loadInvoiceData();
  }, [orderId]);

  if (loading) return <div style={{ color: 'var(--text-muted)', textAlign: 'center' }}>Loading Invoice...</div>;
  if (!order) return <div style={{ color: 'var(--danger)', textAlign: 'center' }}>Invoice not found</div>;

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
  const outstandingBeforeOrder = shop ? shop.outstanding_amount + totalCollected - order.net_amount : 0;
  const remainingOutstanding = shop ? shop.outstanding_amount : 0;

  return (
    <div>
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
          border: '2px solid #1e293b',
          padding: '20px',
          background: '#ffffff',
          color: '#0f172a',
          width: '100%',
          maxWidth: '7.8in',
          margin: '0 auto',
          boxSizing: 'border-box',
          fontFamily: '"Outfit", "Noto Sans Tamil", "Inter", sans-serif',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          
          {/* Company Branding & Tax Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2.5px solid #1e293b', paddingBottom: '10px' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              {/* Simple Wholesale Logo Symbol */}
              <div style={{
                background: '#1e293b',
                color: '#ffffff',
                fontWeight: '800',
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
                <h2 style={{ fontSize: '20px', fontWeight: '800', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#1e293b' }}>
                  {settings.company_name}
                </h2>
                <p style={{ fontSize: '10px', color: '#475569', margin: '3px 0 1px 0', fontWeight: '500' }}>
                  📍 {settings.company_address}
                </p>
                <div style={{ display: 'flex', gap: '10px', fontSize: '10px', color: '#475569', fontWeight: '600' }}>
                  <span>📞 Mob: {settings.upi_mobile}</span>
                  <span>|</span>
                  <span>GSTIN: <strong style={{ color: '#0f172a' }}>{settings.company_gst}</strong></span>
                </div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <h1 style={{ fontSize: '18px', fontWeight: '900', color: '#1e293b', margin: 0, letterSpacing: '0.5px' }}>
                TAX INVOICE
              </h1>
              <p style={{ fontSize: '10px', fontWeight: 'bold', color: '#475569', margin: '3px 0 0 0', textTransform: 'uppercase' }}>
                வரி விலைப்பட்டியல்
              </p>
              <span style={{ fontSize: '8px', color: '#64748b', border: '1px solid #cbd5e1', padding: '2px 6px', borderRadius: '3px', display: 'inline-block', marginTop: '6px', fontWeight: '600' }}>
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
            fontSize: '11px'
          }}>
            {/* Left side details */}
            <div style={{ padding: '8px 10px', borderRight: '1.5px solid #1e293b', display: 'flex', flexDirection: 'column', gap: '5px', background: '#f8fafc' }}>
              <div style={{ display: 'flex' }}>
                <span style={{ width: '90px', color: '#475569', fontWeight: '600' }}>{lang === 'ta' ? 'பில் எண்:' : 'Invoice No:'}</span>
                <strong style={{ color: '#0f172a' }}>{order.invoice_number}</strong>
              </div>
              <div style={{ display: 'flex' }}>
                <span style={{ width: '90px', color: '#475569', fontWeight: '600' }}>{lang === 'ta' ? 'பில் தேதி:' : 'Invoice Date:'}</span>
                <span>{new Date(order.order_date).toLocaleDateString('en-GB')}</span>
              </div>
              <div style={{ display: 'flex' }}>
                <span style={{ width: '90px', color: '#475569', fontWeight: '600' }}>{lang === 'ta' ? 'வழித்தடம்:' : 'Route:'}</span>
                <span>{route ? (lang === 'ta' ? route.name_ta : route.name_en) : ''}</span>
              </div>
              <div style={{ display: 'flex' }}>
                <span style={{ width: '90px', color: '#475569', fontWeight: '600' }}>{lang === 'ta' ? 'விற்பனையாளர்:' : 'Salesman:'}</span>
                <span>{lang === 'ta' ? 'விநியோக நபர்' : 'Delivery Person'}</span>
              </div>
            </div>
            {/* Right side Customer details */}
            <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <div style={{ display: 'flex' }}>
                <span style={{ width: '100px', color: '#475569', fontWeight: '600' }}>{lang === 'ta' ? 'வாடிக்கையாளர்:' : 'Customer Name:'}</span>
                <strong style={{ color: '#1e293b' }}>{shop ? (lang === 'ta' ? shop.name_ta : shop.name_en) : ''}</strong>
              </div>
              <div style={{ display: 'flex' }}>
                <span style={{ width: '100px', color: '#475569', fontWeight: '600' }}>{lang === 'ta' ? 'தொடர்பு எண்:' : 'Mobile No:'}</span>
                <span>{shop ? shop.mobile : ''}</span>
              </div>
              <div style={{ display: 'flex' }}>
                <span style={{ width: '100px', color: '#475569', fontWeight: '600' }}>{lang === 'ta' ? 'ஜிஎஸ்டி எண்:' : 'Customer GSTIN:'}</span>
                <span style={{ fontWeight: '600' }}>{shop ? shop.gst_number || 'N/A' : 'N/A'}</span>
              </div>
              <div style={{ display: 'flex' }}>
                <span style={{ width: '100px', color: '#475569', fontWeight: '600' }}>{lang === 'ta' ? 'முகவரி:' : 'Shop Address:'}</span>
                <span style={{ color: '#334155' }}>{shop ? (lang === 'ta' ? shop.address_ta || shop.address_en : shop.address_en) : ''}</span>
              </div>
            </div>
          </div>

          {/* Product Details Tabular Format */}
          <div style={{ border: '1.5px solid #1e293b', borderRadius: '4px', overflow: 'hidden' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '11px',
              textAlign: 'left'
            }}>
              <thead>
                <tr style={{ background: '#1e293b', color: '#ffffff' }}>
                  <th style={{ padding: '6px 8px', width: '40px', fontWeight: '700', borderBottom: '1.5px solid #1e293b' }}>S.No</th>
                  <th style={{ padding: '6px 8px', fontWeight: '700', borderBottom: '1.5px solid #1e293b' }}>
                    {lang === 'ta' ? 'பொருட்களின் விபரம்' : 'Product Name'}
                  </th>
                  <th style={{ padding: '6px 8px', width: '70px', fontWeight: '700', borderBottom: '1.5px solid #1e293b' }}>
                    {lang === 'ta' ? 'அளவு' : 'Size'}
                  </th>
                  <th style={{ padding: '6px 8px', width: '60px', textAlign: 'center', fontWeight: '700', borderBottom: '1.5px solid #1e293b' }}>
                    {lang === 'ta' ? 'பெட்டி' : 'Cases'}
                  </th>
                  <th style={{ padding: '6px 8px', width: '60px', textAlign: 'center', fontWeight: '700', borderBottom: '1.5px solid #1e293b' }}>
                    {lang === 'ta' ? 'பாட்டில்' : 'Bottles'}
                  </th>
                  <th style={{ padding: '6px 8px', width: '80px', textAlign: 'right', fontWeight: '700', borderBottom: '1.5px solid #1e293b' }}>
                    {lang === 'ta' ? 'விகிதம்' : 'Rate'}
                  </th>
                  <th style={{ padding: '6px 8px', width: '90px', textAlign: 'right', fontWeight: '700', borderBottom: '1.5px solid #1e293b' }}>
                    {lang === 'ta' ? 'தொகை' : 'Amount'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {orderItems.map((item, idx) => {
                  const prod = products.find(p => p.id === item.product_id);
                  const pName = prod ? (lang === 'ta' ? prod.name_ta : prod.name_en) : 'Product';
                  const pSize = prod ? prod.size : '';

                  return (
                    <tr key={item.id} style={{
                      background: idx % 2 === 0 ? '#ffffff' : '#f8fafc',
                      borderBottom: '1px solid #cbd5e1'
                    }}>
                      <td style={{ padding: '6px 8px', color: '#64748b', fontWeight: '500' }}>{idx + 1}</td>
                      <td style={{ padding: '6px 8px', fontWeight: '600', color: '#1e293b' }}>{pName}</td>
                      <td style={{ padding: '6px 8px', color: '#475569' }}>{pSize}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'center', fontWeight: '600' }}>{item.cases || 0}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'center' }}>{item.bottles || 0}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', color: '#475569' }}>₹{item.rate}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: '700', color: '#0f172a' }}>₹{item.amount}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Bottom Summary Section & UPI QR Section */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '15px', marginTop: '4px' }}>
            
            {/* Payment Details Section */}
            <div style={{
              border: '1.5px solid #1e293b',
              borderRadius: '4px',
              padding: '10px 12px',
              background: '#f8fafc',
              display: 'flex',
              gap: '12px',
              alignItems: 'center',
              boxSizing: 'border-box'
            }}>
              {/* QR Code Container */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                <svg viewBox="0 0 100 100" style={{ width: '70px', height: '70px', background: '#ffffff', padding: '3px', border: '1px solid #cbd5e1' }}>
                  <rect width="100" height="100" fill="white" />
                  <rect x="10" y="10" width="20" height="20" fill="black" />
                  <rect x="15" y="15" width="10" height="10" fill="white" />
                  <rect x="70" y="10" width="20" height="20" fill="black" />
                  <rect x="75" y="15" width="10" height="10" fill="white" />
                  <rect x="10" y="70" width="20" height="20" fill="black" />
                  <rect x="15" y="75" width="10" height="10" fill="white" />
                  <rect x="40" y="40" width="20" height="20" fill="black" />
                  <path d="M 35 15 H 65 V 25 H 35 Z M 15 35 H 25 V 65 H 15 Z M 45 75 H 85 V 85 H 45 Z" fill="black" />
                </svg>
                <span style={{ fontSize: '7px', fontWeight: 'bold', color: '#475569', textTransform: 'uppercase' }}>GPay QR Scanner</span>
              </div>
              {/* Merchant / UPI Info */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '9.5px', color: '#334155' }}>
                <strong style={{ fontSize: '11px', color: '#1e293b', textTransform: 'uppercase' }}>
                  {lang === 'ta' ? 'யூபிஐ கட்டணம்' : 'UPI Payment'}
                </strong>
                <span>{lang === 'ta' ? 'கியூஆர் ஸ்கேன் செய்து செலுத்தலாம்' : 'Scan to pay directly from mobile bank apps.'}</span>
                <div style={{ marginTop: '2px', fontWeight: '700' }}>
                  <div>📞 Mobile: {settings.upi_mobile}</div>
                </div>
                <p style={{ fontSize: '7.5px', color: '#64748b', fontStyle: 'italic', margin: '4px 0 0 0' }}>
                  * All disputes subject to local jurisdiction.
                </p>
              </div>
            </div>

            {/* Structured Financial Ledger Summary */}
            <div style={{
              border: '1.5px solid #1e293b',
              borderRadius: '4px',
              overflow: 'hidden',
              fontSize: '11px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxSizing: 'border-box'
            }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 8px', borderBottom: '1px solid #cbd5e1' }}>
                  <span style={{ color: '#475569', fontWeight: '500' }}>{lang === 'ta' ? 'துணைத்தொகை:' : 'Subtotal:'}</span>
                  <span style={{ fontWeight: '600' }}>₹{order.total_amount}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 8px', borderBottom: '1px solid #cbd5e1' }}>
                  <span style={{ color: '#475569', fontWeight: '500' }}>{lang === 'ta' ? 'தள்ளுபடி:' : 'Discount:'}</span>
                  <span style={{ fontWeight: '600', color: '#ef4444' }}>-₹{order.discount}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 8px', borderBottom: '1px solid #cbd5e1' }}>
                  <span style={{ color: '#475569', fontWeight: '500' }}>{lang === 'ta' ? 'முந்தைய நிலுவை:' : 'Prev Outstanding:'}</span>
                  <span style={{ fontWeight: '600' }}>₹{outstandingBeforeOrder}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 8px', borderBottom: '1px solid #cbd5e1' }}>
                  <span style={{ color: '#475569', fontWeight: '500' }}>{lang === 'ta' ? 'வசூலிக்கப்பட்ட தொகை:' : 'Amount Collected:'}</span>
                  <span style={{ fontWeight: '600', color: '#10b981' }}>₹{totalCollected}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 8px', borderBottom: '1px solid #cbd5e1' }}>
                  <span style={{ color: '#475569', fontWeight: '500' }}>{lang === 'ta' ? 'நிகர நிலுவை:' : 'Net Outstanding:'}</span>
                  <span style={{ fontWeight: '700', color: '#ef4444' }}>₹{remainingOutstanding}</span>
                </div>
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '7px 8px',
                background: '#1e293b',
                color: '#ffffff',
                fontWeight: '800',
                fontSize: '13px'
              }}>
                <span>{lang === 'ta' ? 'மொத்த தொகை:' : 'GRAND TOTAL:'}</span>
                <span>₹{order.net_amount}</span>
              </div>
            </div>
          </div>

          {/* Signature Sign-Off Areas */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: '30px',
            padding: '0 8px'
          }}>
            <div style={{ textAlign: 'center', width: '180px' }}>
              <div style={{ borderTop: '1px dashed #475569', paddingTop: '6px', fontSize: '9px', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>
                {lang === 'ta' ? 'வாடிக்கையாளர் கையொப்பம்' : 'Customer Signature'}
              </div>
            </div>
            <div style={{ textAlign: 'center', width: '180px' }}>
              <div style={{ borderTop: '1px dashed #475569', paddingTop: '6px', fontSize: '9px', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>
                {lang === 'ta' ? 'அங்கீகரிக்கப்பட்ட கையொப்பம்' : 'Authorised Signatory'}
              </div>
            </div>
          </div>
        </div>

        {/* Buttons Controls */}
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }} className="no-print">
          <button className="btn btn-primary" onClick={handlePrint}>
            🖨️ {t('print_invoice')} (A4 Half Size)
          </button>
          
          <button className="btn btn-secondary" onClick={handleDownloadPDF}>
            📥 {t('download_pdf')}
          </button>

          <a className="btn btn-secondary" href={getWhatsAppLink()} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', background: '#128C7E', color: 'white', borderColor: '#128C7E' }}>
            💬 {t('share_whatsapp')}
          </a>
        </div>
      </div>
    </div>
  );
}
