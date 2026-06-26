/**
 * storage.js - Firebase Firestore Compat bootstrap.
 * Initializes the SDK, enables offline persistence, and seeds demo data once.
 * All actual data access goes through the Repository layer (js/repositories.js) -
 * pages must never call `db.collection(...)` directly.
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

// Enable offline persistence (cached reads across reloads, offline support).
// Gracefully no-op if unsupported (private browsing, multiple open tabs, old browsers).
db.enablePersistence({ synchronizeTabs: true }).catch((err) => {
  if (err.code === 'failed-precondition') {
    console.warn('Firestore persistence unavailable: multiple tabs open without synchronizeTabs support.');
  } else if (err.code === 'unimplemented') {
    console.warn('Firestore persistence unavailable: browser does not support required APIs.');
  } else {
    console.warn('Firestore persistence could not be enabled:', err);
  }
});

// Seed Firestore collections if the database is brand new and empty.
// Gated behind a localStorage flag after the first confirmed non-empty check,
// so this never re-runs the seeding probe read on every subsequent page load.
const SEED_CHECK_FLAG = 'seedCheckComplete';

async function seedFirestoreIfNeeded() {
  if (localStorage.getItem(SEED_CHECK_FLAG) === '1') return;

  try {
    const suppliersSnap = await PerfStats.timeRead('seedCheck.suppliers', () => db.collection('suppliers').get());
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
    localStorage.setItem(SEED_CHECK_FLAG, '1');
  } catch (err) {
    console.error('Error during seeding check:', err);
  }
}

// Run seeding asynchronously
seedFirestoreIfNeeded();
