/**
 * repositories.js - Repository Layer
 *
 * The ONLY module allowed to call `fetch('/api/...')`. Pages call these
 * repositories; repositories check the Cache layer first and only hit the
 * backend API when the cache is empty or has been invalidated by a write.
 *
 *   UI -> Repository -> Cache -> /api/* (Vercel) -> Turso
 *
 * The browser never talks to Turso directly - the auth token lives only in
 * the serverless functions under /api, never in client-side code. This file
 * replaces the previous Firestore-backed implementation; every exported
 * function keeps the exact same name/signature/return shape so no page
 * controller (index.js, settings.js, supplier-*.js) needed any changes.
 *
 * Caching strategy (unchanged from the Firestore version):
 *   - suppliers / inspectors / comments: small, low-churn collections,
 *     cached whole and invalidated on any write to that collection.
 *   - parts: cached per-supplier (the only access pattern the app uses),
 *     invalidated on part writes/transfers and on supplier delete.
 *   - records: NOT cached whole (unbounded growth) - always queried scoped
 *     to what's actually displayed (by supplier, or latest-N for the
 *     Register page log), and the per-supplier result is cached briefly so
 *     switching tabs for the same supplier (History <-> Charts) doesn't
 *     re-hit the API.
 *
 * Every fetch() call below is wrapped in PerfStats.timeRead/timeWrite
 * (js/perf-stats.js) purely for observability (read/write counts, duration) -
 * it never alters control flow or return values.
 */

async function apiRequest(method, path, body) {
  const res = await fetch(path, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.error || `API request failed: ${method} ${path} (${res.status})`);
  }
  if (res.status === 204) return null;
  return res.json();
}

window.SupplierRepository = (function () {
  const CACHE_KEY = 'suppliers:all';

  return {
    async getAll() {
      return Cache.getOrLoad(CACHE_KEY, () => PerfStats.timeRead('suppliers.getAll', () => apiRequest('GET', '/api/suppliers')));
    },

    async getById(id) {
      const all = await this.getAll();
      const found = all.find(s => s.id === id);
      if (found) return found;
      // Fallback to a direct fetch in case the cache is stale relative to id (defensive only).
      try {
        return await PerfStats.timeRead(`suppliers.getById:${id}`, () => apiRequest('GET', `/api/suppliers?id=${encodeURIComponent(id)}`));
      } catch (err) {
        return null;
      }
    },

    async add(name) {
      const trimmedName = name.trim();
      const created = await PerfStats.timeWrite('suppliers.add', () => apiRequest('POST', '/api/suppliers', { name: trimmedName }));
      Cache.invalidate(CACHE_KEY);
      return created;
    },

    async rename(id, name) {
      const trimmedName = name.trim();
      await PerfStats.timeWrite(`suppliers.rename:${id}`, () => apiRequest('PUT', `/api/suppliers?id=${encodeURIComponent(id)}`, { name: trimmedName }));

      Cache.invalidate(CACHE_KEY);
      Cache.invalidate(`parts:bySupplier:${id}`);
      Cache.invalidate(`records:bySupplier:${id}`);

      return { id, name: trimmedName };
    },

    async remove(id) {
      await PerfStats.timeWrite(`suppliers.remove:${id}`, () => apiRequest('DELETE', `/api/suppliers?id=${encodeURIComponent(id)}`));

      Cache.invalidate(CACHE_KEY);
      Cache.invalidate(`parts:bySupplier:${id}`);
      Cache.invalidate(`records:bySupplier:${id}`);

      return true;
    }
  };
})();

window.PartRepository = (function () {
  return {
    /**
     * Used only by the Suppliers directory list to compute per-supplier part counts.
     * Cached whole since it's read on every directory render/search keystroke.
     */
    async getAll() {
      return Cache.getOrLoad('parts:all', () => PerfStats.timeRead('parts.getAll', () => apiRequest('GET', '/api/parts')));
    },

    async getBySupplier(supplierId) {
      const key = `parts:bySupplier:${supplierId}`;
      return Cache.getOrLoad(key, () =>
        PerfStats.timeRead(key, () => apiRequest('GET', `/api/parts?supplierId=${encodeURIComponent(supplierId)}`))
      );
    },

    async add(supplierId, detailId, detailName, supplierName) {
      const created = await PerfStats.timeWrite('parts.add', () => apiRequest('POST', '/api/parts', {
        supplierId,
        supplierName,
        detailId: detailId.trim().toUpperCase(),
        detailName: detailName.trim()
      }));
      Cache.invalidate('parts:all');
      Cache.invalidate(`parts:bySupplier:${supplierId}`);
      return created;
    },

    async update(id, supplierId, detailId, detailName) {
      const updated = await PerfStats.timeWrite(`parts.update:${id}`, () => apiRequest('PUT', `/api/parts?id=${encodeURIComponent(id)}`, {
        detailId: detailId.trim().toUpperCase(),
        detailName: detailName.trim()
      }));
      Cache.invalidate('parts:all');
      Cache.invalidate(`parts:bySupplier:${supplierId}`);
      return updated;
    },

    async remove(id, supplierId) {
      await PerfStats.timeWrite(`parts.remove:${id}`, () => apiRequest('DELETE', `/api/parts?id=${encodeURIComponent(id)}`));
      Cache.invalidate('parts:all');
      Cache.invalidate(`parts:bySupplier:${supplierId}`);
      return true;
    },

    async transfer(partId, sourceSupplierId, targetSupplierId, targetSupplierName) {
      const updated = await PerfStats.timeWrite(`parts.transfer:${partId}`, () => apiRequest('POST', '/api/parts?action=transfer', {
        partId,
        targetSupplierId,
        targetSupplierName
      }));
      Cache.invalidate('parts:all');
      Cache.invalidate(`parts:bySupplier:${sourceSupplierId}`);
      Cache.invalidate(`parts:bySupplier:${targetSupplierId}`);
      return updated;
    }
  };
})();

window.InspectorRepository = (function () {
  const CACHE_KEY = 'inspectors:all';

  return {
    async getAll() {
      return Cache.getOrLoad(CACHE_KEY, () => PerfStats.timeRead('inspectors.getAll', () => apiRequest('GET', '/api/inspectors')));
    },

    async getById(id) {
      const all = await this.getAll();
      return all.find(i => i.id === id) || null;
    },

    async add(fullName) {
      const trimmedName = fullName.trim();
      const created = await PerfStats.timeWrite('inspectors.add', () => apiRequest('POST', '/api/inspectors', { fullName: trimmedName }));
      Cache.invalidate(CACHE_KEY);
      return created;
    },

    async update(id, fullName) {
      const trimmedName = fullName.trim();
      const updated = await PerfStats.timeWrite(`inspectors.update:${id}`, () => apiRequest('PUT', `/api/inspectors?id=${encodeURIComponent(id)}`, { fullName: trimmedName }));
      Cache.invalidate(CACHE_KEY);
      return updated;
    },

    async remove(id) {
      await PerfStats.timeWrite(`inspectors.remove:${id}`, () => apiRequest('DELETE', `/api/inspectors?id=${encodeURIComponent(id)}`));
      Cache.invalidate(CACHE_KEY);
      return true;
    }
  };
})();

window.CommentRepository = (function () {
  const CACHE_KEY = 'comments:all';

  return {
    async getAll() {
      return Cache.getOrLoad(CACHE_KEY, () => PerfStats.timeRead('comments.getAll', () => apiRequest('GET', '/api/comments')));
    },

    async add(text) {
      const trimmedText = text.trim();
      const created = await PerfStats.timeWrite('comments.add', () => apiRequest('POST', '/api/comments', { text: trimmedText }));
      Cache.invalidate(CACHE_KEY);
      return created;
    },

    async update(id, text) {
      const trimmedText = text.trim();
      const updated = await PerfStats.timeWrite(`comments.update:${id}`, () => apiRequest('PUT', `/api/comments?id=${encodeURIComponent(id)}`, { text: trimmedText }));
      Cache.invalidate(CACHE_KEY);
      return updated;
    },

    async remove(id) {
      await PerfStats.timeWrite(`comments.remove:${id}`, () => apiRequest('DELETE', `/api/comments?id=${encodeURIComponent(id)}`));
      Cache.invalidate(CACHE_KEY);
      return true;
    }
  };
})();

window.ReceivingRepository = (function () {
  function invalidateForSupplier(supplierId) {
    Cache.invalidate(`records:bySupplier:${supplierId}`);
    Cache.invalidate('records:latest30');
    Cache.invalidate('records:distinctYears');
  }

  return {
    /**
     * Register page log: only the latest N records are ever displayed there,
     * so the API queries with ORDER BY date DESC LIMIT N instead of returning
     * the whole table. Cached because the page re-renders (sort/search)
     * without needing a fresh read each time.
     */
    async getLatest(count = 30) {
      return Cache.getOrLoad('records:latest30', () =>
        PerfStats.timeRead('records.getLatest', () => apiRequest('GET', `/api/records?latest=${count}`))
      );
    },

    /**
     * Returns the distinct calendar years present across ALL records, for the
     * Supplier Charts tab's year selector. Reads the small denormalized
     * meta_years table (maintained incrementally by the API on every record
     * write/import) instead of scanning the entire records table - this was
     * the single slowest query in the app before the meta_years table existed
     * (50+ seconds on this dataset under Firestore's full-collection scan).
     */
    async getDistinctYears() {
      return Cache.getOrLoad('records:distinctYears', () =>
        PerfStats.timeRead('records.getDistinctYears', () => apiRequest('GET', '/api/records-years'))
      );
    },

    /**
     * Supplier detail tabs (History + Charts) both need every record for one
     * supplier - queried directly scoped to supplierId, instead of returning
     * every supplier's records and filtering in JS. Cached per supplier so
     * switching between the History and Charts tabs for the same supplier
     * reuses the same read.
     */
    async getBySupplier(supplierId) {
      const key = `records:bySupplier:${supplierId}`;
      return Cache.getOrLoad(key, () =>
        PerfStats.timeRead(key, () => apiRequest('GET', `/api/records?supplierId=${encodeURIComponent(supplierId)}`))
      );
    },

    /**
     * `supplierName`/`inspectorName` are passed in by the caller (already known from
     * the form's selected <option> text) instead of being re-fetched from the API,
     * keeping the same 2-reads-saved optimization as the Firestore version.
     */
    async add(record) {
      const created = await PerfStats.timeWrite('records.add', () => apiRequest('POST', '/api/records', {
        date: record.date,
        fn: record.fn.trim(),
        supplierId: record.supplierId,
        supplierName: record.supplierName,
        detailId: record.detailId,
        detailName: record.detailName,
        quantity: Number(record.quantity),
        checkedQuantity: Number(record.checkedQuantity),
        returnedQuantity: Number(record.returnedQuantity),
        inspectorId: record.inspectorId,
        inspectorName: record.inspectorName,
        comment: record.comment.trim()
      }));
      invalidateForSupplier(record.supplierId);
      return created;
    },

    async update(id, record) {
      const updated = await PerfStats.timeWrite(`records.update:${id}`, () => apiRequest('PUT', `/api/records?id=${encodeURIComponent(id)}`, {
        date: record.date,
        fn: record.fn.trim(),
        supplierId: record.supplierId,
        supplierName: record.supplierName,
        detailId: record.detailId,
        detailName: record.detailName,
        quantity: Number(record.quantity),
        checkedQuantity: Number(record.checkedQuantity),
        returnedQuantity: Number(record.returnedQuantity),
        inspectorId: record.inspectorId,
        inspectorName: record.inspectorName,
        comment: record.comment.trim()
      }));
      invalidateForSupplier(record.supplierId);
      return updated;
    },

    async remove(id, supplierId) {
      await PerfStats.timeWrite(`records.remove:${id}`, () => apiRequest('DELETE', `/api/records?id=${encodeURIComponent(id)}`));
      invalidateForSupplier(supplierId);
      return true;
    },

    /**
     * Bulk CSV import: the browser still parses the CSV file itself (pure
     * client-side text processing, js/supplier-history.js parseCSV()), then
     * sends the parsed rows here in one request. The API resolves/creates
     * inspectors and parts and bulk-inserts all records server-side, instead
     * of the browser issuing many small batched writes directly to the DB.
     */
    async importRows(supplierId, supplierName, rows) {
      const result = await PerfStats.timeWrite('records.importRows', () => apiRequest('POST', '/api/records-import', {
        supplierId,
        supplierName,
        rows
      }));
      invalidateForSupplier(supplierId);
      return result;
    }
  };
})();
