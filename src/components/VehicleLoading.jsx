import React, { useState, useEffect } from 'react';
import api from '../api';
import { translateShopName, translateRouteName, translateProductName } from '../translations';
import * as XLSX from 'xlsx';

export default function VehicleLoading({ t, lang, session }) {
  const [routes, setRoutes] = useState([]);
  const [shops, setShops] = useState([]);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [orderItems, setOrderItems] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [dispatches, setDispatches] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [users, setUsers] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState('summary'); // 'summary' | 'tracking' | 'reports'

  // Filter States
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const [filterRoute, setFilterRoute] = useState('');
  const [filterVehicle, setFilterVehicle] = useState('');
  const [filterSalesman, setFilterSalesman] = useState('');
  const [filterDeliveryPerson, setFilterDeliveryPerson] = useState('');

  // Selected Dispatch for Tracking
  const [selectedDispatchId, setSelectedDispatchId] = useState('');
  const [trackingQuantities, setTrackingQuantities] = useState({}); // key: product_id, val: { delivered: 0, returned: 0 }

  // Reports & Print Scope States
  const [printScope, setPrintScope] = useState('all'); // 'all' | 'consolidated' | 'routewise'
  const [reportType, setReportType] = useState('loading_report'); // 'loading_report' | 'route_report' | 'requirement_report' | 'dispatch_report' | 'delivery_return_report'
  const [reportDateFrom, setReportDateFrom] = useState(new Date().toISOString().split('T')[0]);
  const [reportDateTo, setReportDateTo] = useState(new Date().toISOString().split('T')[0]);

  // Load Data
  const loadAllData = async () => {
    try {
      const [rData, sData, pData, oData, oiData, vData, dData, delData, uData] = await Promise.all([
        api.getRoutes(),
        api.getShops(),
        api.getProducts(),
        api.getOrders(),
        api.getOrderItems(),
        api.getVehicles(),
        api.getVehicleDispatches(),
        api.getDeliveries(),
        api.getUsers()
      ]);
      setRoutes(rData || []);
      setShops(sData || []);
      setProducts(pData || []);
      setOrders(oData || []);
      setOrderItems(oiData || []);
      setVehicles(vData || []);
      setDispatches(dData || []);
      setDeliveries(delData || []);
      setUsers(uData || []);
    } catch (err) {
      console.error('Error loading vehicle loading cockpit datasets:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Compute Active Salesmen and Delivery Persons
  const salesmen = users.filter(u => u.role === 'salesman' && u.active);
  const deliveryPersons = users.filter(u => u.role === 'delivery' && u.active);

  // 1. Filter Orders based on criteria
  const getFilteredOrders = () => {
    return orders.filter(o => {
      // Confirmed/Pending orders on selected date
      const dateMatch = o.order_date.startsWith(filterDate);
      if (!dateMatch) return false;

      // Filter Route
      if (filterRoute && o.route_id !== filterRoute) return false;

      // Filter Salesman
      if (filterSalesman && o.salesman_id !== filterSalesman) return false;

      // Filter Delivery Person (match assigned route or order's delivery person)
      if (filterDeliveryPerson) {
        const orderShop = shops.find(s => s.id === o.shop_id);
        const shopRoute = orderShop ? routes.find(r => r.id === orderShop.route_id) : null;
        const routeDeliveryManId = shopRoute ? shopRoute.delivery_man_id : null;
        if (o.delivery_man_id !== filterDeliveryPerson && routeDeliveryManId !== filterDeliveryPerson) {
          return false;
        }
      }

      // Status must be pending or dispatched (not cancelled)
      if (o.status === 'cancelled') return false;

      return true;
    });
  };

  const filteredOrders = getFilteredOrders();
  const matchedOrderIds = filteredOrders.map(o => o.id);

  // 2. Consolidate Product Requirements
  const getConsolidatedRequirements = (orderList) => {
    const consolidation = {};
    const orderIds = new Set(orderList.map(o => o.id));
    const items = orderItems.filter(item => orderIds.has(item.order_id));

    items.forEach(item => {
      const prod = products.find(p => p.id === item.product_id);
      if (!prod) return;

      const caseRule = prod.case_qty_rule;
      const totalBottles = (Number(item.cases || 0) * caseRule) + Number(item.bottles || 0);

      if (!consolidation[item.product_id]) {
        consolidation[item.product_id] = 0;
      }
      consolidation[item.product_id] += totalBottles;
    });

    return Object.keys(consolidation).map(prodId => {
      const prod = products.find(p => p.id === prodId);
      const total = consolidation[prodId];
      const cases = Math.floor(total / prod.case_qty_rule);
      const bottles = total % prod.case_qty_rule;
      return {
        product_id: prodId,
        product: prod,
        cases,
        bottles,
        total_bottles: total
      };
    });
  };

  const consolidatedRequirements = getConsolidatedRequirements(filteredOrders);

  // 3. Group requirements Route-wise
  const getRouteWiseBreakdown = () => {
    const breakdown = {};

    filteredOrders.forEach(o => {
      const routeId = o.route_id || 'unknown';
      if (!breakdown[routeId]) {
        breakdown[routeId] = [];
      }
      breakdown[routeId].push(o);
    });

    return Object.keys(breakdown).map(routeId => {
      const routeObj = routes.find(r => r.id === routeId);
      const routeName = routeObj ? (lang === 'ta' ? routeObj.name_ta : routeObj.name_en) : 'Unassigned Route';
      const routeOrders = breakdown[routeId];
      const requirements = getConsolidatedRequirements(routeOrders);

      return {
        route_id: routeId,
        route_name: routeName,
        requirements
      };
    });
  };

  const routeWiseBreakdown = getRouteWiseBreakdown();

  // 4. Stock Shortage Validation
  const getShortageList = () => {
    const shortage = [];
    consolidatedRequirements.forEach(req => {
      const prod = req.product;
      if (req.total_bottles > prod.current_stock_bottles) {
        const diff = req.total_bottles - prod.current_stock_bottles;
        const shortageCases = Math.floor(diff / prod.case_qty_rule);
        const shortageBottles = diff % prod.case_qty_rule;
        shortage.push({
          product: prod,
          shortageCases,
          shortageBottles,
          total_shortage_bottles: diff
        });
      }
    });
    return shortage;
  };

  const shortageList = getShortageList();
  const hasStockShortage = shortageList.length > 0;

  // Format stock display
  const formatStock = (totalBottles, caseRule) => {
    const cases = Math.floor(totalBottles / caseRule);
    const bottles = totalBottles % caseRule;
    let result = [];
    if (cases > 0) result.push(`${cases} C`);
    if (bottles > 0) result.push(`${bottles} B`);
    return result.join(', ') || '0 Stock';
  };

  // Generate Dispatch / Reserve Stock
  const handleGenerateLoadingSheet = async () => {
    if (!filterVehicle) {
      alert(lang === 'ta' ? 'வாகனத்தைத் தேர்ந்தெடுக்கவும்' : 'Please select a vehicle to generate dispatch');
      return;
    }
    if (consolidatedRequirements.length === 0) {
      alert(lang === 'ta' ? 'அனுப்பப்பட வேண்டிய ஆர்டர்கள் எதுவும் இல்லை' : 'No orders found to dispatch');
      return;
    }
    if (hasStockShortage) {
      alert(lang === 'ta' ? 'இருப்புப் பற்றாக்குறை உள்ளது! தயவுசெய்து முதலில் இருப்பை நிரப்பவும்.' : 'Stock shortage exists! Please resolve stock shortages first.');
      return;
    }

    setSubmitting(true);

    const items = consolidatedRequirements.map(req => ({
      product_id: req.product_id,
      cases: req.cases,
      bottles: req.bottles
    }));

    try {
      // 1. Calls backend dispatch route to deduct warehouse stock and add to vehicle stock
      const newDispatch = await api.dispatchVehicleStock({
        vehicle_id: filterVehicle,
        items
      });

      // 2. Enhance dispatch metadata with associated orders, route, status using our new PUT route
      await api.updateVehicleDispatch(newDispatch.id, {
        ...newDispatch,
        order_ids: matchedOrderIds,
        route_id: filterRoute || '',
        salesman_id: filterSalesman || '',
        delivery_man_id: filterDeliveryPerson || '',
        status: 'dispatched'
      });

      alert(lang === 'ta' ? 'வண்டி ஏற்றுதல் மற்றும் அனுப்பல் சீட்டு வெற்றிகரமாக உருவாக்கப்பட்டது!' : 'Loading sheet generated and vehicle dispatched successfully!');
      setFilterVehicle('');
      loadAllData();
    } catch (err) {
      console.error(err);
      alert(err.message || 'Error processing vehicle dispatch');
    } finally {
      setSubmitting(false);
    }
  };

  // Re-fetch tracking values when selected dispatch changes
  useEffect(() => {
    if (!selectedDispatchId) {
      setTrackingQuantities({});
      return;
    }

    const disp = dispatches.find(d => d.id === selectedDispatchId);
    if (!disp) return;

    const initialTracking = {};
    disp.items.forEach(item => {
      // Find orders in this dispatch that are already completed/delivered
      const dispOrders = orders.filter(o => disp.order_ids?.includes(o.id));
      const deliveredOrders = dispOrders.filter(o => o.status === 'delivered');
      
      // Calculate delivered bottles
      const deliveredItems = orderItems.filter(oi => 
        deliveredOrders.some(o => o.id === oi.order_id) && oi.product_id === item.product_id
      );

      const prod = products.find(p => p.id === item.product_id);
      const caseRule = prod ? prod.case_qty_rule : 24;

      let totalDeliveredBottles = 0;
      deliveredItems.forEach(oi => {
        totalDeliveredBottles += (oi.cases * caseRule) + oi.bottles;
      });

      // Default delivered is computed from orders. Else fallback to total loaded.
      const deliveredTotal = Math.min(item.total_bottles, totalDeliveredBottles || item.total_bottles);
      const returnedTotal = item.total_bottles - deliveredTotal;

      initialTracking[item.product_id] = {
        delivered_cases: Math.floor(deliveredTotal / caseRule),
        delivered_bottles: deliveredTotal % caseRule,
        returned_cases: Math.floor(returnedTotal / caseRule),
        returned_bottles: returnedTotal % caseRule
      };
    });

    setTrackingQuantities(initialTracking);
  }, [selectedDispatchId, dispatches, orders, orderItems, products]);

  // Adjust Delivered / Returned dynamically
  const handleTrackingQtyChange = (prodId, field, casesVal, bottlesVal) => {
    const disp = dispatches.find(d => d.id === selectedDispatchId);
    if (!disp) return;

    const item = disp.items.find(i => i.product_id === prodId);
    const prod = products.find(p => p.id === prodId);
    if (!item || !prod) return;

    const caseRule = prod.case_qty_rule;
    const totalLoaded = item.total_bottles;

    let targetDelivered = 0;
    const current = trackingQuantities[prodId] || { delivered_cases: 0, delivered_bottles: 0 };

    if (field === 'delivered_cases') {
      const cVal = Math.max(0, parseInt(casesVal) || 0);
      targetDelivered = (cVal * caseRule) + current.delivered_bottles;
    } else if (field === 'delivered_bottles') {
      const bVal = Math.max(0, parseInt(bottlesVal) || 0);
      targetDelivered = (current.delivered_cases * caseRule) + bVal;
    }

    // Clamp delivered qty to loaded limit
    if (targetDelivered > totalLoaded) {
      targetDelivered = totalLoaded;
    }

    const targetReturned = totalLoaded - targetDelivered;

    setTrackingQuantities({
      ...trackingQuantities,
      [prodId]: {
        delivered_cases: Math.floor(targetDelivered / caseRule),
        delivered_bottles: targetDelivered % caseRule,
        returned_cases: Math.floor(targetReturned / caseRule),
        returned_bottles: targetReturned % caseRule
      }
    });
  };

  // Complete Delivery & Return Stock
  const handleProcessReturns = async () => {
    const disp = dispatches.find(d => d.id === selectedDispatchId);
    if (!disp) return;

    setSubmitting(true);
    try {
      // 1. Loop through tracking items and add returned quantities back to warehouse product stock
      for (const item of disp.items) {
        const prod = products.find(p => p.id === item.product_id);
        if (!prod) continue;

        const track = trackingQuantities[item.product_id];
        if (!track) continue;

        const returnedBottles = (track.returned_cases * prod.case_qty_rule) + track.returned_bottles;
        
        if (returnedBottles > 0) {
          // Increment warehouse product stock directly
          await api.updateProduct(prod.id, {
            ...prod,
            current_stock_bottles: prod.current_stock_bottles + returnedBottles
          });
        }
      }

      // 2. Mark corresponding deliveries in database logistics run as delivered
      const dispDeliveries = deliveries.filter(del => disp.order_ids?.includes(del.order_id));
      for (const d of dispDeliveries) {
        if (d.status !== 'delivered') {
          // Complete standard delivery flow in database
          await api.completeDelivery(d.id, {
            cashAmount: 0, // collected via checkout summaries or outstanding desk
            gpayAmount: 0,
            gpayTxn: '',
            remarks: 'Reconciled via dispatch returns sheet'
          });
        }
      }

      // 3. Mark the vehicle dispatch as completed
      await api.updateVehicleDispatch(disp.id, {
        ...disp,
        status: 'completed',
        reconciliation_date: new Date().toISOString(),
        tracking_quantities: trackingQuantities
      });

      alert(lang === 'ta' ? 'வருமானம் வெற்றிகரமாகப் பெறப்பட்டு, சரக்குகள் கிடங்கில் திரும்ப சேர்க்கப்பட்டது!' : 'Returns processed and returned stock added back to inventory successfully!');
      setSelectedDispatchId('');
      loadAllData();
    } catch (err) {
      console.error(err);
      alert(err.message || 'Error processing returns reconciliation');
    } finally {
      setSubmitting(false);
    }
  };

  // Reports Exports Handlers
  const getFilteredDispatchesForReport = () => {
    return dispatches.filter(d => {
      const date = d.dispatch_date.split('T')[0];
      return date >= reportDateFrom && date <= reportDateTo;
    });
  };

  const handleExportExcel = () => {
    let exportData = [];
    let title = 'Report';

    if (reportType === 'loading_report') {
      title = 'Vehicle Loading Summary';
      exportData = consolidatedRequirements.map(req => ({
        'Product': translateProductName(req.product, lang),
        'Brand': req.product.brand,
        'Size': req.product.size,
        'Cases': req.cases,
        'Bottles': req.bottles,
        'Total Bottles': req.total_bottles
      }));
    } else if (reportType === 'route_report') {
      title = 'Route wise Loading Summary';
      routeWiseBreakdown.forEach(route => {
        route.requirements.forEach(req => {
          exportData.push({
            'Route': route.route_name,
            'Product': translateProductName(req.product, lang),
            'Cases': req.cases,
            'Bottles': req.bottles
          });
        });
      });
    } else if (reportType === 'requirement_report') {
      title = 'Consolidated Product Requirement';
      exportData = consolidatedRequirements.map(req => ({
        'Product': translateProductName(req.product, lang),
        'Required Qty': `${req.cases} C, ${req.bottles} B`,
        'Available Warehouse Stock': formatStock(req.product.current_stock_bottles, req.product.case_qty_rule)
      }));
    } else if (reportType === 'dispatch_report') {
      title = 'Vehicle Dispatches Log';
      getFilteredDispatchesForReport().forEach(d => {
        const vehicle = vehicles.find(v => v.id === d.vehicle_id);
        const routeObj = routes.find(r => r.id === d.route_id);
        d.items.forEach(item => {
          const prod = products.find(p => p.id === item.product_id);
          exportData.push({
            'Dispatch ID': d.id,
            'Date': new Date(d.dispatch_date).toLocaleDateString(),
            'Vehicle': vehicle ? `${vehicle.vehicle_number} (${vehicle.driver_name})` : 'Unknown',
            'Route': routeObj ? routeObj.name_en : 'All Routes',
            'Product': prod ? translateProductName(prod, lang) : 'Unknown',
            'Loaded': `${item.cases} C, ${item.bottles} B`,
            'Status': d.status === 'completed' ? 'Delivered & Reconciled' : 'Dispatched'
          });
        });
      });
    } else if (reportType === 'delivery_return_report') {
      title = 'Delivery vs Return Report';
      getFilteredDispatchesForReport().forEach(d => {
        const vehicle = vehicles.find(v => v.id === d.vehicle_id);
        d.items.forEach(item => {
          const prod = products.find(p => p.id === item.product_id);
          const track = d.tracking_quantities?.[item.product_id] || { delivered_cases: 0, delivered_bottles: 0, returned_cases: 0, returned_bottles: 0 };
          exportData.push({
            'Dispatch ID': d.id,
            'Date': new Date(d.dispatch_date).toLocaleDateString(),
            'Vehicle': vehicle ? vehicle.vehicle_number : 'Unknown',
            'Product': prod ? translateProductName(prod, lang) : 'Unknown',
            'Loaded Qty': `${item.cases} C, ${item.bottles} B`,
            'Delivered Qty': `${track.delivered_cases} C, ${track.delivered_bottles} B`,
            'Returned Qty': `${track.returned_cases} C, ${track.returned_bottles} B`
          });
        });
      });
    }

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, title);
    XLSX.writeFile(wb, `${title.replace(/\s+/g, '_')}_${Date.now()}.xlsx`);
  };

  const handleExportPDF = () => {
    const element = document.getElementById('loading-sheet-report-card');
    const opt = {
      margin:       0.5,
      filename:     `Consolidated_Vehicle_Loading_Report_${Date.now()}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2 },
      jsPDF:        { unit: 'in', format: 'letter', orientation: 'landscape' }
    };
    import('html2pdf.js').then((html2pdfModule) => {
      const html2pdf = html2pdfModule.default || html2pdfModule;
      html2pdf().set(opt).from(element).save();
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const handlePrintScope = (scope = 'all') => {
    setPrintScope(scope);
    setTimeout(() => {
      window.print();
    }, 120);
  };

  if (loading) return <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '3rem' }}>Loading Loading sheet Desk...</div>;

  const currentRouteObj = routes.find(r => r.id === filterRoute);
  const currentVehicleObj = vehicles.find(v => v.id === filterVehicle);
  const currentSalesmanObj = users.find(u => u.id === filterSalesman);
  const currentDeliveryObj = users.find(u => u.id === filterDeliveryPerson);

  return (
    <div>
      {/* Embedded Print CSS for print options */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .printable-header-banner { display: block !important; margin-bottom: 20px; }
          body { background: #fff !important; color: #000 !important; font-family: sans-serif; }
          .glass-card {
            background: #fff !important;
            border: 1px solid #999 !important;
            box-shadow: none !important;
            color: #000 !important;
            padding: 12px !important;
            margin-bottom: 20px !important;
            break-inside: avoid;
          }
          .custom-table {
            width: 100% !important;
            border-collapse: collapse !important;
            color: #000 !important;
          }
          .custom-table th, .custom-table td {
            border: 1px solid #333 !important;
            padding: 6px 10px !important;
            color: #000 !important;
            font-size: 11pt !important;
          }
          .custom-table th {
            background-color: #f0f0f0 !important;
            color: #000 !important;
            font-weight: bold !important;
          }
          .print-hide-consolidated { display: none !important; }
          .print-hide-routewise { display: none !important; }
        }
      `}</style>

      {/* Title */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>📦 {lang === 'ta' ? 'வாகன ஏற்றுதல் சுருக்கம்' : 'Vehicle Loading Summary'}</h1>
        <p style={{ color: 'var(--text-muted)' }}>Consolidate shop-wise orders into vehicle loading lists & manage dispatch stock logs</p>
      </div>

      {/* Navigation Subtabs */}
      <div className="reports-tabs no-print" style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <button
          className={`btn ${activeSubTab === 'summary' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveSubTab('summary')}
          style={{ fontSize: '0.85rem' }}
        >
          📋 {lang === 'ta' ? 'ஏற்றுதல் அறிக்கை' : 'Consolidated Load List'}
        </button>
        <button
          className={`btn ${activeSubTab === 'tracking' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveSubTab('tracking')}
          style={{ fontSize: '0.85rem' }}
        >
          🚚 {lang === 'ta' ? 'வண்டி வருவாய் கண்காணிப்பு' : 'Delivery & Return Tracking'}
        </button>
        <button
          className={`btn ${activeSubTab === 'reports' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveSubTab('reports')}
          style={{ fontSize: '0.85rem' }}
        >
          📊 {lang === 'ta' ? 'அறிக்கைகள்' : 'Loading Sheets & Reports'}
        </button>
      </div>

      {/* Printable Banner Header (Visible only when printed) */}
      <div className="printable-header-banner" style={{ display: 'none' }}>
        <div style={{ textAlign: 'center', marginBottom: '1rem', borderBottom: '2px solid #000', paddingBottom: '0.5rem' }}>
          <h2 style={{ fontSize: '1.6rem', margin: '0 0 0.25rem 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {printScope === 'consolidated' 
              ? (lang === 'ta' ? 'வாகன மொத்த ஏற்றுதல் பட்டியல்' : 'CONSOLIDATED VEHICLE LOAD LIST')
              : printScope === 'routewise' 
              ? (lang === 'ta' ? 'வழித்தடம் வாரியான ஏற்றுதல் பிரிவு' : 'ROUTE-WISE LOADING BREAKDOWN')
              : (lang === 'ta' ? 'வாகன ஏற்றுதல் சீட்டு & வழித்தட பிரிவு' : 'VEHICLE LOADING SHEET & ROUTE BREAKDOWN')}
          </h2>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', fontSize: '0.95rem', color: '#222', flexWrap: 'wrap', marginTop: '0.5rem' }}>
            <span><strong>Date:</strong> {filterDate}</span>
            {currentRouteObj && <span><strong>Route:</strong> {currentRouteObj.name_en}</span>}
            {currentVehicleObj && <span><strong>Vehicle:</strong> {currentVehicleObj.vehicle_number}</span>}
            {currentSalesmanObj && <span><strong>Salesman:</strong> {currentSalesmanObj.name}</span>}
            {currentDeliveryObj && <span><strong>Delivery:</strong> {currentDeliveryObj.name}</span>}
            <span><strong>Orders:</strong> {filteredOrders.length}</span>
          </div>
        </div>
      </div>

      {/* -------------------- TAB 1: LOADING SUMMARY COCKPIT -------------------- */}
      {activeSubTab === 'summary' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Filters Bar */}
          <div className="glass-card no-print" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
              <div className="form-group">
                <label style={{ fontWeight: '600' }}>{lang === 'ta' ? 'விநியோக தேதி' : 'Delivery Date'}</label>
                <input
                  type="date"
                  className="form-input"
                  value={filterDate}
                  onChange={e => setFilterDate(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label style={{ fontWeight: '600' }}>{lang === 'ta' ? 'வழித்தடம்' : 'Route'}</label>
                <select
                  className="form-select"
                  value={filterRoute}
                  onChange={e => setFilterRoute(e.target.value)}
                >
                  <option value="">-- {lang === 'ta' ? 'அனைத்து வழித்தடங்களும்' : 'All Routes'} --</option>
                  {routes.map(r => (
                    <option key={r.id} value={r.id}>{translateRouteName(r, lang)}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label style={{ fontWeight: '600' }}>{lang === 'ta' ? 'விற்பனையாளர்' : 'Salesman'}</label>
                <select
                  className="form-select"
                  value={filterSalesman}
                  onChange={e => setFilterSalesman(e.target.value)}
                >
                  <option value="">-- {lang === 'ta' ? 'அனைத்து விற்பனையாளர்களும்' : 'All Salesmen'} --</option>
                  {salesmen.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label style={{ fontWeight: '600' }}>{lang === 'ta' ? 'விநியோக நபர்' : 'Delivery Person'}</label>
                <select
                  className="form-select"
                  value={filterDeliveryPerson}
                  onChange={e => setFilterDeliveryPerson(e.target.value)}
                >
                  <option value="">-- {lang === 'ta' ? 'அனைத்து நபர்களும்' : 'All Delivery Persons'} --</option>
                  {deliveryPersons.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Print Options Toolbar */}
          <div className="glass-card no-print" style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', background: 'rgba(59, 130, 246, 0.05)', borderColor: 'var(--accent-cyan)' }}>
            <div style={{ fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-cyan)' }}>
              <span style={{ fontSize: '1.1rem' }}>🖨️</span>
              <span>{lang === 'ta' ? 'அச்சிடும் தேர்வுகள் (Print Options):' : 'Print Options:'}</span>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => handlePrintScope('consolidated')}
                style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                title="Print Consolidated Load List only"
              >
                📋 {lang === 'ta' ? 'மொத்த பட்டியல் அச்சிடு' : 'Print Consolidated Load List'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => handlePrintScope('routewise')}
                style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                title="Print Route-wise Loading Breakdown only"
              >
                🗺️ {lang === 'ta' ? 'வழித்தடம் பிரிவு அச்சிடு' : 'Print Route-wise Breakdown'}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => handlePrintScope('all')}
                style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                title="Print Full Loading Sheet containing both list & route breakdown"
              >
                🖨️ {lang === 'ta' ? 'முழு பட்டியல் அச்சிடு (இரண்டும்)' : 'Print Full Sheet (Both)'}
              </button>
            </div>
          </div>

          {/* Shortage Warning Box */}
          {hasStockShortage && (
            <div className="glass-card" style={{ borderColor: 'var(--danger)', background: 'rgba(239, 68, 68, 0.05)', padding: '1rem' }}>
              <h4 style={{ color: 'var(--danger)', margin: '0 0 0.5rem 0', fontWeight: 'bold' }}>
                ⚠️ {lang === 'ta' ? 'கிடங்கு சரக்கு இருப்பு பற்றாக்குறை!' : 'Warehouse Stock Shortage Alert!'}
              </h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0 0 0.75rem 0' }}>
                {lang === 'ta' ? 'அனுப்பப்படும் மொத்த அளவை விட கிடங்கு இருப்பு குறைவாக உள்ளதால் வண்டியை அனுப்ப முடியாது. இருப்பை நிரப்பவும்.' : 'Warehouse stock is insufficient for the consolidated load requirement. Prevent dispatch generation until resolved.'}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem', fontSize: '0.85rem' }}>
                {shortageList.map((sh, idx) => (
                  <div key={idx} style={{ color: 'var(--text-main)' }}>
                    🚨 <strong>{translateProductName(sh.product, lang)}</strong>: Shortage of <span style={{ color: 'var(--danger)', fontWeight: 'bold' }}>{sh.shortageCases} C, {sh.shortageBottles} B</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Consolidated Loading Summary Table */}
          <div className={`glass-card ${printScope === 'routewise' ? 'print-hide-consolidated' : ''}`} id="printable-loading-summary">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: '700', margin: 0 }}>
                📋 {lang === 'ta' ? 'ஏற்றுதல் விபரம் - ' : 'Consolidated Load List - '} {new Date(filterDate).toLocaleDateString()}
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.8rem', fontWeight: '700' }}>
                  {filteredOrders.length} Orders
                </span>
                <button
                  type="button"
                  className="btn btn-secondary no-print"
                  onClick={() => handlePrintScope('consolidated')}
                  style={{ fontSize: '0.8rem', padding: '0.25rem 0.6rem' }}
                >
                  🖨️ Print
                </button>
              </div>
            </div>

            <div className="table-container">
              <table className="custom-table" style={{ fontSize: '0.9rem' }}>
                <thead>
                  <tr>
                    <th>S.No</th>
                    <th>Product</th>
                    <th>Brand</th>
                    <th>Size</th>
                    <th style={{ textAlign: 'right' }}>Total Cases</th>
                    <th style={{ textAlign: 'right' }}>Total Bottles</th>
                    <th style={{ textAlign: 'right' }}>Total Units</th>
                  </tr>
                </thead>
                <tbody>
                  {consolidatedRequirements.map((req, idx) => (
                    <tr key={idx}>
                      <td>{idx + 1}</td>
                      <td><strong>{translateProductName(req.product, lang)}</strong></td>
                      <td>{req.product.brand}</td>
                      <td>{req.product.size}</td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold', color: 'var(--accent-cyan)' }}>{req.cases}</td>
                      <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{req.bottles}</td>
                      <td style={{ textAlign: 'right', color: 'var(--success)' }}>{req.total_bottles} B</td>
                    </tr>
                  ))}
                  {consolidatedRequirements.length === 0 && (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                        No order requirements found for this filter criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Route-wise Load Summary */}
          {routeWiseBreakdown.length > 0 && (
            <div className={`glass-card ${printScope === 'consolidated' ? 'print-hide-routewise' : ''}`}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: '700', margin: 0 }}>
                  🗺️ {lang === 'ta' ? 'வழித்தடம் வாரியான ஏற்றுதல் விபரம்' : 'Route-wise Loading Breakdown'}
                </h3>
                <button
                  type="button"
                  className="btn btn-secondary no-print"
                  onClick={() => handlePrintScope('routewise')}
                  style={{ fontSize: '0.8rem', padding: '0.25rem 0.6rem' }}
                >
                  🖨️ Print
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {routeWiseBreakdown.map((route, routeIdx) => (
                  <div key={routeIdx} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1rem', background: 'rgba(255,255,255,0.01)' }}>
                    <h4 style={{ color: 'var(--accent-cyan)', marginBottom: '0.75rem', fontWeight: 'bold' }}>🗺️ {route.route_name}</h4>
                    <div className="table-container">
                      <table className="custom-table" style={{ fontSize: '0.85rem' }}>
                        <thead>
                          <tr>
                            <th>S.No</th>
                            <th>Product</th>
                            <th style={{ textAlign: 'right' }}>Cases Required</th>
                            <th style={{ textAlign: 'right' }}>Bottles Required</th>
                            <th style={{ textAlign: 'right' }}>Total Units</th>
                          </tr>
                        </thead>
                        <tbody>
                          {route.requirements.map((req, reqIdx) => (
                            <tr key={reqIdx}>
                              <td>{reqIdx + 1}</td>
                              <td>{translateProductName(req.product, lang)}</td>
                              <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{req.cases}</td>
                              <td style={{ textAlign: 'right' }}>{req.bottles}</td>
                              <td style={{ textAlign: 'right' }}>{req.total_bottles} B</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Dispatch Section */}
          <div className="glass-card no-print" style={{ padding: '1.25rem', borderLeft: '3px solid var(--success)' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '1rem' }}>
              🚚 {lang === 'ta' ? 'வண்டிக்கு அனுப்புதல்' : 'Generate Dispatch Loading Sheet'}
            </h3>
            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div className="form-group" style={{ flex: 1, minWidth: '240px' }}>
                <label style={{ fontWeight: '600' }}>Select Dispatch Vehicle / வண்டி எண்</label>
                <select
                  className="form-select"
                  value={filterVehicle}
                  onChange={e => setFilterVehicle(e.target.value)}
                >
                  <option value="">-- {lang === 'ta' ? 'வண்டியைத் தேர்வு செய்க' : 'Select Vehicle'} --</option>
                  {vehicles.filter(v => v.status === 'active').map(v => (
                    <option key={v.id} value={v.id}>{v.vehicle_number} ({v.driver_name})</option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                className="btn btn-primary"
                style={{ height: '42px', minWidth: '180px' }}
                onClick={handleGenerateLoadingSheet}
                disabled={submitting || hasStockShortage || !filterVehicle || consolidatedRequirements.length === 0}
              >
                {submitting ? 'Processing...' : '🚀 Generate Loading Sheet'}
              </button>
            </div>
          </div>

        </div>
      )}

      {/* -------------------- TAB 2: LOGISTICS DELIVERY & RETURN TRACKING -------------------- */}
      {activeSubTab === 'tracking' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Dispatch Selector Card */}
          <div className="glass-card">
            <h3 style={{ fontSize: '1.2rem', fontWeight: '700', marginBottom: '1rem' }}>
              🚚 {lang === 'ta' ? 'செயலில் உள்ள வண்டிகள்' : 'Select Active Dispatched Vehicle'}
            </h3>
            <div className="form-group" style={{ maxWidth: '400px' }}>
              <select
                className="form-select"
                value={selectedDispatchId}
                onChange={e => setSelectedDispatchId(e.target.value)}
              >
                <option value="">-- {lang === 'ta' ? 'வழித்தட வண்டியைத் தேர்ந்தெடு' : 'Select Dispatched Run'} --</option>
                {dispatches.filter(d => d.status === 'dispatched').map(d => {
                  const veh = vehicles.find(v => v.id === d.vehicle_id);
                  const routeObj = routes.find(r => r.id === d.route_id);
                  return (
                    <option key={d.id} value={d.id}>
                      📅 {new Date(d.dispatch_date).toLocaleDateString()} - 🚛 {veh ? veh.vehicle_number : 'Vehicle'} ({routeObj ? routeObj.name_en : 'All Routes'})
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {/* Selected Dispatch Verification & Editing Qty */}
          {selectedDispatchId && (
            <div className="glass-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--accent-cyan)', margin: 0 }}>
                  📝 {lang === 'ta' ? 'விநியோகம் மற்றும் வருவாய் சரிபார்ப்பு' : 'Process Delivery & Return Quantities'}
                </h3>
              </div>

              <div className="table-container">
                <table className="custom-table" style={{ fontSize: '0.85rem' }}>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th style={{ textAlign: 'right', width: '120px' }}>Loaded Qty</th>
                      <th style={{ width: '100px' }}>Delivered C</th>
                      <th style={{ width: '100px' }}>Delivered B</th>
                      <th style={{ width: '100px' }}>Returned C</th>
                      <th style={{ width: '100px' }}>Returned B</th>
                      <th style={{ textAlign: 'right', width: '120px' }}>To Warehouse</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dispatches.find(d => d.id === selectedDispatchId)?.items.map(item => {
                      const prod = products.find(p => p.id === item.product_id);
                      if (!prod) return null;

                      const track = trackingQuantities[item.product_id] || { delivered_cases: 0, delivered_bottles: 0, returned_cases: 0, returned_bottles: 0 };
                      const returnedBottles = (track.returned_cases * prod.case_qty_rule) + track.returned_bottles;

                      return (
                        <tr key={item.product_id}>
                          <td><strong>{translateProductName(prod, lang)}</strong></td>
                          <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{item.cases} C, {item.bottles} B</td>
                          <td>
                            <input
                              type="number"
                              className="form-input"
                              placeholder="0"
                              min="0"
                              style={{ padding: '0.25rem 0.5rem', width: '80px', fontSize: '0.85rem' }}
                              value={track.delivered_cases}
                              onChange={e => handleTrackingQtyChange(item.product_id, 'delivered_cases', e.target.value, null)}
                              onWheel={(e) => e.target.blur()}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              className="form-input"
                              placeholder="0"
                              min="0"
                              style={{ padding: '0.25rem 0.5rem', width: '80px', fontSize: '0.85rem' }}
                              value={track.delivered_bottles}
                              onChange={e => handleTrackingQtyChange(item.product_id, 'delivered_bottles', null, e.target.value)}
                              onWheel={(e) => e.target.blur()}
                            />
                          </td>
                          <td style={{ color: 'var(--warning)', fontWeight: '600' }}>
                            {track.returned_cases} Cases
                          </td>
                          <td style={{ color: 'var(--warning)', fontWeight: '600' }}>
                            {track.returned_bottles} Bottles
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: '700', color: 'var(--success)' }}>
                            +{returnedBottles} Bottles
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Action Buttons */}
              <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setSelectedDispatchId('')}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleProcessReturns}
                  disabled={submitting}
                >
                  {submitting ? 'Saving...' : '💾 Process Returns & Reconcile'}
                </button>
              </div>
            </div>
          )}

        </div>
      )}

      {/* -------------------- TAB 3: REPORTS & EXPORTS PANEL -------------------- */}
      {activeSubTab === 'reports' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Selection & Filters */}
          <div className="glass-card no-print" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
                <label style={{ fontWeight: '600' }}>Report Category / அறிக்கை வகை</label>
                <select
                  className="form-select"
                  value={reportType}
                  onChange={e => setReportType(e.target.value)}
                >
                  <option value="loading_report">{lang === 'ta' ? 'வண்டி ஏற்றுதல் அறிக்கை' : 'Vehicle Loading Report'}</option>
                  <option value="route_report">{lang === 'ta' ? 'வழித்தடம் வாரி ஏற்றுதல் அறிக்கை' : 'Route Loading Report'}</option>
                  <option value="requirement_report">{lang === 'ta' ? 'சரக்குத் தேவை அறிக்கை' : 'Product Requirement Report'}</option>
                  <option value="dispatch_report">{lang === 'ta' ? 'வாகனங்கள் அனுப்புகை பதிவேடு' : 'Dispatch Report'}</option>
                  <option value="delivery_return_report">{lang === 'ta' ? 'விநியோகம் vs வருமானம் அறிக்கை' : 'Delivery vs Return Report'}</option>
                </select>
              </div>

              <div className="form-group">
                <label style={{ fontWeight: '600' }}>From Date</label>
                <input
                  type="date"
                  className="form-input"
                  value={reportDateFrom}
                  onChange={e => setReportDateFrom(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label style={{ fontWeight: '600' }}>To Date</label>
                <input
                  type="date"
                  className="form-input"
                  value={reportDateTo}
                  onChange={e => setReportDateTo(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={handleExportExcel} style={{ fontSize: '0.85rem' }}>📊 Export Excel</button>
                <button type="button" className="btn btn-primary" onClick={handlePrint} style={{ fontSize: '0.85rem' }}>🖨️ Print Report</button>
                <button type="button" className="btn btn-secondary" onClick={handleExportPDF} style={{ fontSize: '0.85rem' }}>📥 Download PDF</button>
              </div>
            </div>
          </div>

          {/* Loading Sheet Report Card (rendered for viewing / printing) */}
          <div className="glass-card" id="loading-sheet-report-card">
            <h3 style={{ marginBottom: '1.25rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-main)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
              {reportType.replace(/_/g, ' ')} ({new Date(reportDateFrom).toLocaleDateString()} to {new Date(reportDateTo).toLocaleDateString()})
            </h3>

            {/* Sub-report Renders */}
            {reportType === 'loading_report' && (
              <div className="table-container">
                <table className="custom-table" style={{ fontSize: '0.9rem' }}>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Brand</th>
                      <th>Size</th>
                      <th style={{ textAlign: 'right' }}>Total Cases</th>
                      <th style={{ textAlign: 'right' }}>Total Bottles</th>
                      <th style={{ textAlign: 'right' }}>Total Units</th>
                    </tr>
                  </thead>
                  <tbody>
                    {consolidatedRequirements.map((req, idx) => (
                      <tr key={idx}>
                        <td><strong>{translateProductName(req.product, lang)}</strong></td>
                        <td>{req.product.brand}</td>
                        <td>{req.product.size}</td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{req.cases}</td>
                        <td style={{ textAlign: 'right' }}>{req.bottles}</td>
                        <td style={{ textAlign: 'right', color: 'var(--success)' }}>{req.total_bottles} B</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {reportType === 'route_report' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {routeWiseBreakdown.map((route, routeIdx) => (
                  <div key={routeIdx} style={{ padding: '0.5rem 0' }}>
                    <h4 style={{ color: 'var(--accent-cyan)', marginBottom: '0.5rem', fontWeight: 'bold' }}>🗺️ {route.route_name}</h4>
                    <table className="custom-table" style={{ fontSize: '0.85rem' }}>
                      <thead>
                        <tr>
                          <th>Product</th>
                          <th style={{ textAlign: 'right' }}>Cases Required</th>
                          <th style={{ textAlign: 'right' }}>Bottles Required</th>
                        </tr>
                      </thead>
                      <tbody>
                        {route.requirements.map((req, reqIdx) => (
                          <tr key={reqIdx}>
                            <td>{translateProductName(req.product, lang)}</td>
                            <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{req.cases}</td>
                            <td style={{ textAlign: 'right' }}>{req.bottles}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            )}

            {reportType === 'requirement_report' && (
              <div className="table-container">
                <table className="custom-table" style={{ fontSize: '0.9rem' }}>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th style={{ textAlign: 'right' }}>Consolidated Required</th>
                      <th style={{ textAlign: 'right' }}>Warehouse Inventory Available</th>
                    </tr>
                  </thead>
                  <tbody>
                    {consolidatedRequirements.map((req, idx) => (
                      <tr key={idx}>
                        <td><strong>{translateProductName(req.product, lang)}</strong></td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold', color: 'var(--warning)' }}>{req.cases} Cases, {req.bottles} Bottles</td>
                        <td style={{ textAlign: 'right', color: 'var(--success)' }}>{formatStock(req.product.current_stock_bottles, req.product.case_qty_rule)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {reportType === 'dispatch_report' && (
              <div className="table-container">
                <table className="custom-table" style={{ fontSize: '0.9rem' }}>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Dispatch ID</th>
                      <th>Vehicle</th>
                      <th>Route</th>
                      <th>Product</th>
                      <th style={{ textAlign: 'right' }}>Loaded Quantity</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getFilteredDispatchesForReport().map(d => {
                      const veh = vehicles.find(v => v.id === d.vehicle_id);
                      const routeObj = routes.find(r => r.id === d.route_id);
                      return d.items.map((item, itemIdx) => {
                        const prod = products.find(p => p.id === item.product_id);
                        return (
                          <tr key={`${d.id}_${item.product_id}`}>
                            {itemIdx === 0 && (
                              <td rowSpan={d.items.length}>{new Date(d.dispatch_date).toLocaleDateString()}</td>
                            )}
                            {itemIdx === 0 && (
                              <td rowSpan={d.items.length}><code>{d.id}</code></td>
                            )}
                            {itemIdx === 0 && (
                              <td rowSpan={d.items.length}>{veh ? `${veh.vehicle_number} (${veh.driver_name})` : 'N/A'}</td>
                            )}
                            {itemIdx === 0 && (
                              <td rowSpan={d.items.length}>{routeObj ? translateRouteName(routeObj, lang) : 'All Routes'}</td>
                            )}
                            <td>{prod ? translateProductName(prod, lang) : 'Unknown Product'}</td>
                            <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{item.cases} C, {item.bottles} B</td>
                            {itemIdx === 0 && (
                              <td rowSpan={d.items.length}>
                                <span style={{ 
                                  color: d.status === 'completed' ? 'var(--success)' : 'var(--warning)',
                                  fontWeight: 'bold' 
                                }}>
                                  {d.status === 'completed' ? 'Delivered & Reconciled' : 'Dispatched'}
                                </span>
                              </td>
                            )}
                          </tr>
                        );
                      });
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {reportType === 'delivery_return_report' && (
              <div className="table-container">
                <table className="custom-table" style={{ fontSize: '0.9rem' }}>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Dispatch ID</th>
                      <th>Vehicle</th>
                      <th>Product</th>
                      <th style={{ textAlign: 'right' }}>Loaded</th>
                      <th style={{ textAlign: 'right' }}>Delivered</th>
                      <th style={{ textAlign: 'right' }}>Returned</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getFilteredDispatchesForReport().map(d => {
                      const veh = vehicles.find(v => v.id === d.vehicle_id);
                      return d.items.map((item, itemIdx) => {
                        const prod = products.find(p => p.id === item.product_id);
                        const track = d.tracking_quantities?.[item.product_id] || { delivered_cases: 0, delivered_bottles: 0, returned_cases: 0, returned_bottles: 0 };
                        return (
                          <tr key={`${d.id}_${item.product_id}`}>
                            {itemIdx === 0 && (
                              <td rowSpan={d.items.length}>{new Date(d.dispatch_date).toLocaleDateString()}</td>
                            )}
                            {itemIdx === 0 && (
                              <td rowSpan={d.items.length}><code>{d.id}</code></td>
                            )}
                            {itemIdx === 0 && (
                              <td rowSpan={d.items.length}>{veh ? veh.vehicle_number : 'N/A'}</td>
                            )}
                            <td>{prod ? translateProductName(prod, lang) : 'Unknown Product'}</td>
                            <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{item.cases} C, {item.bottles} B</td>
                            <td style={{ textAlign: 'right', color: 'var(--success)' }}>{track.delivered_cases} C, {track.delivered_bottles} B</td>
                            <td style={{ textAlign: 'right', color: 'var(--warning)' }}>{track.returned_cases} C, {track.returned_bottles} B</td>
                          </tr>
                        );
                      });
                    })}
                  </tbody>
                </table>
              </div>
            )}

          </div>

        </div>
      )}

    </div>
  );
}
