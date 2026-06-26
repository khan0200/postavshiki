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
 *
 * Every direct Firestore read/write below is wrapped in PerfStats.timeRead/
 * timeWrite (js/perf-stats.js) purely for observability (read/write counts,
 * duration) - it never alters control flow or return values.
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
      return Cache.getOrLoad(CACHE_KEY, () => PerfStats.timeRead('suppliers.getAll', () => db.collection('suppliers').get().then(snapToList)));
    },

    async getById(id) {
      const all = await this.getAll();
      const found = all.find(s => s.id === id);
      if (found) return found;
      // Fallback to a direct doc read in case the cache is stale relative to id (defensive only).
      const snap = await PerfStats.timeRead(`suppliers.getById:${id}`, () => db.collection('suppliers').doc(id).get());
      return snap.exists ? { id: snap.id, ...snap.data() } : null;
    },

    async add(name) {
      const docRef = await PerfStats.timeWrite('suppliers.add', () => db.collection('suppliers').add({
        name: name.trim(),
        createdAt: new Date().toISOString()
      }));
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
        PerfStats.timeRead(`parts.bySupplier:${id}`, () => db.collection('parts').where('supplierId', '==', id).get()),
        PerfStats.timeRead(`records.bySupplier:${id}`, () => db.collection('records').where('supplierId', '==', id).get())
      ]);
      partsSnap.forEach(doc => batch.update(doc.ref, { supplierName: trimmedName }));
      recordsSnap.forEach(doc => batch.update(doc.ref, { supplierName: trimmedName }));

      await PerfStats.timeWrite('suppliers.rename(batch)', () => batch.commit());

      Cache.invalidate(CACHE_KEY);
      Cache.invalidate(`parts:bySupplier:${id}`);
      Cache.invalidate(`records:bySupplier:${id}`);

      return { id, name: trimmedName };
    },

    async remove(id) {
      const batch = db.batch();
      batch.delete(db.collection('suppliers').doc(id));

      const partsSnap = await PerfStats.timeRead(`parts.bySupplier:${id}`, () => db.collection('parts').where('supplierId', '==', id).get());
      partsSnap.forEach(doc => batch.delete(doc.ref));

      await PerfStats.timeWrite('suppliers.remove(batch)', () => batch.commit());

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
      return Cache.getOrLoad('parts:all', () => PerfStats.timeRead('parts.getAll', () => db.collection('parts').get().then(snapToList)));
    },

    async getBySupplier(supplierId) {
      const key = `parts:bySupplier:${supplierId}`;
      return Cache.getOrLoad(key, () =>
        PerfStats.timeRead(key, () => db.collection('parts').where('supplierId', '==', supplierId).get().then(snapToList))
      );
    },

    async add(supplierId, detailId, detailName, supplierName) {
      const docRef = await PerfStats.timeWrite('parts.add', () => db.collection('parts').add({
        supplierId,
        supplierName,
        detailId: detailId.trim().toUpperCase(),
        detailName: detailName.trim(),
        createdAt: new Date().toISOString()
      }));
      Cache.invalidate('parts:all');
      Cache.invalidate(`parts:bySupplier:${supplierId}`);
      return { id: docRef.id, supplierId, supplierName, detailId, detailName };
    },

    async update(id, supplierId, detailId, detailName) {
      await PerfStats.timeWrite(`parts.update:${id}`, () => db.collection('parts').doc(id).update({
        detailId: detailId.trim().toUpperCase(),
        detailName: detailName.trim()
      }));
      Cache.invalidate('parts:all');
      Cache.invalidate(`parts:bySupplier:${supplierId}`);
      return { id, detailId, detailName };
    },

    async remove(id, supplierId) {
      await PerfStats.timeWrite(`parts.remove:${id}`, () => db.collection('parts').doc(id).delete());
      Cache.invalidate('parts:all');
      Cache.invalidate(`parts:bySupplier:${supplierId}`);
      return true;
    },

    async transfer(partId, sourceSupplierId, targetSupplierId, targetSupplierName) {
      await PerfStats.timeWrite(`parts.transfer:${partId}`, () => db.collection('parts').doc(partId).update({
        supplierId: targetSupplierId,
        supplierName: targetSupplierName
      }));
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
      return Cache.getOrLoad(CACHE_KEY, () => PerfStats.timeRead('inspectors.getAll', () => db.collection('inspectors').get().then(snapToList)));
    },

    async getById(id) {
      const all = await this.getAll();
      return all.find(i => i.id === id) || null;
    },

    async add(fullName) {
      const docRef = await PerfStats.timeWrite('inspectors.add', () => db.collection('inspectors').add({ fullName: fullName.trim() }));
      Cache.invalidate(CACHE_KEY);
      return { id: docRef.id, fullName: fullName.trim() };
    },

    async update(id, fullName) {
      await PerfStats.timeWrite(`inspectors.update:${id}`, () => db.collection('inspectors').doc(id).update({ fullName: fullName.trim() }));
      Cache.invalidate(CACHE_KEY);
      return { id, fullName: fullName.trim() };
    },

    async remove(id) {
      await PerfStats.timeWrite(`inspectors.remove:${id}`, () => db.collection('inspectors').doc(id).delete());
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
      return Cache.getOrLoad(CACHE_KEY, () => PerfStats.timeRead('comments.getAll', () => db.collection('comments').get().then(snapToList)));
    },

    async add(text) {
      const docRef = await PerfStats.timeWrite('comments.add', () => db.collection('comments').add({ text: text.trim() }));
      Cache.invalidate(CACHE_KEY);
      return { id: docRef.id, text: text.trim() };
    },

    async update(id, text) {
      await PerfStats.timeWrite(`comments.update:${id}`, () => db.collection('comments').doc(id).update({ text: text.trim() }));
      Cache.invalidate(CACHE_KEY);
      return { id, text: text.trim() };
    },

    async remove(id) {
      await PerfStats.timeWrite(`comments.remove:${id}`, () => db.collection('comments').doc(id).delete());
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
      return Cache.getOrLoad('records:latest30', () =>
        PerfStats.timeRead('records.getLatest', () => db.collection('records').orderBy('date', 'desc').limit(count).get().then(snapToList))
      );
    },

    /**
     * Returns the distinct calendar years present across ALL records, for the
     * Supplier Charts tab's year selector. Reads a single denormalized
     * `meta/years` doc (maintained incrementally by recordYear() below)
     * instead of scanning the entire `records` collection - on a collection
     * with thousands of documents, the old full-scan query could take 8+
     * seconds or time out entirely; this is now a single-document read.
     *
     * Self-healing: if `meta/years` doesn't exist yet (first run after this
     * change, before any new record write has had a chance to create it),
     * falls back to the one-time full scan and persists the result so every
     * subsequent call - on any page, by any user - never needs to scan again.
     */
    async getDistinctYears() {
      return Cache.getOrLoad('records:distinctYears', () => PerfStats.timeRead('meta.years.get', async () => {
        const metaSnap = await db.collection('meta').doc('years').get();
        if (metaSnap.exists && Array.isArray(metaSnap.data().values)) {
          return metaSnap.data().values;
        }

        // One-time backfill: no meta doc yet, so this is the first read since
        // existing historical records were written before this scheme existed.
        const snap = await PerfStats.timeRead('records.getDistinctYears(backfill)', () => db.collection('records').get());
        const years = new Set();
        snap.forEach(d => {
          const date = d.data().date;
          if (date) {
            const yr = new Date(date).getFullYear();
            if (!isNaN(yr)) years.add(yr);
          }
        });
        const yearsArray = Array.from(years);
        await db.collection('meta').doc('years').set({ values: yearsArray });
        return yearsArray;
      }));
    },

    /**
     * Merges this record's calendar year into the denormalized `meta/years`
     * doc via arrayUnion (atomic, no read-before-write, safe under concurrent
     * writers, and a no-op if the year is already present). Called by every
     * write path that can introduce a record with a new date (add/update/CSV
     * import) so getDistinctYears() never needs to re-scan `records`.
     */
    async recordYear(dateStr) {
      if (!dateStr) return;
      const yr = new Date(dateStr).getFullYear();
      if (isNaN(yr)) return;
      await db.collection('meta').doc('years').set({
        values: firebase.firestore.FieldValue.arrayUnion(yr)
      }, { merge: true });
      Cache.invalidate('records:distinctYears');
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
      return Cache.getOrLoad(key, () =>
        PerfStats.timeRead(key, () => db.collection('records').where('supplierId', '==', supplierId).get().then(snapToList))
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

      const docRef = await PerfStats.timeWrite('records.add', () => db.collection('records').add(newRecord));
      invalidateForSupplier(record.supplierId);
      await this.recordYear(newRecord.date);
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

      await PerfStats.timeWrite(`records.update:${id}`, () => db.collection('records').doc(id).update(updatedRecord));
      invalidateForSupplier(record.supplierId);
      await this.recordYear(updatedRecord.date);
      return { id, ...updatedRecord };
    },

    async remove(id, supplierId) {
      await PerfStats.timeWrite(`records.remove:${id}`, () => db.collection('records').doc(id).delete());
      invalidateForSupplier(supplierId);
      return true;
    }
  };
})();
