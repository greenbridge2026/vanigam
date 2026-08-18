import React, { useState, useEffect } from 'react';
import api from '../api';
import ConfirmModal from './ConfirmModal';
import * as XLSX from 'xlsx';
import { translateProductName } from '../translations';

export default function ProductMgr({ t, lang }) {
  const [products, setProducts] = useState([]);
  const [editingProduct, setEditingProduct] = useState(null);
  const [loading, setLoading] = useState(true);

  // Form Fields
  const [nameEn, setNameEn] = useState('');
  const [nameTa, setNameTa] = useState('');
  const [activeField, setActiveField] = useState(null);
  const [brand, setBrand] = useState('');
  const [category, setCategory] = useState('');
  const [size, setSize] = useState('');
  const [caseQtyRule, setCaseQtyRule] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [wholesalePrice, setWholesalePrice] = useState('');
  const [retailPrice, setRetailPrice] = useState('');
  const [minStock, setMinStock] = useState(0);
  const [status, setStatus] = useState('active');
  const [mrp, setMrp] = useState('');
  const [gst, setGst] = useState('');
  const [parsedProducts, setParsedProducts] = useState([]);
  const [importing, setImporting] = useState(false);
  const [currentStockCases, setCurrentStockCases] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    async function loadProducts() {
      try {
        const data = await api.getProducts();
        setProducts(data);
      } catch (err) {
        console.error('Failed to load products list', err);
      } finally {
        setLoading(false);
      }
    }
    loadProducts();
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
      alert(lang === 'ta' ? 'தயாரிப்பு பெயர் தேவை' : 'Product name is required');
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

    const caseRuleNum = Number(caseQtyRule) || 24;
    const stockCasesNum = Number(currentStockCases) || 0;

    const payload = {
      name_en: finalEn,
      name_ta: finalTa,
      brand,
      category: category || '',
      size,
      case_qty_rule: caseRuleNum,
      purchase_price: Number(purchasePrice) || 0,
      wholesale_price: Number(wholesalePrice) || 0,
      retail_price: Number(retailPrice) || 0,
      min_stock: Number(minStock) || 0,
      status,
      mrp: Number(mrp) || 0,
      gst: Number(gst) || 0,
      current_stock_bottles: stockCasesNum * caseRuleNum
    };

    try {
      if (editingProduct) {
        const updated = await api.updateProduct(editingProduct.id, payload);
        setProducts(products.map(p => p.id === editingProduct.id ? updated : p));
      } else {
        const added = await api.createProduct(payload);
        setProducts([...products, added]);
      }
      resetForm();
    } catch (err) {
      alert(err.message || 'Error saving product settings');
    }
  };

  const handleEdit = async (prod) => {
    setEditingProduct(prod);
    setNameEn(prod.name_en || '');

    let initialTa = prod.name_ta || '';
    if (!initialTa || /[a-zA-Z]/.test(initialTa) || initialTa.trim() === (prod.name_en || '').trim()) {
      const dictTa = translateProductName(prod, 'ta');
      if (dictTa && !/[a-zA-Z]/.test(dictTa)) {
        initialTa = dictTa;
      } else {
        try {
          const translated = await api.translate(prod.name_en, 'en', 'ta');
          if (translated) initialTa = translated;
        } catch (err) {
          console.warn('Auto-translate on edit failed', err);
        }
      }
    }

    setNameTa(initialTa || translateProductName(prod, 'ta'));
    setBrand(prod.brand);
    setCategory(prod.category || '');
    setSize(prod.size);
    setCaseQtyRule(prod.case_qty_rule);
    setPurchasePrice(prod.purchase_price);
    setWholesalePrice(prod.wholesale_price);
    setRetailPrice(prod.retail_price);
    setMinStock(prod.min_stock);
    setStatus(prod.status);
    setMrp(prod.mrp || 0);
    setGst(prod.gst || 0);
    setCurrentStockCases(Math.floor((prod.current_stock_bottles || 0) / (prod.case_qty_rule || 24)));
  };

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);

  const handleToggleSelect = (id) => {
    setSelectedProductIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    if (selectedProductIds.length === filteredProducts.length && filteredProducts.length > 0) {
      setSelectedProductIds([]);
    } else {
      setSelectedProductIds(filteredProducts.map(p => p.id));
    }
  };

  const handleBulkDeleteTrigger = () => {
    setBulkConfirmOpen(true);
  };

  const executeBulkDelete = async () => {
    setBulkConfirmOpen(false);
    if (selectedProductIds.length === 0) return;
    try {
      const res = await api.bulkDeleteProducts(selectedProductIds);
      if (res.success) {
        const deletedSet = new Set(res.deletedIds);
        setProducts(products.filter(p => !deletedSet.has(p.id)));

        let msg = t('bulk_deleted_summary')
          .replace('{deleted}', res.deletedCount)
          .replace('{skipped}', res.skippedCount);

        if (res.errors && res.errors.length > 0) {
          msg += '\n\n' + (lang === 'ta' ? 'விவரங்கள்:' : 'Details:') + '\n' + res.errors.join('\n');
        }

        alert(msg);
        setSelectedProductIds([]);
      }
    } catch (err) {
      alert(err.message || 'Failed to bulk delete products');
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
      await api.deleteProduct(deleteTargetId);
      setProducts(products.filter(p => p.id !== deleteTargetId));
      alert('Product moved to Recycle Bin. / தயாரிப்பு குப்பைத் தொட்டிக்கு நகர்த்தப்பட்டது.');
    } catch (err) {
      alert(err.message || 'Failed to delete product');
    } finally {
      setDeleteTargetId(null);
    }
  };

  const resetForm = () => {
    setEditingProduct(null);
    setNameEn('');
    setNameTa('');
    setActiveField(null);
    setBrand('');
    setCategory('');
    setSize('');
    setCaseQtyRule('');
    setPurchasePrice('');
    setWholesalePrice('');
    setRetailPrice('');
    setMinStock(0);
    setStatus('active');
    setMrp('');
    setGst('');
    setCurrentStockCases('');
  };

  const handleDownloadTemplate = () => {
    const templateData = [
      {
        Brand: 'Coca Cola',
        ProductName: 'Coke 2.25 Litre',
        Size: '2.25L',
        MRP: 110,
        PackQty: 9,
        PurchasePrice: 90,
        WholesalePrice: 95,
        RetailPrice: 100,
        GST: 18,
        OpeningStock: 10,
        MinStock: 18,
        Status: 'active'
      },
      {
        Brand: 'Fanta',
        ProductName: 'Fanta 500ml',
        Size: '500ml',
        MRP: 40,
        PackQty: 24,
        PurchasePrice: 30,
        WholesalePrice: 32,
        RetailPrice: 35,
        GST: 18,
        OpeningStock: 5,
        MinStock: 24,
        Status: 'active'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Products Template');
    XLSX.writeFile(wb, 'products_import_template.xlsx');
  };

  const handleExportToExcel = () => {
    if (products.length === 0) {
      alert(lang === 'ta' ? 'ஏற்றுமதி செய்ய தயாரிப்புகள் எதுவும் இல்லை' : 'No products to export.');
      return;
    }

    const exportData = products.map(p => ({
      Brand: p.brand || '',
      ProductName: p.name_en || '',
      Size: p.size || '',
      MRP: p.mrp || 0,
      PackQty: p.case_qty_rule || 24,
      PurchasePrice: p.purchase_price || 0,
      WholesalePrice: p.wholesale_price || 0,
      RetailPrice: p.retail_price || 0,
      GST: p.gst || 0,
      OpeningStock: Math.floor((p.current_stock_bottles || 0) / (p.case_qty_rule || 24)),
      MinStock: p.min_stock || 0,
      Status: p.status || 'active'
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Products List');
    XLSX.writeFile(wb, 'products_list.xlsx');
  };

  const [translatingAll, setTranslatingAll] = useState(false);

  const handleAutoTranslateAll = async () => {
    setTranslatingAll(true);
    try {
      const res = await api.autoTranslateProducts();
      if (res && res.success) {
        setProducts(res.products);
        alert(
          lang === 'ta'
            ? `${res.updatedCount} தயாரிப்புகளின் தமிழ் பெயர்கள் வெற்றிகரமாக புதுப்பிக்கப்பட்டன!`
            : `Successfully updated Tamil names for ${res.updatedCount} products!`
        );
      }
    } catch (err) {
      alert(err.message || 'Auto translation failed');
    } finally {
      setTranslatingAll(false);
    }
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

        const mapped = await Promise.all(data.map(async (row) => {
          const brand = getVal(row, ['Brand']) || '';
          const name_en = getVal(row, ['ProductName', 'NameEn', 'Name']) || '';
          let name_ta = getVal(row, ['ProductNameTamil', 'NameTa']) || '';

          if (name_en && (!name_ta || /[a-zA-Z]/.test(name_ta) || name_ta.trim() === name_en.trim())) {
            const dictTa = translateProductName({ name_en, name_ta: '' }, 'ta');
            if (dictTa && !/[a-zA-Z]/.test(dictTa)) {
              name_ta = dictTa;
            } else {
              try {
                const translated = await api.translate(name_en, 'en', 'ta');
                if (translated) name_ta = translated;
              } catch (e) {
                console.warn('Auto translate during Excel upload failed:', e);
              }
            }
          }

          return {
            brand,
            name_en,
            name_ta: name_ta || name_en,
            size: getVal(row, ['Size']) || '',
            mrp: Number(getVal(row, ['MRP']) || 0),
            case_qty_rule: Number(getVal(row, ['PackQty', 'CaseQty', 'CaseQtyRule']) || 24),
            purchase_price: Number(getVal(row, ['PurchasePrice']) || 0),
            wholesale_price: Number(getVal(row, ['WholesalePrice']) || 0),
            retail_price: Number(getVal(row, ['RetailPrice']) || 0),
            gst: Number(getVal(row, ['GST']) || 0),
            opening_stock: Number(getVal(row, ['OpeningStock', 'Stock']) || 0),
            min_stock: Number(getVal(row, ['MinStock']) || 24),
            status: getVal(row, ['Status']) || 'active'
          };
        }));

        // Pre-import validation
        const missingFields = mapped.filter(p => !p.brand || !p.name_en || !p.size);
        if (missingFields.length > 0) {
          alert(
            lang === 'ta'
              ? 'சில வரிசைகளில் பிராண்ட், தயாரிப்பு பெயர் அல்லது அளவு விடுபட்டுள்ளது!'
              : `Validation Error: ${missingFields.length} row(s) are missing required fields (Brand, ProductName, Size).`
          );
          return;
        }

        setParsedProducts(mapped);
      } catch (err) {
        console.error('File parsing error:', err);
        alert(lang === 'ta' ? 'கோப்பைப் படிப்பதில் பிழை ஏற்பட்டது!' : 'Error reading file! Please check the structure.');
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleConfirmImport = async () => {
    if (parsedProducts.length === 0) return;
    setImporting(true);
    try {
      const results = await api.importProducts(parsedProducts);
      const updatedList = await api.getProducts();
      setProducts(updatedList);
      alert(
        lang === 'ta'
          ? `வெற்றிகரமாக ${results.length} தயாரிப்புகள் இறக்குமதி செய்யப்பட்டன!`
          : `Successfully imported ${results.length} products!`
      );
      setParsedProducts([]);
    } catch (err) {
      alert(err.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const formatStock = (stockBottles, caseRule) => {
    const cases = Math.floor(stockBottles / caseRule);
    const bottles = stockBottles % caseRule;
    
    let result = '';
    if (cases > 0) result += `${cases} ${lang === 'ta' ? 'கேஸ்' : 'Cases'}`;
    if (bottles > 0) result += `${result ? ', ' : ''}${bottles} ${lang === 'ta' ? 'பாட்டில்' : 'Bottles'}`;
    return result || (lang === 'ta' ? 'சரக்கு இல்லை' : '0 Bottles');
  };

  const filteredProducts = products.filter(p => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    const nameEnMatch = (p.name_en || '').toLowerCase().includes(query);
    const nameTaMatch = (p.name_ta || '').toLowerCase().includes(query);
    const brandMatch = (p.brand || '').toLowerCase().includes(query);
    return nameEnMatch || nameTaMatch || brandMatch;
  });

  if (loading) return <div style={{ color: 'var(--text-muted)', textAlign: 'center' }}>Loading Product Manager...</div>;

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>🥤 {t('product_mgmt')}</h1>
        <p style={{ color: 'var(--text-muted)' }}>Define pricing formulas, packaging options, and thresholds for inventory lines</p>
      </div>

      {/* Excel Bulk Import Card */}
      <div className="glass-card" style={{ marginBottom: '2rem' }}>
        <h2 style={{ marginBottom: '0.5rem', fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>📊</span> {lang === 'ta' ? 'எக்செல் மூலம் மொத்தமாக தயாரிப்புகளை இறக்குமதி செய்க' : 'Bulk Import Products via Excel'}
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
          {lang === 'ta' 
            ? 'பிராண்ட், தயாரிப்பு பெயர், அளவு, விலைகள் மற்றும் துவக்க இருப்பு உள்ளிட்ட தயாரிப்புகளை இறக்குமதி செய்யவும் அல்லது தற்போதைய தயாரிப்புகளைப் பதிவிறக்கவும்.' 
            : 'Import products including brand, product name, size, pricing, and opening stock counts, or download the current products list.'}
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', marginBottom: '1.5rem' }}>
          <button type="button" className="btn btn-secondary" onClick={handleDownloadTemplate} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            📥 {lang === 'ta' ? 'மாதிரி எக்செல் கோப்பை பதிவிறக்கு' : 'Download Excel Template'}
          </button>
          
          <button type="button" className="btn btn-secondary" onClick={handleExportToExcel} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            📤 {lang === 'ta' ? 'தற்போதைய தயாரிப்புகளைப் பதிவிறக்கு' : 'Download Products (Excel)'}
          </button>

          <button 
            type="button" 
            className="btn btn-secondary" 
            onClick={handleAutoTranslateAll} 
            disabled={translatingAll}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'var(--accent-cyan)', color: '#000', fontWeight: 'bold' }}
          >
            🌐 {translatingAll ? (lang === 'ta' ? 'மொழிபெயர்க்கப்படுகிறது...' : 'Translating...') : (lang === 'ta' ? 'தமிழ் பெயர்களை தானாக புதுப்பி' : 'Auto-Translate Tamil Names')}
          </button>
          
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

        {parsedProducts.length > 0 && (
          <div style={{ 
            background: 'rgba(255,255,255,0.05)', 
            borderRadius: 'var(--radius)', 
            padding: '1rem', 
            border: '1px solid rgba(255,255,255,0.1)',
            marginBottom: '1.5rem'
          }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem', color: 'var(--accent-cyan)' }}>
              📋 {lang === 'ta' ? `இறக்குமதி செய்ய தயாராக உள்ளவை (${parsedProducts.length})` : `Loaded Products Ready for Import (${parsedProducts.length})`}
            </h3>
            
            <div style={{ maxHeight: '200px', overflowY: 'auto', fontSize: '0.85rem' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.2)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '0.5rem' }}>Brand</th>
                    <th style={{ padding: '0.5rem' }}>Product Name</th>
                    <th style={{ padding: '0.5rem' }}>Size</th>
                    <th style={{ padding: '0.5rem' }}>Pack Qty</th>
                    <th style={{ padding: '0.5rem' }}>MRP</th>
                    <th style={{ padding: '0.5rem' }}>Purchase Price</th>
                    <th style={{ padding: '0.5rem' }}>Opening Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedProducts.map((p, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '0.5rem' }}>{p.brand}</td>
                      <td style={{ padding: '0.5rem' }}>{p.name_en}</td>
                      <td style={{ padding: '0.5rem' }}>{p.size}</td>
                      <td style={{ padding: '0.5rem' }}>{p.case_qty_rule}</td>
                      <td style={{ padding: '0.5rem' }}>₹{p.mrp}</td>
                      <td style={{ padding: '0.5rem' }}>₹{p.purchase_price}</td>
                      <td style={{ padding: '0.5rem' }}>{p.opening_stock} Cases</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setParsedProducts([])}>
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
          <strong>{lang === 'ta' ? 'தேவைப்படும் பத்திகள்:' : 'Required Column Headers:'}</strong>
          <span style={{ 
            display: 'inline-block', 
            background: 'rgba(255,255,255,0.05)', 
            padding: '0.1rem 0.4rem', 
            borderRadius: '3px', 
            marginLeft: '0.5rem',
            fontFamily: 'monospace',
            color: 'var(--accent-cyan)'
          }}>
            Brand, ProductName, Size, MRP, PackQty, PurchasePrice, WholesalePrice, RetailPrice, GST, OpeningStock, MinStock, Status
          </span>
        </div>
      </div>

      {/* Add Product Form Card */}
      {!editingProduct && (
        <div className="glass-card">
          <h2 style={{ marginBottom: '1.25rem', fontSize: '1.25rem' }}>
            {t('add_product')}
          </h2>
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-group">
                <label>{t('product_name_en')}</label>
                <input type="text" className="form-input" value={nameEn} onChange={e => setNameEn(e.target.value)} onFocus={() => setActiveField('en')} placeholder="e.g. Coca Cola 2.25 Litre" />
              </div>
              <div className="form-group">
                <label>{t('product_name_ta')}</label>
                <input type="text" className="form-input" value={nameTa} onChange={e => setNameTa(e.target.value)} onFocus={() => setActiveField('ta')} placeholder="எ.கா. கோகோ கோலா 2.25 லிட்டர்" />
              </div>
              <div className="form-group">
                <label>{t('brand')}</label>
                <input type="text" className="form-input" value={brand} onChange={e => setBrand(e.target.value)} required placeholder="e.g. Coca Cola" />
              </div>
              <div className="form-group">
                <label>{t('size')}</label>
                <input type="text" className="form-input" value={size} onChange={e => setSize(e.target.value)} required placeholder="e.g. 2.25L, 500ml" />
              </div>
              <div className="form-group">
                <label>{t('case_qty')} (Bottles per Case)</label>
                <input type="number" className="form-input" value={caseQtyRule} onChange={e => setCaseQtyRule(e.target.value)} required min="1" placeholder="9 or 24" />
              </div>
              <div className="form-group">
                <label>{t('purchase_price')} (₹ per Case)</label>
                <input type="number" className="form-input" value={purchasePrice} onChange={e => setPurchasePrice(e.target.value)} required min="0" />
              </div>
              <div className="form-group">
                <label>{t('wholesale_price')} (₹ per Case)</label>
                <input type="number" className="form-input" value={wholesalePrice} onChange={e => setWholesalePrice(e.target.value)} required min="0" />
              </div>
              <div className="form-group">
                <label>{t('retail_price')} (₹ per Case)</label>
                <input type="number" className="form-input" value={retailPrice} onChange={e => setRetailPrice(e.target.value)} required min="0" />
              </div>
              <div className="form-group">
                <label>{t('mrp')}</label>
                <input type="number" className="form-input" value={mrp} onChange={e => setMrp(e.target.value)} required min="0" step="any" />
              </div>
              <div className="form-group">
                <label>{t('gst')}</label>
                <input type="number" className="form-input" value={gst} onChange={e => setGst(e.target.value)} required min="0" max="100" step="any" />
              </div>
              <div className="form-group">
                <label>{lang === 'ta' ? 'சரக்கு இருப்பு (பெட்டிகள்)' : 'Live Stock (Cases)'}</label>
                <input type="number" className="form-input" value={currentStockCases} onChange={e => setCurrentStockCases(e.target.value)} min="0" placeholder="e.g. 10" />
              </div>
              <div className="form-group">
                <label>{t('status')}</label>
                <select className="form-select" value={status} onChange={e => setStatus(e.target.value)}>
                  <option value="active">{t('active')}</option>
                  <option value="inactive">{t('inactive')}</option>
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

      {/* Edit Product Popup Modal */}
      {editingProduct && (
        <div className="modal-overlay">
          <div className="glass-card modal-card" style={{ maxWidth: '750px', width: '95%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <h2 style={{ fontSize: '1.35rem', fontWeight: '700', margin: 0 }}>
                ✏️ {t('edit_product')}: {lang === 'ta' ? editingProduct.name_ta : editingProduct.name_en}
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
                    <label>{t('product_name_en')}</label>
                    <input type="text" className="form-input" value={nameEn} onChange={e => setNameEn(e.target.value)} onFocus={() => setActiveField('en')} placeholder="e.g. Coca Cola 2.25 Litre" />
                  </div>
                  <div className="form-group">
                    <label>{t('product_name_ta')}</label>
                    <input type="text" className="form-input" value={nameTa} onChange={e => setNameTa(e.target.value)} onFocus={() => setActiveField('ta')} placeholder="எ.கா. கோகோ கோலா 2.25 லிட்டர்" />
                  </div>
                  <div className="form-group">
                    <label>{t('brand')}</label>
                    <input type="text" className="form-input" value={brand} onChange={e => setBrand(e.target.value)} required placeholder="e.g. Coca Cola" />
                  </div>
                  <div className="form-group">
                    <label>{t('size')}</label>
                    <input type="text" className="form-input" value={size} onChange={e => setSize(e.target.value)} required placeholder="e.g. 2.25L, 500ml" />
                  </div>
                  <div className="form-group">
                    <label>{t('case_qty')} (Bottles per Case)</label>
                    <input type="number" className="form-input" value={caseQtyRule} onChange={e => setCaseQtyRule(e.target.value)} required min="1" placeholder="9 or 24" />
                  </div>
                  <div className="form-group">
                    <label>{t('purchase_price')} (₹ per Case)</label>
                    <input type="number" className="form-input" value={purchasePrice} onChange={e => setPurchasePrice(e.target.value)} required min="0" />
                  </div>
                  <div className="form-group">
                    <label>{t('wholesale_price')} (₹ per Case)</label>
                    <input type="number" className="form-input" value={wholesalePrice} onChange={e => setWholesalePrice(e.target.value)} required min="0" />
                  </div>
                  <div className="form-group">
                    <label>{t('retail_price')} (₹ per Case)</label>
                    <input type="number" className="form-input" value={retailPrice} onChange={e => setRetailPrice(e.target.value)} required min="0" />
                  </div>
                  <div className="form-group">
                    <label>{t('mrp')}</label>
                    <input type="number" className="form-input" value={mrp} onChange={e => setMrp(e.target.value)} required min="0" step="any" />
                  </div>
                  <div className="form-group">
                    <label>{t('gst')}</label>
                    <input type="number" className="form-input" value={gst} onChange={e => setGst(e.target.value)} required min="0" max="100" step="any" />
                  </div>
                  <div className="form-group">
                    <label>{lang === 'ta' ? 'சரக்கு இருப்பு (பெட்டிகள்)' : 'Live Stock (Cases)'}</label>
                    <input type="number" className="form-input" value={currentStockCases} onChange={e => setCurrentStockCases(e.target.value)} min="0" placeholder="e.g. 10" />
                  </div>
                  <div className="form-group">
                    <label>{t('status')}</label>
                    <select className="form-select" value={status} onChange={e => setStatus(e.target.value)}>
                      <option value="active">{t('active')}</option>
                      <option value="inactive">{t('inactive')}</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="btn-group" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: 'auto' }}>
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

      {/* Product List */}
      <div className="glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Inventory Setup</h2>
            <input
              type="text"
              className="form-input"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={lang === 'ta' ? 'தயாரிப்புகளைத் தேடு...' : '🔍 Search products...'}
              style={{ width: '220px', padding: '0.4rem 0.75rem', fontSize: '0.9rem', margin: 0 }}
            />
          </div>
          {selectedProductIds.length > 0 && (
            <button
              type="button"
              className="btn btn-danger"
              onClick={handleBulkDeleteTrigger}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 1rem',
                fontSize: '0.9rem',
                background: 'var(--danger)',
                border: 'none',
                color: '#fff',
                cursor: 'pointer',
                borderRadius: 'var(--radius)',
                transition: 'all 0.2s ease-in-out'
              }}
            >
              🗑️ {t('bulk_delete')} ({selectedProductIds.length})
            </button>
          )}
        </div>
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th style={{ width: '40px', padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    className="form-checkbox"
                    checked={filteredProducts.length > 0 && selectedProductIds.length === filteredProducts.length}
                    onChange={handleToggleSelectAll}
                    style={{ cursor: 'pointer', transform: 'scale(1.2)' }}
                  />
                </th>
                <th>Product details</th>
                <th>Brand / Size</th>
                <th>Case Qty Rule</th>
                <th>Purchase (Case)</th>
                <th>Wholesale (Case)</th>
                <th>Retail (Case)</th>
                <th>MRP</th>
                <th>GST</th>
                <th>Live Stock (Case Count)</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map(p => (
                <tr key={p.id}>
                  <td style={{ textAlign: 'center', padding: '0.75rem 0.5rem' }}>
                    <input
                      type="checkbox"
                      className="form-checkbox"
                      checked={selectedProductIds.includes(p.id)}
                      onChange={() => handleToggleSelect(p.id)}
                      style={{ cursor: 'pointer', transform: 'scale(1.2)' }}
                    />
                  </td>
                  <td>
                    <div style={{ fontWeight: '700' }}>{lang === 'ta' ? p.name_ta : p.name_en}</div>
                  </td>
                  <td>
                    <div>{p.brand}</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--accent-cyan)' }}>{p.size}</div>
                  </td>
                  <td><strong>{p.case_qty_rule}</strong> Bottles</td>
                  <td>₹{p.purchase_price}</td>
                  <td style={{ color: 'var(--warning)', fontWeight: '600' }}>₹{p.wholesale_price}</td>
                  <td style={{ color: 'var(--accent-cyan)', fontWeight: '600' }}>₹{p.retail_price}</td>
                  <td>₹{p.mrp || 0}</td>
                  <td>{p.gst || 0}%</td>
                  <td style={{
                    fontWeight: '700',
                    color: p.current_stock_bottles === 0 ? 'var(--danger)' : p.current_stock_bottles <= p.min_stock ? 'var(--warning)' : 'var(--success)'
                  }}>
                    {formatStock(p.current_stock_bottles, p.case_qty_rule)}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                      <button className="language-btn" onClick={() => handleEdit(p)}>
                        ✏️ Edit
                      </button>
                      <button className="btn btn-danger" onClick={() => handleDeleteTrigger(p.id)} style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}>
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

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
        title={t('confirm_title')}
        message={t('confirm_bulk_delete_msg')}
        confirmText={t('confirm_ok')}
        cancelText={t('confirm_cancel')}
        onConfirm={executeBulkDelete}
        onCancel={() => setBulkConfirmOpen(false)}
      />

    </div>
  );
}
