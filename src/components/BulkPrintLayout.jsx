import React, { useState, useEffect } from 'react';
import api from '../api';
import { translateShopName, translateRouteName, translateProductName, translateAddress } from '../translations';

export default function BulkPrintLayout({ orderIds, t, lang, onBack }) {
  const [orders, setOrders] = useState([]);
  const [orderItems, setOrderItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [shops, setShops] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState({
    company_name: "GSK Agency",
    company_address: "Cooldrinks Shop - Tindivanam",
    company_gst: "33CWRPK4071L1Z2",
    upi_mobile: "9345463415"
  });

  useEffect(() => {
    async function loadData() {
      try {
        const [ordData, itemData, prodData, shopData, routeData, payData, settData] = await Promise.all([
          api.getOrders(),
          api.getOrderItems(),
          api.getProducts(),
          api.getShops(),
          api.getRoutes(),
          api.getPayments(),
          api.getSettings()
        ]);
        setOrders(ordData);
        setOrderItems(itemData);
        setProducts(prodData);
        setShops(shopData);
        setRoutes(routeData);
        setPayments(payData);
        if (settData) setSettings(settData);
      } catch (err) {
        console.error('Failed to load bulk print datasets', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [orderIds]);

  const handlePrintAll = () => {
    window.print();
  };

  if (loading) return <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>Loading Invoices for Printing...</div>;

  return (
    <div>
      <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} className="no-print">
        <div>
          <h1 style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>🖨️ {lang === 'ta' ? 'மொத்த விலைப்பட்டியல்கள் அச்சிடுதல்' : 'Bulk Print Invoices'}</h1>
          <p style={{ color: 'var(--text-muted)' }}>
            {lang === 'ta' ? `தேர்ந்தெடுக்கப்பட்ட ${orderIds.length} பில்களை அச்சிடவும்` : `Print all ${orderIds.length} selected invoices`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className="btn btn-secondary" onClick={onBack}>
            {lang === 'ta' ? '⬅ பின்னால்' : '⬅ Back'}
          </button>
          <button className="btn btn-primary" onClick={handlePrintAll}>
            🖨️ {lang === 'ta' ? 'அனைத்தையும் அச்சிடு' : 'Print All Invoices'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '3.5rem', alignItems: 'center' }}>
        {orderIds.map((orderId, index) => {
          const order = orders.find(o => o.id === orderId);
          if (!order) return null;

          const shop = shops.find(s => s.id === order.shop_id);
          const route = routes.find(r => r.id === order.route_id);
          const currentItems = orderItems.filter(oi => oi.order_id === orderId);
          const currentPayments = payments.filter(p => p.order_id === orderId);

          const totalCollected = currentPayments.reduce((sum, p) => sum + p.collected_amount, 0);
          const outstandingBeforeOrder = shop ? shop.outstanding_amount + totalCollected - order.net_amount : 0;
          const remainingOutstanding = shop ? shop.outstanding_amount : 0;
          const isCompact = currentItems.length <= 5;

          return (
            <div key={order.id} className="invoice-card" style={{
              border: '2px solid #1e293b',
              padding: isCompact ? '12px' : '20px',
              background: '#ffffff',
              color: '#0f172a',
              width: '100%',
              maxWidth: '7.8in',
              boxSizing: 'border-box',
              fontFamily: '"Outfit", "Noto Sans Tamil", "Inter", sans-serif',
              display: 'flex',
              flexDirection: 'column',
              gap: isCompact ? '6px' : '12px',
              minHeight: isCompact ? '5.2in' : 'auto',
              maxHeight: isCompact ? '5.5in' : 'auto',
              pageBreakAfter: index === orderIds.length - 1 ? 'auto' : 'always',
              marginBottom: '1rem'
            }}>
              {/* Company Branding & Tax Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: isCompact ? '1.5px solid #1e293b' : '2.5px solid #1e293b', paddingBottom: isCompact ? '6px' : '10px' }}>
                <div style={{ display: 'flex', gap: isCompact ? '8px' : '12px', alignItems: 'center' }}>
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
                    justifyContent: 'center'
                  }}>
                    GSK
                  </div>
                  <div>
                    <h2 style={{ fontSize: isCompact ? '16px' : '20px', fontWeight: '800', margin: 0, textTransform: 'uppercase', color: '#1e293b' }}>
                      {settings.company_name}
                    </h2>
                    <p style={{ fontSize: isCompact ? '9px' : '10px', color: '#475569', margin: isCompact ? '1px 0' : '3px 0 1px 0', fontWeight: '500' }}>
                      📍 {settings.company_address}
                    </p>
                    <div style={{ display: 'flex', gap: '10px', fontSize: isCompact ? '9px' : '10px', color: '#475569', fontWeight: '600' }}>
                      <span>📞 Mob: {settings.upi_mobile}</span>
                      <span>|</span>
                      <span>GSTIN: <strong>{settings.company_gst}</strong></span>
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <h1 style={{ fontSize: isCompact ? '15px' : '18px', fontWeight: '900', color: '#1e293b', margin: 0 }}>
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
                <div style={{ padding: isCompact ? '5px 8px' : '8px 10px', borderRight: '1.5px solid #1e293b', display: 'flex', flexDirection: 'column', gap: isCompact ? '3px' : '5px', background: '#f8fafc' }}>
                  <div style={{ display: 'flex' }}>
                    <span style={{ width: lang === 'ta' ? '120px' : '90px', color: '#475569', fontWeight: '600', flexShrink: 0 }}>{lang === 'ta' ? 'பில் எண்:' : 'Invoice No:'}</span>
                    <strong style={{ color: '#0f172a' }}>{order.invoice_number}</strong>
                  </div>
                  <div style={{ display: 'flex' }}>
                    <span style={{ width: lang === 'ta' ? '120px' : '90px', color: '#475569', fontWeight: '600', flexShrink: 0 }}>{lang === 'ta' ? 'பில் தேதி:' : 'Invoice Date:'}</span>
                    <span>{new Date(order.order_date).toLocaleDateString('en-GB')}</span>
                  </div>
                  <div style={{ display: 'flex' }}>
                    <span style={{ width: lang === 'ta' ? '120px' : '90px', color: '#475569', fontWeight: '600', flexShrink: 0 }}>{lang === 'ta' ? 'வழித்தடம்:' : 'Route:'}</span>
                    <span>{translateRouteName(route, lang)}</span>
                  </div>
                  <div style={{ display: 'flex' }}>
                    <span style={{ width: lang === 'ta' ? '120px' : '90px', color: '#475569', fontWeight: '600', flexShrink: 0 }}>{lang === 'ta' ? 'விற்பனையாளர்:' : 'Salesman:'}</span>
                    <span>{lang === 'ta' ? 'விநியோக நபர்' : 'Delivery Person'}</span>
                  </div>
                </div>
                <div style={{ padding: isCompact ? '5px 8px' : '8px 10px', display: 'flex', flexDirection: 'column', gap: isCompact ? '3px' : '5px' }}>
                  <div style={{ display: 'flex' }}>
                    <span style={{ width: lang === 'ta' ? '120px' : '100px', color: '#475569', fontWeight: '600', flexShrink: 0 }}>{lang === 'ta' ? 'வாடிக்கையாளர்:' : 'Customer Name:'}</span>
                    <strong style={{ color: '#1e293b' }}>{translateShopName(shop, lang)}</strong>
                  </div>
                  <div style={{ display: 'flex' }}>
                    <span style={{ width: lang === 'ta' ? '120px' : '100px', color: '#475569', fontWeight: '600', flexShrink: 0 }}>{lang === 'ta' ? 'தொடர்பு எண்:' : 'Mobile No:'}</span>
                    <span>{shop ? shop.mobile : ''}</span>
                  </div>
                  <div style={{ display: 'flex' }}>
                    <span style={{ width: lang === 'ta' ? '120px' : '100px', color: '#475569', fontWeight: '600', flexShrink: 0 }}>{lang === 'ta' ? 'ஜிஎஸ்டி எண்:' : 'Customer GSTIN:'}</span>
                    <span style={{ fontWeight: '600' }}>{shop ? shop.gst_number || 'N/A' : 'N/A'}</span>
                  </div>
                  <div style={{ display: 'flex' }}>
                    <span style={{ width: lang === 'ta' ? '120px' : '100px', color: '#475569', fontWeight: '600', flexShrink: 0 }}>{lang === 'ta' ? 'முகவரி:' : 'Shop Address:'}</span>
                    <span style={{ color: '#334155' }}>{shop ? translateAddress(shop.address, lang) || 'N/A' : 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* Product Details Table */}
              <div style={{ border: '1.5px solid #1e293b', borderRadius: '4px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: isCompact ? '10.5px' : '11px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: '#1e293b', color: '#ffffff' }}>
                      <th style={{ padding: isCompact ? '4px 6px' : '6px 8px', width: '40px', fontWeight: '700' }}>S.No</th>
                      <th style={{ padding: isCompact ? '4px 6px' : '6px 8px', fontWeight: '700' }}>{lang === 'ta' ? 'பொருட்களின் விபரம்' : 'Product Name'}</th>
                      {!isCompact && <th style={{ padding: '6px 8px', width: '70px', fontWeight: '700' }}>{lang === 'ta' ? 'அளவு' : 'Size'}</th>}
                      <th style={{ padding: isCompact ? '4px 6px' : '6px 8px', width: '60px', textAlign: 'center', fontWeight: '700' }}>{lang === 'ta' ? 'பெட்டி' : 'Cases'}</th>
                      <th style={{ padding: isCompact ? '4px 6px' : '6px 8px', width: '60px', textAlign: 'center', fontWeight: '700' }}>{lang === 'ta' ? 'பாட்டில்' : 'Bottles'}</th>
                      <th style={{ padding: isCompact ? '4px 6px' : '6px 8px', width: '80px', textAlign: 'right', fontWeight: '700' }}>{lang === 'ta' ? 'விகிதம்' : 'Rate'}</th>
                      <th style={{ padding: isCompact ? '4px 6px' : '6px 8px', width: '90px', textAlign: 'right', fontWeight: '700' }}>{lang === 'ta' ? 'தொகை' : 'Amount'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentItems.map((item, idx) => {
                      const prod = products.find(p => p.id === item.product_id);
                      const pName = prod ? translateProductName(prod, lang) : 'Product';
                      const pSize = prod ? prod.size : '';

                      return (
                        <tr key={item.id} style={{ background: idx % 2 === 0 ? '#ffffff' : '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                          <td style={{ padding: isCompact ? '4px 6px' : '6px 8px', color: '#64748b' }}>{idx + 1}</td>
                          <td style={{ padding: isCompact ? '4px 6px' : '6px 8px', fontWeight: '600', color: '#1e293b' }}>{pName}</td>
                          {!isCompact && <td style={{ padding: '6px 8px', color: '#475569' }}>{pSize}</td>}
                          <td style={{ padding: isCompact ? '4px 6px' : '6px 8px', textAlign: 'center', fontWeight: '600' }}>{item.cases || 0}</td>
                          <td style={{ padding: isCompact ? '4px 6px' : '6px 8px', textAlign: 'center' }}>{item.bottles || 0}</td>
                          <td style={{ padding: isCompact ? '4px 6px' : '6px 8px', textAlign: 'right', color: '#475569' }}>₹{item.rate}</td>
                          <td style={{ padding: isCompact ? '4px 6px' : '6px 8px', textAlign: 'right', fontWeight: '700', color: '#0f172a' }}>₹{item.amount}</td>
                        </tr>
                      );
                    })}
                    {/* Total Row */}
                    <tr style={{
                      background: '#f8fafc',
                      borderTop: '2px solid #1e293b',
                      borderBottom: '2px solid #1e293b',
                      fontWeight: '700'
                    }}>
                      <td style={{ padding: isCompact ? '4px 6px' : '6px 8px' }}></td>
                      <td style={{ padding: isCompact ? '4px 6px' : '6px 8px', color: '#1e293b' }}>{lang === 'ta' ? 'மொத்தம்' : 'Total'}</td>
                      {!isCompact && <td style={{ padding: '6px 8px' }}></td>}
                      <td style={{ padding: isCompact ? '4px 6px' : '6px 8px', textAlign: 'center', color: '#1e293b', fontWeight: '800' }}>
                        {currentItems.reduce((sum, item) => sum + (Number(item.cases) || 0), 0)}
                      </td>
                      <td style={{ padding: isCompact ? '4px 6px' : '6px 8px', textAlign: 'center', color: '#1e293b', fontWeight: '800' }}>
                        {currentItems.reduce((sum, item) => sum + (Number(item.bottles) || 0), 0)}
                      </td>
                      <td style={{ padding: isCompact ? '4px 6px' : '6px 8px', textAlign: 'right' }}></td>
                      <td style={{ padding: isCompact ? '4px 6px' : '6px 8px', textAlign: 'right', fontWeight: '800', color: '#0f172a' }}>
                        ₹{currentItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Bottom Summary Section */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: isCompact ? '10px' : '15px', marginTop: '2px' }}>
                <div style={{ border: '1.5px solid #1e293b', borderRadius: '4px', padding: isCompact ? '6px 10px' : '10px 12px', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '4px', justifyContent: 'center' }}>
                  <strong style={{ fontSize: isCompact ? '10px' : '11px', color: '#1e293b', textTransform: 'uppercase', borderBottom: '1px solid #cbd5e1', paddingBottom: '3px', marginBottom: '2px' }}>
                    {lang === 'ta' ? 'கட்டண விவரங்கள்' : 'Payment Information'}
                  </strong>
                  <span style={{ fontSize: isCompact ? '8.5px' : '9.5px', color: '#334155' }}>
                    {lang === 'ta' ? 'கட்டணங்கள் ரொக்கம் அல்லது காசோலை மூலம் பெறப்படும்.' : 'Accepted Payments: Cash or Cheque.'}
                  </span>
                </div>

                <div style={{ border: '1.5px solid #1e293b', borderRadius: '4px', overflow: 'hidden', fontSize: isCompact ? '10px' : '11px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: isCompact ? '3px 6px' : '5px 8px', borderBottom: '1px solid #cbd5e1' }}>
                      <span style={{ color: '#475569' }}>{lang === 'ta' ? 'துணைத்தொகை:' : 'Subtotal:'}</span>
                      <span style={{ fontWeight: '600' }}>₹{order.total_amount}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: isCompact ? '3px 6px' : '5px 8px', borderBottom: '1px solid #cbd5e1' }}>
                      <span style={{ color: '#475569' }}>{lang === 'ta' ? 'தள்ளுபடி:' : 'Discount:'}</span>
                      <span style={{ fontWeight: '600', color: '#ef4444' }}>-₹{order.discount}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: isCompact ? '3px 6px' : '5px 8px', borderBottom: '1px solid #cbd5e1' }}>
                      <span style={{ color: '#475569' }}>{lang === 'ta' ? 'முந்தைய நிலுவை:' : 'Prev Outstanding:'}</span>
                      <span style={{ fontWeight: '600' }}>₹{outstandingBeforeOrder}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: isCompact ? '3px 6px' : '5px 8px', borderBottom: '1px solid #cbd5e1' }}>
                      <span style={{ color: '#475569' }}>{lang === 'ta' ? 'வசூலிக்கப்பட்ட தொகை:' : 'Amount Collected:'}</span>
                      <span style={{ fontWeight: '600', color: '#10b981' }}>₹{totalCollected}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: isCompact ? '3px 6px' : '5px 8px', borderBottom: '1px solid #cbd5e1' }}>
                      <span style={{ color: '#475569' }}>{lang === 'ta' ? 'நிகர நிலுவை:' : 'Net Outstanding:'}</span>
                      <span style={{ fontWeight: '700', color: '#ef4444' }}>₹{remainingOutstanding}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: isCompact ? '5px 6px' : '7px 8px', background: '#1e293b', color: '#ffffff', fontWeight: '800', fontSize: isCompact ? '11px' : '13px' }}>
                    <span>{lang === 'ta' ? 'மொத்த தொகை:' : 'GRAND TOTAL:'}</span>
                    <span>₹{order.net_amount}</span>
                  </div>
                </div>
              </div>

              {/* Signatures */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: isCompact ? '15px' : '30px', padding: '0 8px' }}>
                <div style={{ textAlign: 'center', width: '180px' }}>
                  <div style={{ borderTop: '1px dashed #475569', paddingTop: '6px', fontSize: isCompact ? '8px' : '9px', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>
                    {lang === 'ta' ? 'வாடிக்கையாளர் கையொப்பம்' : 'Customer Signature'}
                  </div>
                </div>
                <div style={{ textAlign: 'center', width: '180px' }}>
                  <div style={{ borderTop: '1px dashed #475569', paddingTop: '6px', fontSize: isCompact ? '8px' : '9px', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>
                    {lang === 'ta' ? 'அங்கீகரிக்கப்பட்ட கையொப்பம்' : 'Authorised Signatory'}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
