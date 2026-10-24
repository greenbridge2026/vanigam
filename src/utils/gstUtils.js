/**
 * Shared GST Utility for Vanigam ERP
 * Single Source of Truth for GST calculation, CGST/SGST splitting, and tax breakdown
 * across Order Taking, Vehicle Direct Sales, Billing, Invoices, Exports, and Reports.
 */

export function calculateItemGst({
  rawAmount = 0,
  grossTotal = 0,
  orderDiscount = 0,
  productGst = 0,
  customerGstin = '',
  companyGstin = '33CWRPK4071L1Z2'
}) {
  const lineGross = Number(rawAmount || 0);
  const totalGross = Number(grossTotal || 0);
  const discount = Number(orderDiscount || 0);
  
  // 1. Calculate proportionate discount on this item
  let itemDiscount = 0;
  let netInclusive = lineGross;
  if (totalGross > 0 && discount > 0) {
    itemDiscount = (lineGross / totalGross) * discount;
    netInclusive = Math.max(0, lineGross - itemDiscount);
  }

  const gstRate = Number(productGst || 0);

  // 2. Prices in Product Management are TAX-INCLUSIVE.
  // Extract taxable sale amount BEFORE tax:
  // Taxable = Net Inclusive / (1 + (gstRate / 100))
  let itemTaxable = 0;
  if (gstRate > 0) {
    itemTaxable = Number((netInclusive / (1 + (gstRate / 100))).toFixed(2));
  } else {
    itemTaxable = Number(netInclusive.toFixed(2));
  }

  // Total tax extracted from netInclusive
  const totalTaxCalculated = Number((netInclusive - itemTaxable).toFixed(2));

  // 3. Check state code: Intra-state vs Inter-state
  const companyState = (companyGstin || '33').trim().slice(0, 2);
  const custGst = (customerGstin || '').trim();
  const custState = custGst.length >= 2 ? custGst.slice(0, 2) : '';
  const isInterState = custState && /^\d{2}$/.test(custState) && custState !== companyState;

  let cgstRate = 0;
  let sgstRate = 0;
  let igstRate = 0;
  let cgstAmount = 0;
  let sgstAmount = 0;
  let igstAmount = 0;

  if (isInterState) {
    igstRate = gstRate;
    igstAmount = totalTaxCalculated;
  } else {
    cgstRate = gstRate / 2;
    sgstRate = gstRate / 2;
    cgstAmount = Number((totalTaxCalculated / 2).toFixed(2));
    sgstAmount = Number((totalTaxCalculated - cgstAmount).toFixed(2));
  }

  const totalGst = Number((cgstAmount + sgstAmount + igstAmount).toFixed(2));
  const grandTotal = Number((itemTaxable + totalGst).toFixed(2));

  return {
    lineGross,
    itemDiscount: Number(itemDiscount.toFixed(2)),
    taxableAmount: itemTaxable,
    gstRate,
    cgstRate,
    cgstAmount,
    sgstRate,
    sgstAmount,
    igstRate,
    igstAmount,
    totalGst,
    grandTotal,
    isInterState
  };
}

export function calculateOrderGstBreakdown({
  items = [],
  products = [],
  discount = 0,
  customerGstin = '',
  companyGstin = '33CWRPK4071L1Z2'
}) {
  // 1. Calculate Gross Total from items
  const evaluatedItems = items.map(item => {
    const prod = products.find(p => p.id === (item.product_id || item.productId));
    const caseRule = prod?.case_qty_rule || 24;
    const rate = Number(item.rate !== undefined ? item.rate : (item.price || 0));
    const cases = Number(item.cases || 0);
    const bottles = Number(item.bottles || 0);
    
    let rawAmount = 0;
    if (item.amount !== undefined && item.amount !== null) {
      rawAmount = Number(item.amount);
    } else if (item.subtotal !== undefined && item.subtotal !== null) {
      rawAmount = Number(item.subtotal);
    } else {
      rawAmount = (cases * rate) + (bottles * (rate / caseRule));
    }
    rawAmount = Math.round(rawAmount);

    return {
      ...item,
      product: prod,
      rate,
      cases,
      bottles,
      rawAmount,
      gstRate: Number(prod?.gst || 0)
    };
  });

  const grossTotal = evaluatedItems.reduce((sum, it) => sum + it.rawAmount, 0);
  const discountAmt = Math.min(grossTotal, Number(discount || 0));

  // 2. Calculate item-level GST breakdown
  const itemBreakdown = evaluatedItems.map(it => {
    const gstCalc = calculateItemGst({
      rawAmount: it.rawAmount,
      grossTotal,
      orderDiscount: discountAmt,
      productGst: it.gstRate,
      customerGstin,
      companyGstin
    });
    return {
      ...it,
      ...gstCalc
    };
  });

  // 3. Aggregate by GST Rate
  const rateMap = {};
  itemBreakdown.forEach(item => {
    const r = item.gstRate;
    if (!rateMap[r]) {
      rateMap[r] = {
        gstRate: r,
        cgstRate: item.cgstRate,
        sgstRate: item.sgstRate,
        igstRate: item.igstRate,
        taxableAmount: 0,
        cgstAmount: 0,
        sgstAmount: 0,
        igstAmount: 0,
        totalGst: 0,
        grandTotal: 0,
        itemCount: 0
      };
    }
    rateMap[r].taxableAmount += item.taxableAmount;
    rateMap[r].cgstAmount += item.cgstAmount;
    rateMap[r].sgstAmount += item.sgstAmount;
    rateMap[r].igstAmount += item.igstAmount;
    rateMap[r].totalGst += item.totalGst;
    rateMap[r].grandTotal += item.grandTotal;
    rateMap[r].itemCount += 1;
  });

  const rateBreakdown = Object.values(rateMap).map(r => ({
    ...r,
    taxableAmount: Number(r.taxableAmount.toFixed(2)),
    cgstAmount: Number(r.cgstAmount.toFixed(2)),
    sgstAmount: Number(r.sgstAmount.toFixed(2)),
    igstAmount: Number(r.igstAmount.toFixed(2)),
    totalGst: Number(r.totalGst.toFixed(2)),
    grandTotal: Number(r.grandTotal.toFixed(2))
  })).sort((a, b) => a.gstRate - b.gstRate);

  const taxableAmount = Number(itemBreakdown.reduce((sum, it) => sum + it.taxableAmount, 0).toFixed(2));
  const totalCgst = Number(itemBreakdown.reduce((sum, it) => sum + it.cgstAmount, 0).toFixed(2));
  const totalSgst = Number(itemBreakdown.reduce((sum, it) => sum + it.sgstAmount, 0).toFixed(2));
  const totalIgst = Number(itemBreakdown.reduce((sum, it) => sum + it.igstAmount, 0).toFixed(2));
  const totalGst = Number(itemBreakdown.reduce((sum, it) => sum + it.totalGst, 0).toFixed(2));
  const grandTotalIncGst = Number((taxableAmount + totalGst).toFixed(2));

  return {
    grossTotal,
    discount: discountAmt,
    taxableAmount,
    totalCgst,
    totalSgst,
    totalIgst,
    totalGst,
    grandTotalIncGst,
    items: itemBreakdown,
    rateBreakdown,
    isInterState: itemBreakdown.some(it => it.isInterState)
  };
}
