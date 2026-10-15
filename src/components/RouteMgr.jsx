import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import api from '../api';
import ConfirmModal from './ConfirmModal';

export default function RouteMgr({ t, lang }) {
  const [routes, setRoutes] = useState([]);
  const [users, setUsers] = useState([]);
  const [shops, setShops] = useState([]);
  const [editingRoute, setEditingRoute] = useState(null);
  const [selectedRouteForShops, setSelectedRouteForShops] = useState(null);
  
  // Excel bulk import states
  const [parsedRoutes, setParsedRoutes] = useState([]);
  const [importing, setImporting] = useState(false);
  const [translatingAll, setTranslatingAll] = useState(false);

  // Form fields
  const [nameEn, setNameEn] = useState('');
  const [nameTa, setNameTa] = useState('');
  const [activeField, setActiveField] = useState(null);
  const [salesmanId, setSalesmanId] = useState('');
  const [deliveryManId, setDeliveryManId] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [rData, uData, sData] = await Promise.all([
          api.getRoutes(),
          api.getUsers(),
          api.getShops()
        ]);
        setRoutes(rData);
        setUsers(uData);
        setShops(sData);
      } catch (err) {
        console.error('Failed to load routes/users/shops', err);
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

  const salesmanList = users.filter(u => u.role === 'salesman' && u.active);
  const deliveryList = users.filter(u => u.role === 'delivery' && u.active);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!nameEn.trim() && !nameTa.trim()) {
      alert(lang === 'ta' ? 'பெயர் தேவை' : 'Name is required');
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
      salesman_id: salesmanId,
      delivery_man_id: deliveryManId
    };

    try {
      if (editingRoute) {
        await api.updateRoute(editingRoute.id, payload);
      } else {
        await api.createRoute(payload);
      }
      const freshRoutes = await api.getRoutes();
      setRoutes(freshRoutes);
      resetForm();
    } catch (err) {
      alert(err.message || 'Error saving route data');
    }
  };

  const handleEdit = (route) => {
    setEditingRoute(route);
    setNameEn(route.name_en);
    setNameTa(route.name_ta);
    setSalesmanId(route.salesman_id || '');
    setDeliveryManId(route.delivery_man_id || '');
  };

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [selectedRouteIds, setSelectedRouteIds] = useState([]);
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleToggleSelect = (id) => {
    setSelectedRouteIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    if (filteredRoutes.length > 0 && selectedRouteIds.length === filteredRoutes.length) {
      setSelectedRouteIds([]);
    } else {
      setSelectedRouteIds(filteredRoutes.map(r => r.id));
    }
  };

  const handleSelectAllRoutes = () => {
    setSelectedRouteIds(routes.map(r => r.id));
  };

  const handleClearSelection = () => {
    setSelectedRouteIds([]);
  };

  const handleBulkDeleteTrigger = () => {
    if (selectedRouteIds.length === 0) return;
    setBulkConfirmOpen(true);
  };

  const executeBulkDelete = async () => {
    setBulkConfirmOpen(false);
    if (selectedRouteIds.length === 0) return;
    try {
      const res = await api.bulkDeleteRoutes(selectedRouteIds);
      if (res.success) {
        const deletedSet = new Set(res.deletedIds);
        setRoutes(prev => prev.filter(r => !deletedSet.has(r.id)));
        setSelectedRouteIds([]);
        const template = t('bulk_deleted_routes_summary') || 'Successfully moved {count} route(s) to the Recycle Bin.';
        alert(template.replace('{count}', res.deletedCount));
      }
    } catch (err) {
      alert((lang === 'ta' ? 'வழித்தடங்களை நீக்க முடியவில்லை: ' : 'Failed to bulk delete routes: ') + (err.message || err));
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
      await api.deleteRoute(deleteTargetId);
      const freshRoutes = await api.getRoutes();
      setRoutes(freshRoutes);
      setSelectedRouteIds(prev => prev.filter(id => id !== deleteTargetId));
      alert('Route moved to Recycle Bin. / வழித்தடம் குப்பைத் தொட்டிக்கு நகர்த்தப்பட்டது.');
    } catch (err) {
      alert('Failed to delete route: ' + (err.message || err));
    } finally {
      setDeleteTargetId(null);
    }
  };

  const filteredRoutes = routes.filter(r => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const nameEn = (r.name_en || '').toLowerCase();
    const nameTa = (r.name_ta || '').toLowerCase();
    const sm = (users.find(u => u.id === r.salesman_id)?.name || '').toLowerCase();
    const dm = (users.find(u => u.id === r.delivery_man_id)?.name || '').toLowerCase();
    return nameEn.includes(q) || nameTa.includes(q) || sm.includes(q) || dm.includes(q);
  });

  const handleDownloadTemplate = () => {
    const templateData = [
      {
        'S.No': 1,
        'Route Name (English)': 'Trichy Road Route',
        'Route Name (Tamil)': 'திருச்சி சாலை வழித்தடம்',
        'Salesman': salesmanList[0]?.name || 'Salesman Name',
        'Delivery Person': deliveryList[0]?.name || 'Delivery Person Name'
      },
      {
        'S.No': 2,
        'Route Name (English)': 'Chennai Highway Route',
        'Route Name (Tamil)': 'சென்னை நெடுஞ்சாலை வழித்தடம்',
        'Salesman': '',
        'Delivery Person': ''
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Routes Template');
    XLSX.writeFile(wb, 'routes_import_template.xlsx');
  };

  const handleExportToExcel = () => {
    if (routes.length === 0) {
      alert(lang === 'ta' ? 'பதிவிறக்க வழித்தடங்கள் எதுவும் இல்லை!' : 'No routes available to export!');
      return;
    }

    const exportData = routes.map((r, idx) => ({
      'S.No': idx + 1,
      'Route Name (English)': r.name_en || '',
      'Route Name (Tamil)': r.name_ta || '',
      'Salesman': users.find(u => u.id === r.salesman_id)?.name || 'Unassigned',
      'Delivery Person': users.find(u => u.id === r.delivery_man_id)?.name || 'Unassigned',
      'Assigned Shops': shops.filter(s => s.route_id === r.id).length
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Routes List');
    XLSX.writeFile(wb, `routes_list_${Date.now()}.xlsx`);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
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
          const name_en = String(getVal(row, ['RouteNameEnglish', 'RouteNameEn', 'RouteName', 'Route', 'NameEn', 'Name', 'EnglishName']) || '').trim();
          const name_ta = String(getVal(row, ['RouteNameTamil', 'RouteNameTa', 'TamilName', 'NameTa', 'Tamil']) || '').trim();
          const salesmanRaw = String(getVal(row, ['Salesman', 'SalesmanName', 'SalesPerson', 'SalesmanId']) || '').trim();
          const deliveryRaw = String(getVal(row, ['DeliveryPerson', 'DeliveryMan', 'Delivery', 'DeliveryName', 'DeliveryManId']) || '').trim();

          let matchedSalesmanId = '';
          if (salesmanRaw) {
            const smLower = salesmanRaw.toLowerCase();
            const foundSm = users.find(u => 
              u.role === 'salesman' && 
              (u.id === salesmanRaw || (u.name && u.name.toLowerCase() === smLower) || (u.username && u.username.toLowerCase() === smLower))
            );
            if (foundSm) matchedSalesmanId = foundSm.id;
          }

          let matchedDeliveryId = '';
          if (deliveryRaw) {
            const dmLower = deliveryRaw.toLowerCase();
            const foundDm = users.find(u => 
              u.role === 'delivery' && 
              (u.id === deliveryRaw || (u.name && u.name.toLowerCase() === dmLower) || (u.username && u.username.toLowerCase() === dmLower))
            );
            if (foundDm) matchedDeliveryId = foundDm.id;
          }

          return {
            name_en,
            name_ta: name_ta || name_en,
            salesman_id: matchedSalesmanId,
            delivery_man_id: matchedDeliveryId,
            salesman_raw: salesmanRaw,
            delivery_raw: deliveryRaw
          };
        }).filter(r => r.name_en || r.name_ta);

        if (mapped.length === 0) {
          alert(lang === 'ta' ? 'செல்லுபடியாகும் வழித்தடங்கள் எதுவும் இல்லை!' : 'No valid routes found in file. Please check column headers.');
          return;
        }

        setParsedRoutes(mapped);
      } catch (err) {
        console.error('File parsing error:', err);
        alert(lang === 'ta' ? 'கோப்பைப் படிப்பதில் பிழை ஏற்பட்டது!' : 'Error reading file! Please check the structure.');
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const handleAutoTranslateAll = async () => {
    if (parsedRoutes.length === 0) return;
    setTranslatingAll(true);
    try {
      const updated = await Promise.all(
        parsedRoutes.map(async (r) => {
          if (r.name_en && (!r.name_ta || r.name_ta === r.name_en)) {
            try {
              const trans = await api.translate(r.name_en, 'en', 'ta');
              return { ...r, name_ta: trans || r.name_ta };
            } catch (e) {
              return r;
            }
          }
          return r;
        })
      );
      setParsedRoutes(updated);
    } catch (err) {
      console.error('Auto translate failed:', err);
    } finally {
      setTranslatingAll(false);
    }
  };

  const handleConfirmImport = async () => {
    if (parsedRoutes.length === 0) return;
    setImporting(true);
    try {
      const results = await api.importRoutes(parsedRoutes);
      const freshRoutes = await api.getRoutes();
      setRoutes(freshRoutes);
      alert(
        lang === 'ta'
          ? `வெற்றிகரமாக ${results.length} வழித்தடங்கள் இறக்குமதி செய்யப்பட்டன!`
          : `Successfully imported ${results.length} routes!`
      );
      setParsedRoutes([]);
    } catch (err) {
      alert(err.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const resetForm = () => {
    setEditingRoute(null);
    setNameEn('');
    setNameTa('');
    setSalesmanId('');
    setDeliveryManId('');
    setActiveField(null);
  };

  if (loading) return <div style={{ color: 'var(--text-muted)', textAlign: 'center' }}>Loading Route Manager...</div>;

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>🗺️ {t('route_mgmt')}</h1>
        <p style={{ color: 'var(--text-muted)' }}>Manage wholesale routes and assign field sales/delivery staff</p>
      </div>

      {/* Excel Bulk Import Card */}
      <div className="glass-card" style={{ marginBottom: '2rem' }}>
        <h2 style={{ marginBottom: '0.5rem', fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>📊</span> {lang === 'ta' ? 'எக்செல் மூலம் மொத்தமாக வழித்தடங்களை இறக்குமதி செய்க' : 'Bulk Import Routes via Excel'}
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
          {lang === 'ta'
            ? 'வழித்தட பெயர் (ஆங்கிலம், தமிழ்), விற்பனையாளர் மற்றும் டெலிவரி பணியாளர் உள்ளிட்ட வழித்தடங்களை எக்செல் மூலம் சேர்க்கவும் அல்லது தற்போதைய வழித்தடங்களைப் பதிவிறக்கவும்.'
            : 'Import routes including route names (English, Tamil), assigned salesman, and delivery staff, or download the existing routes list.'}
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', marginBottom: '1.5rem' }}>
          <button type="button" className="btn btn-secondary" onClick={handleDownloadTemplate} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            📥 {lang === 'ta' ? 'மாதிரி எக்செல் கோப்பை பதிவிறக்கு' : 'Download Excel Template'}
          </button>

          <button type="button" className="btn btn-secondary" onClick={handleExportToExcel} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            📤 {lang === 'ta' ? 'தற்போதைய வழித்தடங்களைப் பதிவிறக்கு' : 'Download Routes (Excel)'}
          </button>

          {parsedRoutes.length > 0 && (
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={handleAutoTranslateAll} 
              disabled={translatingAll}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'var(--accent-cyan)', color: '#000', fontWeight: 'bold' }}
            >
              🌐 {translatingAll ? (lang === 'ta' ? 'மொழிபெயர்க்கப்படுகிறது...' : 'Translating...') : (lang === 'ta' ? 'தமிழ் பெயர்களை தானாக புதுப்பி' : 'Auto-Translate Tamil Names')}
            </button>
          )}

          <div style={{ position: 'relative', overflow: 'hidden', display: 'inline-block' }}>
            <button type="button" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
              📁 {lang === 'ta' ? 'கோப்பைத் தேர்ந்தெடு (Excel / CSV)' : 'Select Excel / CSV File'}
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
        </div>

        {parsedRoutes.length > 0 && (
          <div style={{ 
            background: 'rgba(255,255,255,0.05)', 
            borderRadius: 'var(--radius)', 
            padding: '1rem', 
            border: '1px solid rgba(255,255,255,0.1)',
            marginBottom: '1.5rem'
          }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem', color: 'var(--accent-cyan)' }}>
              📋 {lang === 'ta' ? `இறக்குமதி செய்ய தயாராக உள்ள வழித்தடங்கள் (${parsedRoutes.length})` : `Loaded Routes Ready for Import (${parsedRoutes.length})`}
            </h3>

            <div style={{ maxHeight: '240px', overflowY: 'auto', fontSize: '0.85rem' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.2)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '0.5rem' }}>#</th>
                    <th style={{ padding: '0.5rem' }}>Route Name (English)</th>
                    <th style={{ padding: '0.5rem' }}>Route Name (Tamil)</th>
                    <th style={{ padding: '0.5rem' }}>Salesman</th>
                    <th style={{ padding: '0.5rem' }}>Delivery Person</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedRoutes.map((r, idx) => {
                    const smUser = users.find(u => u.id === r.salesman_id);
                    const dmUser = users.find(u => u.id === r.delivery_man_id);
                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '0.5rem', color: 'var(--text-muted)' }}>{idx + 1}</td>
                        <td style={{ padding: '0.5rem', fontWeight: 'bold' }}>{r.name_en || '-'}</td>
                        <td style={{ padding: '0.5rem' }}>{r.name_ta || '-'}</td>
                        <td style={{ padding: '0.5rem', color: smUser ? 'var(--accent-cyan)' : 'var(--text-muted)' }}>
                          {smUser ? `👤 ${smUser.name}` : (r.salesman_raw ? `❓ ${r.salesman_raw}` : '—')}
                        </td>
                        <td style={{ padding: '0.5rem', color: dmUser ? 'var(--success)' : 'var(--text-muted)' }}>
                          {dmUser ? `🚚 ${dmUser.name}` : (r.delivery_raw ? `❓ ${r.delivery_raw}` : '—')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setParsedRoutes([])}>
                {t('cancel')}
              </button>
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={handleConfirmImport} 
                disabled={importing}
                style={{ background: 'var(--success)' }}
              >
                {importing ? (lang === 'ta' ? 'இறக்குமதி செய்யப்படுகிறது...' : 'Importing...') : (lang === 'ta' ? 'இறக்குமதி செய்' : 'Confirm Import')}
              </button>
            </div>
          </div>
        )}

        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          <strong>{lang === 'ta' ? 'தேவைப்படும் பத்திகள்:' : 'Supported Column Headers:'}</strong>
          <span style={{ 
            display: 'inline-block', 
            background: 'rgba(255,255,255,0.05)', 
            padding: '0.1rem 0.4rem', 
            borderRadius: '3px', 
            marginLeft: '0.5rem',
            fontFamily: 'monospace',
            color: 'var(--accent-cyan)'
          }}>
            Route Name (English), Route Name (Tamil), Salesman, Delivery Person
          </span>
        </div>
      </div>

      {/* Add Route Form Card (Normal view) */}
      {!editingRoute && (
        <div className="glass-card">
          <h2 style={{ marginBottom: '1.25rem', fontSize: '1.25rem' }}>{t('add_route')}</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-group">
                <label>{t('route_name_en')}</label>
                <input
                  type="text"
                  className="form-input"
                  value={nameEn}
                  onChange={e => setNameEn(e.target.value)}
                  onFocus={() => setActiveField('en')}
                  placeholder="e.g. Trichy Road Route"
                />
              </div>
              <div className="form-group">
                <label>{t('route_name_ta')}</label>
                <input
                  type="text"
                  className="form-input"
                  value={nameTa}
                  onChange={e => setNameTa(e.target.value)}
                  onFocus={() => setActiveField('ta')}
                  placeholder="எ.கா. திருச்சி சாலை வழித்தடம்"
                />
              </div>
              <div className="form-group">
                <label>{t('assign_salesman')}</label>
                <select
                  className="form-select"
                  value={salesmanId}
                  onChange={e => setSalesmanId(e.target.value)}
                >
                  <option value="">-- {t('assign_salesman')} --</option>
                  {salesmanList.map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>{t('assign_delivery')}</label>
                <select
                  className="form-select"
                  value={deliveryManId}
                  onChange={e => setDeliveryManId(e.target.value)}
                >
                  <option value="">-- {t('assign_delivery')} --</option>
                  {deliveryList.map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
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

      {/* Edit Route Popup Modal */}
      {editingRoute && (
        <div className="modal-overlay">
          <div className="glass-card modal-card" style={{ maxWidth: '650px', width: '95%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <h2 style={{ fontSize: '1.35rem', fontWeight: '700', margin: 0 }}>
                ✏️ {t('edit_route')}: {editingRoute.name_en || editingRoute.name_ta}
              </h2>
              <button 
                type="button" 
                onClick={resetForm}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.5rem', cursor: 'pointer', lineHeight: 1 }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="form-group">
                  <label>{t('route_name_en')}</label>
                  <input
                    type="text"
                    className="form-input"
                    value={nameEn}
                    onChange={e => setNameEn(e.target.value)}
                    onFocus={() => setActiveField('en')}
                    placeholder="e.g. Trichy Road Route"
                  />
                </div>
                <div className="form-group">
                  <label>{t('route_name_ta')}</label>
                  <input
                    type="text"
                    className="form-input"
                    value={nameTa}
                    onChange={e => setNameTa(e.target.value)}
                    onFocus={() => setActiveField('ta')}
                    placeholder="எ.கா. திருச்சி சாலை வழித்தடம்"
                  />
                </div>
                <div className="form-group">
                  <label>{t('assign_salesman')}</label>
                  <select
                    className="form-select"
                    value={salesmanId}
                    onChange={e => setSalesmanId(e.target.value)}
                  >
                    <option value="">-- {t('assign_salesman')} --</option>
                    {salesmanList.map(u => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>{t('assign_delivery')}</label>
                  <select
                    className="form-select"
                    value={deliveryManId}
                    onChange={e => setDeliveryManId(e.target.value)}
                  >
                    <option value="">-- {t('assign_delivery')} --</option>
                    {deliveryList.map(u => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="btn-group" style={{ marginTop: '1.5rem', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
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

      {/* Routes List */}
      <div className="glass-card">
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1.25rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: '1.25rem', margin: 0 }}>
              {lang === 'ta' ? 'செயலில் உள்ள வழித்தடங்கள்' : 'Active Route Assignments'}
            </h2>
            <span style={{
              fontSize: '0.8rem',
              fontWeight: 600,
              background: 'rgba(59, 130, 246, 0.1)',
              color: 'var(--accent-blue)',
              padding: '0.2rem 0.6rem',
              borderRadius: '12px'
            }}>
              {routes.length} {lang === 'ta' ? 'வழித்தடங்கள்' : 'routes'}
            </span>
            {selectedRouteIds.length > 0 && (
              <span style={{
                fontSize: '0.8rem',
                fontWeight: 600,
                background: 'rgba(239, 68, 68, 0.12)',
                color: 'var(--danger)',
                padding: '0.2rem 0.6rem',
                borderRadius: '12px'
              }}>
                ✓ {selectedRouteIds.length} {lang === 'ta' ? 'தேர்ந்தெடுக்கப்பட்டது' : 'selected'}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            <input
              type="text"
              className="form-input"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={lang === 'ta' ? '🔍 வழித்தடங்களைத் தேடு...' : '🔍 Search routes...'}
              style={{ width: '220px', padding: '0.45rem 0.75rem', fontSize: '0.9rem', margin: 0 }}
            />

            {routes.length > 0 && (
              <>
                {selectedRouteIds.length === routes.length ? (
                  <button
                    type="button"
                    className="language-btn"
                    onClick={handleClearSelection}
                    style={{ fontSize: '0.85rem', padding: '0.45rem 0.75rem' }}
                  >
                    ✕ {lang === 'ta' ? 'தேர்வை நீக்கு' : 'Deselect All'}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="language-btn"
                    onClick={handleSelectAllRoutes}
                    style={{ fontSize: '0.85rem', padding: '0.45rem 0.75rem' }}
                  >
                    ☑ {lang === 'ta' ? 'அனைத்தையும் தேர்ந்தெடு' : 'Select All'} ({routes.length})
                  </button>
                )}
              </>
            )}

            {selectedRouteIds.length > 0 && (
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleBulkDeleteTrigger}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.45rem 0.85rem',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  boxShadow: '0 2px 8px rgba(239, 68, 68, 0.25)'
                }}
              >
                🗑️ {selectedRouteIds.length === routes.length
                  ? (lang === 'ta' ? 'அனைத்தையும் நீக்கு' : 'Delete All')
                  : (lang === 'ta' ? 'தேர்ந்தெடுத்தவற்றை நீக்கு' : 'Delete Selected')} ({selectedRouteIds.length})
              </button>
            )}
          </div>
        </div>

        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th style={{ width: '42px', textAlign: 'center', padding: '0.75rem 0.5rem' }}>
                  <input
                    type="checkbox"
                    className="form-checkbox"
                    checked={filteredRoutes.length > 0 && selectedRouteIds.length === filteredRoutes.length}
                    onChange={handleToggleSelectAll}
                    style={{ cursor: 'pointer', transform: 'scale(1.2)' }}
                    title={lang === 'ta' ? 'அனைத்தையும் தேர்ந்தெடு / நீக்கு' : 'Select / Deselect all'}
                  />
                </th>
                <th>{t('route_name_en')}</th>
                <th>{t('route_name_ta')}</th>
                <th>{t('assign_salesman')}</th>
                <th>{t('assign_delivery')}</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRoutes.map(r => {
                const isSelected = selectedRouteIds.includes(r.id);
                const salesmanName = users.find(u => u.id === r.salesman_id)?.name || 'Unassigned';
                const deliveryName = users.find(u => u.id === r.delivery_man_id)?.name || 'Unassigned';
                return (
                  <tr
                    key={r.id}
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
                        onChange={() => handleToggleSelect(r.id)}
                        style={{ cursor: 'pointer', transform: 'scale(1.2)' }}
                      />
                    </td>
                    <td><strong>{r.name_en}</strong></td>
                    <td><strong>{r.name_ta}</strong></td>
                    <td style={{ color: r.salesman_id ? 'var(--accent-cyan)' : 'var(--text-muted)' }}>👤 {salesmanName}</td>
                    <td style={{ color: r.delivery_man_id ? 'var(--success)' : 'var(--text-muted)' }}>🚚 {deliveryName}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                        <button className="language-btn" onClick={() => setSelectedRouteForShops(r)} style={{ borderColor: 'var(--accent-blue)', color: 'var(--accent-blue)', background: 'rgba(59, 130, 246, 0.05)' }} title={lang === 'ta' ? 'கடைகளைக் காட்டு' : 'Show Shops'}>
                          👁️ {lang === 'ta' ? 'கடைகள்' : 'Shops'}
                        </button>
                        <button className="language-btn" onClick={() => handleEdit(r)} style={{ borderStyle: 'dashed' }}>
                          ✏️ Edit
                        </button>
                        <button className="btn btn-danger" onClick={() => handleDeleteTrigger(r.id)} style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}>
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {routes.length === 0 && (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                    {t('no_routes')}
                  </td>
                </tr>
              )}
              {routes.length > 0 && filteredRoutes.length === 0 && (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                    {lang === 'ta' ? 'பொருந்தும் வழித்தடங்கள் எதுவும் காணப்படவில்லை.' : 'No matching routes found.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Shops under Route Modal */}
      {selectedRouteForShops && (
        <div className="modal-overlay">
          <div className="glass-card modal-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <h3 style={{ fontSize: '1.4rem', fontWeight: '700' }}>
                🏢 {lang === 'ta' ? selectedRouteForShops.name_ta : selectedRouteForShops.name_en} - {lang === 'ta' ? 'கடைகள்' : 'Shops'} ({shops.filter(s => s.route_id === selectedRouteForShops.id).length})
              </h3>
              <button 
                onClick={() => setSelectedRouteForShops(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.5rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ overflowY: 'auto', flex: 1, marginBottom: '1.5rem' }} className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>{lang === 'ta' ? 'கடையின் பெயர்' : 'Shop Name'}</th>
                    <th>{lang === 'ta' ? 'தொடர்பு நபர்' : 'Contact'}</th>
                    <th>{lang === 'ta' ? 'கைபேசி எண்' : 'Mobile'}</th>
                    <th>{lang === 'ta' ? 'வகை' : 'Type'}</th>
                    <th style={{ textAlign: 'right' }}>{lang === 'ta' ? 'நிலுவை தொகை' : 'Outstanding'}</th>
                  </tr>
                </thead>
                <tbody>
                  {shops.filter(s => s.route_id === selectedRouteForShops.id).map(s => (
                    <tr key={s.id}>
                      <td>
                        <strong>{lang === 'ta' ? s.name_ta : s.name_en}</strong>
                      </td>
                      <td>{s.contact_person}</td>
                      <td>{s.mobile}</td>
                      <td>
                        <span style={{
                          fontSize: '0.75rem',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          backgroundColor: s.shop_type === 'wholesale' ? 'rgba(6, 182, 212, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                          color: s.shop_type === 'wholesale' ? 'var(--accent-cyan)' : 'var(--success)',
                          border: s.shop_type === 'wholesale' ? '1px solid var(--accent-cyan)' : '1px solid var(--success)'
                        }}>
                          {s.shop_type === 'wholesale' ? (lang === 'ta' ? 'மொத்த விற்பனை' : 'Wholesale') : (lang === 'ta' ? 'சில்லறை விற்பனை' : 'Retail')}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold', color: s.outstanding_amount > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                        ₹{s.outstanding_amount}
                      </td>
                    </tr>
                  ))}
                  {shops.filter(s => s.route_id === selectedRouteForShops.id).length === 0 && (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                        {lang === 'ta' ? 'இந்த வழித்தடத்தில் கடைகள் எதுவும் இல்லை.' : 'No shops found under this route.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setSelectedRouteForShops(null)}>
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
          selectedRouteIds.length === routes.length
            ? (t('confirm_delete_all_routes_msg') || 'Are you sure you want to move ALL {count} routes to the Recycle Bin?').replace('{count}', selectedRouteIds.length)
            : (t('confirm_bulk_delete_routes_msg') || 'Are you sure you want to move {count} selected route(s) to the Recycle Bin?').replace('{count}', selectedRouteIds.length)
        }
        confirmText={lang === 'ta' ? 'ஆம், நீக்கு' : 'Yes, Delete'}
        cancelText={t('confirm_cancel')}
        onConfirm={executeBulkDelete}
        onCancel={() => setBulkConfirmOpen(false)}
      />
    </div>
  );
}
