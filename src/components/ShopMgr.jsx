import React, { useState, useEffect } from 'react';
import api from '../api';
import ConfirmModal from './ConfirmModal';
import * as XLSX from 'xlsx';
import { translateShopName } from '../translations';

export default function ShopMgr({ t, lang, onBillSelected }) {
  const [shops, setShops] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [orders, setOrders] = useState([]);
  const [editingShop, setEditingShop] = useState(null);
  const [filterRoute, setFilterRoute] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedShopForBills, setSelectedShopForBills] = useState(null);
  const [shopModalTab, setShopModalTab] = useState('bills'); // 'bills' | 'history'
  const [loading, setLoading] = useState(true);
  const [parsedShops, setParsedShops] = useState([]);
  const [importing, setImporting] = useState(false);
  const [importRouteId, setImportRouteId] = useState('');

  // Form Fields
  const [nameEn, setNameEn] = useState('');
  const [nameTa, setNameTa] = useState('');
  const [activeField, setActiveField] = useState(null);
  const [contactPerson, setContactPerson] = useState('');
  const [mobile, setMobile] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [address, setAddress] = useState('');
  const [shopType, setShopType] = useState('retail');
  const [routeId, setRouteId] = useState('');
  const [status, setStatus] = useState('active');
  const [outstanding, setOutstanding] = useState(0);
  const [deliveries, setDeliveries] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const [sData, rData, oData, dData] = await Promise.all([
          api.getShops(),
          api.getRoutes(),
          api.getOrders(),
          api.getDeliveries()
        ]);
        setShops(Array.isArray(sData) ? sData : []);
        setRoutes(Array.isArray(rData) ? rData : []);
        setOrders(Array.isArray(oData) ? oData : []);
        setDeliveries(Array.isArray(dData) ? dData : []);
      } catch (err) {
        console.error('Failed to load shop/route/order lists', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Auto-translate English to Tamil
  useEffect(() => {
    if (activeField !== 'en' || !nameEn.trim()) return;
    const delayDebounceFn = setTimeout(async () => {
      try {
        const translated = await api.translate(nameEn.trim(), 'en', 'ta');
        if (translated) setNameTa(translated);
      } catch (err) {
        console.error('Auto-translation to Tamil failed:', err);
      }
    }, 600);

    return () => clearTimeout(delayDebounceFn);
  }, [nameEn]);

  // Auto-translate Tamil to English
  useEffect(() => {
    if (activeField !== 'ta' || !nameTa.trim()) return;
    const delayDebounceFn = setTimeout(async () => {
      try {
        const translated = await api.translate(nameTa.trim(), 'ta', 'en');
        if (translated) setNameEn(translated);
      } catch (err) {
        console.error('Auto-translation to English failed:', err);
      }
    }, 600);

    return () => clearTimeout(delayDebounceFn);
  }, [nameTa]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    if (!nameEn.trim() && !nameTa.trim()) {
      alert(lang === 'ta' ? 'கடையின் பெயர் தேவை' : 'Shop name is required');
      return;
    }

    setSubmitting(true);
    let finalEn = nameEn.trim();
    let finalTa = nameTa.trim();

    // Auto-translate on submit if one is missing
    if (finalEn && !finalTa) {
      try {
        finalTa = await api.translate(finalEn, 'en', 'ta');
      } catch (err) {
        console.warn('Failed to translate to Tamil on submit', err);
      }
    } else if (finalTa && !finalEn) {
      try {
        finalEn = await api.translate(finalTa, 'ta', 'en');
      } catch (err) {
        console.warn('Failed to translate to English on submit', err);
      }
    }

    const payload = {
      name_en: finalEn,
      name_ta: finalTa,
      contact_person: contactPerson,
      mobile,
      gst_number: gstNumber,
      address,
      shop_type: shopType,
      route_id: routeId,
      status,
      outstanding_amount: Number(outstanding || 0)
    };

    try {
      if (editingShop) {
        await api.updateShop(editingShop.id, payload);
      } else {
        await api.createShop(payload);
      }
      const [sData, oData] = await Promise.all([api.getShops(), api.getOrders()]);
      setShops(sData);
      setOrders(oData);
      resetForm();
    } catch (err) {
      alert(err.message || 'Error saving shop details');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (shop) => {
    setEditingShop(shop);
    setNameEn(shop.name_en || shop.name);
    setNameTa(shop.name_ta || shop.name);
    setContactPerson(shop.contact_person || '');
    setMobile(shop.mobile);
    setGstNumber(shop.gst_number || '');
    setAddress(shop.address);
    setShopType(shop.shop_type);
    setRouteId(shop.route_id);
    setStatus(shop.status);
    setOutstanding(shop.outstanding_amount || 0);
  };

  const toggleStatus = async (shop) => {
    const newStatus = shop.status === 'active' ? 'inactive' : 'active';
    try {
      const updated = await api.updateShop(shop.id, { status: newStatus });
      setShops(shops.map(s => s.id === shop.id ? updated : s));
    } catch (err) {
      alert('Failed to toggle status');
    }
  };

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [selectedShopIds, setSelectedShopIds] = useState([]);
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);

  const handleToggleSelect = (id) => {
    setSelectedShopIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    if (filteredShops.length > 0 && selectedShopIds.length === filteredShops.length) {
      setSelectedShopIds([]);
    } else {
      setSelectedShopIds(filteredShops.map(s => s.id));
    }
  };

  const handleSelectAllShops = () => {
    setSelectedShopIds(shops.map(s => s.id));
  };

  const handleClearSelection = () => {
    setSelectedShopIds([]);
  };

  const handleBulkDeleteTrigger = () => {
    if (selectedShopIds.length === 0) return;
    setBulkConfirmOpen(true);
  };

  const executeBulkDelete = async () => {
    setBulkConfirmOpen(false);
    if (selectedShopIds.length === 0) return;
    try {
      const res = await api.bulkDeleteShops(selectedShopIds);
      if (res.success) {
        const deletedSet = new Set(res.deletedIds);
        setShops(prev => prev.filter(s => !deletedSet.has(s.id)));
        setSelectedShopIds([]);

        let msg = (t('bulk_deleted_shops_summary') || 'Successfully moved {deleted} shop(s) to the Recycle Bin.')
          .replace('{deleted}', res.deletedCount);

        if (res.skippedCount > 0) {
          msg += '\n\n' + (lang === 'ta'
            ? `${res.skippedCount} கடைகள் செயலில் உள்ள ஆர்டர்கள்/பில்கள் இருப்பதால் தவிர்க்கப்பட்டன.`
            : `${res.skippedCount} shop(s) skipped because they have existing orders.`);
        }

        alert(msg);
      }
    } catch (err) {
      alert((lang === 'ta' ? 'கடைகளை நீக்க முடியவில்லை: ' : 'Failed to bulk delete shops: ') + (err.message || err));
    }
  };

  const handleDeleteTrigger = (id) => {
    setDeleteTargetId(id);
    setConfirmOpen(true);
  };

  const executeDelete = async () => {
    setConfirmOpen(false);
    if (!deleteTargetId) return;
    try {
      await api.deleteShop(deleteTargetId);
      setShops(shops.filter(s => s.id !== deleteTargetId));
      setSelectedShopIds(prev => prev.filter(id => id !== deleteTargetId));
      alert('Shop moved to Recycle Bin. / கடை குப்பைத் தொட்டிக்கு நகர்த்தப்பட்டது.');
    } catch (err) {
      alert(err.message || 'Failed to delete shop');
    } finally {
      setDeleteTargetId(null);
    }
  };

  const resetForm = () => {
    setEditingShop(null);
    setNameEn('');
    setNameTa('');
    setActiveField(null);
    setContactPerson('');
    setMobile('');
    setGstNumber('');
    setAddress('');
    setShopType('retail');
    setRouteId('');
    setStatus('active');
    setOutstanding(0);
  };

  const handleExportToExcel = () => {
    if (shops.length === 0) {
      alert(lang === 'ta' ? 'ஏற்றுமதி செய்ய கடைகள் எதுவும் இல்லை' : 'No shops to export.');
      return;
    }

    const exportData = shops.map((s, index) => {
      const routeObj = routes.find(r => r.id === s.route_id);
      const routeName = routeObj ? (routeObj.name_en || routeObj.name_ta) : 'Unassigned';
      return {
        'S.No': index + 1,
        'Shop Name (English)': s.name_en || '',
        'Shop Name (Tamil)': s.name_ta || '',
        'Mobile Number': s.mobile || '',
        'Address / Location': s.address || '',
        'Assigned Route': routeName,
        'Contact Person': s.contact_person || '',
        'Shop Type': s.shop_type || 'retail',
        'GST Number': s.gst_number || '',
        'Outstanding Amount': s.outstanding_amount || 0,
        'Status': s.status || 'active'
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Shops List');
    XLSX.writeFile(wb, `shops_list_${Date.now()}.xlsx`);
  };

  const handleDownloadTemplate = () => {
    const templateData = [
      {
        'S.No': 1,
        'Shop Name (English)': 'Raja Cool Drinks',
        'Shop Name (Tamil)': 'ராஜா குளிர் பானங்கள்',
        'Mobile Number': '9876543210',
        'Address / Location': 'Door No 12, Bazaar Street, Tindivanam',
        'Assigned Route': routes[0]?.name_en || 'Main Route',
        'Contact Person': 'Raja',
        'Shop Type': 'Retail',
        'GST Number': '33CWRPK4071L1Z2',
        'Outstanding Amount': 0,
        'Status': 'Active'
      },
      {
        'S.No': 2,
        'Shop Name (English)': 'City Wholesale Store',
        'Shop Name (Tamil)': 'சிட்டி மொத்த விற்பனை கடை',
        'Mobile Number': '9845123456',
        'Address / Location': '45, Bus Stand Road',
        'Assigned Route': routes[1]?.name_en || routes[0]?.name_en || 'Main Route',
        'Contact Person': 'Kannan',
        'Shop Type': 'Wholesale',
        'GST Number': '',
        'Outstanding Amount': 2500,
        'Status': 'Active'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Shops Template');
    XLSX.writeFile(wb, 'shops_import_template.xlsx');
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        if (data.length === 0) {
          alert(lang === 'ta' ? 'பதிவேற்றிய கோப்பு காலியாக உள்ளது' : 'Uploaded file is empty.');
          return;
        }

        // Helper to perform case-insensitive header mapping
        const getVal = (row, keys) => {
          for (const key of keys) {
            const foundKey = Object.keys(row).find(
              k => k.toLowerCase().replace(/[^a-z0-9]/g, '') === key.toLowerCase().replace(/[^a-z0-9]/g, '')
            );
            if (foundKey && row[foundKey] !== undefined) return row[foundKey];
          }
          return undefined;
        };

        const mapped = data.map((row) => {
          const name_en = String(getVal(row, ['ShopNameEnglish', 'ShopNameEn', 'ShopName', 'Name', 'EnglishName', 'NameEn']) || '').trim();
          const name_ta = String(getVal(row, ['ShopNameTamil', 'ShopNameTa', 'TamilName', 'NameTa', 'Tamil']) || '').trim();
          const mobile = String(getVal(row, ['MobileNumber', 'MobileNo', 'Mobile', 'Phone', 'PhoneNumber', 'Cell']) || '').trim();
          const address = String(getVal(row, ['AddressLocation', 'Address', 'Location', 'Street', 'DoorNo']) || '').trim();
          const contact_person = String(getVal(row, ['ContactPerson', 'OwnerName', 'Owner', 'Contact', 'Person']) || 'Owner').trim();
          const gst_number = String(getVal(row, ['GSTNumber', 'GSTIN', 'GST', 'GstNo', 'TaxId']) || '').trim();

          let shop_type = String(getVal(row, ['ShopType', 'Type']) || 'retail').toLowerCase().trim();
          if (shop_type.includes('wholesale') || shop_type.includes('மொத்த')) {
            shop_type = 'wholesale';
          } else {
            shop_type = 'retail';
          }

          let status = String(getVal(row, ['Status', 'State']) || 'active').toLowerCase().trim();
          if (status.includes('inact') || status.includes('செயலற்ற')) {
            status = 'inactive';
          } else {
            status = 'active';
          }

          const outstanding_amount = Number(getVal(row, ['OutstandingAmount', 'Outstanding', 'Balance', 'OpeningBalance', 'DueAmount']) || 0);

          const routeRaw = String(getVal(row, ['AssignedRoute', 'Route', 'RouteName', 'RouteId']) || '').trim();
          let matchedRouteId = '';
          if (routeRaw) {
            const rLower = routeRaw.toLowerCase();
            const foundRoute = routes.find(r =>
              r.id === routeRaw ||
              (r.name_en && r.name_en.toLowerCase() === rLower) ||
              (r.name_ta && r.name_ta.toLowerCase() === rLower)
            );
            if (foundRoute) matchedRouteId = foundRoute.id;
          }

          return {
            name_en,
            name_ta: name_ta || name_en,
            mobile,
            address,
            contact_person,
            gst_number,
            shop_type,
            status,
            outstanding_amount,
            route_id: matchedRouteId,
            route_name: routeRaw
          };
        }).filter(s => s.name_en || s.name_ta);

        if (mapped.length === 0) {
          alert(
            lang === 'ta'
              ? 'செல்லுபடியாகும் கடைகள் எதுவும் இல்லை! தயவுசெய்து தலைப்புகளைச் சரிபார்க்கவும்.'
              : 'No valid shops found in file. Please check column headers.'
          );
          return;
        }

        setParsedShops(mapped);
      } catch (err) {
        console.error('File parsing error:', err);
        alert(lang === 'ta' ? 'கோப்பைப் படிப்பதில் பிழை ஏற்பட்டது!' : 'Error reading file! Please check the structure.');
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const handleConfirmImport = async () => {
    const missingRoute = parsedShops.some(s => !s.route_id);
    if (missingRoute && !importRouteId) {
      alert(lang === 'ta' ? 'வழித்தடம் இல்லாத கடைகளுக்கு இயல்புநிலை வழித்தடத்தைத் தேர்ந்தெடுக்கவும்!' : 'Please select an assigned route for shops that do not have a route specified in the Excel file.');
      return;
    }
    if (parsedShops.length === 0) return;
    setImporting(true);
    try {
      const results = await api.importShops(importRouteId, parsedShops);
      const updatedList = await api.getShops();
      setShops(updatedList);
      alert(
        lang === 'ta'
          ? `வெற்றிகரமாக ${results.length} கடைகள் இறக்குமதி செய்யப்பட்டன!`
          : `Successfully imported ${results.length} shops!`
      );
      setParsedShops([]);
      setImportRouteId('');
    } catch (err) {
      alert(err.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  if (loading) return <div style={{ color: 'var(--text-muted)', textAlign: 'center' }}>Loading Shop Manager...</div>;

  // Filter & Search Logic
  const safeShops = Array.isArray(shops) ? shops : [];
  const safeRoutes = Array.isArray(routes) ? routes : [];

  const filteredShops = safeShops.filter(s => {
    if (!s) return false;
    const matchesRoute = filterRoute ? s.route_id === filterRoute : true;
    
    const nameStr = `${s.name_en || ''} ${s.name_ta || ''} ${s.contact_person || ''} ${s.mobile || ''} ${s.gst_number || ''}`.toLowerCase();
    const matchesSearch = searchQuery ? nameStr.includes(searchQuery.toLowerCase()) : true;

    return matchesRoute && matchesSearch;
  });

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>🏢 {t('shop_mgmt')}</h1>
        <p style={{ color: 'var(--text-muted)' }}>Register and coordinate retail and wholesale shops across routes</p>
      </div>

      {/* Add Shop Form (Inline) */}
      {!editingShop && (
        <div className="glass-card">
          <h2 style={{ marginBottom: '1.25rem', fontSize: '1.25rem' }}>
            ➕ {t('add_shop')}
          </h2>
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-group">
                <label>{t('shop_name')} (English)</label>
                <input type="text" className="form-input" value={nameEn} onChange={e => setNameEn(e.target.value)} onFocus={() => setActiveField('en')} placeholder="e.g. Raja Cool Drinks" />
              </div>
              <div className="form-group">
                <label>{t('shop_name')} (Tamil)</label>
                <input type="text" className="form-input" value={nameTa} onChange={e => setNameTa(e.target.value)} onFocus={() => setActiveField('ta')} placeholder="எ.கா. ராஜா குளிர் பானங்கள்" />
              </div>
              <div className="form-group">
                <label>{t('contact_person')}</label>
                <input type="text" className="form-input" value={contactPerson} onChange={e => setContactPerson(e.target.value)} placeholder="Owner name" />
              </div>
              <div className="form-group">
                <label>{t('mobile_number')}</label>
                <input
                  type="text"
                  className="form-input"
                  value={mobile}
                  onChange={e => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  maxLength={10}
                  pattern="[0-9]{10}"
                  inputMode="numeric"
                  required
                  placeholder="e.g. 9876543210"
                />
              </div>
              <div className="form-group">
                <label>{t('gst_number')}</label>
                <input type="text" className="form-input" value={gstNumber} onChange={e => setGstNumber(e.target.value)} placeholder="15-digit GSTIN" />
              </div>
              <div className="form-group">
                <label>{t('shop_type')}</label>
                <select className="form-select" value={shopType} onChange={e => setShopType(e.target.value)}>
                  <option value="retail">{t('retail')}</option>
                  <option value="wholesale">{t('wholesale')}</option>
                </select>
              </div>
              <div className="form-group">
                <label>{t('assigned_route')}</label>
                <select className="form-select" value={routeId} onChange={e => setRouteId(e.target.value)} required>
                  <option value="">-- Select Route --</option>
                  {routes.map(r => (
                    <option key={r.id} value={r.id}>{lang === 'ta' ? r.name_ta : r.name_en}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>{t('status')}</label>
                <select className="form-select" value={status} onChange={e => setStatus(e.target.value)}>
                  <option value="active">{t('active')}</option>
                  <option value="inactive">{t('inactive')}</option>
                </select>
              </div>
              <div className="form-group">
                <label>{t('outstanding_amount')} (₹)</label>
                <input type="number" className="form-input" value={outstanding} onChange={e => setOutstanding(e.target.value)} placeholder="0" />
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>{t('address')}</label>
                <input type="text" className="form-input" value={address} onChange={e => setAddress(e.target.value)} required placeholder="Door No, Street Name, Area" />
              </div>
            </div>
            <div className="btn-group">
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? (lang === 'ta' ? '⏳ சேமிக்கிறது...' : '⏳ Saving...') : `💾 ${t('save')}`}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Shop Form (Popup Modal) */}
      {editingShop && (
        <div className="modal-overlay">
          <div className="glass-card modal-card" style={{ maxWidth: '700px', width: '95%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <h2 style={{ fontSize: '1.35rem', fontWeight: '700', margin: 0 }}>
                ✏️ {t('edit_shop')}: {translateShopName(editingShop, lang)}
              </h2>
              <button 
                type="button" 
                onClick={resetForm}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.5rem', cursor: 'pointer', lineHeight: 1 }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div style={{ overflowY: 'auto', flex: 1, paddingRight: '0.5rem', marginBottom: '1rem' }}>
                <div className="form-grid">
                  <div className="form-group">
                    <label>{t('shop_name')} (English)</label>
                    <input type="text" className="form-input" value={nameEn} onChange={e => setNameEn(e.target.value)} onFocus={() => setActiveField('en')} placeholder="e.g. Raja Cool Drinks" />
                  </div>
                  <div className="form-group">
                    <label>{t('shop_name')} (Tamil)</label>
                    <input type="text" className="form-input" value={nameTa} onChange={e => setNameTa(e.target.value)} onFocus={() => setActiveField('ta')} placeholder="எ.கா. ராஜா குளிர் பானங்கள்" />
                  </div>
                  <div className="form-group">
                    <label>{t('contact_person')}</label>
                    <input type="text" className="form-input" value={contactPerson} onChange={e => setContactPerson(e.target.value)} placeholder="Owner name" />
                  </div>
                  <div className="form-group">
                    <label>{t('mobile_number')}</label>
                    <input
                      type="text"
                      className="form-input"
                      value={mobile}
                      onChange={e => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      maxLength={10}
                      pattern="[0-9]{10}"
                      inputMode="numeric"
                      required
                      placeholder="e.g. 9876543210"
                    />
                  </div>
                  <div className="form-group">
                    <label>{t('gst_number')}</label>
                    <input type="text" className="form-input" value={gstNumber} onChange={e => setGstNumber(e.target.value)} placeholder="15-digit GSTIN" />
                  </div>
                  <div className="form-group">
                    <label>{t('shop_type')}</label>
                    <select className="form-select" value={shopType} onChange={e => setShopType(e.target.value)}>
                      <option value="retail">{t('retail')}</option>
                      <option value="wholesale">{t('wholesale')}</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>{t('assigned_route')}</label>
                    <select className="form-select" value={routeId} onChange={e => setRouteId(e.target.value)} required>
                      <option value="">-- Select Route --</option>
                      {routes.map(r => (
                        <option key={r.id} value={r.id}>{lang === 'ta' ? r.name_ta : r.name_en}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>{t('status')}</label>
                    <select className="form-select" value={status} onChange={e => setStatus(e.target.value)}>
                      <option value="active">{t('active')}</option>
                      <option value="inactive">{t('inactive')}</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>{t('outstanding_amount')} (₹)</label>
                    <input type="number" className="form-input" value={outstanding} onChange={e => setOutstanding(e.target.value)} placeholder="0" />
                  </div>
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label>{t('address')}</label>
                    <input type="text" className="form-input" value={address} onChange={e => setAddress(e.target.value)} required placeholder="Door No, Street Name, Area" />
                  </div>
                </div>
              </div>

              <div className="btn-group" style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: 'auto' }}>
                <button type="button" className="btn btn-secondary" onClick={resetForm}>
                  {t('cancel')}
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? (lang === 'ta' ? '⏳ சேமிக்கிறது...' : '⏳ Saving...') : `💾 ${t('save')}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Filter and List Section */}
      <div className="glass-card">
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Registered Shops ({filteredShops.length})</h2>
            {selectedShopIds.length > 0 && (
              <span style={{
                fontSize: '0.8rem',
                fontWeight: 600,
                background: 'rgba(239, 68, 68, 0.12)',
                color: 'var(--danger)',
                padding: '0.2rem 0.6rem',
                borderRadius: '12px'
              }}>
                ✓ {selectedShopIds.length} {lang === 'ta' ? 'தேர்ந்தெடுக்கப்பட்டது' : 'selected'}
              </span>
            )}
          </div>
          
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <button type="button" className="btn btn-secondary" onClick={handleDownloadTemplate} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}>
              📥 {lang === 'ta' ? 'வார்ப்புருவைப் பதிவிறக்கு' : 'Download Template'}
            </button>

            <button type="button" className="btn btn-secondary" onClick={handleExportToExcel} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}>
              📤 {lang === 'ta' ? 'கடைகளைப் பதிவிறக்கு (Excel)' : 'Download Shops (Excel)'}
            </button>
            
            <div style={{ position: 'relative', overflow: 'hidden', display: 'inline-block' }}>
              <button type="button" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}>
                📁 {lang === 'ta' ? 'கோப்பைத் தேர்ந்தெடு (Excel / CSV)' : 'Select Excel / CSV'}
              </button>
              <input 
                type="file" 
                accept=".xlsx,.xls,.csv" 
                onChange={handleFileUpload} 
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  opacity: 0,
                  fontSize: '100px',
                  cursor: 'pointer'
                }} 
              />
            </div>

            <select className="form-select" value={filterRoute} onChange={e => setFilterRoute(e.target.value)} style={{ minWidth: '180px', padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}>
              <option value="">All Routes / அனைத்து வழித்தடங்களும்</option>
              {routes.map(r => (
                <option key={r.id} value={r.id}>{lang === 'ta' ? r.name_ta : r.name_en}</option>
              ))}
            </select>
            
            <input
              type="text"
              className="form-input"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search shops..."
              style={{ width: '180px', padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
            />

            {filteredShops.length > 0 && (
              <>
                {selectedShopIds.length === filteredShops.length ? (
                  <button
                    type="button"
                    className="language-btn"
                    onClick={handleClearSelection}
                    style={{ fontSize: '0.85rem', padding: '0.4rem 0.75rem' }}
                  >
                    ✕ {lang === 'ta' ? 'தேர்வை நீக்கு' : 'Deselect All'}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="language-btn"
                    onClick={handleToggleSelectAll}
                    style={{ fontSize: '0.85rem', padding: '0.4rem 0.75rem' }}
                  >
                    ☑ {filterRoute ? (lang === 'ta' ? 'வழித்தடக் கடைகளைத் தேர்ந்தெடு' : 'Select All in Route') : (lang === 'ta' ? 'அனைத்தையும் தேர்ந்தெடு' : 'Select All')} ({filteredShops.length})
                  </button>
                )}
              </>
            )}

            {filterRoute && selectedShopIds.length !== shops.length && shops.length > filteredShops.length && (
              <button
                type="button"
                className="language-btn"
                onClick={handleSelectAllShops}
                style={{ fontSize: '0.85rem', padding: '0.4rem 0.75rem' }}
                title={lang === 'ta' ? 'அனைத்து வழித்தடக் கடைகளையும் தேர்ந்தெடு' : 'Select all shops across all routes'}
              >
                ☑ {lang === 'ta' ? 'அனைத்து கடைகளும்' : 'All Shops'} ({shops.length})
              </button>
            )}

            {selectedShopIds.length > 0 && (
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleBulkDeleteTrigger}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.4rem 0.85rem',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  boxShadow: '0 2px 8px rgba(239, 68, 68, 0.25)'
                }}
              >
                🗑️ {selectedShopIds.length === shops.length
                  ? (lang === 'ta' ? 'அனைத்து கடைகளையும் நீக்கு' : 'Delete All Shops')
                  : (filterRoute && selectedShopIds.length === filteredShops.length
                      ? (lang === 'ta' ? 'வழித்தடக் கடைகளை நீக்கு' : 'Delete Route Shops')
                      : (lang === 'ta' ? 'தேர்ந்தெடுத்தவற்றை நீக்கு' : 'Delete Selected'))} ({selectedShopIds.length})
              </button>
            )}
          </div>
        </div>

        {parsedShops.length > 0 && (
          <div style={{ 
            background: 'rgba(255,255,255,0.05)', 
            borderRadius: 'var(--radius)', 
            padding: '1rem', 
            border: '1px solid rgba(255,255,255,0.1)',
            marginBottom: '1.5rem'
          }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.75rem', color: 'var(--accent-cyan)' }}>
              📋 {lang === 'ta' ? `இறக்குமதி செய்ய தயாராக உள்ள கடைகள் (${parsedShops.length})` : `Loaded Shops Ready for Import (${parsedShops.length})`}
            </h3>

            {(() => {
              const missingCount = parsedShops.filter(s => !s.route_id).length;
              return (
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
                  <label style={{ fontWeight: '600', fontSize: '0.9rem' }}>
                    {missingCount > 0 
                      ? (lang === 'ta' 
                          ? `வழித்தடம் இல்லாத ${missingCount} கடைகளுக்கு வழித்தடத்தைத் தேர்ந்தெடுக்கவும்:` 
                          : `Assign Default Route (${missingCount} shop(s) without route in Excel):`)
                      : (lang === 'ta' 
                          ? 'அனைத்து கடைகளுக்கும் எக்செல் மூலம் வழித்தடம் ஒதுக்கப்பட்டுள்ளது (தேவைப்பட்டால் மாற்றலாம்):' 
                          : 'All shops have assigned routes from file (optional override):')}
                    {missingCount > 0 && <span style={{ color: 'var(--danger)', marginLeft: '0.25rem' }}>*</span>}
                  </label>
                  <select 
                    className="form-select" 
                    value={importRouteId} 
                    onChange={e => setImportRouteId(e.target.value)} 
                    style={{ minWidth: '240px' }}
                  >
                    <option value="">{missingCount > 0 ? '-- Select Default Route --' : '-- Keep File Routes --'}</option>
                    {routes.map(r => (
                      <option key={r.id} value={r.id}>{lang === 'ta' ? r.name_ta : r.name_en}</option>
                    ))}
                  </select>
                </div>
              );
            })()}
            
            <div style={{ maxHeight: '240px', overflowY: 'auto', fontSize: '0.85rem' }} className="table-container">
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }} className="custom-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Shop Name (English)</th>
                    <th>Shop Name (Tamil)</th>
                    <th>Mobile Number</th>
                    <th>Address / Location</th>
                    <th>Assigned Route</th>
                    <th>Contact Person</th>
                    <th>Shop Type</th>
                    <th>GST Number</th>
                    <th>Outstanding (₹)</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedShops.map((s, idx) => {
                    const matchedR = routes.find(r => r.id === s.route_id);
                    const defaultR = routes.find(r => r.id === importRouteId);
                    const displayRoute = matchedR ? (lang === 'ta' ? matchedR.name_ta : matchedR.name_en) 
                      : (defaultR ? `⚡ ${(lang === 'ta' ? defaultR.name_ta : defaultR.name_en)}` : (s.route_name || '—'));
                    return (
                      <tr key={idx}>
                        <td style={{ color: 'var(--text-muted)' }}>{idx + 1}</td>
                        <td><strong>{s.name_en || '-'}</strong></td>
                        <td>{s.name_ta || '-'}</td>
                        <td>{s.mobile || '-'}</td>
                        <td>{s.address || '-'}</td>
                        <td style={{ color: (matchedR || defaultR) ? 'var(--accent-cyan)' : 'var(--danger)' }}>
                          {displayRoute}
                        </td>
                        <td>{s.contact_person || '-'}</td>
                        <td><span className="badge" style={{ textTransform: 'capitalize' }}>{s.shop_type || 'retail'}</span></td>
                        <td>{s.gst_number || '-'}</td>
                        <td>₹{s.outstanding_amount || 0}</td>
                        <td><span className={`badge ${s.status === 'active' ? 'badge-success' : 'badge-danger'}`} style={{ textTransform: 'capitalize' }}>{s.status || 'active'}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              <strong>{lang === 'ta' ? 'ஆதரிக்கப்படும் பத்திகள்:' : 'Supported Column Headers:'}</strong>
              <span style={{ 
                display: 'inline-block', 
                background: 'rgba(255,255,255,0.05)', 
                padding: '0.1rem 0.4rem', 
                borderRadius: '3px', 
                marginLeft: '0.5rem',
                fontFamily: 'monospace',
                color: 'var(--accent-cyan)'
              }}>
                Shop Name (English), Shop Name (Tamil), Mobile Number, Address / Location, Assigned Route, Contact Person, Shop Type, GST Number, Outstanding Amount, Status
              </span>
            </div>

            <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={() => { setParsedShops([]); setImportRouteId(''); }}>
                {t('cancel')}
              </button>
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={handleConfirmImport} 
                disabled={importing || (parsedShops.some(s => !s.route_id) && !importRouteId)}
                style={{ 
                  background: 'var(--success)', 
                  opacity: (importing || (parsedShops.some(s => !s.route_id) && !importRouteId)) ? 0.6 : 1 
                }}
              >
                {importing ? (lang === 'ta' ? 'இறக்குமதி செய்யப்படுகிறது...' : 'Importing...') : (lang === 'ta' ? 'இறக்குமதி செய்' : 'Confirm Import')}
              </button>
            </div>
          </div>
        )}

        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th style={{ width: '42px', textAlign: 'center', padding: '0.75rem 0.5rem' }}>
                  <input
                    type="checkbox"
                    className="form-checkbox"
                    checked={filteredShops.length > 0 && selectedShopIds.length === filteredShops.length}
                    onChange={handleToggleSelectAll}
                    style={{ cursor: 'pointer', transform: 'scale(1.2)' }}
                    title={lang === 'ta' ? 'அனைத்தையும் தேர்ந்தெடு / நீக்கு' : 'Select / Deselect all'}
                  />
                </th>
                <th>{t('shop_name')}</th>
                <th>{t('mobile_number')}</th>
                <th>Address / Location</th>
                <th>{t('assigned_route')}</th>
                <th>{t('contact_person')}</th>
                <th>{t('shop_type')}</th>
                <th>{t('outstanding_amount')}</th>
                <th>{t('status')}</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredShops.map(s => {
                const isSelected = selectedShopIds.includes(s.id);
                const routeObj = routes.find(r => r.id === s.route_id);
                const routeName = routeObj ? (lang === 'ta' ? routeObj.name_ta : routeObj.name_en) : 'None';
                return (
                  <tr
                    key={s.id}
                    style={{
                      background: isSelected ? 'rgba(59, 130, 246, 0.08)' : undefined,
                      transition: 'background 0.15s ease'
                    }}
                  >
                    <td style={{ textAlign: 'center', padding: '0.75rem 0.5rem' }}>
                      <input
                        type="checkbox"
                        className="form-checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelect(s.id)}
                        style={{ cursor: 'pointer', transform: 'scale(1.2)' }}
                      />
                    </td>
                    <td>
                      <div style={{ fontWeight: '700' }}>{translateShopName(s, lang)}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>GSTIN: {s.gst_number || 'N/A'}</div>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.85rem', color: 'var(--accent-cyan)' }}>📞 {s.mobile}</div>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textOverflow: 'ellipsis', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden' }} title={s.address}>
                        {s.address}
                      </div>
                    </td>
                    <td><span style={{ fontSize: '0.85rem', background: 'rgba(255,255,255,0.03)', padding: '4px 8px', borderRadius: '4px' }}>{routeName}</span></td>
                    <td>
                      <div>{s.contact_person || 'N/A'}</div>
                    </td>
                    <td>
                      <span style={{
                        fontSize: '0.75rem',
                        padding: '2px 8px',
                        borderRadius: '9999px',
                        fontWeight: '700',
                        color: s.shop_type === 'wholesale' ? '#a855f7' : 'var(--accent-cyan)',
                        border: `1px solid ${s.shop_type === 'wholesale' ? '#a855f7' : 'var(--accent-cyan)'}`
                      }}>
                        {s.shop_type === 'wholesale' ? t('wholesale') : t('retail')}
                      </span>
                    </td>
                    <td style={{ fontWeight: '700', color: s.outstanding_amount > 0 ? 'var(--warning)' : 'var(--success)' }}>
                      ₹{s.outstanding_amount || 0}
                    </td>
                    <td>
                      <span
                        onClick={() => toggleStatus(s)}
                        style={{
                          cursor: 'pointer',
                          fontSize: '0.75rem',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: s.status === 'active' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                          color: s.status === 'active' ? 'var(--success)' : 'var(--danger)',
                          border: `1px solid ${s.status === 'active' ? 'var(--success)' : 'var(--danger)'}`
                        }}
                      >
                        {s.status === 'active' ? t('active') : t('inactive')}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'nowrap', whiteSpace: 'nowrap' }}>
                        <button className="language-btn" onClick={async () => {
                          try {
                            const oData = await api.getOrders();
                            setOrders(oData);
                          } catch (e) {}
                          setSelectedShopForBills(s);
                        }} style={{ borderColor: 'var(--accent-cyan)', color: 'var(--accent-cyan)', background: 'rgba(6, 182, 212, 0.05)', padding: '0.25rem 0.5rem', fontSize: '0.75rem', whiteSpace: 'nowrap' }} title={lang === 'ta' ? 'விலைப்பட்டியல் வரலாறு' : 'Bill History'}>
                          📄 {lang === 'ta' ? 'பில்கள்' : 'Bills'}
                        </button>
                        <button className="language-btn" onClick={() => handleEdit(s)} style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                          ✏️ Edit
                        </button>
                        <button className="btn btn-danger" onClick={() => handleDeleteTrigger(s.id)} style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredShops.length === 0 && (
                <tr>
                  <td colSpan="10" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                    No shops found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Shop History & Bills Modal */}
      {selectedShopForBills && (
        <div className="modal-overlay">
          <div className="glass-card modal-card" style={{ display: 'flex', flexDirection: 'column', maxHeight: '80vh', width: '90%', maxWidth: '650px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <h3 style={{ fontSize: '1.35rem', fontWeight: '700', margin: 0 }}>
                📋 {lang === 'ta' ? selectedShopForBills.name_ta : selectedShopForBills.name_en} - {lang === 'ta' ? 'கடை வரலாறு' : 'Shop Profile & History'}
              </h3>
              <button 
                onClick={() => setSelectedShopForBills(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.5rem', cursor: 'pointer', lineHeight: 1 }}
              >
                ✕
              </button>
            </div>

            {/* Tab Selector */}
            <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', marginBottom: '1.25rem' }}>
              <button
                type="button"
                style={{
                  background: 'none',
                  border: 'none',
                  borderBottom: shopModalTab === 'bills' ? '2px solid var(--accent-cyan)' : 'none',
                  color: shopModalTab === 'bills' ? 'var(--accent-cyan)' : 'var(--text-muted)',
                  padding: '0.5rem 1rem',
                  cursor: 'pointer',
                  fontWeight: shopModalTab === 'bills' ? '700' : '400',
                  fontSize: '0.9rem'
                }}
                onClick={() => setShopModalTab('bills')}
              >
                📄 {lang === 'ta' ? 'விலைப்பட்டியல்கள்' : 'Invoices & Bills'} ({orders.filter(o => o.shop_id === selectedShopForBills.id).length})
              </button>
              <button
                type="button"
                style={{
                  background: 'none',
                  border: 'none',
                  borderBottom: shopModalTab === 'history' ? '2px solid var(--accent-cyan)' : 'none',
                  color: shopModalTab === 'history' ? 'var(--accent-cyan)' : 'var(--text-muted)',
                  padding: '0.5rem 1rem',
                  cursor: 'pointer',
                  fontWeight: shopModalTab === 'history' ? '700' : '400',
                  fontSize: '0.9rem'
                }}
                onClick={() => setShopModalTab('history')}
              >
                🚚 {lang === 'ta' ? 'விநியோக வரலாறு' : 'Delivery Timeline'}
              </button>
            </div>

            {shopModalTab === 'bills' ? (
              <div style={{ overflowY: 'auto', flex: 1, marginBottom: '1.5rem' }} className="table-container">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>{lang === 'ta' ? 'விலைப்பட்டியல் எண்' : 'Invoice No'}</th>
                      <th>{lang === 'ta' ? 'தேதி' : 'Date'}</th>
                      <th>{lang === 'ta' ? 'மொத்த தொகை' : 'Net Amount'}</th>
                      <th>{lang === 'ta' ? 'நிலை' : 'Status'}</th>
                      <th style={{ textAlign: 'right' }}>{lang === 'ta' ? 'செயல்கள்' : 'Actions'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.filter(o => o.shop_id === selectedShopForBills.id).map(o => {
                      let bg = 'rgba(245, 158, 11, 0.1)';
                      let col = 'var(--warning)';
                      let lbl = lang === 'ta' ? 'நிலுவையில் உள்ளது' : 'Pending';

                      if (o.status === 'delivered') {
                        bg = 'rgba(16, 185, 129, 0.1)';
                        col = 'var(--success)';
                        lbl = lang === 'ta' ? 'விநியோகிக்கப்பட்டது' : 'Delivered';
                      } else if (o.status === 'not_delivered') {
                        bg = 'rgba(239, 68, 68, 0.1)';
                        col = 'var(--danger)';
                        lbl = lang === 'ta' ? 'விநியோகிக்கப்படவில்லை' : 'Not Delivered';
                      } else if (o.status === 'returned') {
                        bg = 'rgba(59, 130, 246, 0.1)';
                        col = 'var(--accent-blue)';
                        lbl = lang === 'ta' ? 'திரும்பப் பெறப்பட்டது' : 'Returned';
                      }

                      return (
                        <tr key={o.id}>
                          <td>
                            <strong>{o.invoice_number}</strong>
                          </td>
                          <td>
                            {new Date(o.order_date).toLocaleDateString(lang === 'ta' ? 'ta-IN' : 'en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </td>
                          <td style={{ fontWeight: 'bold' }}>
                            ₹{o.net_amount}
                          </td>
                          <td>
                            <span style={{
                              fontSize: '0.75rem',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              backgroundColor: bg,
                              color: col,
                              border: `1px solid ${col}`
                            }}>
                              {lbl}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {onBillSelected && (
                              <button 
                                className="language-btn" 
                                style={{ borderColor: 'var(--accent-blue)', color: 'var(--accent-blue)', background: 'rgba(59, 130, 246, 0.05)', padding: '0.2rem 0.5rem', fontSize: '0.8rem' }}
                                onClick={() => {
                                  setSelectedShopForBills(null);
                                  onBillSelected(o.id);
                                }}
                              >
                                👁️ {lang === 'ta' ? 'பார்வை' : 'View'}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {orders.filter(o => o.shop_id === selectedShopForBills.id).length === 0 && (
                      <tr>
                        <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                          {lang === 'ta' ? 'இந்த கடைக்கு பில்கள் எதுவும் இல்லை.' : 'No bills found for this shop.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ overflowY: 'auto', flex: 1, marginBottom: '1.5rem', padding: '0.5rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  {deliveries
                    .filter(d => {
                      const ord = orders.find(o => o.id === d.order_id);
                      return ord && ord.shop_id === selectedShopForBills.id;
                    })
                    .sort((a, b) => new Date(b.delivery_time || 0) - new Date(a.delivery_time || 0))
                    .map(d => {
                      const ord = orders.find(o => o.id === d.order_id);
                      const formattedDate = d.delivery_time 
                        ? new Date(d.delivery_time).toLocaleDateString(lang === 'ta' ? 'ta-IN' : 'en-US', { day: '2-digit', month: 'short', year: 'numeric' })
                        : ord 
                        ? new Date(ord.order_date).toLocaleDateString(lang === 'ta' ? 'ta-IN' : 'en-US', { day: '2-digit', month: 'short', year: 'numeric' })
                        : '--';

                      let statusText = d.status.toUpperCase();
                      let statusCol = 'var(--warning)';
                      if (d.status === 'delivered') {
                        statusCol = 'var(--success)';
                        statusText = lang === 'ta' ? 'விநியோகிக்கப்பட்டது' : 'Delivered';
                      } else if (d.status === 'not_delivered') {
                        statusCol = 'var(--danger)';
                        statusText = lang === 'ta' ? `விநியோகிக்கப்படவில்லை (காரணம்: ${d.reason || 'மற்றவை'})` : `Not Delivered (Reason: ${d.reason || 'Other'})`;
                      } else if (d.status === 'returned') {
                        statusCol = 'var(--accent-blue)';
                        statusText = lang === 'ta' ? `திரும்பப் பெறப்பட்டது (காரணம்: ${d.reason || 'மற்றவை'})` : `Returned (Reason: ${d.reason || 'Other'})`;
                      } else {
                        statusText = lang === 'ta' ? 'நிலுவையில் உள்ளது' : 'Pending';
                      }

                      return (
                        <div key={d.id} style={{
                          padding: '0.75rem',
                          background: 'rgba(255,255,255,0.02)',
                          borderLeft: `4px solid ${statusCol}`,
                          borderRadius: '4px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.25rem'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                            <span style={{ fontWeight: '700' }}>{formattedDate}</span>
                            <span style={{ color: 'var(--text-muted)' }}>Invoice: {ord?.invoice_number}</span>
                          </div>
                          <div style={{ fontSize: '0.9rem', fontWeight: '500', color: statusCol }}>
                            {statusText}
                          </div>
                          {d.remarks && (
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '0.2rem' }}>
                              Remarks: "{d.remarks}"
                            </div>
                          )}
                        </div>
                      );
                    })}
                  {deliveries.filter(d => {
                    const ord = orders.find(o => o.id === d.order_id);
                    return ord && ord.shop_id === selectedShopForBills.id;
                  }).length === 0 && (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                      {lang === 'ta' ? 'விநியோக வரலாறு எதுவும் இல்லை.' : 'No delivery logs available for this shop.'}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
              <button className="btn btn-secondary" onClick={() => setSelectedShopForBills(null)}>
                {lang === 'ta' ? 'மூடுக' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
      <ConfirmModal
        isOpen={confirmOpen}
        title={t('confirm_title')}
        message={t('confirm_delete_msg')}
        confirmText={t('confirm_ok')}
        cancelText={t('confirm_cancel')}
        onConfirm={executeDelete}
        onCancel={() => setConfirmOpen(false)}
      />

      <ConfirmModal
        isOpen={bulkConfirmOpen}
        title={lang === 'ta' ? 'மொத்தமாக நீக்குவதை உறுதிப்படுத்து' : 'Confirm Bulk Deletion'}
        message={
          selectedShopIds.length === shops.length
            ? (t('confirm_delete_all_shops_msg') || 'Are you sure you want to move ALL {count} shops to the Recycle Bin? (Shops with existing orders will be automatically skipped)').replace('{count}', selectedShopIds.length)
            : (filterRoute && selectedShopIds.length === filteredShops.length
                ? (t('confirm_delete_route_shops_msg') || 'Are you sure you want to move all {count} shop(s) in this route to the Recycle Bin? (Shops with existing orders will be automatically skipped)').replace('{count}', selectedShopIds.length)
                : (t('confirm_bulk_delete_shops_msg') || 'Are you sure you want to move {count} selected shop(s) to the Recycle Bin? (Shops with existing orders will be automatically skipped)').replace('{count}', selectedShopIds.length))
        }
        confirmText={lang === 'ta' ? 'ஆம், நீக்கு' : 'Yes, Delete'}
        cancelText={t('confirm_cancel')}
        onConfirm={executeBulkDelete}
        onCancel={() => setBulkConfirmOpen(false)}
      />
    </div>
  );
}
