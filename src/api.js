import { db, isFirebaseConfigured } from './firebase';
import { doc, getDoc } from 'firebase/firestore';

const API_BASE = '/api';

// High-Speed In-Memory Client Cache for Instant Navigation
const clientCache = new Map();
const CACHE_TTL_MS = 60 * 1000; // 60 seconds fresh TTL

export function getCached(tableName) {
  const entry = clientCache.get(tableName);
  return entry ? entry.data : null;
}

export function setCached(tableName, data) {
  clientCache.set(tableName, { data, timestamp: Date.now() });
}

export function invalidateCache(tableNames) {
  if (!tableNames) {
    clientCache.clear();
    return;
  }
  const keys = Array.isArray(tableNames) ? tableNames : [tableNames];
  for (const k of keys) {
    clientCache.delete(k);
  }
}

function apiFetch(url, options = {}, targetTenantId = null) {
  const headers = { ...options.headers };
  const tenantId = targetTenantId || localStorage.getItem('tenantId') || 'GSK_AGENCY';
  headers['x-tenant-id'] = tenantId;
  
  const sessionStr = localStorage.getItem('session');
  if (sessionStr) {
    try {
      const session = JSON.parse(sessionStr);
      if (session && session.id) {
        headers['x-user-id'] = session.id;
      }
    } catch (e) {
      console.error('Failed to parse session in apiFetch:', e);
    }
  }

  return fetch(url, { ...options, headers });
}

// Robust response parser that reads body stream once as text and parses JSON safely
async function parseJsonResponse(res, defaultErrMsg = 'API Request Failed') {
  const text = await res.text();
  let parsed = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      // text is not valid JSON
    }
  }

  if (!res.ok) {
    const errorMsg = (parsed && (parsed.error || parsed.message)) || text || `${defaultErrMsg} (Status ${res.status})`;
    throw new Error(errorMsg);
  }

  return parsed;
}

// Helper to load table data: fast path from local backend with instant client caching
async function getTableData(tableName, fallbackUrl, targetTenantId = null, forceRefresh = false) {
  const tenantId = targetTenantId || localStorage.getItem('tenantId') || 'GSK_AGENCY';
  
  // Instant Cache Hit (< 1ms)
  if (!forceRefresh) {
    const cached = clientCache.get(tableName);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
      return cached.data;
    }
  }

  // Fast Path: Fetch from local Express backend (in-memory cached, < 5ms response)
  try {
    const res = await apiFetch(fallbackUrl, {}, tenantId);
    if (res.ok) {
      const data = await parseJsonResponse(res, `Failed to load ${tableName}`);
      clientCache.set(tableName, { data: data || [], timestamp: Date.now() });
      return data || [];
    }
  } catch (err) {
    // If local server unreachable, fall back to direct Firestore
  }

  // Fallback to direct Firestore if backend is offline
  if (isFirebaseConfigured && db) {
    try {
      const docRef = doc(db, 'tenants', tenantId, 'tables', tableName);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const docData = docSnap.data();
        let result = [];
        if (docData && docData.is_chunked) {
          const totalChunks = docData.total_chunks || 1;
          const chunkPromises = [];
          for (let i = 0; i < totalChunks; i++) {
            chunkPromises.push(getDoc(doc(db, 'tenants', tenantId, 'tables', `${tableName}__chunk_${i}`)));
          }
          const chunkSnaps = await Promise.all(chunkPromises);
          for (const cSnap of chunkSnaps) {
            if (cSnap.exists()) {
              result.push(...(cSnap.data()?.data || []));
            }
          }
        } else {
          result = docData?.data || [];
        }
        clientCache.set(tableName, { data: result, timestamp: Date.now() });
        return result;
      }
      return [];
    } catch (err) {
      console.warn(`Firestore read failed for "${tableName}":`, err);
    }
  }

  const fallback = clientCache.get(tableName);
  return fallback ? fallback.data : [];
}

export const api = {
  getCached,
  setCached,
  invalidateCache,

  // Preload all core tables on app start so all pages render instantly
  async preloadCoreTables() {
    try {
      await Promise.allSettled([
        getTableData('routes', `${API_BASE}/routes`),
        getTableData('shops', `${API_BASE}/shops`),
        getTableData('products', `${API_BASE}/products`),
        getTableData('orders', `${API_BASE}/orders`),
        getTableData('order_items', `${API_BASE}/orders/items`),
        getTableData('deliveries', `${API_BASE}/deliveries`),
        getTableData('payments', `${API_BASE}/payments`),
        getTableData('settings', `${API_BASE}/settings`)
      ]);
    } catch (e) {
      console.warn('Preload notice:', e);
    }
  },

  // Auth
  async login(tenantId, username, password) {
    localStorage.setItem('tenantId', tenantId);
    clientCache.clear();
    const res = await apiFetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId, username, password })
    });
    return parseJsonResponse(res, 'Login failed');
  },

  // System / Super Admin
  async getTenants() {
    const res = await apiFetch(`${API_BASE}/system/tenants`);
    return parseJsonResponse(res, 'Failed to fetch tenants');
  },
  async createTenant(tenantData) {
    const res = await apiFetch(`${API_BASE}/system/tenants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tenantData)
    });
    return parseJsonResponse(res, 'Failed to create tenant');
  },
  async updateTenantStatus(id, active) {
    const res = await apiFetch(`${API_BASE}/system/tenants/${id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active })
    });
    return parseJsonResponse(res, 'Failed to update tenant status');
  },
  async deleteTenant(id) {
    const res = await apiFetch(`${API_BASE}/system/tenants/${id}`, {
      method: 'DELETE'
    });
    return parseJsonResponse(res, 'Failed to delete tenant');
  },

  async getUsers(targetTenantId = null) {
    return getTableData('users', `${API_BASE}/users`, targetTenantId);
  },

  // Routes
  async getRoutes() {
    return getTableData('routes', `${API_BASE}/routes`);
  },
  async createRoute(routeData) {
    const res = await apiFetch(`${API_BASE}/routes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(routeData)
    });
    const added = await parseJsonResponse(res, 'Failed to create route');
    invalidateCache('routes');
    return added;
  },
  async updateRoute(id, routeData) {
    const res = await apiFetch(`${API_BASE}/routes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(routeData)
    });
    const updated = await parseJsonResponse(res, 'Failed to update route');
    invalidateCache('routes');
    return updated;
  },
  async deleteRoute(id) {
    const res = await apiFetch(`${API_BASE}/routes/${id}`, {
      method: 'DELETE'
    });
    const result = await parseJsonResponse(res, 'Failed to delete route');
    invalidateCache('routes');
    return result;
  },
  async bulkDeleteRoutes(ids) {
    const res = await apiFetch(`${API_BASE}/routes/bulk-delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids })
    });
    const result = await parseJsonResponse(res, 'Failed to bulk delete routes');
    invalidateCache('routes');
    return result;
  },
  async importRoutes(routesList) {
    const res = await apiFetch(`${API_BASE}/routes/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(routesList)
    });
    const result = await parseJsonResponse(res, 'Failed to import routes');
    invalidateCache('routes');
    return result;
  },

  // Shops
  async getShops() {
    return getTableData('shops', `${API_BASE}/shops`);
  },
  async createShop(shopData) {
    const res = await apiFetch(`${API_BASE}/shops`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(shopData)
    });
    const added = await parseJsonResponse(res, 'Failed to create shop');
    invalidateCache('shops');
    return added;
  },
  async updateShop(id, shopData) {
    const res = await apiFetch(`${API_BASE}/shops/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(shopData)
    });
    const updated = await parseJsonResponse(res, 'Failed to update shop');
    invalidateCache('shops');
    return updated;
  },
  async importShops(shopsList) {
    const res = await apiFetch(`${API_BASE}/shops/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(shopsList)
    });
    const result = await parseJsonResponse(res, 'Failed to import shops');
    invalidateCache('shops');
    return result;
  },

  // Products
  async getProducts() {
    return getTableData('products', `${API_BASE}/products`);
  },
  async createProduct(productData) {
    const res = await apiFetch(`${API_BASE}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(productData)
    });
    const added = await parseJsonResponse(res, 'Failed to create product');
    invalidateCache(['products', 'stock_ledger']);
    return added;
  },
  async updateProduct(id, productData) {
    const res = await apiFetch(`${API_BASE}/products/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(productData)
    });
    const updated = await parseJsonResponse(res, 'Failed to update product');
    invalidateCache(['products', 'stock_ledger']);
    return updated;
  },
  async importProducts(productsList) {
    const res = await apiFetch(`${API_BASE}/products/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(productsList)
    });
    const result = await parseJsonResponse(res, 'Failed to import products');
    invalidateCache(['products', 'stock_ledger']);
    return result;
  },
  async adjustProductStock(id, payload) {
    const res = await apiFetch(`${API_BASE}/stock/adjust`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_id: id, ...payload })
    });
    const result = await parseJsonResponse(res, 'Failed to adjust stock');
    invalidateCache(['products', 'stock_ledger']);
    return result;
  },

  // Purchases
  async getPurchases() {
    return getTableData('purchases', `${API_BASE}/purchases`);
  },
  async createPurchase(purchaseData) {
    const res = await apiFetch(`${API_BASE}/purchases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(purchaseData)
    });
    const added = await parseJsonResponse(res, 'Failed to record purchase');
    invalidateCache(['purchases', 'products', 'stock_ledger']);
    return added;
  },
  async updatePurchase(id, purchaseData) {
    const res = await apiFetch(`${API_BASE}/purchases/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(purchaseData)
    });
    const updated = await parseJsonResponse(res, 'Failed to update purchase entry');
    invalidateCache(['purchases', 'products', 'stock_ledger']);
    return updated;
  },

  // Stock Ledger
  async getStockLedger() {
    return getTableData('stock_ledger', `${API_BASE}/stock/ledger`);
  },

  // Orders
  async getOrders() {
    const orders = await getTableData('orders', `${API_BASE}/orders`);
    if (orders && orders.length > 0) {
      orders.sort((a, b) => {
        const dateA = a.order_date ? new Date(a.order_date).getTime() : 0;
        const dateB = b.order_date ? new Date(b.order_date).getTime() : 0;
        if (dateA !== dateB) return dateA - dateB;
        return (a.id || '').localeCompare(b.id || '');
      });
    }
    return orders || [];
  },
  async getOrderItems() {
    return getTableData('order_items', `${API_BASE}/orders/items`);
  },
  async getOrder(id) {
    try {
      const res = await apiFetch(`${API_BASE}/orders/${id}`);
      if (res.ok) {
        return await parseJsonResponse(res, 'Failed to fetch order');
      }
    } catch (e) {
      console.warn('Direct getOrder fetch failed:', e);
    }
    return null;
  },
  async createOrder(orderData) {
    const res = await apiFetch(`${API_BASE}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderData)
    });
    const result = await parseJsonResponse(res, 'Failed to place order');
    
    // Instantly update client cache with updated products so stocks reflect in 0ms
    if (result && result.products) {
      setCached('products', result.products);
    }
    // Instantly populate new order & items in client cache so Billing loads in 0ms
    if (result && result.order) {
      const cachedOrders = getCached('orders');
      if (cachedOrders && Array.isArray(cachedOrders)) {
        setCached('orders', [result.order, ...cachedOrders.filter(o => o.id !== result.order.id)]);
      }
    }
    if (result && result.items) {
      const cachedItems = getCached('order_items');
      if (cachedItems && Array.isArray(cachedItems)) {
        setCached('order_items', [...result.items, ...cachedItems.filter(i => i.order_id !== result.order.id)]);
      }
    }

    invalidateCache(['deliveries', 'shops', 'stock_ledger', 'notifications', 'outstanding_history']);
    return result;
  },
  async updateOrder(id, orderData) {
    const res = await apiFetch(`${API_BASE}/orders/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderData)
    });
    const result = await parseJsonResponse(res, 'Failed to update order/invoice');
    invalidateCache(['orders', 'order_items', 'products', 'deliveries', 'shops', 'stock_ledger', 'outstanding_history']);
    return result;
  },

  // Deliveries
  async getDeliveries() {
    return getTableData('deliveries', `${API_BASE}/deliveries`);
  },
  async completeDelivery(id, payload) {
    const res = await apiFetch(`${API_BASE}/deliveries/${id}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await parseJsonResponse(res, 'Failed to complete delivery');
    invalidateCache(['deliveries', 'orders', 'shops', 'payments', 'outstanding_history', 'stock_ledger']);
    return result;
  },
  async getDeliveryAuditTrail() {
    return getTableData('delivery_audit_trail', `${API_BASE}/delivery-audit-trail`);
  },
  async getSettings() {
    return getTableData('settings', `${API_BASE}/settings`);
  },
  async updateSettings(settings) {
    const res = await apiFetch(`${API_BASE}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
    const updated = await parseJsonResponse(res, 'Failed to update settings');
    invalidateCache('settings');
    return updated;
  },

  // Payments & Collections
  async getPayments() {
    return getTableData('payments', `${API_BASE}/payments`);
  },
  async createPayment(paymentData) {
    const res = await apiFetch(`${API_BASE}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(paymentData)
    });
    const result = await parseJsonResponse(res, 'Failed to register payment');
    invalidateCache(['payments', 'shops', 'orders', 'outstanding_history']);
    return result;
  },
  async getOutstandingHistory() {
    return getTableData('outstanding_history', `${API_BASE}/outstanding/history`);
  },

  // Notifications
  async getNotifications() {
    return getTableData('notifications', `${API_BASE}/notifications`);
  },
  async markNotificationsRead() {
    const res = await apiFetch(`${API_BASE}/notifications/mark-read`, {
      method: 'POST'
    });
    const result = await parseJsonResponse(res, 'Failed to mark notifications read');
    invalidateCache('notifications');
    return result;
  },

  // Reports
  async getReportSummary() {
    const res = await apiFetch(`${API_BASE}/reports/summary`);
    return parseJsonResponse(res, 'Failed to fetch report summary');
  },

  // Deletions
  async deleteShop(id) {
    const res = await apiFetch(`${API_BASE}/shops/${id}`, {
      method: 'DELETE'
    });
    const result = await parseJsonResponse(res, 'Failed to delete shop');
    invalidateCache(['shops', 'recycle_bin']);
    return result;
  },
  async bulkDeleteShops(ids, force = false) {
    const res = await apiFetch(`${API_BASE}/shops/bulk-delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, force })
    });
    const result = await parseJsonResponse(res, 'Failed to bulk delete shops');
    invalidateCache(['shops', 'recycle_bin']);
    return result;
  },
  async deleteProduct(id) {
    const res = await apiFetch(`${API_BASE}/products/${id}`, {
      method: 'DELETE'
    });
    const result = await parseJsonResponse(res, 'Failed to delete product');
    invalidateCache(['products', 'stock_ledger', 'recycle_bin']);
    return result;
  },
  async bulkDeleteProducts(ids) {
    const res = await apiFetch(`${API_BASE}/products/bulk-delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids })
    });
    const result = await parseJsonResponse(res, 'Failed to bulk delete products');
    invalidateCache(['products', 'stock_ledger', 'recycle_bin']);
    return result;
  },
  async deletePurchase(id) {
    const res = await apiFetch(`${API_BASE}/purchases/${id}`, {
      method: 'DELETE'
    });
    const result = await parseJsonResponse(res, 'Failed to delete purchase');
    invalidateCache(['purchases', 'products', 'stock_ledger', 'recycle_bin']);
    return result;
  },
  async deleteOrder(id) {
    const res = await apiFetch(`${API_BASE}/orders/${id}`, {
      method: 'DELETE'
    });
    const result = await parseJsonResponse(res, 'Failed to cancel/delete order');
    invalidateCache(['orders', 'order_items', 'deliveries', 'shops', 'products', 'stock_ledger', 'recycle_bin']);
    return result;
  },

  // User Access Management
  async createUser(userData, targetTenantId = null) {
    const res = await apiFetch(`${API_BASE}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    }, targetTenantId);
    const added = await parseJsonResponse(res, 'Failed to create user access');
    invalidateCache('users');
    return added;
  },
  async updateUser(id, userData, targetTenantId = null) {
    const res = await apiFetch(`${API_BASE}/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    }, targetTenantId);
    const updated = await parseJsonResponse(res, 'Failed to update user access');
    invalidateCache('users');
    return updated;
  },
  async deleteUser(id, targetTenantId = null) {
    const res = await apiFetch(`${API_BASE}/users/${id}`, {
      method: 'DELETE'
    }, targetTenantId);
    const result = await parseJsonResponse(res, 'Failed to delete user access');
    invalidateCache('users');
    return result;
  },

  // Recycle Bin
  async getRecycleBin() {
    return getTableData('recycle_bin', `${API_BASE}/recycle-bin`);
  },
  async restoreRecycleBinItem(id) {
    const res = await apiFetch(`${API_BASE}/recycle-bin/${id}/restore`, {
      method: 'POST'
    });
    const result = await parseJsonResponse(res, 'Failed to restore item');
    invalidateCache(); // Restore affects multiple tables
    return result;
  },
  async purgeRecycleBinItem(id) {
    const res = await apiFetch(`${API_BASE}/recycle-bin/${id}`, {
      method: 'DELETE'
    });
    const result = await parseJsonResponse(res, 'Failed to purge item');
    invalidateCache('recycle_bin');
    return result;
  },

  // Vehicles
  async getVehicles() {
    return getTableData('vehicles', `${API_BASE}/vehicles`);
  },
  async createVehicle(vehicleData) {
    const res = await apiFetch(`${API_BASE}/vehicles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(vehicleData)
    });
    const result = await parseJsonResponse(res, 'Failed to create vehicle');
    invalidateCache('vehicles');
    return result;
  },
  async updateVehicle(id, vehicleData) {
    const res = await apiFetch(`${API_BASE}/vehicles/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(vehicleData)
    });
    const result = await parseJsonResponse(res, 'Failed to update vehicle');
    invalidateCache('vehicles');
    return result;
  },
  async deleteVehicle(id) {
    const res = await apiFetch(`${API_BASE}/vehicles/${id}`, {
      method: 'DELETE'
    });
    const result = await parseJsonResponse(res, 'Failed to delete vehicle');
    invalidateCache('vehicles');
    return result;
  },
  async getVehicleStock() {
    return getTableData('vehicle_stock', `${API_BASE}/vehicles/stock`);
  },
  async getVehicleDispatches() {
    return getTableData('vehicle_dispatches', `${API_BASE}/vehicles/dispatches`);
  },
  async updateVehicleDispatch(id, dispatchData) {
    const res = await apiFetch(`${API_BASE}/vehicles/dispatches/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dispatchData)
    });
    const result = await parseJsonResponse(res, 'Failed to update vehicle dispatch');
    invalidateCache(['vehicle_dispatches', 'vehicle_stock']);
    return result;
  },
  async dispatchVehicleStock(dispatchData) {
    const res = await apiFetch(`${API_BASE}/vehicles/dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dispatchData)
    });
    const result = await parseJsonResponse(res, 'Failed to dispatch vehicle stock');
    invalidateCache(['vehicle_stock', 'vehicle_dispatches', 'products', 'stock_ledger']);
    return result;
  },
  async getVehicleSales() {
    return getTableData('vehicle_sales', `${API_BASE}/vehicles/sales`);
  },
  async createVehicleSale(saleData) {
    const res = await apiFetch(`${API_BASE}/vehicles/sales`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(saleData)
    });
    const result = await parseJsonResponse(res, 'Failed to record direct sale');
    invalidateCache(['vehicle_sales', 'vehicle_stock', 'shops', 'payments', 'orders']);
    return result;
  },
  async getVehicleReconciliations() {
    return getTableData('vehicle_reconciliations', `${API_BASE}/vehicles/reconciliations`);
  },
  async reconcileVehicleStock(reconcileData) {
    const res = await apiFetch(`${API_BASE}/vehicles/reconcile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reconcileData)
    });
    const result = await parseJsonResponse(res, 'Failed to reconcile vehicle stock');
    invalidateCache(['vehicle_reconciliations', 'vehicle_stock', 'products', 'stock_ledger']);
    return result;
  },

  async translate(text, from, to) {
    const res = await apiFetch(`${API_BASE}/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, from, to })
    });
    const data = await parseJsonResponse(res, 'Failed to translate');
    return data ? data.translatedText : '';
  },

  // Rough Bills
  async getRoughBills() {
    try {
      const res = await apiFetch(`${API_BASE}/rough-bills`);
      if (res.ok) {
        return await parseJsonResponse(res, 'Failed to fetch rough bills');
      }
    } catch (e) {
      console.warn('Backend rough bills fetch failed, using local storage fallback', e);
    }
    const local = localStorage.getItem('rough_bills');
    return local ? JSON.parse(local) : [];
  },
  async saveRoughBill(bill) {
    try {
      const res = await apiFetch(`${API_BASE}/rough-bills`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bill)
      });
      if (res.ok) {
        const saved = await parseJsonResponse(res, 'Failed to save rough bill');
        const local = JSON.parse(localStorage.getItem('rough_bills') || '[]');
        local.unshift(saved);
        localStorage.setItem('rough_bills', JSON.stringify(local.slice(0, 200)));
        return saved;
      }
    } catch (e) {
      console.warn('Backend rough bill save failed, saving to local storage', e);
    }
    const local = JSON.parse(localStorage.getItem('rough_bills') || '[]');
    const newBill = { ...bill, id: bill.id || `rb_${Date.now()}` };
    local.unshift(newBill);
    localStorage.setItem('rough_bills', JSON.stringify(local.slice(0, 200)));
    return newBill;
  },
  async deleteRoughBill(id) {
    try {
      await apiFetch(`${API_BASE}/rough-bills/${id}`, { method: 'DELETE' });
    } catch (e) {}
    const local = JSON.parse(localStorage.getItem('rough_bills') || '[]');
    const filtered = local.filter(b => b.id !== id);
    localStorage.setItem('rough_bills', JSON.stringify(filtered));
    return { success: true };
  }
};

export default api;
