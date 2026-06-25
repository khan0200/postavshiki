# Parts Receiving Management System (Firebase Engine)

A modern, responsive, industrial-grade **Parts Receiving Management System** designed for manufacturing quality control and incoming inventory registration. Built using pure HTML5, CSS3, Vanilla JavaScript (ES6+), Bootstrap 5, and **Firebase Firestore (Compat/UMD SDK)**.

---

## Project Structure

```
/parts-management
│
├── index.html          # Page 1: Incoming Parts Registration
├── supplier.html       # Page 2: Suppliers Catalog, History & Importer
├── settings.html       # Page 3: Inspectors & Predefined Comments Settings
│
├── css/
│     style.css         # Industrial UI design and theme variables
│
├── js/
│     app.js            # Global initialization and diagnostic script
│     index.js          # Controller for incoming parts registry (async)
│     supplier.js       # Controller for supplier logs, parts, and importer (async)
│     settings.js       # Controller for staff and presets (async)
│     storage.js        # Firebase Firestore Compat driver (seeding built-in)
│     ui.js             # General UI elements (Toasts, Custom modals, Navbars)
│
└── README.md           # Project configuration and setup guide
```

---

## Features

- **Local Execution Compatible (file:/// Support)**:
  - Loads Firebase libraries via UMD Compat script tags. This eliminates browser CORS blocks when double-clicking the HTML files to run them locally directly in Chrome/Edge/Firefox.
  
- **Cloud Datastore (Firebase Firestore)**:
  - Database logic is fully encapsulated inside `js/storage.js` using the compat SDK.
  - Custom collections created: `suppliers`, `parts`, `inspectors`, `comments`, and `records`.
  - Documents contain denormalized name values (`supplierName` and `detailName`) inside written records.
  - Cascade updates are fully implemented: changing a supplier's name automatically syncs it across all of their parts and historical receiving records.
  - Automatic seed checks pre-load industrial QC records if collections are empty.

- **CSV Import Tool (`supplier.html`)**:
  - Bulk-load suppliers and parts directly from spreadsheets (Excel `.xlsx` sheets can be saved as Comma Delimited `.csv` files).
  - Built-in quote-safe parser handles commas embedded inside cell text (e.g. `"Nord Plastics, Ltd"`).
  - Smart column mapping: Looks for common columns containing supplier names and part IDs. Falls back to sequential column indexing (Col 1: Supplier, Col 2: Part ID, Col 3: Part Name) if headers are not found.
  - Data mapping integrity: Dynamically checks for existing supplier names in Firestore. Creates missing suppliers automatically, matches parts under their respective IDs, and skips pre-existing parts to prevent redundancy.
  - Live preview renders the first 5 records of the file to the operator before committing documents to Firestore.

- **Incoming Delivery Registration (`index.html`)**:
  - Auto-capped parameters ensure quantity validity in real time.
  - Custom searchable Detail ID dropdown filters inventory parts by selected supplier.
  - Dual-input comment picker enables standard keyboard input alongside quick presets.
  - Left-border colored table rows flag partial returns (Yellow) or full rejections (Red).

- **Suppliers Directory & Dashboards (`supplier.html`)**:
  - Left panel: Searchable catalog of suppliers displaying active parts and delivery logs.
  - Tabs:
    - **History**: Displays delivery history for the selected supplier.
    - **Parts**: Full parts database with edit/delete actions and a **Transfer** tool to migrate parts to another supplier.
    - **Reports**: Interactive monthly bar and line charts (Chart.js) that adapt to show daily distributions when a specific month details filter is selected.

---

## Firebase Configuration

The Firestore integration is pre-configured in `js/storage.js`:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyBPF5_HYIGuqDNZQQ1V1rGsow3IDkQpO6s",
  authDomain: "omadbek-ef47a.firebaseapp.com",
  projectId: "omadbek-ef47a",
  storageBucket: "omadbek-ef47a.firebasestorage.app",
  messagingSenderId: "355866151538",
  appId: "1:355866151538:web:4bb0cc8251bdf8c15c50eb"
};
```

To swap or connect a different Firebase project, simply update the `firebaseConfig` object inside [js/storage.js](file:///c:/Users/User/Desktop/Postavshik/js/storage.js).

---

## Setup & Running

1. **Direct File Open**:
   - Simply double-click `index.html` or `supplier.html` to run the application directly from the filesystem.
   
2. **Local HTTP Server**:
   - Alternatively, serve the files via any local server:
     ```bash
     python -m http.server 8000
     ```
