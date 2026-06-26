/**
 * perf-stats.js - Lightweight instrumentation for cache/Firestore activity.
 * Pure observability: never affects control flow or return values of the
 * code that calls it. Inspect live via `PerfStats.summary()` in DevTools.
 */

window.PerfStats = (function () {
  const counters = {
    cacheHits: 0,
    cacheMisses: 0,
    firestoreReads: 0,   // number of repository-level read calls (collection.get() or doc.get())
    firestoreWrites: 0,  // number of repository-level write calls (add/set/update/delete, batch.commit() counts as 1)
    queryDurations: []   // { label, ms } for each Firestore read, most recent last
  };

  const MAX_DURATION_SAMPLES = 200;

  return {
    recordCacheHit(key) {
      counters.cacheHits++;
      console.debug(`[PerfStats] cache HIT  ${key}`);
    },

    recordCacheMiss(key) {
      counters.cacheMisses++;
      console.debug(`[PerfStats] cache MISS ${key}`);
    },

    recordRead(label, ms) {
      counters.firestoreReads++;
      counters.queryDurations.push({ label, ms });
      if (counters.queryDurations.length > MAX_DURATION_SAMPLES) {
        counters.queryDurations.shift();
      }
      console.debug(`[PerfStats] Firestore READ  ${label} (${ms.toFixed(1)}ms)`);
    },

    recordWrite(label, ms) {
      counters.firestoreWrites++;
      console.debug(`[PerfStats] Firestore WRITE ${label} (${ms.toFixed(1)}ms)`);
    },

    /**
     * Wraps an async Firestore read call, timing it and recording the result.
     * Usage: PerfStats.timeRead('suppliers:getAll', () => db.collection('suppliers').get())
     */
    async timeRead(label, fn) {
      const start = performance.now();
      const result = await fn();
      this.recordRead(label, performance.now() - start);
      return result;
    },

    /**
     * Wraps an async Firestore write call (add/set/update/delete/batch.commit), timing it.
     */
    async timeWrite(label, fn) {
      const start = performance.now();
      const result = await fn();
      this.recordWrite(label, performance.now() - start);
      return result;
    },

    /**
     * Snapshot of cumulative counters plus derived stats, safe to call anytime
     * from the browser console for a quick read on session activity.
     */
    summary() {
      const total = counters.cacheHits + counters.cacheMisses;
      const hitRate = total > 0 ? ((counters.cacheHits / total) * 100).toFixed(1) + '%' : 'n/a';
      const durations = counters.queryDurations.map(d => d.ms);
      const avgMs = durations.length > 0 ? (durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(1) : 'n/a';

      return {
        cacheHits: counters.cacheHits,
        cacheMisses: counters.cacheMisses,
        cacheHitRate: hitRate,
        firestoreReads: counters.firestoreReads,
        firestoreWrites: counters.firestoreWrites,
        avgReadDurationMs: avgMs,
        recentQueries: counters.queryDurations.slice(-10)
      };
    },

    reset() {
      counters.cacheHits = 0;
      counters.cacheMisses = 0;
      counters.firestoreReads = 0;
      counters.firestoreWrites = 0;
      counters.queryDurations = [];
    }
  };
})();
