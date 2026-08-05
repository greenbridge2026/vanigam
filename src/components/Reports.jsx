import React, { useState, useEffect } from 'react';
import api from '../api';
import ConfirmModal from './ConfirmModal';

export default function Reports({ t, lang, onBillSelected, session }) {
  const [activeTab, setActiveTab] = useState('daily_sales');
  const [orders, setOrders] = useState([]);
  const [orderItems, setOrderItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [shops, setShops] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [payments, setPayments] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [deliveryAuditTrail, setDeliveryAuditTrail] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Delivery Status Report Filters
  const [delFilterDateFrom, setDelFilterDateFrom] = useState('');
  const [delFilterDateTo, setDelFilterDateTo] = useState('');
  const [delFilterRoute, setDelFilterRoute] = useState('');
  const [delFilterDeliveryPerson, setDelFilterDeliveryPerson] = useState('');
  const [delFilterShop, setDelFilterShop] = useState('');
  const [delFilterStatus, setDelFilterStatus] = useState('');
  const [selectedBreakdown, setSelectedBreakdown] = useState('all'); // 'all' | 'delivered' | 'not_delivered' | 'returned'


  useEffect(() => {
    async function loadReportsData() {
      try {
        const [ord, items, prod, sh, rt, pay, purch, del, audit] = await Promise.all([
          api.getOrders(),
          api.getOrderItems(),
          api.getProducts(),
          api.getShops(),
          api.getRoutes(),
          api.getPayments(),
          api.getPurchases(),
          api.getDeliveries(),
          api.getDeliveryAuditTrail()
        ]);
        setOrders(ord);
        setOrderItems(items);
        setProducts(prod);
        setShops(sh);
        setRoutes(rt);
        setPayments(pay);
        setPurchases(purch);
        setDeliveries(del);
        setDeliveryAuditTrail(audit || []);
      } catch (err) {
        console.error('Failed to load reports datasets', err);
      } finally {
        setLoading(false);
      }
    }
    loadReportsData();
  }, []);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState(null);

  const handleDeleteOrderTrigger = (id) => {
    setDeleteTargetId(id);
    setConfirmOpen(true);
  };

  const executeDeleteOrder = async () => {
    setConfirmOpen(false);
    if (!deleteTargetId) return;
    try {
      await api.deleteOrder(deleteTargetId);
      setOrders(orders.filter(o => o.id !== deleteTargetId));
      // Reload details to keep state fresh
      const [items, prod, sh, pay, del] = await Promise.all([
        api.getOrderItems(),
        api.getProducts(),
        api.getShops(),
        api.getPayments(),
        api.getDeliveries()
      ]);
      setOrderItems(items);
      setProducts(prod);
      setShops(sh);
      setPayments(pay);
      setDeliveries(del);
      alert('Order successfully deleted. / ஆர்டர் வெற்றிகரமாக நீக்கப்பட்டது.');
    } catch (err) {
      alert(err.message || 'Failed to delete order');
    } finally {
      setDeleteTargetId(null);
    }
  };

  if (loading) return <div style={{ color: 'var(--text-muted)', textAlign: 'center' }}>Loading Analytical Reports...</div>;

  // Filter items matching global search
  const query = searchQuery.toLowerCase();
  
  // Custom Filter Function per report item
  const matchesSearch = (item, type) => {
    if (!searchQuery) return true;
    
    if (type === 'order') {
      const shopObj = shops.find(s => s.id === item.shop_id);
      const routeObj = routes.find(r => r.id === item.route_id);
      const sName = shopObj ? `${shopObj.name_en} ${shopObj.name_ta}` : '';
      const rName = routeObj ? `${routeObj.name_en} ${routeObj.name_ta}` : '';
      return (
        item.invoice_number.toLowerCase().includes(query) ||
        sName.toLowerCase().includes(query) ||
        rName.toLowerCase().includes(query) ||
        (shopObj?.mobile || '').includes(query) ||
        (shopObj?.gst_number || '').toLowerCase().includes(query)
      );
    }
    
    if (type === 'payment') {
      const shopObj = shops.find(s => s.id === item.shop_id);
      const sName = shopObj ? `${shopObj.name_en} ${shopObj.name_ta}` : '';
      return (
        sName.toLowerCase().includes(query) ||
        item.transaction_number.toLowerCase().includes(query) ||
        item.payment_mode.toLowerCase().includes(query)
      );
    }

    if (type === 'shop') {
      const routeObj = routes.find(r => r.id === item.route_id);
      const rName = routeObj ? `${routeObj.name_en} ${routeObj.name_ta}` : '';
      const sName = `${item.name_en} ${item.name_ta}`;
      return (
        sName.toLowerCase().includes(query) ||
        rName.toLowerCase().includes(query) ||
        item.mobile.includes(query) ||
        (item.gst_number || '').toLowerCase().includes(query) ||
        item.contact_person.toLowerCase().includes(query)
      );
    }

    if (type === 'product') {
      const pName = `${item.name_en} ${item.name_ta}`;
      return pName.toLowerCase().includes(query) || item.brand.toLowerCase().includes(query);
    }

    if (type === 'purchase') {
      const prod = products.find(p => p.id === item.product_id);
      const pName = prod ? `${prod.name_en} ${prod.name_ta}` : '';
      return pName.toLowerCase().includes(query) || item.supplier.toLowerCase().includes(query);
    }

    return true;
  };

  const renderReportContent = () => {
    switch (activeTab) {
      
      // 1. Daily Sales
      case 'daily_sales': {
        const filtered = orders.filter(o => matchesSearch(o, 'order'));
        return (
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Invoice No</th>
                  <th>Shop</th>
                  <th>Discount</th>
                  <th>Net Total</th>
                  <th>Status</th>
                  <th>Bill</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(o => {
                  const shop = shops.find(s => s.id === o.shop_id);
                  return (
                    <tr key={o.id}>
                      <td>{new Date(o.order_date).toLocaleDateString()}</td>
                      <td><strong>{o.invoice_number}</strong></td>
                      <td>{shop ? (lang === 'ta' ? shop.name_ta : shop.name_en) : 'Shop'}</td>
                      <td>₹{o.discount}</td>
                      <td style={{ color: 'var(--accent-cyan)', fontWeight: '700' }}>₹{o.net_amount}</td>
                      <td>
                        <span style={{
                          fontSize: '0.75rem', padding: '2px 6px', borderRadius: '4px',
                          background: o.status === 'delivered' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                          color: o.status === 'delivered' ? 'var(--success)' : 'var(--warning)',
                          border: `1px solid ${o.status === 'delivered' ? 'var(--success)' : 'var(--warning)'}`
                        }}>
                          {o.status === 'delivered' ? t('delivered') : t('pending')}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                          <button className="language-btn" onClick={() => onBillSelected(o.id)}>View</button>
                           {session?.role === 'admin' && (
                             <button className="btn btn-danger" onClick={() => handleDeleteOrderTrigger(o.id)} style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}>
                                Delete
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
        );
      }

      // 2. Route-wise Sales
      case 'route_sales': {
        return (
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Route Name</th>
                  <th>Assigned Sales Rep</th>
                  <th>Total Orders Placed</th>
                  <th>Gross Value Sold</th>
                </tr>
              </thead>
              <tbody>
                {routes.map(r => {
                  const routeOrders = orders.filter(o => o.route_id === r.id);
                  const total = routeOrders.reduce((sum, o) => sum + o.net_amount, 0);
                  return (
                    <tr key={r.id}>
                      <td><strong>{lang === 'ta' ? r.name_ta : r.name_en}</strong></td>
                      <td>👤 {t('salesman')}</td>
                      <td>{routeOrders.length} Orders</td>
                      <td style={{ color: 'var(--success)', fontWeight: '700' }}>₹{total}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      }

      // 3. Salesman-wise Sales
      case 'salesman_sales': {
        return (
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Salesperson Name</th>
                  <th>Role</th>
                  <th>Total Orders Registered</th>
                  <th>Net Booking Value</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>👤 <strong>Salesman Karthik</strong></td>
                  <td>Field Sales Rep</td>
                  <td>{orders.length} Orders</td>
                  <td style={{ color: 'var(--accent-cyan)', fontWeight: '700' }}>₹{orders.reduce((sum, o) => sum + o.net_amount, 0)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        );
      }

      // 4. Delivery Report
      case 'delivery_report': {
        const unifiedLogs = [];

        // 1. Audit trail completed/failed deliveries
        deliveryAuditTrail.forEach(log => {
          const order = orders.find(o => o.invoice_number === log.order_number);
          const shopObj = order ? shops.find(s => s.id === order.shop_id) : null;
          const routeObj = order ? routes.find(r => r.id === order.route_id) : null;
          
          let productsStr = '';
          let netAmount = 0;
          if (order) {
            netAmount = order.net_amount;
            const items = orderItems.filter(oi => oi.order_id === order.id);
            productsStr = items.map(oi => {
              const p = products.find(prod => prod.id === oi.product_id);
              const pName = p ? (lang === 'ta' ? p.name_ta : p.name_en) : 'Product';
              return `${pName} (${oi.cases} Cases, ${oi.bottles} Bottles)`;
            }).join(', ');
          }

          unifiedLogs.push({
            id: log.id,
            order_number: log.order_number,
            date: log.timestamp,
            route_name: log.route_name || (routeObj ? routeObj.name_en : ''),
            route_id: routeObj ? routeObj.id : '',
            shop_name: log.shop_name || (shopObj ? shopObj.name_en : ''),
            shop_id: shopObj ? shopObj.id : '',
            delivery_person: log.delivery_person || 'Delivery Man',
            status: log.status,
            reason: log.reason,
            remarks: log.remarks,
            products: productsStr,
            amount: netAmount,
            returned_quantity: log.returned_quantity || 0
          });
        });

        // 2. Pending deliveries
        deliveries.filter(d => d.status === 'pending').forEach(d => {
          const order = orders.find(o => o.id === d.order_id);
          if (order) {
            const shopObj = shops.find(s => s.id === order.shop_id);
            const routeObj = routes.find(r => r.id === order.route_id);

            let productsStr = '';
            const items = orderItems.filter(oi => oi.order_id === order.id);
            productsStr = items.map(oi => {
              const p = products.find(prod => prod.id === oi.product_id);
              const pName = p ? (lang === 'ta' ? p.name_ta : p.name_en) : 'Product';
              return `${pName} (${oi.cases} C, ${oi.bottles} B)`;
            }).join(', ');

            unifiedLogs.push({
              id: d.id,
              order_number: order.invoice_number,
              date: order.order_date,
              route_name: routeObj ? routeObj.name_en : '',
              route_id: routeObj ? routeObj.id : '',
              shop_name: shopObj ? shopObj.name_en : '',
              shop_id: shopObj ? shopObj.id : '',
              delivery_person: 'Delivery Man Ramesh',
              status: 'pending',
              reason: '',
              remarks: '',
              products: productsStr,
              amount: order.net_amount,
              returned_quantity: 0
            });
          }
        });

        // Apply filters
        const filteredLogs = unifiedLogs.filter(log => {
          if (delFilterDateFrom && new Date(log.date).getTime() < new Date(delFilterDateFrom + 'T00:00:00').getTime()) return false;
          if (delFilterDateTo && new Date(log.date).getTime() > new Date(delFilterDateTo + 'T23:59:59').getTime()) return false;
          if (delFilterRoute && log.route_id !== delFilterRoute && log.route_name !== delFilterRoute) return false;
          if (delFilterShop && log.shop_id !== delFilterShop && log.shop_name !== delFilterShop) return false;
          if (delFilterDeliveryPerson && !log.delivery_person.toLowerCase().includes(delFilterDeliveryPerson.toLowerCase())) return false;
          if (delFilterStatus && log.status !== delFilterStatus) return false;
          return true;
        }).sort((a, b) => new Date(b.date) - new Date(a.date));

        // Grouping logs for count metrics
        const deliveredLogs = filteredLogs.filter(l => l.status === 'delivered');
        const notDeliveredLogs = filteredLogs.filter(l => l.status === 'not_delivered');
        const returnedLogs = filteredLogs.filter(l => l.status === 'returned');
        const pendingLogs = filteredLogs.filter(l => l.status === 'pending');

        const shopClosedCount = notDeliveredLogs.filter(l => l.reason === 'Shop Closed').length;
        const paymentIssueCount = notDeliveredLogs.filter(l => l.reason === 'Payment Issue').length;

        const totalDeliveredAmt = deliveredLogs.reduce((sum, l) => sum + l.amount, 0);
        const totalNotDeliveredAmt = notDeliveredLogs.reduce((sum, l) => sum + l.amount, 0);
        const totalReturnedAmt = returnedLogs.reduce((sum, l) => sum + l.amount, 0);

        const handleExportExcel = () => {
          const exportData = filteredLogs.map(l => ({
            'Order No': l.order_number,
            'Date': new Date(l.date).toLocaleDateString(),
            'Route': l.route_name,
            'Shop': l.shop_name,
            'Delivery Person': l.delivery_person,
            'Status': l.status.toUpperCase(),
            'Reason': l.reason || '',
            'Remarks': l.remarks || '',
            'Returned Qty (Bottles)': l.returned_quantity || 0,
            'Amount (INR)': l.amount,
            'Products': l.products
          }));

          exportData.push({});
          exportData.push({ 'Order No': 'SUMMARY REPORT' });
          exportData.push({ 'Order No': 'Total Delivered Orders', 'Date': deliveredLogs.length, 'Route': `Value: ₹${totalDeliveredAmt}` });
          exportData.push({ 'Order No': 'Total Not Delivered Orders', 'Date': notDeliveredLogs.length, 'Route': `Value: ₹${totalNotDeliveredAmt}` });
          exportData.push({ 'Order No': 'Total Returned Orders', 'Date': returnedLogs.length, 'Route': `Value: ₹${totalReturnedAmt}` });
          exportData.push({ 'Order No': 'Shop Closed Count', 'Date': shopClosedCount });
          exportData.push({ 'Order No': 'Payment Issue Count', 'Date': paymentIssueCount });

          const ws = XLSX.utils.json_to_sheet(exportData);
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, 'Delivery Report');
          XLSX.writeFile(wb, `Delivery_Report_${Date.now()}.xlsx`);
        };

        const handleExportCSV = () => {
          const headers = ['Order No', 'Date', 'Route', 'Shop', 'Delivery Person', 'Status', 'Reason', 'Remarks', 'Returned Qty', 'Amount', 'Products'];
          const rows = filteredLogs.map(l => [
            l.order_number,
            new Date(l.date).toLocaleDateString(),
            l.route_name,
            l.shop_name,
            l.delivery_person,
            l.status.toUpperCase(),
            l.reason || '',
            l.remarks || '',
            l.returned_quantity || 0,
            l.amount,
            `"${l.products.replace(/"/g, '""')}"`
          ]);

          rows.push([]);
          rows.push(['SUMMARY REPORT']);
          rows.push(['Total Delivered Orders', deliveredLogs.length, `Value: Rs.${totalDeliveredAmt}`]);
          rows.push(['Total Not Delivered Orders', notDeliveredLogs.length, `Value: Rs.${totalNotDeliveredAmt}`]);
          rows.push(['Total Returned Orders', returnedLogs.length, `Value: Rs.${totalReturnedAmt}`]);
          rows.push(['Shop Closed Count', shopClosedCount]);
          rows.push(['Payment Issue Count', paymentIssueCount]);

          const csvContent = "data:text/csv;charset=utf-8," 
            + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
          const encodedUri = encodeURI(csvContent);
          const link = document.createElement("a");
          link.setAttribute("href", encodedUri);
          link.setAttribute("download", `Delivery_Report_${Date.now()}.csv`);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        };

        const handleExportPDF = () => {
          const element = document.getElementById('delivery-report-printable-area');
          const opt = {
            margin:       0.3,
            filename:     `Delivery_Report_${Date.now()}.pdf`,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2 },
            jsPDF:        { unit: 'in', format: 'letter', orientation: 'landscape' }
          };
          
          import('html2pdf.js').then((html2pdfModule) => {
            const html2pdf = html2pdfModule.default || html2pdfModule;
            html2pdf().set(opt).from(element).save();
          }).catch(() => {
            if (window.html2pdf) {
              window.html2pdf().set(opt).from(element).save();
            } else {
              alert('PDF generator not available.');
            }
          });
        };

        const visibleLogs = selectedBreakdown === 'all' ? filteredLogs : filteredLogs.filter(l => l.status === selectedBreakdown);

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* Filters Section */}
            <div className="glass-card" style={{ padding: '1.25rem' }}>
              <h3 style={{ fontSize: '1rem', marginBottom: '1rem', fontWeight: '700' }}>🔍 Filter Delivery logs / விநியோகப் பதிவுகளை வடிகட்டவும்</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.85rem' }}>
                <div className="form-group">
                  <label style={{ fontSize: '0.8rem' }}>Date From</label>
                  <input type="date" className="form-input" value={delFilterDateFrom} onChange={e => setDelFilterDateFrom(e.target.value)} />
                </div>
                <div className="form-group">
                  <label style={{ fontSize: '0.8rem' }}>Date To</label>
                  <input type="date" className="form-input" value={delFilterDateTo} onChange={e => setDelFilterDateTo(e.target.value)} />
                </div>
                <div className="form-group">
                  <label style={{ fontSize: '0.8rem' }}>Route</label>
                  <select className="form-select" value={delFilterRoute} onChange={e => setDelFilterRoute(e.target.value)}>
                    <option value="">All Routes</option>
                    {routes.map(r => (
                      <option key={r.id} value={r.id}>{lang === 'ta' ? r.name_ta : r.name_en}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label style={{ fontSize: '0.8rem' }}>Shop</label>
                  <select className="form-select" value={delFilterShop} onChange={e => setDelFilterShop(e.target.value)}>
                    <option value="">All Shops</option>
                    {shops.map(s => (
                      <option key={s.id} value={s.id}>{lang === 'ta' ? s.name_ta : s.name_en}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label style={{ fontSize: '0.8rem' }}>Delivery Person</label>
                  <input type="text" className="form-input" value={delFilterDeliveryPerson} onChange={e => setDelFilterDeliveryPerson(e.target.value)} placeholder="Name..." />
                </div>
                <div className="form-group">
                  <label style={{ fontSize: '0.8rem' }}>Status</label>
                  <select className="form-select" value={delFilterStatus} onChange={e => setDelFilterStatus(e.target.value)}>
                    <option value="">All Statuses</option>
                    <option value="pending">Pending</option>
                    <option value="delivered">Delivered</option>
                    <option value="not_delivered">Not Delivered</option>
                    <option value="returned">Returned</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Export & Summary Section */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={handleExportExcel} style={{ fontSize: '0.85rem', padding: '0.4rem 0.85rem' }}>📥 Export Excel</button>
                <button type="button" className="btn btn-secondary" onClick={handleExportCSV} style={{ fontSize: '0.85rem', padding: '0.4rem 0.85rem' }}>📄 Export CSV</button>
                <button type="button" className="btn btn-primary" onClick={handleExportPDF} style={{ fontSize: '0.85rem', padding: '0.4rem 0.85rem' }}>🖨️ Download PDF</button>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button className={`language-btn ${selectedBreakdown === 'all' ? 'active' : ''}`} style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }} onClick={() => setSelectedBreakdown('all')}>All ({filteredLogs.length})</button>
                <button className={`language-btn ${selectedBreakdown === 'delivered' ? 'active' : ''}`} style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', borderColor: 'var(--success)', color: selectedBreakdown === 'delivered' ? '#fff' : 'var(--success)' }} onClick={() => setSelectedBreakdown('delivered')}>Delivered ({deliveredLogs.length})</button>
                <button className={`language-btn ${selectedBreakdown === 'not_delivered' ? 'active' : ''}`} style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', borderColor: 'var(--danger)', color: selectedBreakdown === 'not_delivered' ? '#fff' : 'var(--danger)' }} onClick={() => setSelectedBreakdown('not_delivered')}>Not Delivered ({notDeliveredLogs.length})</button>
                <button className={`language-btn ${selectedBreakdown === 'returned' ? 'active' : ''}`} style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', borderColor: 'var(--accent-blue)', color: selectedBreakdown === 'returned' ? '#fff' : 'var(--accent-blue)' }} onClick={() => setSelectedBreakdown('returned')}>Returned ({returnedLogs.length})</button>
              </div>
            </div>

            {/* Main printable report area */}
            <div id="delivery-report-printable-area" className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
                <h2 style={{ fontSize: '1.3rem', margin: 0 }}>📊 Delivery fulfillment Summary / விநியோக நிறைவு அறிக்கை</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                  <div style={{ padding: '0.75rem', background: 'rgba(16, 185, 129, 0.05)', borderRadius: '6px', border: '1px solid rgba(16, 185, 129, 0.1)' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Delivered Orders</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--success)' }}>{deliveredLogs.length} (₹{totalDeliveredAmt})</div>
                  </div>
                  <div style={{ padding: '0.75rem', background: 'rgba(239, 68, 68, 0.05)', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.1)' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Not Delivered Orders</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--danger)' }}>{notDeliveredLogs.length} (₹{totalNotDeliveredAmt})</div>
                  </div>
                  <div style={{ padding: '0.75rem', background: 'rgba(59, 130, 246, 0.05)', borderRadius: '6px', border: '1px solid rgba(59, 130, 246, 0.1)' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Returned Orders</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--accent-blue)' }}>{returnedLogs.length} (₹{totalReturnedAmt})</div>
                  </div>
                  <div style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Issues Breakdown</div>
                    <div style={{ fontSize: '0.9rem', fontWeight: '700', marginTop: '0.2rem' }}>
                      Shop Closed: {shopClosedCount} | Payment Issue: {paymentIssueCount}
                    </div>
                  </div>
                </div>
              </div>

              {/* Data Table */}
              <div className="table-container">
                <table className="custom-table" style={{ width: '100%' }}>
                  {selectedBreakdown === 'all' && (
                    <>
                      <thead>
                        <tr>
                          <th>Order No</th>
                          <th>Date</th>
                          <th>Route</th>
                          <th>Shop</th>
                          <th>Delivery Person</th>
                          <th>Status</th>
                          <th>Reason & Remarks</th>
                          <th style={{ textAlign: 'right' }}>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleLogs.map(l => (
                          <tr key={l.id}>
                            <td><strong>{l.order_number}</strong></td>
                            <td>{new Date(l.date).toLocaleDateString()}</td>
                            <td>{l.route_name}</td>
                            <td>{l.shop_name}</td>
                            <td>👤 {l.delivery_person}</td>
                            <td>
                              <span style={{
                                fontSize: '0.75rem', padding: '2px 6px', borderRadius: '4px',
                                background: l.status === 'delivered' ? 'rgba(16, 185, 129, 0.1)' : l.status === 'pending' ? 'rgba(245, 158, 11, 0.1)' : l.status === 'returned' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                color: l.status === 'delivered' ? 'var(--success)' : l.status === 'pending' ? 'var(--warning)' : l.status === 'returned' ? 'var(--accent-blue)' : 'var(--danger)',
                                border: `1px solid ${l.status === 'delivered' ? 'var(--success)' : l.status === 'pending' ? 'var(--warning)' : l.status === 'returned' ? 'var(--accent-blue)' : 'var(--danger)'}`
                              }}>
                                {l.status.toUpperCase()}
                              </span>
                            </td>
                            <td>
                              {l.reason && <strong style={{ color: 'var(--warning)' }}>[{l.reason}] </strong>}
                              {l.remarks || '--'}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: '700' }}>₹{l.amount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </>
                  )}

                  {selectedBreakdown === 'delivered' && (
                    <>
                      <thead>
                        <tr>
                          <th>Order No</th>
                          <th>Date</th>
                          <th>Route</th>
                          <th>Shop</th>
                          <th>Delivered By</th>
                          <th>Delivered Time</th>
                          <th>Products Handled</th>
                          <th style={{ textAlign: 'right' }}>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleLogs.map(l => (
                          <tr key={l.id}>
                            <td><strong>{l.order_number}</strong></td>
                            <td>{new Date(l.date).toLocaleDateString()}</td>
                            <td>{l.route_name}</td>
                            <td>{l.shop_name}</td>
                            <td>👤 {l.delivery_person}</td>
                            <td>{new Date(l.date).toLocaleTimeString()}</td>
                            <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={l.products}>
                              {l.products}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: '700', color: 'var(--success)' }}>₹{l.amount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </>
                  )}

                  {selectedBreakdown === 'not_delivered' && (
                    <>
                      <thead>
                        <tr>
                          <th>Order No</th>
                          <th>Date</th>
                          <th>Route</th>
                          <th>Shop</th>
                          <th>Delivery Person</th>
                          <th>Reason</th>
                          <th>Logistics Remarks</th>
                          <th>Products Reverted</th>
                          <th style={{ textAlign: 'right' }}>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleLogs.map(l => (
                          <tr key={l.id}>
                            <td><strong>{l.order_number}</strong></td>
                            <td>{new Date(l.date).toLocaleDateString()}</td>
                            <td>{l.route_name}</td>
                            <td>{l.shop_name}</td>
                            <td>👤 {l.delivery_person}</td>
                            <td style={{ fontWeight: 'bold', color: 'var(--danger)' }}>{l.reason}</td>
                            <td style={{ fontStyle: 'italic' }}>{l.remarks || '--'}</td>
                            <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{l.products}</td>
                            <td style={{ textAlign: 'right', fontWeight: '700' }}>₹{l.amount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </>
                  )}

                  {selectedBreakdown === 'returned' && (
                    <>
                      <thead>
                        <tr>
                          <th>Order No</th>
                          <th>Date</th>
                          <th>Route</th>
                          <th>Shop</th>
                          <th>Return Reason</th>
                          <th>Total Returned Qty</th>
                          <th>Returned Date</th>
                          <th>Products Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleLogs.map(l => (
                          <tr key={l.id}>
                            <td><strong>{l.order_number}</strong></td>
                            <td>{new Date(l.date).toLocaleDateString()}</td>
                            <td>{l.route_name}</td>
                            <td>{l.shop_name}</td>
                            <td style={{ fontWeight: 'bold', color: 'var(--accent-blue)' }}>{l.reason}</td>
                            <td>{l.returned_quantity} bottles</td>
                            <td>{new Date(l.date).toLocaleDateString()}</td>
                            <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{l.products}</td>
                          </tr>
                        ))}
                      </tbody>
                    </>
                  )}

                  {visibleLogs.length === 0 && (
                    <tbody>
                      <tr>
                        <td colSpan="10" style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                          No matching logs found for the selected status.
                        </td>
                      </tr>
                    </tbody>
                  )}
                </table>
              </div>

            </div>

          </div>
        );
      }

      // 5. Collection Report
      case 'collection_report': {
        const filtered = payments.filter(p => matchesSearch(p, 'payment'));
        const totalCollect = filtered.reduce((sum, p) => sum + p.collected_amount, 0);

        return (
          <div>
            <div style={{ padding: '1rem', background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '8px', marginBottom: '1rem' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Total Amount Collected:</span>
              <h3 style={{ fontSize: '1.75rem', color: 'var(--success)', fontWeight: '800' }}>₹{totalCollect}</h3>
            </div>

            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Shop</th>
                    <th>Reference Invoice</th>
                    <th>Payment Mode</th>
                    <th>Txn / Ref No</th>
                    <th>Collected Value</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(p => {
                    const shop = shops.find(s => s.id === p.shop_id);
                    const ord = orders.find(o => o.id === p.order_id);
                    return (
                      <tr key={p.id}>
                        <td>{new Date(p.payment_date).toLocaleDateString()}</td>
                        <td><strong>{shop ? (lang === 'ta' ? shop.name_ta : shop.name_en) : ''}</strong></td>
                        <td>{ord?.invoice_number || 'Outstanding Pay'}</td>
                        <td>
                          <span style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--accent-cyan)', fontWeight: '600' }}>
                            {p.payment_mode}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{p.transaction_number}</td>
                        <td style={{ color: 'var(--success)', fontWeight: '700' }}>₹{p.collected_amount}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      }

      // 6. Outstanding Report
      case 'outstanding_report': {
        const filtered = shops.filter(s => s.outstanding_amount > 0 && matchesSearch(s, 'shop'));
        const sumOutstanding = filtered.reduce((sum, s) => sum + s.outstanding_amount, 0);

        return (
          <div>
            <div style={{ padding: '1rem', background: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: '8px', marginBottom: '1rem' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Cumulative Outstandings:</span>
              <h3 style={{ fontSize: '1.75rem', color: 'var(--warning)', fontWeight: '800' }}>₹{sumOutstanding}</h3>
            </div>

            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Shop Name</th>
                    <th>Contact Info</th>
                    <th>Shop Type</th>
                    <th>Unpaid Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(s => (
                    <tr key={s.id}>
                      <td><strong>{lang === 'ta' ? s.name_ta : s.name_en}</strong></td>
                      <td>
                        <div>{s.contact_person}</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--accent-cyan)' }}>📞 {s.mobile}</div>
                      </td>
                      <td>
                        <span style={{ textTransform: 'uppercase', fontSize: '0.75rem' }}>{s.shop_type}</span>
                      </td>
                      <td style={{ color: 'var(--danger)', fontWeight: '700' }}>₹{s.outstanding_amount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      }

      // 7. Stock Report
      case 'stock_report': {
        const filtered = products.filter(p => matchesSearch(p, 'product'));
        return (
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Brand / Size</th>
                  <th>Case Ratio</th>
                  <th>Available Stock (Bottles)</th>
                  <th>Min Limit Alert</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => {
                  const isOut = p.current_stock_bottles === 0;
                  const isLow = p.current_stock_bottles <= p.min_stock;
                  return (
                    <tr key={p.id}>
                      <td><strong>{lang === 'ta' ? p.name_ta : p.name_en}</strong></td>
                      <td>{p.brand} | {p.size}</td>
                      <td>{p.case_qty_rule} Bottles/Case</td>
                      <td style={{ fontWeight: '700' }}>{p.current_stock_bottles} bottles</td>
                      <td>{p.min_stock} bottles</td>
                      <td>
                        {isOut ? (
                          <span style={{ fontSize: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--danger)' }}>
                            OUT
                          </span>
                        ) : isLow ? (
                          <span style={{ fontSize: '0.75rem', background: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning)', padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--warning)' }}>
                            LOW
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.75rem', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--success)' }}>
                            OK
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      }

      // 8. Purchase Report
      case 'purchase_report': {
        const filtered = purchases.filter(p => matchesSearch(p, 'purchase'));
        return (
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Supplier</th>
                  <th>Product</th>
                  <th>Cases Purchased</th>
                  <th>Rate/Case</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => {
                  const prod = products.find(pr => pr.id === p.product_id);
                  return (
                    <tr key={p.id}>
                      <td>{new Date(p.purchase_date).toLocaleDateString()}</td>
                      <td><strong>{p.supplier}</strong></td>
                      <td>{prod ? (lang === 'ta' ? prod.name_ta : prod.name_en) : ''}</td>
                      <td>{p.cases} Cases, {p.bottles} Bottles</td>
                      <td>₹{p.purchase_price}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      }

      // 9. Profit Report
      case 'profit_report': {
        // Calculate Profit: Revenue - Purchase Cost of all sold quantities
        let totalCost = 0;
        let totalRevenue = 0;

        orderItems.forEach(item => {
          const p = products.find(prod => prod.id === item.product_id);
          if (p) {
            const totalQtyBottles = (item.cases * p.case_qty_rule) + item.bottles;
            const cost = totalQtyBottles * (p.purchase_price / p.case_qty_rule);
            totalCost += cost;
            totalRevenue += item.amount;
          }
        });

        const grossProfit = Math.round(totalRevenue - totalCost);
        const marginPct = totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(1) : 0;

        return (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Net Sales Revenue:</span>
                <h3 style={{ fontSize: '1.5rem', fontWeight: '800' }}>₹{Math.round(totalRevenue)}</h3>
              </div>
              <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Estimated Cost of Goods Sold (COGS):</span>
                <h3 style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--text-muted)' }}>₹{Math.round(totalCost)}</h3>
              </div>
              <div style={{ padding: '1rem', background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '8px' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{t('gross_profit')}:</span>
                <h3 style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--success)' }}>₹{grossProfit} ({marginPct}%)</h3>
              </div>
            </div>

            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Total Bottles Sold</th>
                    <th>Sales Revenue</th>
                    <th>Product Cost Value</th>
                    <th>Estimated Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map(p => {
                    const soldQty = orderItems
                      .filter(oi => oi.product_id === p.id)
                      .reduce((sum, oi) => sum + (oi.cases * p.case_qty_rule + oi.bottles), 0);
                    
                    const revenue = orderItems
                      .filter(oi => oi.product_id === p.id)
                      .reduce((sum, oi) => sum + oi.amount, 0);

                    const cost = soldQty * (p.purchase_price / p.case_qty_rule);
                    const profit = Math.round(revenue - cost);

                    if (soldQty === 0) return null;

                    return (
                      <tr key={p.id}>
                        <td><strong>{lang === 'ta' ? p.name_ta : p.name_en}</strong></td>
                        <td>{soldQty} bottles ({Math.floor(soldQty/p.case_qty_rule)} Cases)</td>
                        <td>₹{revenue}</td>
                        <td>₹{Math.round(cost)}</td>
                        <td style={{ color: profit >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: '700' }}>
                          ₹{profit}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      }

      default:
        return null;
    }
  };

  const tabs = [
    { id: 'daily_sales', label: t('daily_sales') },
    { id: 'route_sales', label: t('route_sales') },
    { id: 'salesman_sales', label: t('salesman_sales') },
    { id: 'delivery_report', label: 'Delivery logs' },
    { id: 'collection_report', label: t('collection_report') },
    { id: 'outstanding_report', label: t('outstanding_report') },
    { id: 'stock_report', label: t('stock_report') },
    { id: 'purchase_report', label: t('purchase_report') },
    { id: 'profit_report', label: t('profit_report') }
  ];

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>📈 Operational Intelligence Reports</h1>
        <p style={{ color: 'var(--text-muted)' }}>Query and verify active ledgers, profitability indexes, and collection reports</p>
      </div>

      {/* Global Search Bar */}
      <div className="search-wrapper">
        <span>🔍</span>
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder={t('search_placeholder')}
        />
      </div>

      {/* Navigation tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }} className="reports-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`language-btn ${activeTab === tab.id ? 'active' : ''}`}
            style={{
              background: activeTab === tab.id ? 'var(--accent-cyan)' : '',
              color: activeTab === tab.id ? '#0f172a' : ''
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Render selected report */}
      <div className="glass-card">
        {renderReportContent()}
      </div>
      <ConfirmModal
        isOpen={confirmOpen}
        title={t('confirm_title')}
        message={t('confirm_delete_msg')}
        confirmText={t('confirm_ok')}
        cancelText={t('confirm_cancel')}
        onConfirm={executeDeleteOrder}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
