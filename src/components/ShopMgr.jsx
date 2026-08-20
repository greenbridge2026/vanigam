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

  // Outstanding Adjustment Modal State
  const [adjustingShop, setAdjustingShop] = useState(null);
  const [newOutstanding, setNewOutstanding] = useState('');
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [adjusting, setAdjusting] = useState(false);

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

  useEffect(() => {
    async function loadData() {
      try {
        const [sData, rData, oData, dData] = await Promise.all([
          api.getShops(),
          api.getRoutes(),
          api.getOrders(),
          api.getDeliveries()
        ]);
        setShops(sData);
        setRoutes(rData);
        setOrders(oData);
        setDeliveries(dData || []);
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
    if (activeField !== 'en') return;
    if (!nameEn.trim()) {
      setNameTa('');
      return;
    }
    const delayDebounceFn = setTimeout(async () => {
      try {
        const translated = await api.translate(nameEn, 'en', 'ta');
        if (translated) setNameTa(translated);
      } catch (err) {
        console.error('Auto-translation to Tamil failed:', err);
      }
    }, 1000);

    return () => clearTimeout(delayDebounceFn);
  }, [nameEn, activeField]);

  // Auto-translate Tamil to English
  useEffect(() => {
    if (activeField !== 'ta') return;
    if (!nameTa.trim()) {
      setNameEn('');
      return;
    }
    const delayDebounceFn = setTimeout(async () => {
      try {
        const translated = await api.translate(nameTa, 'ta', 'en');
        if (translated) setNameEn(translated);
      } catch (err) {
        console.error('Auto-translation to English failed:', err);
      }
    }, 1000);

    return () => clearTimeout(delayDebounceFn);
  }, [nameTa, activeField]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!nameEn.trim() && !nameTa.trim()) {
      alert(lang === 'ta' ? 'கடையின் பெயர் தேவை' : 'Shop name is required');
      return;
    }

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
        const updated = await api.updateShop(editingShop.id, payload);
        setShops(shops.map(s => s.id === editingShop.id ? updated : s));
      } else {
        const added = await api.createShop(payload);
        setShops([...shops, added]);
      }
      resetForm();
    } catch (err) {
      alert(err.message || 'Error saving shop details');
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

  const handleOpenAdjustModal = (shop) => {
    setAdjustingShop(shop);
    setNewOutstanding(shop.outstanding_amount || 0);
    setAdjustmentReason('');
  };

  const handleSaveOutstandingAdjustment = async (e) => {
    e.preventDefault();
    if (!adjustingShop) return;
    const val = Number(newOutstanding);
    if (isNaN(val) || val < 0) {
      alert(lang === 'ta' ? 'செல்லுபடியாகும் தொகையை உள்ளிடவும்' : 'Please enter a valid non-negative amount');
      return;
    }
    setAdjusting(true);
    try {
      const updated = await api.updateShop(adjustingShop.id, {
        outstanding_amount: val,
        adjustment_reason: adjustmentReason.trim() || (lang === 'ta' ? 'நிர்வாகியால் நேரடியாக மாற்றப்பட்டது' : 'Manual adjustment by Admin')
      });
      setShops(shops.map(s => s.id === adjustingShop.id ? updated : s));
      alert(lang === 'ta' ? 'நிலுவைத் தொகை வெற்றிகரமாக புதுப்பிக்கப்பட்டது!' : 'Outstanding amount updated successfully!');
      setAdjustingShop(null);
    } catch (err) {
      alert(err.message || 'Failed to update outstanding amount');
    } finally {
      setAdjusting(false);
    }
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
      const routeName = routeObj ? (lang === 'ta' ? routeObj.name_ta : routeObj.name_en) : 'None';
      return {
        'S.No': index + 1,
        'Shop Name (English)': s.name_en || '',
        'Shop Name (Tamil)': s.name_ta || '',
        'Mobile No': s.mobile || '',
        'Address / Location': s.address || '',
        'Contact Person': s.contact_person || '',
        'Assigned Route': routeName,
        'Shop Type': s.shop_type || 'retail',
        'Outstanding Amount': s.outstanding_amount || 0,
        'Status': s.status || 'active',
        'GSTIN': s.gst_number || ''
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Shops List');
    XLSX.writeFile(wb, 'shops_list.xlsx');
  };

  const handleDownloadTemplate = () => {
    const templateData = [
      {
        'S.No': 1,
        'Shop Name': 'Sample Shop Name',
        'Mobile No': '9876543210',
        'Address / Location': '123, Sample Street, City'
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
            if (foundKey) return row[foundKey];
          }
          return undefined;
        };

        const mapped = data.map((row) => {
          return {
            name_en: getVal(row, ['ShopName', 'Name', 'ShopNameEnglish', 'NameEn']) || '',
            name_ta: getVal(row, ['ShopNameTamil', 'NameTa', 'ShopName']) || '',
            mobile: String(getVal(row, ['MobileNo', 'Mobile', 'MobileNumber', 'Phone']) || '').trim(),
            address: getVal(row, ['AddressLocation', 'Address', 'Location']) || '',
            contact_person: getVal(row, ['ContactPerson', 'Owner']) || 'Owner',
            shop_type: 'retail',
            status: 'active',
            outstanding_amount: 0
          };
        });

        const invalidRows = mapped.filter(s => !s.name_en && !s.name_ta);
        if (invalidRows.length > 0) {
          alert(
            lang === 'ta'
              ? 'சில வரிசைகளில் கடையின் பெயர் விடுபட்டுள்ளது!'
              : `Validation Error: ${invalidRows.length} row(s) are missing the Shop Name.`
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
  };

  const handleConfirmImport = async () => {
    if (!importRouteId) {
      alert(lang === 'ta' ? 'வழித்தடத்தைத் தேர்ந்தெடுக்கவும்!' : 'Please select an assigned route for the imported shops.');
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
  const filteredShops = shops.filter(s => {
    const matchesRoute = filterRoute ? s.route_id === filterRoute : true;
    
    const nameStr = `${s.name_en} ${s.name_ta} ${s.contact_person} ${s.mobile} ${s.gst_number}`.toLowerCase();
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
              <button type="submit" className="btn btn-primary">
                💾 {t('save')}
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
                <button type="submit" className="btn btn-primary">
                  💾 {t('save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Filter and List Section */}
      <div className="glass-card">
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: '1.25rem' }}>Registered Shops ({filteredShops.length})</h2>
          
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <button type="button" className="btn btn-secondary" onClick={handleDownloadTemplate} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}>
              📥 {lang === 'ta' ? 'வார்ப்புருவைப் பதிவிறக்கு' : 'Download Template'}
            </button>

            <button type="button" className="btn btn-secondary" onClick={handleExportToExcel} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}>
              📤 {lang === 'ta' ? 'கடைகளைப் பதிவிறக்கு (Excel)' : 'Download Shops (Excel)'}
            </button>
            
            <div style={{ position: 'relative', overflow: 'hidden', display: 'inline-block' }}>
              <button type="button" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}>
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
              style={{ width: '220px', padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
            />
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

            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
              <label style={{ fontWeight: '600', fontSize: '0.9rem' }}>
                {lang === 'ta' ? 'இறக்குமதி செய்யப்பட வேண்டிய வழித்தடம்:' : 'Assign Route for Imported Shops:'} <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <select 
                className="form-select" 
                value={importRouteId} 
                onChange={e => setImportRouteId(e.target.value)} 
                required
                style={{ width: '250px' }}
              >
                <option value="">-- Select Route --</option>
                {routes.map(r => (
                  <option key={r.id} value={r.id}>{lang === 'ta' ? r.name_ta : r.name_en}</option>
                ))}
              </select>
            </div>
            
            <div style={{ maxHeight: '200px', overflowY: 'auto', fontSize: '0.85rem' }} className="table-container">
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }} className="custom-table">
                <thead>
                  <tr>
                    <th>Shop Name (English)</th>
                    <th>Shop Name (Tamil)</th>
                    <th>Mobile No</th>
                    <th>Address / Location</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedShops.map((s, idx) => (
                    <tr key={idx}>
                      <td>{s.name_en}</td>
                      <td>{s.name_ta}</td>
                      <td>{s.mobile}</td>
                      <td>{s.address}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={() => { setParsedShops([]); setImportRouteId(''); }}>
                {t('cancel')}
              </button>
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={handleConfirmImport} 
                disabled={importing || !importRouteId}
                style={{ background: 'var(--success)', opacity: (!importRouteId || importing) ? 0.6 : 1 }}
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
                const routeObj = routes.find(r => r.id === s.route_id);
                const routeName = routeObj ? (lang === 'ta' ? routeObj.name_ta : routeObj.name_en) : 'None';
                return (
                  <tr key={s.id}>
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span>₹{s.outstanding_amount || 0}</span>
                        <button
                          type="button"
                          onClick={() => handleOpenAdjustModal(s)}
                          style={{
                            background: 'rgba(255, 255, 255, 0.08)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '4px',
                            color: 'var(--accent-cyan)',
                            padding: '2px 6px',
                            fontSize: '0.75rem',
                            cursor: 'pointer'
                          }}
                          title={lang === 'ta' ? 'நிலுவையை மாற்று' : 'Edit Outstanding'}
                        >
                          ✏️
                        </button>
                      </div>
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
                        <button className="language-btn" onClick={() => handleOpenAdjustModal(s)} style={{ borderColor: 'var(--warning)', color: 'var(--warning)', background: 'rgba(245, 158, 11, 0.08)', padding: '0.25rem 0.5rem', fontSize: '0.75rem', whiteSpace: 'nowrap' }} title={lang === 'ta' ? 'நிலுவை மாற்றியமைத்தல்' : 'Adjust Outstanding'}>
                          💰 {lang === 'ta' ? 'நிலுவை மாற்று' : 'Adjust Bal'}
                        </button>
                        <button className="language-btn" onClick={() => setSelectedShopForBills(s)} style={{ borderColor: 'var(--accent-cyan)', color: 'var(--accent-cyan)', background: 'rgba(6, 182, 212, 0.05)', padding: '0.25rem 0.5rem', fontSize: '0.75rem', whiteSpace: 'nowrap' }} title={lang === 'ta' ? 'விலைப்பட்டியல் வரலாறு' : 'Bill History'}>
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
                  <td colSpan="9" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
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

      {/* Quick Outstanding Adjustment Modal */}
      {adjustingShop && (
        <div className="modal-overlay">
          <div className="glass-card modal-card" style={{ maxWidth: '480px', width: '90%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: '700', margin: 0, color: 'var(--accent-cyan)' }}>
                💰 {lang === 'ta' ? 'நிலுவைத் தொகையை மாற்று' : 'Adjust Outstanding Amount'}
              </h3>
              <button
                type="button"
                onClick={() => setAdjustingShop(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.5rem', cursor: 'pointer', lineHeight: 1 }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveOutstandingAdjustment}>
              <div style={{ marginBottom: '1rem', background: 'rgba(255,255,255,0.03)', padding: '0.75rem', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)' }}>
                <div style={{ fontWeight: '700', fontSize: '1rem' }}>{translateShopName(adjustingShop, lang)}</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  {lang === 'ta' ? 'தற்போதைய நிலுவை:' : 'Current Outstanding:'} <strong style={{ color: 'var(--warning)' }}>₹{adjustingShop.outstanding_amount || 0}</strong>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label style={{ fontWeight: '600' }}>{lang === 'ta' ? 'புதிய நிலுவைத் தொகை (₹)' : 'New Outstanding Amount (₹)'}</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  className="form-input"
                  value={newOutstanding}
                  onChange={e => setNewOutstanding(e.target.value)}
                  required
                  style={{ fontSize: '1.2rem', fontWeight: '700' }}
                  placeholder="0"
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label style={{ fontWeight: '600' }}>{lang === 'ta' ? 'காரணம் / குறிப்பு' : 'Reason / Note (Optional)'}</label>
                <input
                  type="text"
                  className="form-input"
                  value={adjustmentReason}
                  onChange={e => setAdjustmentReason(e.target.value)}
                  placeholder={lang === 'ta' ? 'எ.கா. முந்தைய நிலுவை திருத்தம்' : 'e.g. Opening balance adjustment / correction'}
                />
              </div>

              <div className="btn-group" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setAdjustingShop(null)}>
                  {t('cancel')}
                </button>
                <button type="submit" className="btn btn-primary" disabled={adjusting}>
                  💾 {adjusting ? (lang === 'ta' ? 'சேமிக்கப்படுகிறது...' : 'Saving...') : t('save')}
                </button>
              </div>
            </form>
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
    </div>
  );
}
