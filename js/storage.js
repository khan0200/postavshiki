/**
 * storage.js - Firebase Firestore Compat Storage Driver
 * Uses the Firebase Compat UMD libraries to allow local double-click execution (bypasses local CORS blocks).
 */

const firebaseConfig = {
  apiKey: "AIzaSyBPF5_HYIGuqDNZQQ1V1rGsow3IDkQpO6s",
  authDomain: "omadbek-ef47a.firebaseapp.com",
  projectId: "omadbek-ef47a",
  storageBucket: "omadbek-ef47a.firebasestorage.app",
  messagingSenderId: "355866151538",
  appId: "1:355866151538:web:4bb0cc8251bdf8c15c50eb"
};

// Initialize Firebase Compat
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Seed Firestore collections if the database is brand new and empty
async function seedFirestoreIfNeeded() {
  try {
    const suppliersSnap = await db.collection('suppliers').get();
    if (suppliersSnap.empty) {
      console.log('%c🌱 Seeding Firebase Firestore with initial industrial data...', 'color: green; font-weight: bold;');
      
      // 1. Seed suppliers
      const suppliers = [
        { id: 'sup-1', name: 'Global Tech Components', createdAt: new Date().toISOString() },
        { id: 'sup-2', name: 'Apex Logistics & Packaging', createdAt: new Date().toISOString() },
        { id: 'sup-3', name: 'Delta Steel Works', createdAt: new Date().toISOString() },
        { id: 'sup-4', name: 'Nord Plastic Moldings', createdAt: new Date().toISOString() }
      ];
      for (const s of suppliers) {
        await db.collection('suppliers').doc(s.id).set({ name: s.name, createdAt: s.createdAt });
      }

      // 2. Seed parts
      const parts = [
        { id: 'part-1', supplierId: 'sup-1', supplierName: 'Global Tech Components', detailId: 'PN-8802', detailName: 'Microchip Controller A1', createdAt: new Date().toISOString() },
        { id: 'part-2', supplierId: 'sup-1', supplierName: 'Global Tech Components', detailId: 'PN-8805', detailName: 'Connector Assembly 4-Pin', createdAt: new Date().toISOString() },
        { id: 'part-3', supplierId: 'sup-1', supplierName: 'Global Tech Components', detailId: 'PN-8809', detailName: 'Voltage Regulator Module', createdAt: new Date().toISOString() },
        
        { id: 'part-4', supplierId: 'sup-2', supplierName: 'Apex Logistics & Packaging', detailId: 'PN-4022', detailName: 'Corrugated Shipping Box Med', createdAt: new Date().toISOString() },
        { id: 'part-5', supplierId: 'sup-2', supplierName: 'Apex Logistics & Packaging', detailId: 'PN-4033', detailName: 'ESD Protective Bag Small', createdAt: new Date().toISOString() },
        
        { id: 'part-6', supplierId: 'sup-3', supplierName: 'Delta Steel Works', detailId: 'PN-1090', detailName: 'Steel Support Bracket M10', createdAt: new Date().toISOString() },
        { id: 'part-7', supplierId: 'sup-3', supplierName: 'Delta Steel Works', detailId: 'PN-1100', detailName: 'Aluminium Mounting Plate', createdAt: new Date().toISOString() },
        
        { id: 'part-8', supplierId: 'sup-4', supplierName: 'Nord Plastic Moldings', detailId: 'PN-3101', detailName: 'Plastic Enclosure IP67', createdAt: new Date().toISOString() },
        { id: 'part-9', supplierId: 'sup-4', supplierName: 'Nord Plastic Moldings', detailId: 'PN-3105', detailName: 'Rubber Gasket Spacer', createdAt: new Date().toISOString() }
      ];
      for (const p of parts) {
        await db.collection('parts').doc(p.id).set({
          supplierId: p.supplierId,
          supplierName: p.supplierName,
          detailId: p.detailId,
          detailName: p.detailName,
          createdAt: p.createdAt
        });
      }

      // 3. Seed inspectors
      const inspectors = [
        { id: 'ins-1', fullName: 'Alexander Ivanov' },
        { id: 'ins-2', fullName: 'Dmitry Petrov' },
        { id: 'ins-3', fullName: 'Elena Sidorova' }
      ];
      for (const ins of inspectors) {
        await db.collection('inspectors').doc(ins.id).set({ fullName: ins.fullName });
      }

      // 4. Seed comments
      const comments = [
        { id: 'cmt-1', text: 'OK' },
        { id: 'cmt-2', text: 'Surface Scratch' },
        { id: 'cmt-3', text: 'Wrong Quantity' },
        { id: 'cmt-4', text: 'Dimension Error' },
        { id: 'cmt-5', text: 'Missing Part' },
        { id: 'cmt-6', text: 'Packaging Damage' }
      ];
      for (const cmt of comments) {
        await db.collection('comments').doc(cmt.id).set({ text: cmt.text });
      }

      // 5. Seed receiving records
      const inspectorsList = ['ins-1', 'ins-2', 'ins-3'];
      const partsList = [
        { sup: 'sup-1', supName: 'Global Tech Components', detId: 'PN-8802', detName: 'Microchip Controller A1' },
        { sup: 'sup-1', supName: 'Global Tech Components', detId: 'PN-8805', detName: 'Connector Assembly 4-Pin' },
        { sup: 'sup-2', supName: 'Apex Logistics & Packaging', detId: 'PN-4022', detName: 'Corrugated Shipping Box Med' },
        { sup: 'sup-3', supName: 'Delta Steel Works', detId: 'PN-1090', detName: 'Steel Support Bracket M10' },
        { sup: 'sup-4', supName: 'Nord Plastic Moldings', detId: 'PN-3101', detName: 'Plastic Enclosure IP67' }
      ];
      const commentsList = ['OK', 'Surface Scratch', 'Wrong Quantity', 'OK', 'OK', 'Packaging Damage'];

      const now = new Date();
      for (let i = 1; i <= 35; i++) {
        const recordDate = new Date();
        recordDate.setDate(now.getDate() - i);
        const part = partsList[i % partsList.length];
        const qty = Math.floor(Math.random() * 200) + 10;
        const checked = qty;
        let returned = 0;
        let comment = 'OK';

        if (i % 8 === 0) {
          returned = Math.floor(qty * 0.1) + 1;
          comment = commentsList[i % commentsList.length];
        } else if (i % 15 === 0) {
          returned = qty;
          comment = 'Reject: Critical Dimension Error';
        }

        const rec = {
          id: `rec-${1000 + i}`,
          date: recordDate.toISOString().split('T')[0],
          fn: `PO-2026-${10000 + i}`,
          supplierId: part.sup,
          supplierName: part.supName,
          detailId: part.detId,
          detailName: part.detName,
          quantity: qty,
          checkedQuantity: checked,
          returnedQuantity: returned,
          inspectorId: inspectorsList[i % inspectorsList.length],
          inspectorName: i % 3 === 0 ? 'Alexander Ivanov' : (i % 3 === 1 ? 'Dmitry Petrov' : 'Elena Sidorova'),
          comment: comment,
          createdAt: recordDate.toISOString()
        };
        await db.collection('records').doc(rec.id).set(rec);
      }
      console.log('%c✔️ Seeding complete.', 'color: green;');
    }
  } catch (err) {
    console.error('Error during seeding check:', err);
  }
}

// Run seeding asynchronously
seedFirestoreIfNeeded();

window.AppStorage = {
  // --- SUPPLIERS ---
  async getSuppliers() {
    const snap = await db.collection('suppliers').get();
    const list = [];
    snap.forEach(d => {
      list.push({ id: d.id, ...d.data() });
    });
    return list;
  },

  async getSupplierById(id) {
    const snap = await db.collection('suppliers').doc(id).get();
    return snap.exists ? { id: snap.id, ...snap.data() } : null;
  },

  async addSupplier(name) {
    const docRef = await db.collection('suppliers').add({
      name: name.trim(),
      createdAt: new Date().toISOString()
    });
    return { id: docRef.id, name: name.trim() };
  },

  async updateSupplier(id, name) {
    // 1. Update supplier name
    await db.collection('suppliers').doc(id).update({ name: name.trim() });
    
    // 2. Cascade update supplierName in parts collection
    const partsSnap = await db.collection('parts').where('supplierId', '==', id).get();
    for (const pDoc of partsSnap.docs) {
      await db.collection('parts').doc(pDoc.id).update({ supplierName: name.trim() });
    }

    // 3. Cascade update supplierName in records collection
    const recordsSnap = await db.collection('records').where('supplierId', '==', id).get();
    for (const rDoc of recordsSnap.docs) {
      await db.collection('records').doc(rDoc.id).update({ supplierName: name.trim() });
    }

    return { id, name: name.trim() };
  },

  async deleteSupplier(id) {
    // Delete supplier document
    await db.collection('suppliers').doc(id).delete();

    // Cascade delete associated parts in parts collection
    const partsSnap = await db.collection('parts').where('supplierId', '==', id).get();
    for (const pDoc of partsSnap.docs) {
      await db.collection('parts').doc(pDoc.id).delete();
    }
    return true;
  },

  // --- PARTS ---
  async getParts() {
    const snap = await db.collection('parts').get();
    const list = [];
    snap.forEach(d => {
      list.push({ id: d.id, ...d.data() });
    });
    return list;
  },

  async getPartsBySupplier(supplierId) {
    const snap = await db.collection('parts').where('supplierId', '==', supplierId).get();
    const list = [];
    snap.forEach(d => {
      list.push({ id: d.id, ...d.data() });
    });
    return list;
  },

  async addPart(supplierId, detailId, detailName) {
    // Fetch supplier to capture current supplierName
    const supplier = await this.getSupplierById(supplierId);
    const supplierName = supplier ? supplier.name : 'Unknown Supplier';

    const docRef = await db.collection('parts').add({
      supplierId,
      supplierName,
      detailId: detailId.trim().toUpperCase(),
      detailName: detailName.trim(),
      createdAt: new Date().toISOString()
    });
    return { id: docRef.id, supplierId, supplierName, detailId, detailName };
  },

  async updatePart(id, detailId, detailName) {
    await db.collection('parts').doc(id).update({
      detailId: detailId.trim().toUpperCase(),
      detailName: detailName.trim()
    });
    return { id, detailId, detailName };
  },

  async deletePart(id) {
    await db.collection('parts').doc(id).delete();
    return true;
  },

  async transferPart(partId, targetSupplierId) {
    const targetSupplier = await this.getSupplierById(targetSupplierId);
    const targetSupplierName = targetSupplier ? targetSupplier.name : 'Unknown Supplier';

    await db.collection('parts').doc(partId).update({
      supplierId: targetSupplierId,
      supplierName: targetSupplierName
    });
    return { id: partId, supplierId: targetSupplierId, supplierName: targetSupplierName };
  },

  // --- INSPECTORS ---
  async getInspectors() {
    const snap = await db.collection('inspectors').get();
    const list = [];
    snap.forEach(d => {
      list.push({ id: d.id, ...d.data() });
    });
    return list;
  },

  async getInspectorById(id) {
    const snap = await db.collection('inspectors').doc(id).get();
    return snap.exists ? { id: snap.id, ...snap.data() } : null;
  },

  async addInspector(fullName) {
    const docRef = await db.collection('inspectors').add({
      fullName: fullName.trim()
    });
    return { id: docRef.id, fullName: fullName.trim() };
  },

  async updateInspector(id, fullName) {
    await db.collection('inspectors').doc(id).update({ fullName: fullName.trim() });
    return { id, fullName: fullName.trim() };
  },

  async deleteInspector(id) {
    await db.collection('inspectors').doc(id).delete();
    return true;
  },

  // --- COMMENTS ---
  async getComments() {
    const snap = await db.collection('comments').get();
    const list = [];
    snap.forEach(d => {
      list.push({ id: d.id, ...d.data() });
    });
    return list;
  },

  async addComment(text) {
    const docRef = await db.collection('comments').add({
      text: text.trim()
    });
    return { id: docRef.id, text: text.trim() };
  },

  async updateComment(id, text) {
    await db.collection('comments').doc(id).update({ text: text.trim() });
    return { id, text: text.trim() };
  },

  async deleteComment(id) {
    await db.collection('comments').doc(id).delete();
    return true;
  },

  // --- RECEIVING RECORDS ---
  async getReceivingRecords() {
    const snap = await db.collection('records').get();
    const list = [];
    snap.forEach(d => {
      list.push({ id: d.id, ...d.data() });
    });
    return list;
  },

  async addReceivingRecord(record) {
    const supplier = await this.getSupplierById(record.supplierId);
    const supplierName = supplier ? supplier.name : 'Unknown Supplier';

    const inspector = await this.getInspectorById(record.inspectorId);
    const inspectorName = inspector ? inspector.fullName : 'Unknown Inspector';

    const newRecord = {
      date: record.date,
      fn: record.fn.trim(),
      supplierId: record.supplierId,
      supplierName: supplierName,
      detailId: record.detailId,
      detailName: record.detailName,
      quantity: Number(record.quantity),
      checkedQuantity: Number(record.checkedQuantity),
      returnedQuantity: Number(record.returnedQuantity),
      inspectorId: record.inspectorId,
      inspectorName: inspectorName,
      comment: record.comment.trim(),
      createdAt: new Date().toISOString()
    };

    const docRef = await db.collection('records').add(newRecord);
    return { id: docRef.id, ...newRecord };
  },

  async deleteReceivingRecord(id) {
    await db.collection('records').doc(id).delete();
    return true;
  }
};
