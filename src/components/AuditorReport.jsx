import React, { useState, useEffect, useMemo, useRef } from 'react';
import api from '../api';
import * as XLSX from 'xlsx';
import { calculateItemGst } from '../utils/gstUtils';

export default function AuditorReport({
  t,
  lang,
  orders: propOrders = [],
  orderItems: propOrderItems = [],
  products: propProducts = [],
  shops: propShops = []
}) {
  // Local date helpers (YYYY-MM-DD)
  const getTodayLocalStr = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const getStartOfMonthStr = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}-01`;
  };

  // Date Range Filters State
  const [fromDate, setFromDate] = useState(getStartOfMonthStr());
  const [toDate, setToDate] = useState(getTodayLocalStr());
  const [appliedFromDate, setAppliedFromDate] = useState(getStartOfMonthStr());
  const [appliedToDate, setAppliedToDate] = useState(getTodayLocalStr());

  // Data States
  const [vehicleSales, setVehicleSales] = useState([]);
  const [settings, setSettings] = useState({
    company_name: 'GSK Agency',
    company_address: 'Cooldrinks Shop - Tindivanam',
    company_gst: '33CWRPK4071L1Z2',
    company_phone: '9345463415'
  });
  const [loading, setLoading] = useState(true);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const reportContainerRef = useRef(null);

  // Fetch Vehicle Sales and Company Settings on mount
  useEffect(() => {
    let isMounted = true;
    async function loadAuxiliaryData() {
      setLoading(true);
      try {
        const [vsData, settsData] = await Promise.all([
          api.getVehicleSales().catch(() => []),
          api.getSettings().catch(() => null)
        ]);
        if (isMounted) {
          if (Array.isArray(vsData)) setVehicleSales(vsData);
          if (settsData && typeof settsData === 'object') {
            setSettings(prev => ({ ...prev, ...settsData }));
          }
        }
      } catch (err) {
        console.error('Error loading auditor report data:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadAuxiliaryData();
    return () => { isMounted = false; };
  }, []);

  // Quick Preset Date Handlers
  const handleSetPreset = (preset) => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const d = now.getDate();

    let newFrom = '';
    let newTo = getTodayLocalStr();

    if (preset === 'today') {
      newFrom = getTodayLocalStr();
      newTo = getTodayLocalStr();
    } else if (preset === 'yesterday') {
      const yest = new Date(y, m, d - 1);
      const str = `${yest.getFullYear()}-${String(yest.getMonth() + 1).padStart(2, '0')}-${String(yest.getDate()).padStart(2, '0')}`;
      newFrom = str;
      newTo = str;
    } else if (preset === 'last7') {
      const prev7 = new Date(y, m, d - 6);
      newFrom = `${prev7.getFullYear()}-${String(prev7.getMonth() + 1).padStart(2, '0')}-${String(prev7.getDate()).padStart(2, '0')}`;
    } else if (preset === 'this_month') {
      newFrom = `${y}-${String(m + 1).padStart(2, '0')}-01`;
      newTo = getTodayLocalStr();
    } else if (preset === 'last_month') {
      const firstDayPrevMonth = new Date(y, m - 1, 1);
      const lastDayPrevMonth = new Date(y, m, 0);
      newFrom = `${firstDayPrevMonth.getFullYear()}-${String(firstDayPrevMonth.getMonth() + 1).padStart(2, '0')}-01`;
      newTo = `${lastDayPrevMonth.getFullYear()}-${String(lastDayPrevMonth.getMonth() + 1).padStart(2, '0')}-${String(lastDayPrevMonth.getDate()).padStart(2, '0')}`;
    } else if (preset === 'all') {
      newFrom = '';
      newTo = '';
    }

    setFromDate(newFrom);
    setToDate(newTo);
    setAppliedFromDate(newFrom);
    setAppliedToDate(newTo);
  };

  const handleGenerateReport = () => {
    setAppliedFromDate(fromDate);
    setAppliedToDate(toDate);
  };

  const handleResetFilters = () => {
    const defFrom = getStartOfMonthStr();
    const defTo = getTodayLocalStr();
    setFromDate(defFrom);
    setToDate(defTo);
    setAppliedFromDate(defFrom);
    setAppliedToDate(defTo);
  };

  // -------------------------------------------------------------
  // CORE AUDITOR CONSOLIDATION ENGINE
  // Consolidates:
  // 1. Order Taking (orders + order_items)
  // 2. Vehicle Direct Sales (vehicle_sales)
  // Calculates taxable amount before tax from tax-inclusive product prices
  // -------------------------------------------------------------
  const { gstRateBreakdown, reportTotals, hasInterstate } = useMemo(() => {
    const seenInvoices = new Set();
    const companyGstin = settings?.company_gst || '33CWRPK4071L1Z2';
    const rateMap = {};

    let totalTaxableAll = 0;
    let totalCgstAll = 0;
    let totalSgstAll = 0;
    let totalIgstAll = 0;
    let totalGstAll = 0;
    let grandTotalAll = 0;
    let totalOrdersCount = 0;
    let totalDirectCount = 0;

    const processItem = ({ rawAmount, orderGross, orderDiscount, productGst, customerGstin }) => {
      const rateNum = Number(productGst || 0);
      // Exclude 0% GST items as requested by user
      if (rateNum <= 0) return;

      const calc = calculateItemGst({
        rawAmount,
        grossTotal: orderGross,
        orderDiscount,
        productGst: rateNum,
        customerGstin,
        companyGstin
      });

      const rate = calc.gstRate;
      if (!rateMap[rate]) {
        rateMap[rate] = {
          gstRate: rate,
          cgstRate: calc.cgstRate,
          sgstRate: calc.sgstRate,
          igstRate: calc.igstRate,
          taxableAmount: 0,
          cgstAmount: 0,
          sgstAmount: 0,
          igstAmount: 0,
          totalGst: 0,
          grandTotal: 0,
          lineCount: 0
        };
      }

      rateMap[rate].taxableAmount += calc.taxableAmount;
      rateMap[rate].cgstAmount += calc.cgstAmount;
      rateMap[rate].sgstAmount += calc.sgstAmount;
      rateMap[rate].igstAmount += calc.igstAmount;
      rateMap[rate].totalGst += calc.totalGst;
      rateMap[rate].grandTotal += calc.grandTotal;
      rateMap[rate].lineCount += 1;

      totalTaxableAll += calc.taxableAmount;
      totalCgstAll += calc.cgstAmount;
      totalSgstAll += calc.sgstAmount;
      totalIgstAll += calc.igstAmount;
      totalGstAll += calc.totalGst;
      grandTotalAll += calc.grandTotal;
    };

    // 1. Process Order Taking Sales
    (propOrders || []).forEach(order => {
      if (order.status === 'cancelled' || order.status === 'not_delivered' || order.status === 'returned') return;
      if (order.is_opening_balance || order.id?.startsWith('ord_ob_') || order.id?.startsWith('ord_adj_')) return;

      const orderDateStr = order.order_date ? order.order_date.slice(0, 10) : '';
      if (appliedFromDate && orderDateStr && orderDateStr < appliedFromDate) return;
      if (appliedToDate && orderDateStr && orderDateStr > appliedToDate) return;
      if (!appliedFromDate && !appliedToDate && !orderDateStr) return;

      const invNum = order.invoice_number || `INV-${order.id}`;
      const uniqueInvKey = `ORDER_${invNum}`;
      if (seenInvoices.has(uniqueInvKey)) return;
      seenInvoices.add(uniqueInvKey);
      totalOrdersCount += 1;

      const shop = (propShops || []).find(s => s.id === order.shop_id);
      const items = (propOrderItems || []).filter(oi => oi.order_id === order.id);
      if (items.length === 0) return;

      const orderGross = Number(order.total_amount || items.reduce((s, it) => s + Number(it.amount || 0), 0));
      const orderDiscount = Number(order.discount || 0);
      const customerGst = (shop?.gst_number || '').trim();

      items.forEach(item => {
        const prod = (propProducts || []).find(p => p.id === item.product_id);
        const rawAmount = Number(item.amount || 0);
        processItem({
          rawAmount,
          orderGross,
          orderDiscount,
          productGst: prod?.gst || 0,
          customerGstin: customerGst
        });
      });
    });

    // 2. Process Vehicle Direct Sales
    (vehicleSales || []).forEach(sale => {
      if (sale.status === 'cancelled') return;

      const saleDateStr = sale.sale_date ? sale.sale_date.slice(0, 10) : '';
      if (appliedFromDate && saleDateStr && saleDateStr < appliedFromDate) return;
      if (appliedToDate && saleDateStr && saleDateStr > appliedToDate) return;
      if (!appliedFromDate && !appliedToDate && !saleDateStr) return;

      const invNum = sale.invoice_number || `DS-${sale.id}`;
      const uniqueInvKey = `VS_${invNum}`;
      if (seenInvoices.has(uniqueInvKey)) return;
      seenInvoices.add(uniqueInvKey);
      totalDirectCount += 1;

      const shop = (propShops || []).find(s => s.id === sale.shop_id);
      const items = Array.isArray(sale.items) ? sale.items : [];
      if (items.length === 0) return;

      const saleGross = items.reduce((s, it) => s + Number(it.subtotal || 0), 0);
      const saleDiscount = Number(sale.discount || 0);
      const customerGst = (shop?.gst_number || '').trim();

      items.forEach(item => {
        const prod = (propProducts || []).find(p => p.id === item.product_id);
        const rawAmount = Number(item.subtotal || 0);
        processItem({
          rawAmount,
          orderGross: saleGross,
          orderDiscount: saleDiscount,
          productGst: prod?.gst || 0,
          customerGstin: customerGst
        });
      });
    });

    const breakdownList = Object.values(rateMap)
      .sort((a, b) => a.gstRate - b.gstRate)
      .map(item => {
        const taxable = Number(item.taxableAmount.toFixed(2));
        const cgst = Number(item.cgstAmount.toFixed(2));
        const sgst = Number(item.sgstAmount.toFixed(2));
        const igst = Number(item.igstAmount.toFixed(2));
        const totalGst = Number(item.totalGst.toFixed(2));
        const grand = Number(item.grandTotal.toFixed(2));
        const share = totalTaxableAll > 0 ? Number(((taxable / totalTaxableAll) * 100).toFixed(1)) : 0;

        return {
          ...item,
          taxableAmount: taxable,
          cgstAmount: cgst,
          sgstAmount: sgst,
          igstAmount: igst,
          totalGst,
          grandTotal: grand,
          percentageOfTotal: share
        };
      });

    const totals = {
      totalTaxable: Number(totalTaxableAll.toFixed(2)),
      totalCgst: Number(totalCgstAll.toFixed(2)),
      totalSgst: Number(totalSgstAll.toFixed(2)),
      totalIgst: Number(totalIgstAll.toFixed(2)),
      totalGst: Number(totalGstAll.toFixed(2)),
      grandTotal: Number(grandTotalAll.toFixed(2)),
      totalInvoices: seenInvoices.size,
      totalOrdersCount,
      totalDirectCount
    };

    return {
      gstRateBreakdown: breakdownList,
      reportTotals: totals,
      hasInterstate: totalIgstAll > 0
    };
  }, [propOrders, propOrderItems, propProducts, propShops, vehicleSales, settings, appliedFromDate, appliedToDate]);

  // -------------------------------------------------------------
  // EXPORT & PRINT HANDLERS
  // -------------------------------------------------------------

  // 1. Export to Excel (.xlsx)
  const handleExportExcel = () => {
    if (gstRateBreakdown.length === 0) {
      alert(lang === 'ta' ? 'ஏற்றுமதி செய்ய எந்த விற்பனை பதிவுகளும் இல்லை.' : 'No sales records to export for the selected date range.');
      return;
    }

    const wb = XLSX.utils.book_new();

    const sheetData = [
      ['VANIGAM ERP - AUDITOR REPORT (GST RATE-WISE SUMMARY)'],
      ['Company Name:', settings?.company_name || 'GSK Agency'],
      ['Address:', settings?.company_address || 'Cooldrinks Shop - Tindivanam'],
      ['GSTIN:', settings?.company_gst || '33CWRPK4071L1Z2'],
      ['Phone:', settings?.company_phone || '9345463415'],
      ['Period:', `${appliedFromDate || 'Beginning'} to ${appliedToDate || 'Today'}`],
      ['Generated On:', new Date().toLocaleString()],
      ['Note:', 'Selling prices in product management are tax-inclusive; taxable value reflects sales before GST.'],
      [''],
      [
        'GST Rate (%)',
        'CGST Rate (%)',
        'SGST Rate (%)',
        'Taxable Value (₹)',
        'CGST Amount (₹)',
        'SGST Amount (₹)',
        ...(hasInterstate ? ['IGST Amount (₹)'] : []),
        'Total GST (₹)',
        'Grand Total (₹)',
        '% Share'
      ]
    ];

    gstRateBreakdown.forEach(item => {
      const row = [
        `${item.gstRate}% GST`,
        `${item.cgstRate}%`,
        `${item.sgstRate}%`,
        item.taxableAmount,
        item.cgstAmount,
        item.sgstAmount
      ];
      if (hasInterstate) row.push(item.igstAmount);
      row.push(item.totalGst, item.grandTotal, `${item.percentageOfTotal}%`);
      sheetData.push(row);
    });

    // Consolidated Total Row
    const totalRow = [
      'CONSOLIDATED TOTAL',
      '-',
      '-',
      reportTotals.totalTaxable,
      reportTotals.totalCgst,
      reportTotals.totalSgst
    ];
    if (hasInterstate) totalRow.push(reportTotals.totalIgst);
    totalRow.push(reportTotals.totalGst, reportTotals.grandTotal, '100%');
    sheetData.push(totalRow);

    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    ws['!cols'] = [
      { wch: 18 }, { wch: 15 }, { wch: 15 }, { wch: 22 }, { wch: 18 }, { wch: 18 },
      ...(hasInterstate ? [{ wch: 18 }] : []),
      { wch: 18 }, { wch: 22 }, { wch: 12 }
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'GST Rate Breakdown');

    const fileName = `Auditor_Report_${appliedFromDate || 'Start'}_to_${appliedToDate || 'End'}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  // 2. Export to CSV (.csv)
  const handleExportCSV = () => {
    if (gstRateBreakdown.length === 0) {
      alert(lang === 'ta' ? 'ஏற்றுமதி செய்ய எந்த விற்பனை பதிவுகளும் இல்லை.' : 'No sales records to export.');
      return;
    }

    const headers = [
      'GST Rate',
      'CGST Rate (%)',
      'SGST Rate (%)',
      'Taxable Value (INR)',
      'CGST Amount (INR)',
      'SGST Amount (INR)',
      ...(hasInterstate ? ['IGST Amount (INR)'] : []),
      'Total GST (INR)',
      'Grand Total (INR)',
      'Share (%)'
    ];

    const csvRows = [headers.join(',')];

    gstRateBreakdown.forEach(r => {
      const row = [
        `"${r.gstRate}% GST"`,
        `"${r.cgstRate}%"`,
        `"${r.sgstRate}%"`,
        r.taxableAmount,
        r.cgstAmount,
        r.sgstAmount
      ];
      if (hasInterstate) row.push(r.igstAmount);
      row.push(r.totalGst, r.grandTotal, `"${r.percentageOfTotal}%"`);
      csvRows.push(row.join(','));
    });

    const totalRow = [
      '"CONSOLIDATED TOTAL"',
      '"-"',
      '"-"',
      reportTotals.totalTaxable,
      reportTotals.totalCgst,
      reportTotals.totalSgst
    ];
    if (hasInterstate) totalRow.push(reportTotals.totalIgst);
    totalRow.push(reportTotals.totalGst, reportTotals.grandTotal, '"100%"');
    csvRows.push(totalRow.join(','));

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Auditor_GST_Report_${appliedFromDate || 'Start'}_to_${appliedToDate || 'End'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 3. Print Report
  const handlePrint = () => {
    window.print();
  };

  // 4. Download PDF
  const handleDownloadPDF = async () => {
    const element = document.getElementById('printable-auditor-report');
    if (!element) return;
    setIsExportingPdf(true);

    try {
      const html2pdfModule = await import('html2pdf.js');
      const html2pdf = html2pdfModule.default || html2pdfModule;

      const opt = {
        margin: [10, 10, 10, 10],
        filename: `Auditor_Report_${appliedFromDate || 'Start'}_to_${appliedToDate || 'End'}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, letterRendering: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
      };

      await html2pdf().set(opt).from(element).save();
    } catch (err) {
      console.error('PDF generation failed:', err);
      alert('PDF generation encountered an issue. You can use the Print button to Save as PDF.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        <p style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>⏳ {lang === 'ta' ? 'தணிக்கையாளர் அறிக்கை தரவு ஏற்றப்படுகிறது...' : 'Loading Auditor Sales & GST Data...'}</p>
        <p style={{ fontSize: '0.85rem' }}>Calculating Taxable Sales and CGST/SGST Breakdown...</p>
      </div>
    );
  }

  return (
    <div className="auditor-report-container" ref={reportContainerRef}>
      
      {/* ------------------------------------------------------------- */}
      {/* TOP BAR: DATE RANGE FILTER & EXPORT BUTTONS (Hidden in Print) */}
      {/* ------------------------------------------------------------- */}
      <div className="no-print" style={{
        background: 'rgba(255, 255, 255, 0.02)',
        border: '1px solid var(--border-color)',
        borderRadius: '12px',
        padding: '1.25rem',
        marginBottom: '1.5rem',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
      }}>
        {/* Title and Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span style={{ fontSize: '1.6rem' }}>📑</span>
              <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
                {lang === 'ta' ? 'தணிக்கையாளர் அறிக்கை (Auditor Report)' : 'Auditor Report'}
              </h2>
              <span style={{
                fontSize: '0.72rem',
                padding: '3px 8px',
                borderRadius: '20px',
                background: 'rgba(6, 182, 212, 0.15)',
                color: 'var(--accent-cyan)',
                border: '1px solid var(--accent-cyan)',
                fontWeight: 700
              }}>
                GST Rate-Wise Summary
              </span>
            </div>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Consolidated sales before tax and CGST / SGST split from <strong>Order Taking</strong> &amp; <strong>Vehicle Direct Sales</strong>
            </p>
          </div>

          {/* The 4 Export & Print Buttons */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleExportExcel}
              className="btn btn-secondary"
              style={{
                fontSize: '0.84rem',
                padding: '0.5rem 0.9rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                background: 'rgba(16, 185, 129, 0.15)',
                borderColor: 'var(--success)',
                color: 'var(--success)',
                fontWeight: 700,
                cursor: 'pointer'
              }}
              title="Download Excel Spreadsheet"
            >
              📊 {lang === 'ta' ? 'Excel ஏற்றுமதி' : 'Excel Export'}
            </button>

            <button
              type="button"
              onClick={handleExportCSV}
              className="btn btn-secondary"
              style={{
                fontSize: '0.84rem',
                padding: '0.5rem 0.9rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                color: 'var(--text-main)',
                fontWeight: 700,
                cursor: 'pointer'
              }}
              title="Download CSV"
            >
              📑 {lang === 'ta' ? 'CSV ஏற்றுமதி' : 'CSV Export'}
            </button>

            <button
              type="button"
              onClick={handleDownloadPDF}
              disabled={isExportingPdf}
              className="btn btn-secondary"
              style={{
                fontSize: '0.84rem',
                padding: '0.5rem 0.9rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                background: 'rgba(239, 68, 68, 0.12)',
                borderColor: 'var(--danger)',
                color: 'var(--danger)',
                fontWeight: 700,
                cursor: 'pointer'
              }}
              title="Download Statement as PDF"
            >
              📥 {isExportingPdf ? 'Exporting...' : (lang === 'ta' ? 'PDF பதிவிறக்கம்' : 'Download PDF')}
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="btn btn-primary"
              style={{
                fontSize: '0.84rem',
                padding: '0.5rem 1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontWeight: 800,
                cursor: 'pointer'
              }}
              title="Print Auditor Statement"
            >
              🖨️ {lang === 'ta' ? 'அச்சுப் பிரதி' : 'Print Report'}
            </button>
          </div>
        </div>

        {/* Date Range Selector */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '1rem',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.85rem',
          background: 'rgba(0, 0, 0, 0.2)',
          borderRadius: '8px',
          border: '1px solid rgba(255, 255, 255, 0.05)'
        }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                {lang === 'ta' ? 'ஆரம்ப தேதி:' : 'From Date:'}
              </label>
              <input
                type="date"
                className="form-input"
                style={{ fontSize: '0.82rem', padding: '0.35rem 0.6rem', width: '140px' }}
                value={fromDate}
                onChange={e => setFromDate(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                {lang === 'ta' ? 'முடிவு தேதி:' : 'To Date:'}
              </label>
              <input
                type="date"
                className="form-input"
                style={{ fontSize: '0.82rem', padding: '0.35rem 0.6rem', width: '140px' }}
                value={toDate}
                onChange={e => setToDate(e.target.value)}
              />
            </div>

            <button
              type="button"
              onClick={handleGenerateReport}
              className="btn btn-primary"
              style={{
                fontSize: '0.82rem',
                padding: '0.4rem 1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              ⚡ {lang === 'ta' ? 'அறிக்கை உருவாக்கு' : 'Generate Report'}
            </button>

            <button
              type="button"
              onClick={handleResetFilters}
              className="btn btn-secondary"
              style={{
                fontSize: '0.82rem',
                padding: '0.4rem 0.85rem',
                color: 'var(--text-muted)',
                cursor: 'pointer'
              }}
            >
              🔄 {lang === 'ta' ? 'வடிகட்டிகளை மீட்டமை' : 'Reset Filters'}
            </button>
          </div>

          {/* Quick Period Presets */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginRight: '0.2rem' }}>Quick:</span>
            {[
              { id: 'today', label: lang === 'ta' ? 'இன்று' : 'Today' },
              { id: 'yesterday', label: lang === 'ta' ? 'நேற்று' : 'Yesterday' },
              { id: 'last7', label: lang === 'ta' ? '7 நாட்கள்' : 'Last 7 Days' },
              { id: 'this_month', label: lang === 'ta' ? 'இந்த மாதம்' : 'This Month' },
              { id: 'last_month', label: lang === 'ta' ? 'கடந்த மாதம்' : 'Last Month' },
              { id: 'all', label: lang === 'ta' ? 'அனைத்தும்' : 'All Time' }
            ].map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleSetPreset(p.id)}
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-main)',
                  padding: '3px 8px',
                  borderRadius: '4px',
                  fontSize: '0.72rem',
                  cursor: 'pointer'
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* FORMAL PRINTABLE AUDITOR STATEMENT WRAPPER                    */}
      {/* ------------------------------------------------------------- */}
      <div id="printable-auditor-report" style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: '12px',
        padding: '1.5rem',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)'
      }}>

        {/* Company Header */}
        <div style={{
          borderBottom: '2px solid var(--accent-cyan)',
          paddingBottom: '1rem',
          marginBottom: '1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--text-main)', margin: '0 0 0.25rem 0', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {settings?.company_name || 'GSK Agency'}
            </h1>
            <p style={{ margin: '0 0 0.2rem 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {settings?.company_address || 'Cooldrinks Shop - Tindivanam'}
            </p>
            <div style={{ display: 'flex', gap: '1rem', fontSize: '0.82rem', color: 'var(--text-main)' }}>
              <span>GSTIN: <strong>{settings?.company_gst || '33CWRPK4071L1Z2'}</strong></span>
              <span>Phone: <strong>{settings?.company_phone || '9345463415'}</strong></span>
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{
              background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.15), rgba(59, 130, 246, 0.15))',
              border: '1px solid var(--accent-cyan)',
              padding: '0.4rem 0.85rem',
              borderRadius: '6px',
              display: 'inline-block',
              marginBottom: '0.35rem'
            }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--accent-cyan)', textTransform: 'uppercase' }}>
                AUDITOR SALES &amp; GST STATEMENT
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Period: <strong style={{ color: 'var(--text-main)' }}>{appliedFromDate || 'Beginning'}</strong> to <strong style={{ color: 'var(--text-main)' }}>{appliedToDate || 'Today'}</strong>
            </p>
            <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Generated: {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}
            </p>
          </div>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* GST RATE-WISE SUMMARY BREAKDOWN TABLE (EXACT USER REQUIREMENT) */}
        {/* ------------------------------------------------------------- */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)' }}>
              🏷️ {lang === 'ta' ? 'ஜிஎஸ்டி விகித சுருக்கம் (GST Rate-Wise Breakdown)' : 'GST Rate-Wise Summary Breakdown'}
            </h3>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Intra-state sales split equally between CGST (50%) and SGST (50%)
            </span>
          </div>

          <div style={{
            overflowX: 'auto',
            background: 'var(--bg-table-container)',
            borderRadius: '8px',
            border: '1px solid var(--border-color)'
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg-table-th)', borderBottom: '2px solid var(--border-color)', textAlign: 'right' }}>
                  <th style={{ padding: '0.75rem 0.85rem', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 700 }}>GST Rate (%)</th>
                  <th style={{ padding: '0.75rem 0.85rem', color: 'var(--text-muted)', fontWeight: 700 }}>CGST Rate (%)</th>
                  <th style={{ padding: '0.75rem 0.85rem', color: 'var(--text-muted)', fontWeight: 700 }}>SGST Rate (%)</th>
                  <th style={{ padding: '0.75rem 0.85rem', color: '#3b82f6', fontWeight: 800 }}>Taxable Value (₹)</th>
                  <th style={{ padding: '0.75rem 0.85rem', color: 'var(--accent-cyan)', fontWeight: 800 }}>CGST Amount (₹)</th>
                  <th style={{ padding: '0.75rem 0.85rem', color: 'var(--success)', fontWeight: 800 }}>SGST Amount (₹)</th>
                  {hasInterstate && (
                    <th style={{ padding: '0.75rem 0.85rem', color: 'var(--warning)', fontWeight: 800 }}>IGST Amount (₹)</th>
                  )}
                  <th style={{ padding: '0.75rem 0.85rem', color: '#f59e0b', fontWeight: 800 }}>Total GST (₹)</th>
                  <th style={{ padding: '0.75rem 0.85rem', color: 'var(--text-main)', fontWeight: 900 }}>Grand Total (₹)</th>
                  <th style={{ padding: '0.75rem 0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>% Share</th>
                </tr>
              </thead>
              <tbody>
                {gstRateBreakdown.length === 0 ? (
                  <tr>
                    <td colSpan={hasInterstate ? 10 : 9} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      {lang === 'ta' ? 'தேர்ந்தெடுக்கப்பட்ட காலத்திற்கு விற்பனை எதுவும் இல்லை' : 'No sales records found for the selected period.'}
                    </td>
                  </tr>
                ) : (
                  gstRateBreakdown.map((item, idx) => {
                    const isZero = item.gstRate === 0;
                    const isHigh = item.gstRate >= 28;
                    const badgeBg = isZero 
                      ? 'rgba(16, 185, 129, 0.12)' 
                      : isHigh 
                        ? 'rgba(239, 68, 68, 0.12)' 
                        : 'rgba(6, 182, 212, 0.12)';
                    const badgeColor = isZero 
                      ? 'var(--success)' 
                      : isHigh 
                        ? 'var(--danger)' 
                        : 'var(--accent-cyan)';

                    return (
                      <tr key={item.gstRate} style={{
                        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                        background: idx % 2 === 0 ? 'rgba(255, 255, 255, 0.015)' : 'transparent',
                        textAlign: 'right'
                      }}>
                        <td style={{ padding: '0.75rem 0.85rem', textAlign: 'left', fontWeight: 800, color: 'var(--text-main)' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '3px 9px',
                            borderRadius: '4px',
                            background: badgeBg,
                            color: badgeColor,
                            fontWeight: 800,
                            fontSize: '0.82rem'
                          }}>
                            {item.gstRate}% GST
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 0.85rem', color: 'var(--accent-cyan)', fontWeight: 700 }}>
                          {item.cgstRate}%
                        </td>
                        <td style={{ padding: '0.75rem 0.85rem', color: 'var(--success)', fontWeight: 700 }}>
                          {item.sgstRate}%
                        </td>
                        <td style={{ padding: '0.75rem 0.85rem', fontWeight: 800, color: '#3b82f6' }}>
                          ₹{item.taxableAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '0.75rem 0.85rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                          ₹{item.cgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '0.75rem 0.85rem', fontWeight: 700, color: 'var(--success)' }}>
                          ₹{item.sgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        {hasInterstate && (
                          <td style={{ padding: '0.75rem 0.85rem', fontWeight: 700, color: 'var(--warning)' }}>
                            ₹{item.igstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                        )}
                        <td style={{ padding: '0.75rem 0.85rem', fontWeight: 800, color: '#f59e0b' }}>
                          ₹{item.totalGst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '0.75rem 0.85rem', fontWeight: 900, color: 'var(--text-main)' }}>
                          ₹{item.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '0.75rem 0.85rem', color: 'var(--text-muted)' }}>
                          {item.percentageOfTotal}%
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {gstRateBreakdown.length > 0 && (
                <tfoot>
                  <tr style={{
                    background: 'var(--bg-table-th)',
                    borderTop: '2px solid var(--accent-cyan)',
                    borderBottom: '2px solid var(--accent-cyan)',
                    fontWeight: 900,
                    textAlign: 'right'
                  }}>
                    <td style={{ padding: '0.85rem', textAlign: 'left', textTransform: 'uppercase', color: 'var(--text-main)', letterSpacing: '0.04em' }}>
                      CONSOLIDATED TOTAL
                    </td>
                    <td style={{ padding: '0.85rem', color: 'var(--text-muted)' }}>-</td>
                    <td style={{ padding: '0.85rem', color: 'var(--text-muted)' }}>-</td>
                    <td style={{ padding: '0.85rem', color: '#3b82f6', fontSize: '0.92rem' }}>
                      ₹{reportTotals.totalTaxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '0.85rem', color: 'var(--accent-cyan)', fontSize: '0.92rem' }}>
                      ₹{reportTotals.totalCgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '0.85rem', color: 'var(--success)', fontSize: '0.92rem' }}>
                      ₹{reportTotals.totalSgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    {hasInterstate && (
                      <td style={{ padding: '0.85rem', color: 'var(--warning)', fontSize: '0.92rem' }}>
                        ₹{reportTotals.totalIgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    )}
                    <td style={{ padding: '0.85rem', color: '#f59e0b', fontSize: '0.95rem' }}>
                      ₹{reportTotals.totalGst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '0.85rem', color: 'var(--text-main)', fontSize: '1rem', fontWeight: 900 }}>
                      ₹{reportTotals.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '0.85rem', color: 'var(--text-muted)' }}>100%</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {/* Auditor Verification Note Footer */}
        <div style={{
          marginTop: '1.5rem',
          paddingTop: '1rem',
          borderTop: '1px dashed var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
          fontSize: '0.78rem',
          color: 'var(--text-muted)'
        }}>
          <div>
            <span>Verified Source Modules: <strong>Order Taking</strong> &amp; <strong>Vehicle Direct Sales</strong>.</span>
            <span style={{ marginLeft: '0.5rem' }}>Selling prices are tax-inclusive; taxable value reflects base sales before tax.</span>
          </div>
          <div>
            <span>Prepared for: <strong>Auditor / Tax Filing Verification</strong></span>
          </div>
        </div>

      </div>

    </div>
  );
}
