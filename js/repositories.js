/**
 * repositories.js - Repository Layer
 *
 * The ONLY module allowed to call `db.collection(...)`. Pages call these
 * repositories; repositories check the Cache layer first and only hit
 * Firestore when the cache is empty or has been invalidated by a write.
 *
 *   UI -> Repository -> Cache -> Firestore
 *
 * Caching strategy:
 *   - suppliers / inspectors / comments: small, low-churn collections,
 *     cached whole and invalidated on any write to that collection.
 *   - parts: cached per-supplier (the only access pattern the app uses),
 *     invalidated on part writes/transfers and on supplier delete.
 *   - records: NOT cached whole (unbounded growth) - always queried scoped
 *     to what's actually displayed (by supplier, or latest-N for the
 *     Register page log) using Firestore where()/orderBy()/limit(), and the
 *     per-supplier result is cached briefly so switching tabs for the same
 *     supplier (History <-> Charts) doesn't re-read Firestore.
 */

window.SupplierRepository = (function () {
  const CACHE_KEY = 'suppliers:all';

  function snapToList(snap) {
    const list = [];
    snap.forEach(d => list.push({ id: d.id, ...d.data() }));
    return list;
  }

  return {
    async getAll() {
      return Cache.getOrLoad(CACHE_KEY, async () => snapToList(await db.collection('suppliers').get()));
    },

    async getById(id) {
      const all = await this.getAll();
      const found = all.find(s => s.id === id);
      if (found) return found;
      // Fallback to a direct doc read in case the cache is stale relative to id (defensive only).
      const snap = await db.collection('suppliers').doc(id).get();
      return snap.exists ? { id: snap.id, ...snap.data() } : null;
    },

    async add(name) {
      const docRef = await db.collection('suppliers').add({
        name: name.trim(),
        createdAt: new Date().toISOString()
      });
      Cache.invalidate(CACHE_KEY);
      return { id: docRef.id, name: name.trim() };
    },

    async rename(id, name) {
      const trimmedName = name.trim();
      const batch = db.batch();

      batch.update(db.collection('suppliers').doc(id), { name: trimmedName });

      // Cascade the new name into denormalized copies on parts + records,
      // batched into a single network round trip instead of N sequential writes.
      const [partsSnap, recordsSnap] = await Promise.all([
        db.collection('parts').where('supplierId', '==', id).get(),
        db.collection('records').where('supplierId', '==', id).get()
      ]);
      partsSnap.forEach(doc => batch.update(doc.ref, { supplierName: trimmedName }));
      recordsSnap.forEach(doc => batch.update(doc.ref, { supplierName: trimmedName }));

      await batch.commit();

      Cache.invalidate(CACHE_KEY);
      Cache.invalidate(`parts:bySupplier:${id}`);
      Cache.invalidate(`records:bySupplier:${id}`);

      return { id, name: trimmedName };
    },

    async remove(id) {
      const batch = db.batch();
      batch.delete(db.collection('suppliers').doc(id));

      const partsSnap = await db.collection('parts').where('supplierId', '==', id).get();
      partsSnap.forEach(doc => batch.delete(doc.ref));

      await batch.commit();

      Cache.invalidate(CACHE_KEY);
      Cache.invalidate(`parts:bySupplier:${id}`);
      Cache.invalidate(`records:bySupplier:${id}`);

      return true;
    }
  };
})();

window.PartRepository = (function () {
  function snapToList(snap) {
    const list = [];
    snap.forEach(d => list.push({ id: d.id, ...d.data() }));
    return list;
  }

  return {
    /**
     * Used only by the Suppliers directory list to compute per-supplier part counts.
     * Cached whole since it's read on every directory render/search keystroke.
     */
    async getAll() {
      return Cache.getOrLoad('parts:all', async () => snapToList(await db.collection('parts').get()));
    },

    async getBySupplier(supplierId) {
      const key = `parts:bySupplier:${supplierId}`;
      return Cache.getOrLoad(key, async () =>
        snapToList(await db.collection('parts').where('supplierId', '==', supplierId).get())
      );
    },

    async add(supplierId, detailId, detailName, supplierName) {
      const docRef = await db.collection('parts').add({
        supplierId,
        supplierName,
        detailId: detailId.trim().toUpperCase(),
        detailName: detailName.trim(),
        createdAt: new Date().toISOString()
      });
      Cache.invalidate('parts:all');
      Cache.invalidate(`parts:bySupplier:${supplierId}`);
      return { id: docRef.id, supplierId, supplierName, detailId, detailName };
    },

    async update(id, supplierId, detailId, detailName) {
      await db.collection('parts').doc(id).update({
        detailId: detailId.trim().toUpperCase(),
        detailName: detailName.trim()
      });
      Cache.invalidate('parts:all');
      Cache.invalidate(`parts:bySupplier:${supplierId}`);
      return { id, detailId, detailName };
    },

    async remove(id, supplierId) {
      await db.collection('parts').doc(id).delete();
      Cache.invalidate('parts:all');
      Cache.invalidate(`parts:bySupplier:${supplierId}`);
      return true;
    },

    async transfer(partId, sourceSupplierId, targetSupplierId, targetSupplierName) {
      await db.collection('parts').doc(partId).update({
        supplierId: targetSupplierId,
        supplierName: targetSupplierName
      });
      Cache.invalidate('parts:all');
      Cache.invalidate(`parts:bySupplier:${sourceSupplierId}`);
      Cache.invalidate(`parts:bySupplier:${targetSupplierId}`);
      return { id: partId, supplierId: targetSupplierId, supplierName: targetSupplierName };
    }
  };
})();

window.InspectorRepository = (function () {
  const CACHE_KEY = 'inspectors:all';

  function snapToList(snap) {
    const list = [];
    snap.forEach(d => list.push({ id: d.id, ...d.data() }));
    return list;
  }

  return {
    async getAll() {
      return Cache.getOrLoad(CACHE_KEY, async () => snapToList(await db.collection('inspectors').get()));
    },

    async getById(id) {
      const all = await this.getAll();
      return all.find(i => i.id === id) || null;
    },

    async add(fullName) {
      const docRef = await db.collection('inspectors').add({ fullName: fullName.trim() });
      Cache.invalidate(CACHE_KEY);
      return { id: docRef.id, fullName: fullName.trim() };
    },

    async update(id, fullName) {
      await db.collection('inspectors').doc(id).update({ fullName: fullName.trim() });
      Cache.invalidate(CACHE_KEY);
      return { id, fullName: fullName.trim() };
    },

    async remove(id) {
      await db.collection('inspectors').doc(id).delete();
      Cache.invalidate(CACHE_KEY);
      return true;
    }
  };
})();

window.CommentRepository = (function () {
  const CACHE_KEY = 'comments:all';

  function snapToList(snap) {
    const list = [];
    snap.forEach(d => list.push({ id: d.id, ...d.data() }));
    return list;
  }

  return {
    async getAll() {
      return Cache.getOrLoad(CACHE_KEY, async () => snapToList(await db.collection('comments').get()));
    },

    async add(text) {
      const docRef = await db.collection('comments').add({ text: text.trim() });
      Cache.invalidate(CACHE_KEY);
      return { id: docRef.id, text: text.trim() };
    },

    async update(id, text) {
      await db.collection('comments').doc(id).update({ text: text.trim() });
      Cache.invalidate(CACHE_KEY);
      return { id, text: text.trim() };
    },

    async remove(id) {
      await db.collection('comments').doc(id).delete();
      Cache.invalidate(CACHE_KEY);
      return true;
    }
  };
})();

window.ReceivingRepository = (function () {
  function snapToList(snap) {
    const list = [];
    snap.forEach(d => list.push({ id: d.id, ...d.data() }));
    return list;
  }

  function invalidateForSupplier(supplierId) {
    Cache.invalidate(`records:bySupplier:${supplierId}`);
    Cache.invalidate('records:latest30');
    Cache.invalidate('records:distinctYears');
  }

  return {
    /**
     * Register page log: only the latest N records are ever displayed there,
     * so query Firestore with orderBy+limit instead of downloading the whole
     * collection and slicing client-side. Cached because the page re-renders
     * (sort/search) without needing a fresh read each time.
     */
    async getLatest(count = 30) {
      return Cache.getOrLoad('records:latest30', async () =>
        snapToList(await db.collection('records').orderBy('date', 'desc').limit(count).get())
      );
    },

    /**
     * Returns the distinct calendar years present across ALL records, for the
     * Supplier Charts tab's year selector. Firestore has no DISTINCT/groupBy,
     * so this is the one place that still legitimately needs every record's
     * `date` field - but it is cached (read once per page session, not once
     * per chart render) and only requests the single field it needs via a
     * lightweight projection-free query (Firestore compat has no field
     * projection, so this remains a full-document read, same cost as before
     * but now incurred once instead of on every tab switch).
     */
    async getDistinctYears() {
      return Cache.getOrLoad('records:distinctYears', async () => {
        const snap = await db.collection('records').get();
        const years = new Set();
        snap.forEach(d => {
          const date = d.data().date;
          if (date) {
            const yr = new Date(date).getFullYear();
            if (!isNaN(yr)) years.add(yr);
          }
        });
        return Array.from(years);
      });
    },

    /**
     * Supplier detail tabs (History + Charts) both need every record for one
     * supplier - queried directly via where(), instead of downloading the
     * entire records collection and filtering in JS. Cached per supplier so
     * switching between the History and Charts tabs for the same supplier
     * reuses the same read.
     */
    async getBySupplier(supplierId) {
      const key = `records:bySupplier:${supplierId}`;
      return Cache.getOrLoad(key, async () =>
        snapToList(await db.collection('records').where('supplierId', '==', supplierId).get())
      );
    },

    /**
     * `supplierName`/`inspectorName` are passed in by the caller (already known from
     * the form's selected <option> text) instead of being re-fetched from Firestore,
     * removing 2 reads per write that were previously unconditional.
     */
    async add(record) {
      const newRecord = {
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
        comment: record.comment.trim(),
        createdAt: new Date().toISOString()
      };

      const docRef = await db.collection('records').add(newRecord);
      invalidateForSupplier(record.supplierId);
      return { id: docRef.id, ...newRecord };
    },

    async update(id, record) {
      const updatedRecord = {
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
        comment: record.comment.trim(),
        updatedAt: new Date().toISOString()
      };

      await db.collection('records').doc(id).update(updatedRecord);
      invalidateForSupplier(record.supplierId);
      return { id, ...updatedRecord };
    },

    async remove(id, supplierId) {
      await db.collection('records').doc(id).delete();
      invalidateForSupplier(supplierId);
      return true;
    }
  };
})();
