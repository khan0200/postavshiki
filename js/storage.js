/**
 * storage.js - Disabled. The app now talks to /api/* (Vercel functions backed by
 * Turso) instead of Firestore directly - see js/repositories.js.
 *
 * Firestore was NOT deleted; the omadbek-ef47a project and all its data are
 * untouched and can be reconnected later. To restore the previous
 * Firestore-direct setup: `git log -p -- js/storage.js` to find the commit
 * before this one was emptied, restore this file's content from it, and
 * restore js/repositories.js + the firebase-app-compat.js/firebase-firestore-compat.js
 * <script> tags in index.html/settings.html/supplier.html the same way.
 */
