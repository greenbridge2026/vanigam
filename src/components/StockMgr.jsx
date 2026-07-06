import React, { useState, useEffect } from 'react';
import api from '../api';

export default function StockMgr({ t, lang }) {
  const [products, setProducts] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [orderItems, setOrderItems] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [prodData, purchData, itemData, ledgerData] = await Promise.all([
          api.getProducts(),
          api.getPurchases(),
          api.getOrderItems(),
          api.getStockLedger()
        ]);
        setProducts(prodData);
        setPurchases(purchData);
        setOrderItems(itemData);
        setLedger(ledgerData);
      } catch (err) {
        console.error('Failed to load stock data', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const formatBottlesToCases = (totalBottles, caseRule) => {
    const cases = Math.floor(totalBottles / caseRule);
    const bottles = totalBottles % caseRule;
    return `${cases} C, ${bottles} B`;
  };

  if (loading) return <div style={{ color: 'var(--text-muted)', textAlign: 'center' }}>Loading Stock Ledger...</div>;

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>📊 {t('stock_ledger')}</h1>
        <p style={{ color: 'var(--text-muted)' }}>Monitor real-time product quantities, purchase lines, sales, and ledger transaction trails</p>
      </div>

      {/* Live Stock Summary */}
      <div className="glass-card">
        <h2 style={{ marginBottom: '1.25rem', fontSize: '1.25rem' }}>Live Stock Valuation (Cases, Bottles)</h2>
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Case Size</th>
                <th>{t('opening_stock')}</th>
                <th>{t('purchased_stock')}</th>
                <th>{t('sold_stock')}</th>
                <th>{t('available_stock')}</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {products.map(p => {
                const caseRule = p.case_qty_rule;
                
                // 1. Compute purchased stock in bottles
                const pPurchased = purchases
                  .filter(pr => pr.product_id === p.id)
                  .reduce((sum, pr) => sum + (pr.cases * caseRule + pr.bottles), 0);
                
                // 2. Compute sold stock in bottles
                const pSold = orderItems
                  .filter(oi => oi.product_id === p.id)
                  .reduce((sum, oi) => sum + (oi.cases * caseRule + oi.bottles), 0);
                
                // 3. Available stock is live stock
                const pAvailable = p.current_stock_bottles;

                // 4. Opening stock = Available - Purchased + Sold
                const pOpening = Math.max(0, pAvailable - pPurchased + pSold);

                const isOutOfStock = pAvailable === 0;
                const isLowStock = pAvailable <= p.min_stock;

                return (
                  <tr key={p.id}>
                    <td>
                      <div style={{ fontWeight: '700' }}>{lang === 'ta' ? p.name_ta : p.name_en}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.brand} | {p.size}</div>
                    </td>
                    <td><strong>{caseRule}</strong> Bottles/Case</td>
                    <td>{formatBottlesToCases(pOpening, caseRule)} ({pOpening} B)</td>
                    <td style={{ color: 'var(--accent-cyan)' }}>+{formatBottlesToCases(pPurchased, caseRule)} ({pPurchased} B)</td>
                    <td style={{ color: 'var(--warning)' }}>-{formatBottlesToCases(pSold, caseRule)} ({pSold} B)</td>
                    <td style={{
                      fontWeight: '800',
                      color: isOutOfStock ? 'var(--danger)' : isLowStock ? 'var(--warning)' : 'var(--success)'
                    }}>
                      {formatBottlesToCases(pAvailable, caseRule)} ({pAvailable} B)
                    </td>
                    <td>
                      {isOutOfStock ? (
                        <span style={{ fontSize: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--danger)' }}>
                          {t('out_of_stock')}
                        </span>
                      ) : isLowStock ? (
                        <span style={{ fontSize: '0.75rem', background: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning)', padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--warning)' }}>
                          {t('low_stock')}
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
      </div>

      {/* Stock Transaction Trail */}
      <div className="glass-card">
        <h2 style={{ marginBottom: '1.25rem', fontSize: '1.25rem' }}>Detailed Audit Ledger Logs</h2>
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>{t('timestamp')}</th>
                <th>Product</th>
                <th>{t('ledger_type')}</th>
                <th>Quantity Change</th>
                <th>{t('ledger_running')}</th>
              </tr>
            </thead>
            <tbody>
              {[...ledger].reverse().slice(0, 30).map(l => {
                const product = products.find(p => p.id === l.product_id);
                const pName = product ? (lang === 'ta' ? product.name_ta : product.name_en) : 'Unknown';
                const pSize = product ? product.size : '';
                const caseRule = product ? product.case_qty_rule : 24;

                let changeStr = '';
                const cases = Math.abs(l.cases_change || 0);
                const bottles = Math.abs(l.bottles_change || 0);
                if (cases > 0) changeStr += `${cases} C`;
                if (bottles > 0) changeStr += `${changeStr ? ', ' : ''}${bottles} B`;
                if (!changeStr) changeStr = '0';
                
                const isAddition = l.transaction_type === 'purchase' || l.transaction_type === 'opening' || l.transaction_type === 'refill';
                const prefix = isAddition ? '+' : '-';
                const color = isAddition ? 'var(--success)' : 'var(--danger)';

                return (
                  <tr key={l.id}>
                    <td>{new Date(l.timestamp).toLocaleString(lang === 'ta' ? 'ta-IN' : 'en-IN')}</td>
                    <td>{pName} <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>({pSize})</span></td>
                    <td>
                      <span style={{
                        textTransform: 'uppercase',
                        fontSize: '0.75rem',
                        fontWeight: '700',
                        color: l.transaction_type === 'sale' ? 'var(--warning)' : l.transaction_type === 'purchase' ? 'var(--accent-cyan)' : 'var(--text-muted)'
                      }}>
                        {l.transaction_type}
                      </span>
                    </td>
                    <td style={{ color, fontWeight: '700' }}>
                      {prefix}{changeStr}
                    </td>
                    <td><strong>{formatBottlesToCases(l.running_stock_bottles, caseRule)}</strong> ({l.running_stock_bottles} Bottles)</td>
                  </tr>
                );
              })}
              {ledger.length === 0 && (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                    Ledger logs are empty.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
