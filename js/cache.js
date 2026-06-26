/**
 * cache.js - Generic in-memory cache layer sitting between Repositories and Firestore.
 * Collections are cached whole (suppliers/inspectors/comments are small + low-churn).
 * Repositories are responsible for invalidating the right keys after writes.
 * Hit/miss events are reported to PerfStats (js/perf-stats.js) for observability only -
 * instrumentation never changes caching behavior or return values.
 */

window.Cache = (function () {
  const store = new Map();

  return {
    /**
     * Returns cached value for key, or undefined if not present.
     */
    get(key) {
      return store.has(key) ? store.get(key) : undefined;
    },

    has(key) {
      return store.has(key);
    },

    set(key, value) {
      store.set(key, value);
      return value;
    },

    invalidate(key) {
      store.delete(key);
    },

    invalidateAll() {
      store.clear();
    },

    /**
     * Returns cached value if present, otherwise awaits loader(), caches it, and returns it.
     * Concurrent calls while a load is in-flight reuse the same in-flight promise instead of
     * issuing duplicate Firestore reads (prevents the keystroke-search read-storm).
     */
    async getOrLoad(key, loader) {
      if (store.has(key)) {
        if (window.PerfStats) PerfStats.recordCacheHit(key);
        const cached = store.get(key);
        // In-flight promises are cached too, so concurrent callers await the same request.
        return cached;
      }
      if (window.PerfStats) PerfStats.recordCacheMiss(key);
      const promise = Promise.resolve().then(loader).catch(err => {
        // Loading failed - do not leave a broken promise cached, allow retry next call.
        store.delete(key);
        throw err;
      });
      store.set(key, promise);
      return promise;
    }
  };
})();
