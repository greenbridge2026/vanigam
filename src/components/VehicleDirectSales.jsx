import React, { useState, useEffect } from 'react';
import api from '../api';
import * as XLSX from 'xlsx';
import { calculateOrderGstBreakdown } from '../utils/gstUtils';
import { translateShopName } from '../translations';

export default function VehicleDirectSales({ t, lang, onBillSelected, session }) {
  const [activeSubTab, setActiveSubTab] = useState('sales'); // 'vehicles' | 'dispatch' | 'sales' | 'reconcile' | 'reports'
  const [loading, setLoading] = useState(() => !api.getCached('products') || api.getCached('products').length === 0);
  const [submitting, setSubmitting] = useState(false);

  // Lists
  const [vehicles, setVehicles] = useState(() => api.getCached('vehicles') || []);
  const [vehicleStock, setVehicleStock] = useState(() => api.getCached('vehicle_stock') || []);
  const [products, setProducts] = useState(() => api.getCached('products') || []);
  const [shops, setShops] = useState(() => api.getCached('shops') || []);
  const [routes, setRoutes] = useState(() => api.getCached('routes') || []);
  const [dispatches, setDispatches] = useState(() => api.getCached('vehicle_dispatches') || []);
  const [reconciliations, setReconciliations] = useState(() => api.getCached('vehicle_reconciliations') || []);
  const [sales, setSales] = useState(() => api.getCached('vehicle_sales') || []);
  const [users, setUsers] = useState(() => api.getCached('users') || []);

  // Vehicles Form State
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [driverName, setDriverName] = useState('');
  const [assignedSalesman, setAssignedSalesman] = useState('');
  const [vehicleStatus, setVehicleStatus] = useState('active');

  // Dispatch Form State
  const [selectedDispatchVehicle, setSelectedDispatchVehicle] = useState('');
  const [dispatchCart, setDispatchCart] = useState({}); // product_id -> { cases, bottles }
  const [dispatchSearch, setDispatchSearch] = useState('');
  const [dispatchBrand, setDispatchBrand] = useState('');
  const [dispatchCategory, setDispatchCategory] = useState('');
  const [dispatchOnlyInStock, setDispatchOnlyInStock] = useState(true);
  const [bulkCasesInput, setBulkCasesInput] = useState('');

  // Sales Entry Form State
  const [selectedSaleVehicle, setSelectedSaleVehicle] = useState('');
  const [selectedSaleRoute, setSelectedSaleRoute] = useState('');
  const [selectedSaleShop, setSelectedSaleShop] = useState('');
  const [saleCart, setSaleCart] = useState({}); // product_id -> { cases, bottles, price }
  const [saleDiscount, setSaleDiscount] = useState(0);
  const [paymentMode, setPaymentMode] = useState('cash');
  const [upiReference, setUpiReference] = useState('');

  // Selected invoice for preview modal
  const [activeInvoice, setActiveInvoice] = useState(null);

  // Reconciliation State
  const [selectedReconcileVehicle, setSelectedReconcileVehicle] = useState('');

  // Filter terms
  const [salesSearch, setSalesSearch] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const currentUser = session;

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [
        vData,
        vsData,
        pData,
        sData,
        dispData,
        reconData,
        saleData,
        userData,
        rData
      ] = await Promise.all([
        api.getVehicles(),
        api.getVehicleStock(),
        api.getProducts(),
        api.getShops(),
        api.getVehicleDispatches(),
        api.getVehicleReconciliations(),
        api.getVehicleSales(),
        api.getUsers(),
        api.getRoutes()
      ]);

      setVehicles(vData || []);
      setVehicleStock(vsData || []);
      setProducts(pData || []);
      setShops(sData || []);
      setDispatches(dispData || []);
      setReconciliations(reconData || []);
      setSales(saleData || []);
      setUsers(userData || []);
      setRoutes(rData || []);
    } catch (err) {
      console.error('Failed to load vehicle direct sales data', err);
    } finally {
      setLoading(false);
    }
  };

  // Helper formatting stock
  const formatStock = (totalBottles, caseRule) => {
    const cases = Math.floor(totalBottles / caseRule);
    const bottles = totalBottles % caseRule;
    let result = '';
    if (cases > 0) result += `${cases} C`;
    if (bottles > 0) result += `${result ? ', ' : ''}${bottles} B`;
    return result || '0 B';
  };

  const getShopName = (shop) => {
    return translateShopName(shop, lang);
  };

  const getProductName = (prod) => {
    if (!prod) return '';
    return lang === 'ta' ? prod.name_ta || prod.name_en : prod.name_en;
  };

  // ---------------- VEHICLE FORM ACTIONS ----------------
  const handleSaveVehicle = async (e) => {
    e.preventDefault();
    const payload = {
      vehicle_number: vehicleNumber,
      driver_name: driverName,
      salesman_id: assignedSalesman,
      status: vehicleStatus
    };

    try {
      if (editingVehicle) {
        const updated = await api.updateVehicle(editingVehicle.id, payload);
        setVehicles(vehicles.map(v => v.id === editingVehicle.id ? updated : v));
      } else {
        const added = await api.createVehicle(payload);
        setVehicles([...vehicles, added]);
      }
      resetVehicleForm();
    } catch (err) {
      alert('Error saving vehicle details');
    }
  };

  const handleEditVehicle = (veh) => {
    setEditingVehicle(veh);
    setVehicleNumber(veh.vehicle_number);
    setDriverName(veh.driver_name);
    setAssignedSalesman(veh.salesman_id);
    setVehicleStatus(veh.status);
  };

  const handleDeleteVehicle = async (id) => {
    if (window.confirm('Are you sure you want to delete this vehicle? / இந்த வாகனத்தை நீக்க வேண்டுமா?')) {
      try {
        await api.deleteVehicle(id);
        setVehicles(vehicles.filter(v => v.id !== id));
      } catch (err) {
        alert('Failed to delete vehicle');
      }
    }
  };

  const resetVehicleForm = () => {
    setEditingVehicle(null);
    setVehicleNumber('');
    setDriverName('');
    setAssignedSalesman('');
    setVehicleStatus('active');
  };

  // ---------------- DISPATCH STOCK ACTIONS ----------------
  const getFilteredDispatchProducts = () => {
    return products
      .filter(p => p.status === 'active')
      .filter(p => !dispatchOnlyInStock || (p.current_stock_bottles || 0) > 0)
      .filter(p => {
        if (!dispatchSearch) return true;
        const s = dispatchSearch.toLowerCase();
        return (
          (p.name_en && p.name_en.toLowerCase().includes(s)) ||
          (p.name_ta && p.name_ta.toLowerCase().includes(s))
        );
      })
      .filter(p => !dispatchBrand || p.brand === dispatchBrand)
      .filter(p => !dispatchCategory || p.category === dispatchCategory);
  };

  const handleDispatchQtyChange = (prodId, field, val) => {
    const value = Math.max(0, parseInt(val) || 0);
    const prod = products.find(p => p.id === prodId);
    if (!prod) return;

    const current = dispatchCart[prodId] || { cases: 0, bottles: 0 };
    const updated = { ...current, [field]: value };
    const reqBottles = (Number(updated.cases || 0) * prod.case_qty_rule) + Number(updated.bottles || 0);
    const availBottles = prod.current_stock_bottles || 0;

    if (reqBottles > availBottles) {
      if (field === 'cases') {
        updated.cases = Math.floor(availBottles / prod.case_qty_rule);
      } else {
        const remaining = Math.max(0, availBottles - (Number(updated.cases || 0) * prod.case_qty_rule));
        updated.bottles = remaining;
      }
    }

    setDispatchCart({
      ...dispatchCart,
      [prodId]: updated
    });
  };

  // 1. Bulk set all visible products to X cases
  const handleSetAllVisibleCases = (numCases) => {
    const qty = Math.max(0, parseInt(numCases) || 0);
    if (qty <= 0) return;
    const visible = getFilteredDispatchProducts();
    const updated = { ...dispatchCart };
    visible.forEach(p => {
      const avail = p.current_stock_bottles || 0;
      const rule = p.case_qty_rule || 1;
      const maxCases = Math.floor(avail / rule);
      const applyCases = Math.min(qty, maxCases);
      if (applyCases > 0 || avail > 0) {
        updated[p.id] = {
          cases: applyCases,
          bottles: updated[p.id]?.bottles || 0
        };
      }
    });
    setDispatchCart(updated);
  };

  // 2. Load max available warehouse stock for all visible products
  const handleLoadAllMaxVisible = () => {
    const visible = getFilteredDispatchProducts();
    const updated = { ...dispatchCart };
    visible.forEach(p => {
      const avail = p.current_stock_bottles || 0;
      const rule = p.case_qty_rule || 1;
      updated[p.id] = {
        cases: Math.floor(avail / rule),
        bottles: avail % rule
      };
    });
    setDispatchCart(updated);
  };

  // 3. Copy from most recent dispatch of selected vehicle
  const handleCopyLastDispatch = () => {
    if (!selectedDispatchVehicle) return;
    const vehicleDispatches = dispatches
      .filter(d => d.vehicle_id === selectedDispatchVehicle && Array.isArray(d.items) && d.items.length > 0)
      .sort((a, b) => new Date(b.dispatch_date || 0) - new Date(a.dispatch_date || 0));

    if (vehicleDispatches.length === 0) {
      alert(lang === 'ta' ? 'இந்த வாகனத்திற்கு முந்தைய ஏற்றுதல் ஏதும் இல்லை!' : 'No previous dispatch found for this vehicle!');
      return;
    }

    const last = vehicleDispatches[0];
    const updated = { ...dispatchCart };
    let filledCount = 0;

    last.items.forEach(item => {
      const p = products.find(prod => prod.id === item.product_id);
      if (p) {
        const avail = p.current_stock_bottles || 0;
        const rule = p.case_qty_rule || 1;
        const maxCases = Math.floor(avail / rule);
        const reqCases = Number(item.cases || 0);
        const reqBottles = Number(item.bottles || 0);
        const reqTotal = (reqCases * rule) + reqBottles;

        if (reqTotal <= avail) {
          updated[item.product_id] = { cases: reqCases, bottles: reqBottles };
        } else {
          updated[item.product_id] = { cases: maxCases, bottles: avail % rule };
        }
        filledCount++;
      }
    });

    setDispatchCart(updated);
    alert(lang === 'ta' 
      ? `${filledCount} பொருட்கள் முந்தைய ஏற்றுதலிலிருந்து (${new Date(last.dispatch_date).toLocaleDateString()}) ஏற்றப்பட்டன!` 
      : `Loaded ${filledCount} products from previous dispatch (${new Date(last.dispatch_date).toLocaleDateString()})!`);
  };

  // 4. Quick row-level actions
  const handleQuickAddCases = (p, addCount) => {
    const current = dispatchCart[p.id] || { cases: 0, bottles: 0 };
    const avail = p.current_stock_bottles || 0;
    const rule = p.case_qty_rule || 1;
    const maxCases = Math.floor(avail / rule);
    const newCases = Math.min(maxCases, (current.cases || 0) + addCount);
    setDispatchCart({
      ...dispatchCart,
      [p.id]: {
        ...current,
        cases: newCases
      }
    });
  };

  const handleSetRowMax = (p) => {
    const avail = p.current_stock_bottles || 0;
    const rule = p.case_qty_rule || 1;
    setDispatchCart({
      ...dispatchCart,
      [p.id]: {
        cases: Math.floor(avail / rule),
        bottles: avail % rule
      }
    });
  };

  const handleClearRow = (prodId) => {
    const updated = { ...dispatchCart };
    delete updated[prodId];
    setDispatchCart(updated);
  };

  const handleClearDispatchCart = () => {
    setDispatchCart({});
  };

  const getDispatchSummary = () => {
    let totalItems = 0;
    let totalCases = 0;
    let totalBottles = 0;
    let totalEqBottles = 0;

    Object.keys(dispatchCart).forEach(pid => {
      const item = dispatchCart[pid];
      const p = products.find(prod => prod.id === pid);
      const c = Number(item.cases || 0);
      const b = Number(item.bottles || 0);
      if (c > 0 || b > 0) {
        totalItems++;
        totalCases += c;
        totalBottles += b;
        if (p) {
          totalEqBottles += (c * (p.case_qty_rule || 1)) + b;
        }
      }
    });

    return { totalItems, totalCases, totalBottles, totalEqBottles };
  };

  const handleDispatchSubmit = async (e) => {
    e.preventDefault();
    if (!selectedDispatchVehicle) return alert('Select a vehicle / வாகனத்தைத் தேர்ந்தெடுக்கவும்');

    const items = Object.keys(dispatchCart)
      .map(prodId => ({
        product_id: prodId,
        cases: dispatchCart[prodId].cases || 0,
        bottles: dispatchCart[prodId].bottles || 0
      }))
      .filter(item => item.cases > 0 || item.bottles > 0);

    if (items.length === 0) return alert('Add quantities to dispatch / ஏற்ற வேண்டிய அளவை உள்ளிடவும்');

    setSubmitting(true);
    try {
      await api.dispatchVehicleStock({
        vehicle_id: selectedDispatchVehicle,
        items
      });
      alert(lang === 'ta' ? 'சரக்கு வெற்றிகரமாக வாகனத்தில் ஏற்றப்பட்டது!' : 'Stock loaded onto vehicle successfully!');
      const targetVeh = selectedDispatchVehicle;
      setDispatchCart({});
      loadAllData();
      setSelectedSaleVehicle(targetVeh);
      if (window.confirm(lang === 'ta' ? 'நேரடி விற்பனை விலைப்பட்டியல் படிவத்திற்கு செல்ல விரும்புகிறீர்களா?' : 'Do you want to switch to Direct Sales Invoice Form to start billing now?')) {
        setActiveSubTab('sales');
      }
    } catch (err) {
      alert(err.message || 'Error executing dispatch');
    } finally {
      setSubmitting(false);
    }
  };

  // ---------------- SALES ENTRY ACTIONS ----------------
  const getProductVehicleStock = (vehicleId, productId) => {
    const stockItem = vehicleStock.find(s => s.vehicle_id === vehicleId && s.product_id === productId);
    return stockItem ? stockItem.current_stock_bottles : 0;
  };

  const handleSaleQtyChange = (prodId, field, val, maxBottles) => {
    const value = Math.max(0, parseInt(val) || 0);
    const prod = products.find(p => p.id === prodId);
    if (!prod) return;

    const currentItem = saleCart[prodId] || { cases: 0, bottles: 0, price: getWholesaleOrRetailPrice(prod, selectedSaleShop) };
    const updatedItem = { ...currentItem, [field]: value };
    const totalRequested = (updatedItem.cases * prod.case_qty_rule) + updatedItem.bottles;

    if (maxBottles !== undefined && maxBottles !== null && totalRequested > maxBottles && (field === 'cases' || field === 'bottles')) {
      alert(`Cannot exceed available stock! Available: ${formatStock(maxBottles, prod.case_qty_rule)} (${maxBottles} B)`);
      return;
    }

    setSaleCart({
      ...saleCart,
      [prodId]: updatedItem
    });
  };

  const getWholesaleOrRetailPrice = (prod, shopId) => {
    const shop = shops.find(s => s.id === shopId);
    if (!shop) return prod.wholesale_price;
    return shop.shop_type === 'wholesale' ? prod.wholesale_price : prod.retail_price;
  };

  useEffect(() => {
    if (selectedSaleShop) {
      const newCart = {};
      Object.keys(saleCart).forEach(pid => {
        const prod = products.find(p => p.id === pid);
        if (prod) {
          newCart[pid] = {
            ...saleCart[pid],
            price: getWholesaleOrRetailPrice(prod, selectedSaleShop)
          };
        }
      });
      setSaleCart(newCart);
    }
  }, [selectedSaleShop]);

  const calculateSaleSubtotal = () => {
    let subtotal = 0;
    Object.keys(saleCart).forEach(pid => {
      const prod = products.find(p => p.id === pid);
      const item = saleCart[pid];
      if (prod && item) {
        const rate = Number(item.price || 0);
        const bottlesRate = rate / prod.case_qty_rule;
        subtotal += (item.cases * rate) + (item.bottles * bottlesRate);
      }
    });
    return Math.round(subtotal);
  };

  // Compute live GST breakdown for direct sales cart
  const directSaleCartItemsArray = Object.keys(saleCart).map(pid => ({
    product_id: pid,
    cases: Number(saleCart[pid].cases || 0),
    bottles: Number(saleCart[pid].bottles || 0),
    price: Number(saleCart[pid].price || 0)
  })).filter(it => it.cases > 0 || it.bottles > 0);

  const directSaleShopObj = shops.find(s => s.id === selectedSaleShop);
  const directSaleGstBreakdown = calculateOrderGstBreakdown({
    items: directSaleCartItemsArray,
    products,
    discount: Number(saleDiscount || 0),
    customerGstin: directSaleShopObj?.gst_number || '',
    companyGstin: '33CWRPK4071L1Z2'
  });

  const handleSaleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedSaleVehicle) return alert('Select vehicle / வாகனத்தைத் தேர்ந்தெடுக்கவும்');
    if (!selectedSaleShop) return alert('Select shop / கடையைத் தேர்வு செய்க');

    const items = Object.keys(saleCart)
      .map(pid => ({
        product_id: pid,
        cases: saleCart[pid].cases || 0,
        bottles: saleCart[pid].bottles || 0,
        price: saleCart[pid].price || 0
      }))
      .filter(item => item.cases > 0 || item.bottles > 0);

    if (items.length === 0) return alert('Add at least one item / ஒரு பொருளையாவது சேர்க்கவும்');

    setSubmitting(true);
    try {
      const selectedShopObj = shops.find(s => s.id === selectedSaleShop);
      const result = await api.createVehicleSale({
        vehicle_id: selectedSaleVehicle,
        route_id: selectedSaleRoute || (selectedShopObj ? selectedShopObj.route_id : ''),
        shop_id: selectedSaleShop,
        salesman_id: currentUser ? currentUser.id : 'u2',
        items,
        discount: Number(saleDiscount),
        payment_mode: paymentMode,
        upi_reference: upiReference
      });

      alert(lang === 'ta' ? 'விற்பனை வெற்றிகரமாகப் பதிவு செய்யப்பட்டது!' : 'Direct Sale recorded successfully!');
      setSaleCart({});
      setSaleDiscount(0);
      setUpiReference('');
      
      setActiveInvoice(result);
      loadAllData();
    } catch (err) {
      alert(err.message || 'Error processing direct sale');
    } finally {
      setSubmitting(false);
    }
  };

  // ---------------- RECONCILIATION ACTIONS ----------------
  const handleReconcileSubmit = async (e) => {
    e.preventDefault();
    if (!selectedReconcileVehicle) return alert('Select vehicle / வாகனத்தைத் தேர்ந்தெடுக்கவும்');

    const vehicleActiveStocks = vehicleStock.filter(
      s => s.vehicle_id === selectedReconcileVehicle && s.current_stock_bottles > 0
    );

    if (vehicleActiveStocks.length === 0) {
      return alert(lang === 'ta' ? 'இந்த வாகனத்தில் சமரசம் செய்ய சரக்குகள் ஏதும் இல்லை!' : 'No stock left on the vehicle to reconcile');
    }

    if (window.confirm('Return remaining stock to warehouse and reconcile? / வாகனத்தில் மீதமுள்ள சரக்குகளை சமரசம் செய்து கிடங்கிற்கு மாற்றவா?')) {
      setSubmitting(true);
      try {
        await api.reconcileVehicleStock({
          vehicle_id: selectedReconcileVehicle
        });
        alert(lang === 'ta' ? 'வாகன சரக்குகள் சமரசம் செய்யப்பட்டு வெற்றிகரமாக கிடங்கிற்கு மாற்றப்பட்டது!' : 'Vehicle stock reconciled and returned to warehouse successfully!');
        loadAllData();
      } catch (err) {
        alert(err.message || 'Error during reconciliation');
      } finally {
        setSubmitting(false);
      }
    }
  };

  const printActiveInvoice = () => {
    window.print();
  };

  const downloadActiveInvoicePdf = async () => {
    if (!activeInvoice) return;
    const element = document.getElementById('printable-direct-invoice');
    if (!element) return;
    try {
      const html2pdfModule = await import('html2pdf.js');
      const html2pdf = html2pdfModule.default || html2pdfModule;
      const opt = {
        margin: 5,
        filename: `Invoice_${activeInvoice.invoice_number}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a5', orientation: 'portrait' }
      };
      html2pdf().set(opt).from(element).save();
    } catch (e) {
      console.error('PDF generation error:', e);
      window.print();
    }
  };

  const exportActiveInvoiceExcel = (inv, gstData) => {
    if (!inv || !gstData) return;
    const shop = shops.find(s => s.id === inv.shop_id);
    const veh = vehicles.find(v => v.id === inv.vehicle_id);
    const wb = XLSX.utils.book_new();
    const rows = [
      [`VEHICLE DIRECT SALE INVOICE - ${inv.invoice_number}`],
      ['Company:', t('company_name') || 'GSK Agency', 'GSTIN:', t('company_gst') || '33CWRPK4071L1Z2'],
      ['Date:', new Date(inv.sale_date).toLocaleString(), 'Vehicle:', veh?.vehicle_number || ''],
      ['Customer:', shop ? getShopName(shop) : '-', 'Customer GSTIN:', shop?.gst_number || 'N/A'],
      ['Payment Mode:', String(inv.payment_mode || 'cash').toUpperCase(), 'UPI Ref:', inv.upi_reference || '-'],
      [''],
      ['S.No', 'Item Details', 'Size', 'Cases', 'Bottles', 'Rate (₹)', 'Taxable (₹)', 'GST %', 'CGST (₹)', 'SGST (₹)', 'Total (₹)']
    ];

    gstData.items.forEach((it, idx) => {
      const p = it.product;
      rows.push([
        idx + 1,
        p ? getProductName(p) : 'Product',
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
      gstData.items.reduce((s, it) => s + it.cases, 0),
      gstData.items.reduce((s, it) => s + it.bottles, 0),
      '',
      gstData.taxableAmount,
      '',
      gstData.totalCgst,
      gstData.totalSgst,
      gstData.grandTotalIncGst
    ]);

    rows.push(['']);
    rows.push(['Gross Amount (₹):', gstData.grossTotal]);
    rows.push(['Discount (-):', -gstData.discount]);
    rows.push(['Taxable Amount Before GST (₹):', gstData.taxableAmount]);
    rows.push(['Total CGST (₹):', gstData.totalCgst]);
    rows.push(['Total SGST (₹):', gstData.totalSgst]);
    rows.push(['Total GST (₹):', gstData.totalGst]);
    rows.push(['Grand Total Including GST (₹):', gstData.grandTotalIncGst]);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 6 }, { wch: 28 }, { wch: 12 }, { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 14 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Direct_Invoice');
    XLSX.writeFile(wb, `Direct_Invoice_${inv.invoice_number}.xlsx`);
  };

  const exportAllDirectSalesExcel = () => {
    if (sales.length === 0) return alert('No direct sales to export');
    const wb = XLSX.utils.book_new();
    const rows = [
      ['DIRECT SALES LOG WITH COMPLETE GST BREAKDOWN'],
      ['Generated On:', new Date().toLocaleString()],
      [''],
      ['Invoice No', 'Date', 'Vehicle', 'Shop Name', 'GSTIN', 'Product', 'Cases', 'Bottles', 'Rate (₹)', 'Taxable (₹)', 'GST %', 'CGST (₹)', 'SGST (₹)', 'Line Total (₹)']
    ];

    sales.forEach(sale => {
      const veh = vehicles.find(v => v.id === sale.vehicle_id);
      const shop = shops.find(s => s.id === sale.shop_id);
      const saleGst = calculateOrderGstBreakdown({
        items: sale.items || [],
        products,
        discount: Number(sale.discount || 0),
        customerGstin: shop?.gst_number || '',
        companyGstin: '33CWRPK4071L1Z2'
      });

      saleGst.items.forEach(it => {
        const p = it.product;
        rows.push([
          sale.invoice_number,
          new Date(sale.sale_date).toLocaleDateString(),
          veh ? veh.vehicle_number : '-',
          shop ? getShopName(shop) : '-',
          shop?.gst_number || 'N/A',
          p ? getProductName(p) : 'Product',
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
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 18 }, { wch: 12 }, { wch: 14 }, { wch: 25 }, { wch: 18 }, { wch: 25 }, { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 14 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Direct_Sales_Log');
    XLSX.writeFile(wb, `Direct_Sales_Log_GST_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  if (loading) return <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>Loading Vehicle Module...</div>;

  return (
    <div>
      {/* Title */}
      <div style={{ marginBottom: '2rem' }} className="no-print">
        <h1 style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>🚚 {lang === 'ta' ? 'வாகன நேரடி விற்பனை மேலாண்மை' : 'Vehicle Direct Sales'}</h1>
        <p style={{ color: 'var(--text-muted)' }}>Load stock on vehicles, make direct sales to shops, check invoice bills, and reconcile returned stock</p>
      </div>

      {/* Internal Navigation Tabs */}
      <div className="no-print" style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', flexWrap: 'wrap' }}>
        <button
          onClick={() => setActiveSubTab('sales')}
          className={`sidebar-link ${activeSubTab === 'sales' ? 'active' : ''}`}
          style={{ width: 'auto', padding: '0.5rem 1rem' }}
        >
          🛒 {t('vehicle_direct_sales')}
        </button>
        <button
          onClick={() => setActiveSubTab('reconcile')}
          className={`sidebar-link ${activeSubTab === 'reconcile' ? 'active' : ''}`}
          style={{ width: 'auto', padding: '0.5rem 1rem' }}
        >
          ♻️ {t('reconcile_stock')}
        </button>
        <button
          onClick={() => setActiveSubTab('reports')}
          className={`sidebar-link ${activeSubTab === 'reports' ? 'active' : ''}`}
          style={{ width: 'auto', padding: '0.5rem 1rem' }}
        >
          📊 {t('vehicle_reports')}
        </button>
        {(currentUser?.role === 'admin' || !currentUser) && (
          <>
            <button
              onClick={() => setActiveSubTab('dispatch')}
              className={`sidebar-link ${activeSubTab === 'dispatch' ? 'active' : ''}`}
              style={{ width: 'auto', padding: '0.5rem 1rem' }}
            >
              📥 {t('dispatch_stock')}
            </button>
            <button
              onClick={() => setActiveSubTab('vehicles')}
              className={`sidebar-link ${activeSubTab === 'vehicles' ? 'active' : ''}`}
              style={{ width: 'auto', padding: '0.5rem 1rem' }}
            >
              🚚 {t('vehicles')}
            </button>
          </>
        )}
      </div>

      {/* -------------------- TAB: SALES ENTRY -------------------- */}
      {activeSubTab === 'sales' && (
        <div className="no-print">
          <div className="glass-card">
            <h2 style={{ marginBottom: '1.25rem', fontSize: '1.25rem' }}>Direct Sales Invoice Form</h2>
            <form onSubmit={handleSaleSubmit}>
              <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                <div className="form-group">
                  <label>{t('select_vehicle') || (lang === 'ta' ? 'வாகனத்தைத் தேர்ந்தெடுக்கவும்' : 'Select Vehicle')}</label>
                  <select
                    className="form-select"
                    value={selectedSaleVehicle}
                    onChange={e => {
                      setSelectedSaleVehicle(e.target.value);
                      setSaleCart({});
                    }}
                    required
                  >
                    <option value="">-- {lang === 'ta' ? 'வாகனம் தேர்வு' : 'Choose Vehicle'} --</option>
                    {vehicles.filter(v => v.status === 'active').map(v => (
                      <option key={v.id} value={v.id}>{v.vehicle_number} ({v.driver_name})</option>
                    ))}
                  </select>
                </div>

                {/* SELECT ROUTE HEADER & SELECTOR */}
                <div className="form-group">
                  <label>{lang === 'ta' ? 'வழியைத் தேர்ந்தெடுக்கவும்' : 'Select Route'}</label>
                  <select
                    className="form-select"
                    value={selectedSaleRoute}
                    onChange={e => {
                      setSelectedSaleRoute(e.target.value);
                      setSelectedSaleShop(''); // Reset shop when route changes
                    }}
                  >
                    <option value="">-- {lang === 'ta' ? 'அனைத்து வழிகள் / வழியைத் தேர்ந்தெடுக்கவும்' : 'All Routes / Select Route'} --</option>
                    {routes.map(r => (
                      <option key={r.id} value={r.id}>
                        {lang === 'ta' ? (r.name_ta || r.name_en) : (r.name_en || r.name_ta)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* SELECT SHOP (FILTERED BY SELECTED ROUTE) */}
                <div className="form-group">
                  <label>{t('select_shop') || (lang === 'ta' ? 'கடையைத் தேர்ந்தெடுக்கவும்' : 'Select Shop')}</label>
                  <select
                    className="form-select"
                    value={selectedSaleShop}
                    onChange={e => setSelectedSaleShop(e.target.value)}
                    required
                  >
                    <option value="">-- {lang === 'ta' ? 'கடையைத் தேர்வு செய்க' : 'Choose Shop'} --</option>
                    {shops
                      .filter(s => s.status === 'active' && (!selectedSaleRoute || s.route_id === selectedSaleRoute))
                      .map(s => (
                        <option key={s.id} value={s.id}>{getShopName(s)} ({s.shop_type})</option>
                      ))}
                  </select>
                  {selectedSaleRoute && (
                    <span style={{ fontSize: '0.72rem', color: 'var(--accent-cyan)', marginTop: '0.25rem', display: 'block' }}>
                      {lang === 'ta'
                        ? `இந்த வழியில் உள்ள கடைகள்: ${shops.filter(s => s.status === 'active' && s.route_id === selectedSaleRoute).length}`
                        : `Showing ${shops.filter(s => s.status === 'active' && s.route_id === selectedSaleRoute).length} shop(s) on this route`}
                    </span>
                  )}
                </div>
              </div>

              {selectedSaleVehicle && selectedSaleShop && (
                <div style={{ marginTop: '1.5rem' }}>
                  <h3 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Loaded Stock Items</h3>
                  
                  <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '150px' }}>
                      <input
                        type="text"
                        placeholder="Filter by Product..."
                        className="form-input"
                        value={salesSearch}
                        onChange={e => setSalesSearch(e.target.value)}
                      />
                    </div>
                    <div style={{ width: '150px' }}>
                      <select className="form-select" value={brandFilter} onChange={e => setBrandFilter(e.target.value)}>
                        <option value="">All Brands</option>
                        {Array.from(new Set(products.map(p => p.brand))).map(b => (
                          <option key={b} value={b}>{b}</option>
                        ))}
                      </select>
                    </div>
                    <div style={{ width: '150px' }}>
                      <select className="form-select" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
                        <option value="">All Categories</option>
                        {Array.from(new Set(products.filter(p => p.category).map(p => p.category))).map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="table-container" style={{ maxHeight: '380px', overflowY: 'auto' }}>
                    <table className="custom-table">
                      <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-table-th)' }}>
                        <tr>
                          <th>Product details</th>
                          <th>Loaded Stock</th>
                          <th>Price Rate (₹ / Case)</th>
                          <th style={{ minWidth: '135px' }}>Sell Cases (Stock)</th>
                          <th style={{ minWidth: '135px' }}>Sell Bottles (Stock)</th>
                          <th style={{ textAlign: 'right' }}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {products
                          .filter(p => p.status === 'active')
                          .filter(p => !salesSearch || p.name_en.toLowerCase().includes(salesSearch.toLowerCase()) || (p.name_ta && p.name_ta.includes(salesSearch)))
                          .filter(p => !brandFilter || p.brand === brandFilter)
                          .filter(p => !categoryFilter || p.category === categoryFilter)
                          .map(p => {
                            const vehicleBottles = getProductVehicleStock(selectedSaleVehicle, p.id);
                            const whBottles = p.current_stock_bottles || 0;
                            const totalAvailBottles = Math.max(0, vehicleBottles + whBottles);
                            if (totalAvailBottles === 0 && vehicleBottles === 0) return null;

                            const availCases = Math.floor(totalAvailBottles / (p.case_qty_rule || 1));
                            const item = saleCart[p.id] || { cases: 0, bottles: 0, price: getWholesaleOrRetailPrice(p, selectedSaleShop) };
                            const calculatedItemSub = Math.round(
                              (item.cases * Number(item.price || 0)) +
                              (item.bottles * (Number(item.price || 0) / p.case_qty_rule))
                            );

                            return (
                              <tr key={p.id}>
                                <td>
                                  <div style={{ fontWeight: '700' }}>{getProductName(p)}</div>
                                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.brand} | {p.category || 'N/A'} | {p.size}</div>
                                </td>
                                <td>
                                  <div style={{ color: vehicleBottles > 0 ? 'var(--success)' : 'var(--text-muted)', fontWeight: 'bold' }}>
                                    {formatStock(vehicleBottles, p.case_qty_rule)} ({vehicleBottles} B)
                                  </div>
                                  {whBottles > 0 && (
                                    <div style={{ fontSize: '0.72rem', color: 'var(--accent-cyan)', fontWeight: '500' }}>
                                      Avail: {formatStock(totalAvailBottles, p.case_qty_rule)}
                                    </div>
                                  )}
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    className="form-input"
                                    style={{ width: '90px', padding: '0.25rem' }}
                                    value={item.price}
                                    onChange={e => handleSaleQtyChange(p.id, 'price', e.target.value, totalAvailBottles)}
                                  />
                                </td>
                                <td>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                    <input
                                      type="number"
                                      className="form-input"
                                      style={{ padding: '0.25rem' }}
                                      value={item.cases || ''}
                                      onChange={e => handleSaleQtyChange(p.id, 'cases', e.target.value, totalAvailBottles)}
                                      placeholder={`Cases (${availCases} C)`}
                                      min="0"
                                    />
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: '500' }}>
                                      ({availCases} C in stock)
                                    </div>
                                  </div>
                                </td>
                                <td>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                    <input
                                      type="number"
                                      className="form-input"
                                      style={{ padding: '0.25rem' }}
                                      value={item.bottles || ''}
                                      onChange={e => handleSaleQtyChange(p.id, 'bottles', e.target.value, totalAvailBottles)}
                                      placeholder={`Bottles (${totalAvailBottles} B)`}
                                      min="0"
                                    />
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: '500' }}>
                                      ({totalAvailBottles} B in stock)
                                    </div>
                                  </div>
                                </td>
                                <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                                  ₹{calculatedItemSub || 0}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                    <div style={{ width: '340px', display: 'flex', flexDirection: 'column', gap: '0.55rem' }} className="glass-card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Gross Amount:</span>
                        <strong>₹{directSaleGstBreakdown.grossTotal}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.85rem' }}>Discount:</span>
                        <input
                          type="number"
                          className="form-input"
                          style={{ width: '100px', padding: '0.25rem' }}
                          value={saleDiscount}
                          onChange={e => setSaleDiscount(Math.max(0, Number(e.target.value)))}
                        />
                      </div>

                      {/* Taxable Amount Before GST */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#0284c7', background: 'rgba(2, 132, 199, 0.08)', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>
                        <span>Taxable Amount Before GST:</span>
                        <strong>₹{directSaleGstBreakdown.taxableAmount}</strong>
                      </div>

                      {/* CGST & SGST Split */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--accent-cyan)' }}>
                        <span>CGST:</span>
                        <strong>₹{directSaleGstBreakdown.totalCgst}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--success)' }}>
                        <span>SGST:</span>
                        <strong>₹{directSaleGstBreakdown.totalSgst}</strong>
                      </div>
                      {directSaleGstBreakdown.totalIgst > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--warning)' }}>
                          <span>IGST:</span>
                          <strong>₹{directSaleGstBreakdown.totalIgst}</strong>
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#f59e0b', borderTop: '1px dashed var(--border-color)', paddingTop: '0.35rem' }}>
                        <span>Total GST:</span>
                        <strong>₹{directSaleGstBreakdown.totalGst}</strong>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid var(--border-color)', paddingTop: '0.5rem' }}>
                        <strong style={{ fontSize: '1rem', color: 'var(--text-main)' }}>Grand Total (Inc. GST):</strong>
                        <strong style={{ fontSize: '1.25rem', color: 'var(--accent-cyan)' }}>₹{directSaleGstBreakdown.grandTotalIncGst}</strong>
                      </div>

                      <div className="form-group" style={{ marginTop: '0.25rem' }}>
                        <label>{t('payment_mode')}</label>
                        <select className="form-select" value={paymentMode} onChange={e => setPaymentMode(e.target.value)}>
                          <option value="cash">{t('cash')}</option>
                          <option value="credit">Credit / Outstanding</option>
                        </select>
                      </div>

                      <button type="submit" className="btn btn-primary" style={{ marginTop: '0.5rem' }} disabled={submitting}>
                        {submitting ? 'Processing...' : '💳 Complete & Print Invoice'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* -------------------- TAB: DAY END RECONCILE -------------------- */}
      {activeSubTab === 'reconcile' && (
        <div className="no-print">
          <div className="glass-card" style={{ maxWidth: '600px', margin: '0 auto' }}>
            <h2 style={{ marginBottom: '1.25rem', fontSize: '1.25rem' }}>Vehicle Stock Reconciliation</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              Select a vehicle to return all remaining loaded stock back to the warehouse inventory.
            </p>
            <form onSubmit={handleReconcileSubmit}>
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label>Select Vehicle</label>
                <select
                  className="form-select"
                  value={selectedReconcileVehicle}
                  onChange={e => setSelectedReconcileVehicle(e.target.value)}
                  required
                >
                  <option value="">-- Choose --</option>
                  {vehicles.map(v => (
                    <option key={v.id} value={v.id}>{v.vehicle_number} ({v.driver_name})</option>
                  ))}
                </select>
              </div>

              {selectedReconcileVehicle && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <h4 style={{ marginBottom: '0.75rem', fontSize: '0.9rem' }}>Remaining Stock to Return:</h4>
                  <div className="table-container">
                    <table className="custom-table" style={{ fontSize: '0.85rem' }}>
                      <thead>
                        <tr>
                          <th>Product</th>
                          <th>Stock on Vehicle</th>
                        </tr>
                      </thead>
                      <tbody>
                        {products.map(p => {
                          const qty = getProductVehicleStock(selectedReconcileVehicle, p.id);
                          if (qty === 0) return null;
                          return (
                            <tr key={p.id}>
                              <td>{getProductName(p)}</td>
                              <td style={{ fontWeight: 'bold', color: 'var(--warning)' }}>
                                {formatStock(qty, p.case_qty_rule)} ({qty} B)
                              </td>
                            </tr>
                          );
                        })}
                        {vehicleStock.filter(s => s.vehicle_id === selectedReconcileVehicle && s.current_stock_bottles > 0).length === 0 && (
                          <tr>
                            <td colSpan="2" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                              No stock loaded on this vehicle.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <button
                type="submit"
                className="btn btn-secondary"
                style={{ width: '100%', padding: '0.75rem', fontWeight: 'bold' }}
                disabled={submitting}
              >
                {submitting ? 'Reconciling...' : '🔄 Return Remaining Stock & Finalize'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* -------------------- TAB: VEHICLES -------------------- */}
      {activeSubTab === 'vehicles' && (
        <div className="no-print">
          <div className="glass-card" style={{ marginBottom: '2rem' }}>
            <h2 style={{ marginBottom: '1.25rem', fontSize: '1.25rem' }}>
              {editingVehicle ? t('edit_vehicle') : t('add_vehicle')}
            </h2>
            <form onSubmit={handleSaveVehicle}>
              <div className="form-grid">
                <div className="form-group">
                  <label>{t('vehicle_number')}</label>
                  <input
                    type="text"
                    className="form-input"
                    value={vehicleNumber}
                    onChange={e => setVehicleNumber(e.target.value)}
                    required
                    placeholder="e.g. TN-45-A-1234"
                  />
                </div>

                <div className="form-group">
                  <label>{t('driver_name')}</label>
                  <input
                    type="text"
                    className="form-input"
                    value={driverName}
                    onChange={e => setDriverName(e.target.value)}
                    required
                    placeholder="Driver's Full Name"
                  />
                </div>

                <div className="form-group">
                  <label>Assign Salesman</label>
                  <select
                    className="form-select"
                    value={assignedSalesman}
                    onChange={e => setAssignedSalesman(e.target.value)}
                    required
                  >
                    <option value="">-- Choose Salesman --</option>
                    {users.filter(u => u.role === 'salesman' && u.active).map(u => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Vehicle Status</label>
                  <select
                    className="form-select"
                    value={vehicleStatus}
                    onChange={e => setVehicleStatus(e.target.value)}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="btn-group" style={{ marginTop: '1.25rem' }}>
                {editingVehicle && (
                  <button type="button" className="btn btn-secondary" onClick={resetVehicleForm}>
                    {t('cancel')}
                  </button>
                )}
                <button type="submit" className="btn btn-primary">
                  💾 {t('save')}
                </button>
              </div>
            </form>
          </div>

          <div className="glass-card">
            <h2 style={{ marginBottom: '1.25rem', fontSize: '1.25rem' }}>Registered Vehicles</h2>
            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Vehicle Number</th>
                    <th>Driver Name</th>
                    <th>Salesman Assigned</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {vehicles.map(v => {
                    const salesman = users.find(u => u.id === v.salesman_id);
                    return (
                      <tr key={v.id}>
                        <td style={{ fontWeight: 'bold' }}>{v.vehicle_number}</td>
                        <td>{v.driver_name}</td>
                        <td>{salesman ? salesman.name : <span style={{ color: 'var(--text-muted)' }}>None</span>}</td>
                        <td>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            border: `1px solid ${v.status === 'active' ? 'var(--success)' : 'var(--border-color)'}`,
                            background: v.status === 'active' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                            color: v.status === 'active' ? 'var(--success)' : 'var(--text-muted)'
                          }}>
                            {v.status === 'active' ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                            <button className="language-btn" onClick={() => handleEditVehicle(v)}>
                              ✏️ Edit
                            </button>
                            <button className="btn btn-danger" onClick={() => handleDeleteVehicle(v.id)} style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}>
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* -------------------- TAB: LOAD DISPATCH -------------------- */}
      {activeSubTab === 'dispatch' && (() => {
        const summary = getDispatchSummary();
        const visibleProducts = getFilteredDispatchProducts();
        const vehicleDispatches = dispatches
          .filter(d => d.vehicle_id === selectedDispatchVehicle && Array.isArray(d.items) && d.items.length > 0)
          .sort((a, b) => new Date(b.dispatch_date || 0) - new Date(a.dispatch_date || 0));
        const lastDispatch = vehicleDispatches[0];

        return (
          <div className="no-print">
            <div className="glass-card" style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
                <div>
                  <h2 style={{ fontSize: '1.3rem', margin: 0 }}>📥 Dispatch Warehouse Stock to Vehicle</h2>
                  <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    {lang === 'ta' ? 'வாகனத்தில் சரக்குகளை மொத்தமாக ஏற்ற எளிதான வழி' : 'Quickly load products into vehicle with 1-click bulk tools'}
                  </p>
                </div>
              </div>

              {/* Step 1: Vehicle Selector */}
              <div className="form-group" style={{ maxWidth: '450px', marginBottom: '1.5rem' }}>
                <label style={{ fontWeight: '600' }}>Select Destination Vehicle / இலக்கு வாகனம்:</label>
                <select
                  className="form-select"
                  value={selectedDispatchVehicle}
                  onChange={e => setSelectedDispatchVehicle(e.target.value)}
                  required
                >
                  <option value="">-- Choose Active Vehicle --</option>
                  {vehicles.filter(v => v.status === 'active').map(v => (
                    <option key={v.id} value={v.id}>{v.vehicle_number} ({v.driver_name})</option>
                  ))}
                </select>
              </div>

              {selectedDispatchVehicle && (
                <form onSubmit={handleDispatchSubmit}>
                  {/* BULK TOOLBOX */}
                  <div style={{
                    background: 'rgba(6, 182, 212, 0.06)',
                    border: '1px solid rgba(6, 182, 212, 0.25)',
                    borderRadius: '10px',
                    padding: '1.25rem',
                    marginBottom: '1.5rem'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
                      <strong style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-cyan)' }}>
                        <span>⚡</span> {lang === 'ta' ? 'மொத்தமாக ஏற்றும் கருவிகள் (Bulk Tools)' : 'Bulk Loading Tools'}
                      </strong>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                          onClick={handleLoadAllMaxVisible}
                          title="Fills all visible products with 100% of available warehouse stock"
                        >
                          <span>📦</span> {lang === 'ta' ? 'அனைத்து சரக்குகளையும் ஏற்று (Max)' : 'Load All Max Available Stock'}
                        </button>
                        {lastDispatch && (
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                            onClick={handleCopyLastDispatch}
                            title={`Copies quantities from previous load on ${new Date(lastDispatch.dispatch_date).toLocaleDateString()}`}
                          >
                            <span>🔄</span> {lang === 'ta' ? 'முந்தைய ஏற்றுதல் நகல்' : `Copy Previous Load (${new Date(lastDispatch.dispatch_date).toLocaleDateString()})`}
                          </button>
                        )}
                        {summary.totalItems > 0 && (
                          <button
                            type="button"
                            className="btn btn-danger"
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                            onClick={handleClearDispatchCart}
                          >
                            <span>🧹</span> {lang === 'ta' ? 'அனைத்தும் நீக்கு' : 'Clear All'}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Quick Fill By Cases Input */}
                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', paddingTop: '0.5rem', borderTop: '1px dashed rgba(255,255,255,0.1)' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: '500', color: 'var(--text-main)' }}>
                        {lang === 'ta' ? 'காட்டி உள்ள அனைத்து பொருட்களுக்கும் பெட்டிகள் அமைக்க:' : 'Bulk Fill Visible Items with:'}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <input
                          type="number"
                          className="form-input"
                          style={{ width: '80px', padding: '0.35rem' }}
                          placeholder="Cases"
                          min="1"
                          value={bulkCasesInput}
                          onChange={e => setBulkCasesInput(e.target.value)}
                        />
                        <button
                          type="button"
                          className="btn btn-primary"
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem' }}
                          onClick={() => {
                            if (!bulkCasesInput) return alert('Enter number of cases');
                            handleSetAllVisibleCases(bulkCasesInput);
                          }}
                        >
                          ⚡ {lang === 'ta' ? 'பொருத்து' : 'Apply to Visible'}
                        </button>
                      </div>
                      <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Quick Presets:</span>
                        {[1, 2, 5, 10, 20].map(cnt => (
                          <button
                            key={cnt}
                            type="button"
                            onClick={() => handleSetAllVisibleCases(cnt)}
                            className="language-btn"
                            style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                          >
                            +{cnt} C
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* SEARCH & FILTER CONTROLS */}
                  <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ flex: 2, minWidth: '200px' }}>
                      <input
                        type="text"
                        placeholder="🔍 Filter by Product Name..."
                        className="form-input"
                        value={dispatchSearch}
                        onChange={e => setDispatchSearch(e.target.value)}
                      />
                    </div>
                    <div style={{ width: '160px' }}>
                      <select className="form-select" value={dispatchBrand} onChange={e => setDispatchBrand(e.target.value)}>
                        <option value="">All Brands</option>
                        {Array.from(new Set(products.map(p => p.brand).filter(Boolean))).map(b => (
                          <option key={b} value={b}>{b}</option>
                        ))}
                      </select>
                    </div>
                    <div style={{ width: '160px' }}>
                      <select className="form-select" value={dispatchCategory} onChange={e => setDispatchCategory(e.target.value)}>
                        <option value="">All Categories</option>
                        {Array.from(new Set(products.map(p => p.category).filter(Boolean))).map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-main)', userSelect: 'none' }}>
                      <input
                        type="checkbox"
                        checked={dispatchOnlyInStock}
                        onChange={e => setDispatchOnlyInStock(e.target.checked)}
                      />
                      <span>In-Stock Only ({visibleProducts.length})</span>
                    </label>
                  </div>

                  {/* LIVE SUMMARY HEADER BAR */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    padding: '0.75rem 1rem',
                    marginBottom: '1rem',
                    flexWrap: 'wrap',
                    gap: '1rem'
                  }}>
                    <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.9rem' }}>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Selected: </span>
                        <strong style={{ color: 'var(--accent-cyan)' }}>{summary.totalItems} Products</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Total Cases: </span>
                        <strong style={{ color: 'var(--success)' }}>{summary.totalCases} C</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Loose Bottles: </span>
                        <strong>{summary.totalBottles} B</strong>
                      </div>
                      <div style={{ borderLeft: '1px solid var(--border-color)', paddingLeft: '1rem' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Total Load: </span>
                        <strong style={{ color: 'var(--warning)' }}>{summary.totalEqBottles} Bottles</strong>
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={submitting || summary.totalItems === 0}
                      style={{ padding: '0.5rem 1.25rem', fontWeight: 'bold' }}
                    >
                      {submitting ? 'Processing Dispatch...' : `📥 Dispatch ${summary.totalCases} Cases to Vehicle`}
                    </button>
                  </div>

                  {/* PRODUCTS TABLE */}
                  <div className="table-container" style={{ maxHeight: '420px', overflowY: 'auto' }}>
                    <table className="custom-table">
                      <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-table-th)' }}>
                        <tr>
                          <th>Product details</th>
                          <th>Warehouse Stock</th>
                          <th style={{ width: '180px' }}>Load Cases</th>
                          <th style={{ width: '110px' }}>Load Bottles</th>
                          <th style={{ width: '120px', textAlign: 'center' }}>Quick Fill</th>
                          <th>Remaining Wh</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleProducts.length === 0 ? (
                          <tr>
                            <td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                              No products found matching filters.
                            </td>
                          </tr>
                        ) : (
                          visibleProducts.map(p => {
                            const cartItem = dispatchCart[p.id] || { cases: 0, bottles: 0 };
                            const maxCases = Math.floor((p.current_stock_bottles || 0) / (p.case_qty_rule || 1));
                            const rule = p.case_qty_rule || 1;
                            const loadedTotalBottles = (Number(cartItem.cases || 0) * rule) + Number(cartItem.bottles || 0);
                            const remainingBottles = Math.max(0, (p.current_stock_bottles || 0) - loadedTotalBottles);

                            return (
                              <tr key={p.id} style={{ background: loadedTotalBottles > 0 ? 'rgba(6, 182, 212, 0.05)' : 'inherit' }}>
                                <td>
                                  <div style={{ fontWeight: '700' }}>{getProductName(p)}</div>
                                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                    {p.brand} | {p.size} ({p.case_qty_rule} B/Case)
                                  </div>
                                </td>
                                <td>
                                  <strong style={{ color: p.current_stock_bottles > 0 ? 'var(--text-main)' : 'var(--danger)' }}>
                                    {formatStock(p.current_stock_bottles, p.case_qty_rule)}
                                  </strong>
                                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>({p.current_stock_bottles} B)</div>
                                </td>
                                <td>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                    <input
                                      type="number"
                                      className="form-input"
                                      style={{ width: '70px', padding: '0.3rem' }}
                                      value={cartItem.cases || ''}
                                      placeholder="0"
                                      onChange={e => handleDispatchQtyChange(p.id, 'cases', e.target.value)}
                                      min="0"
                                      max={maxCases}
                                    />
                                    <button
                                      type="button"
                                      className="language-btn"
                                      style={{ padding: '0.2rem 0.4rem', fontSize: '0.75rem' }}
                                      onClick={() => handleQuickAddCases(p, 1)}
                                      title="Add +1 Case"
                                    >
                                      +1
                                    </button>
                                    <button
                                      type="button"
                                      className="language-btn"
                                      style={{ padding: '0.2rem 0.4rem', fontSize: '0.75rem' }}
                                      onClick={() => handleQuickAddCases(p, 5)}
                                      title="Add +5 Cases"
                                    >
                                      +5
                                    </button>
                                  </div>
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    className="form-input"
                                    style={{ width: '70px', padding: '0.3rem' }}
                                    value={cartItem.bottles || ''}
                                    placeholder="0"
                                    onChange={e => handleDispatchQtyChange(p.id, 'bottles', e.target.value)}
                                    min="0"
                                  />
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'center' }}>
                                    <button
                                      type="button"
                                      className="btn btn-secondary"
                                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                                      onClick={() => handleSetRowMax(p)}
                                      title="Fill max available warehouse stock"
                                    >
                                      Max
                                    </button>
                                    {loadedTotalBottles > 0 && (
                                      <button
                                        type="button"
                                        className="language-btn"
                                        style={{ padding: '0.25rem 0.4rem', fontSize: '0.75rem', color: 'var(--danger)' }}
                                        onClick={() => handleClearRow(p.id)}
                                        title="Clear this row"
                                      >
                                        ✕
                                      </button>
                                    )}
                                  </div>
                                </td>
                                <td>
                                  <span style={{ fontSize: '0.85rem', color: remainingBottles === 0 ? 'var(--text-muted)' : 'var(--success)' }}>
                                    {formatStock(remainingBottles, p.case_qty_rule)}
                                  </span>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* BOTTOM SUBMIT BUTTON */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      Ready to load: <strong>{summary.totalCases} Cases, {summary.totalBottles} Loose Bottles</strong> ({summary.totalItems} products selected)
                    </div>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={submitting || summary.totalItems === 0}
                      style={{ padding: '0.65rem 1.75rem', fontSize: '1rem', fontWeight: 'bold' }}
                    >
                      {submitting ? 'Processing Dispatch...' : '📥 Dispatch Stock to Vehicle'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        );
      })()}

      {/* -------------------- TAB: REPORTS -------------------- */}
      {activeSubTab === 'reports' && (
        <div className="no-print">
          <div className="glass-card" style={{ marginBottom: '2rem' }}>
            <h2 style={{ marginBottom: '1.25rem', fontSize: '1.25rem' }}>Vehicle Stock Report</h2>
            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Vehicle</th>
                    <th>Product</th>
                    <th>Category</th>
                    <th>Loaded Stock Remaining</th>
                  </tr>
                </thead>
                <tbody>
                  {vehicleStock.map(s => {
                    const veh = vehicles.find(v => v.id === s.vehicle_id);
                    const prod = products.find(p => p.id === s.product_id);
                    if (!veh || !prod || s.current_stock_bottles === 0) return null;

                    return (
                      <tr key={s.id}>
                        <td><strong>{veh.vehicle_number}</strong> ({veh.driver_name})</td>
                        <td>{getProductName(prod)} ({prod.size})</td>
                        <td>{prod.category || 'N/A'}</td>
                        <td style={{ color: 'var(--success)', fontWeight: 'bold' }}>
                          {formatStock(s.current_stock_bottles, prod.case_qty_rule)} ({s.current_stock_bottles} Bottles)
                        </td>
                      </tr>
                    );
                  })}
                  {vehicleStock.filter(s => s.current_stock_bottles > 0).length === 0 && (
                    <tr>
                      <td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                        No stock loaded on any active vehicles.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="glass-card" style={{ marginBottom: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Direct Sales Log (Invoices)</h2>
              <button
                type="button"
                onClick={exportAllDirectSalesExcel}
                className="btn btn-secondary"
                style={{ fontSize: '0.82rem', padding: '0.4rem 0.85rem', color: 'var(--success)', borderColor: 'var(--success)', cursor: 'pointer' }}
              >
                📊 Export Direct Sales to Excel (Full GST)
              </button>
            </div>
            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Invoice No</th>
                    <th>Sale Date</th>
                    <th>Vehicle</th>
                    <th>Customer Shop</th>
                    <th>Net Amount</th>
                    <th>Payment Mode</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map(sale => {
                    const veh = vehicles.find(v => v.id === sale.vehicle_id);
                    const shop = shops.find(s => s.id === sale.shop_id);
                    return (
                      <tr key={sale.id}>
                        <td style={{ fontWeight: 'bold', color: 'var(--accent-cyan)' }}>{sale.invoice_number}</td>
                        <td>{new Date(sale.sale_date).toLocaleDateString()}</td>
                        <td>{veh ? veh.vehicle_number : 'Unknown'}</td>
                        <td>{shop ? getShopName(shop) : 'Unknown'}</td>
                        <td style={{ fontWeight: 'bold' }}>₹{sale.net_amount}</td>
                        <td>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            textTransform: 'uppercase',
                            background: sale.payment_mode === 'cash' ? 'rgba(16, 185, 129, 0.1)' : sale.payment_mode === 'upi' ? 'rgba(6, 182, 212, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                            color: sale.payment_mode === 'cash' ? 'var(--success)' : sale.payment_mode === 'upi' ? 'var(--accent-cyan)' : 'var(--danger)',
                            border: `1px solid ${sale.payment_mode === 'cash' ? 'var(--success)' : sale.payment_mode === 'upi' ? 'var(--accent-cyan)' : 'var(--danger)'}`
                          }}>
                            {sale.payment_mode}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button className="language-btn" onClick={() => setActiveInvoice(sale)}>
                            📄 View Bill
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {sales.length === 0 && (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                        No direct sales recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="glass-card" style={{ marginBottom: '2rem' }}>
            <h2 style={{ marginBottom: '1.25rem', fontSize: '1.25rem' }}>Stock Dispatch Logs</h2>
            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Dispatch Date</th>
                    <th>Vehicle</th>
                    <th>Product Items Loaded</th>
                  </tr>
                </thead>
                <tbody>
                  {[...dispatches].reverse().map(d => {
                    const veh = vehicles.find(v => v.id === d.vehicle_id);
                    return (
                      <tr key={d.id}>
                        <td>{new Date(d.dispatch_date).toLocaleString()}</td>
                        <td><strong>{veh ? veh.vehicle_number : 'Unknown'}</strong></td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            {d.items.map(item => {
                              const prod = products.find(p => p.id === item.product_id);
                              return (
                                <div key={item.product_id} style={{ fontSize: '0.85rem' }}>
                                  • {prod ? getProductName(prod) : 'Unknown'} ({prod?.size}) : <strong>{item.cases} C, {item.bottles} B</strong> ({item.total_bottles} Bottles)
                                </div>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="glass-card">
            <h2 style={{ marginBottom: '1.25rem', fontSize: '1.25rem' }}>End-of-Day Reconciliation Logs</h2>
            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Date / Time</th>
                    <th>Vehicle</th>
                    <th>Returned Stock Items</th>
                  </tr>
                </thead>
                <tbody>
                  {[...reconciliations].reverse().map(r => {
                    const veh = vehicles.find(v => v.id === r.vehicle_id);
                    return (
                      <tr key={r.id}>
                        <td>{new Date(r.reconciliation_date).toLocaleString()}</td>
                        <td><strong>{veh ? veh.vehicle_number : 'Unknown'}</strong></td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            {r.returned_items.map(item => {
                              const prod = products.find(p => p.id === item.product_id);
                              return (
                                <div key={item.product_id} style={{ fontSize: '0.85rem' }}>
                                  • {prod ? getProductName(prod) : 'Unknown'} ({prod?.size}) : <strong>{item.cases} C, {item.bottles} B</strong>
                                </div>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* -------------------- INVOICE PRINT PREVIEW MODAL -------------------- */}
      {activeInvoice && (() => {
        const invShop = shops.find(s => s.id === activeInvoice.shop_id);
        const invVeh = vehicles.find(v => v.id === activeInvoice.vehicle_id);
        const invGstBreakdown = calculateOrderGstBreakdown({
          items: activeInvoice.items || [],
          products,
          discount: Number(activeInvoice.discount || 0),
          customerGstin: invShop?.gst_number || '',
          companyGstin: '33CWRPK4071L1Z2'
        });

        return (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'rgba(0,0,0,0.65)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'flex-start',
            zIndex: 9999,
            padding: '2rem 1rem',
            overflowY: 'auto'
          }} className="modal-overlay">
            <div className="glass-card" style={{ maxWidth: '680px', width: '100%', background: 'var(--background-card)', padding: '1.5rem' }}>
              
              <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <h3 style={{ fontSize: '1.1rem', margin: 0, color: '#fff' }}>📄 Direct Invoice Bill ({activeInvoice.invoice_number})</h3>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  <button className="btn btn-primary" onClick={printActiveInvoice} style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}>
                    🖨️ Print
                  </button>
                  <button className="btn btn-secondary" onClick={downloadActiveInvoicePdf} style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', color: 'var(--danger)', borderColor: 'var(--danger)' }}>
                    📥 PDF
                  </button>
                  <button className="btn btn-secondary" onClick={() => exportActiveInvoiceExcel(activeInvoice, invGstBreakdown)} style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', color: 'var(--success)', borderColor: 'var(--success)' }}>
                    📊 Excel
                  </button>
                  <button className="btn btn-secondary" onClick={() => setActiveInvoice(null)} style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', color: '#fff' }}>
                    ✕ Close
                  </button>
                </div>
              </div>

              <div id="printable-direct-invoice" className="invoice-card" style={{ border: '1px solid var(--border-color)', padding: '1.5rem', background: '#fff', color: '#000', borderRadius: '8px' }}>
                
                <div style={{ textAlign: 'center', marginBottom: '1rem', borderBottom: '1.5px dashed #000', paddingBottom: '0.65rem' }}>
                  <h2 style={{ margin: '0 0 0.2rem 0', fontSize: '1.35rem', letterSpacing: '1px', fontWeight: '800' }}>{t('company_name') || 'GSK Agency'}</h2>
                  <p style={{ margin: '0 0 0.2rem 0', fontSize: '10px', color: '#334155' }}>{t('company_address') || 'Cooldrinks Shop - Tindivanam'}</p>
                  <p style={{ margin: 0, fontSize: '11px', fontWeight: 'bold' }}>GSTIN: {t('company_gst') || '33CWRPK4071L1Z2'}</p>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', marginBottom: '1rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>
                  <div>
                    <p style={{ margin: '0 0 0.2rem 0' }}><strong>Invoice No:</strong> {activeInvoice.invoice_number}</p>
                    <p style={{ margin: '0 0 0.2rem 0' }}><strong>Date:</strong> {new Date(activeInvoice.sale_date).toLocaleString()}</p>
                    <p style={{ margin: 0 }}><strong>Vehicle:</strong> {invVeh?.vehicle_number || ''}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ margin: '0 0 0.2rem 0' }}><strong>Customer:</strong> {getShopName(invShop)}</p>
                    <p style={{ margin: '0 0 0.2rem 0' }}><strong>Contact:</strong> {invShop?.mobile || ''}</p>
                    <p style={{ margin: 0 }}><strong>GSTIN:</strong> {invShop?.gst_number || 'N/A'}</p>
                  </div>
                </div>

                {/* Complete Tabular Product Details with GST Columns */}
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px', marginBottom: '1rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1.5px solid #000', background: '#f8fafc' }}>
                      <th style={{ textAlign: 'left', padding: '4px 3px' }}>Item Details</th>
                      <th style={{ textAlign: 'center', padding: '4px 3px', width: '45px' }}>Size</th>
                      <th style={{ textAlign: 'center', padding: '4px 3px', width: '35px' }}>C</th>
                      <th style={{ textAlign: 'center', padding: '4px 3px', width: '35px' }}>B</th>
                      <th style={{ textAlign: 'right', padding: '4px 3px', width: '55px' }}>Rate</th>
                      <th style={{ textAlign: 'right', padding: '4px 3px', width: '65px' }}>Taxable</th>
                      <th style={{ textAlign: 'center', padding: '4px 3px', width: '40px' }}>GST</th>
                      <th style={{ textAlign: 'right', padding: '4px 3px', width: '55px' }}>CGST</th>
                      <th style={{ textAlign: 'right', padding: '4px 3px', width: '55px' }}>SGST</th>
                      <th style={{ textAlign: 'right', padding: '4px 3px', width: '65px' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invGstBreakdown.items.map((item, idx) => {
                      const prod = item.product;
                      return (
                        <tr key={idx} style={{ borderBottom: '1px dashed #e2e8f0' }}>
                          <td style={{ padding: '4px 3px', fontWeight: 600 }}>{getProductName(prod)}</td>
                          <td style={{ textAlign: 'center', padding: '4px 3px', color: '#475569' }}>{prod?.size || '-'}</td>
                          <td style={{ textAlign: 'center', padding: '4px 3px' }}>{item.cases || 0}</td>
                          <td style={{ textAlign: 'center', padding: '4px 3px' }}>{item.bottles || 0}</td>
                          <td style={{ textAlign: 'right', padding: '4px 3px' }}>₹{item.rate}</td>
                          <td style={{ textAlign: 'right', padding: '4px 3px', fontWeight: 600, color: '#0284c7' }}>₹{item.taxableAmount}</td>
                          <td style={{ textAlign: 'center', padding: '4px 3px' }}>{item.gstRate}%</td>
                          <td style={{ textAlign: 'right', padding: '4px 3px' }}>₹{item.cgstAmount}</td>
                          <td style={{ textAlign: 'right', padding: '4px 3px' }}>₹{item.sgstAmount}</td>
                          <td style={{ textAlign: 'right', padding: '4px 3px', fontWeight: 'bold' }}>₹{item.grandTotal}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Horizontal Bottom Summary */}
                <div style={{
                  border: '1.5px solid #1e293b',
                  borderRadius: '4px',
                  overflow: 'hidden',
                  background: '#ffffff',
                  marginTop: '8px',
                  fontSize: '10px'
                }}>
                  {/* Row 1: GST Breakdown (Horizontal) */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: invGstBreakdown.discount > 0 ? 'repeat(6, 1fr)' : 'repeat(5, 1fr)',
                    background: '#f8fafc',
                    borderBottom: '1px solid #cbd5e1',
                    textAlign: 'center'
                  }}>
                    {invGstBreakdown.discount > 0 && (
                      <div style={{ padding: '4px 6px', borderRight: '1px solid #cbd5e1' }}>
                        <span style={{ color: '#ef4444', fontSize: '8px', textTransform: 'uppercase', fontWeight: '700', display: 'block' }}>Discount (-)</span>
                        <strong style={{ color: '#ef4444' }}>-₹{invGstBreakdown.discount}</strong>
                      </div>
                    )}
                    <div style={{ padding: '4px 6px', borderRight: '1px solid #cbd5e1', background: 'rgba(2, 132, 199, 0.08)' }}>
                      <span style={{ color: '#0284c7', fontSize: '8px', textTransform: 'uppercase', fontWeight: '800', display: 'block' }}>Taxable Amount</span>
                      <strong style={{ color: '#0284c7' }}>₹{invGstBreakdown.taxableAmount}</strong>
                    </div>
                    <div style={{ padding: '4px 6px', borderRight: '1px solid #cbd5e1' }}>
                      <span style={{ color: '#0891b2', fontSize: '8px', textTransform: 'uppercase', fontWeight: '700', display: 'block' }}>Total CGST</span>
                      <strong style={{ color: '#0891b2' }}>₹{invGstBreakdown.totalCgst}</strong>
                    </div>
                    <div style={{ padding: '4px 6px', borderRight: '1px solid #cbd5e1' }}>
                      <span style={{ color: '#16a34a', fontSize: '8px', textTransform: 'uppercase', fontWeight: '700', display: 'block' }}>Total SGST</span>
                      <strong style={{ color: '#16a34a' }}>₹{invGstBreakdown.totalSgst}</strong>
                    </div>
                    <div style={{ padding: '4px 6px', borderRight: '1px solid #cbd5e1' }}>
                      <span style={{ color: '#d97706', fontSize: '8px', textTransform: 'uppercase', fontWeight: '700', display: 'block' }}>Total GST</span>
                      <strong style={{ color: '#d97706' }}>₹{invGstBreakdown.totalGst}</strong>
                    </div>
                    <div style={{ padding: '4px 6px', background: 'rgba(15, 23, 42, 0.05)' }}>
                      <span style={{ color: '#0f172a', fontSize: '8px', textTransform: 'uppercase', fontWeight: '800', display: 'block' }}>Grand Total</span>
                      <strong style={{ color: '#0f172a', fontSize: '11px' }}>₹{invGstBreakdown.grandTotalIncGst}</strong>
                    </div>
                  </div>

                  {/* Row 2: Payment Settlement */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '6px 10px',
                    background: '#ffffff'
                  }}>
                    <div style={{ fontSize: '9.5px', color: '#475569' }}>
                      Payment Mode: <strong style={{ textTransform: 'uppercase', color: '#0f172a' }}>{activeInvoice.payment_mode}</strong>
                      {activeInvoice.upi_reference && <span style={{ marginLeft: '12px' }}>UPI Ref: <strong style={{ color: '#0f172a' }}>{activeInvoice.upi_reference}</strong></span>}
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: '900', color: '#0f172a' }}>
                      AMOUNT PAID: <strong style={{ color: '#16a34a', marginLeft: '6px' }}>₹{invGstBreakdown.grandTotalIncGst}</strong>
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: 'center', marginTop: '1.5rem', borderTop: '1px dashed #000', paddingTop: '8px', fontSize: '9px', color: '#475569' }}>
                  Thank you for your business! / வரவுக்கு நன்றி!
                </div>
              </div>

            </div>
          </div>
        );
      })()}
    </div>
  );
}
