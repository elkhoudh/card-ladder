const DB_NAME = "cardladder-cache";
const DB_VERSION = 2; // bumped to drop old schema with period/query in key
const STORE_NAME = "pages";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

class CardCache {
  constructor() {
    this.db = null;
    this.ready = this.open();
  }

  open() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = request.result;
        // Drop old store if it exists (schema change — period/query removed from key)
        if (event.oldVersion > 0 && db.objectStoreNames.contains(STORE_NAME)) {
          db.deleteObjectStore(STORE_NAME);
        }
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onerror = () => reject(request.error);
    });
  }

  // Key: category|direction|p<page>  (no period, no query — data covers all periods)
  static buildKey({ category, direction, page }) {
    return `${category}|${direction}|p${page}`;
  }

  static buildPrefix({ category, direction }) {
    return `${category}|${direction}|`;
  }

  async getPage(key) {
    await this.ready;
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(key);

      request.onsuccess = () => {
        const entry = request.result;
        if (!entry) { resolve(null); return; }
        if (Date.now() - entry.savedAt > CACHE_TTL_MS) { resolve(null); return; }
        resolve(entry);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async setPage(key, data) {
    await this.ready;
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put({ id: key, data, savedAt: Date.now() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getAllPagesForFilter({ category, direction }) {
    await this.ready;
    const prefix = CardCache.buildPrefix({ category, direction });

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(STORE_NAME, "readonly");
      const request = tx.objectStore(STORE_NAME).getAll();

      request.onsuccess = () => {
        const now = Date.now();
        const pages = (request.result || [])
          .filter((e) => e.id.startsWith(prefix) && now - e.savedAt <= CACHE_TTL_MS)
          .sort((a, b) => {
            const pa = Number(a.id.replace(/^.*\|p/, ""));
            const pb = Number(b.id.replace(/^.*\|p/, ""));
            return pa - pb;
          });
        resolve(pages);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async clearAll() {
    await this.ready;
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async clearForCategory(category) {
    await this.ready;
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        for (const entry of request.result || []) {
          if (entry.id.startsWith(`${category}|`)) {
            store.delete(entry.id);
          }
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

window.CardCache = CardCache;
window.CACHE_TTL_MS = CACHE_TTL_MS;
