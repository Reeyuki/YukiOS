export class BlobStorage {
  constructor() {
    this.blobDB = null;
  }

  initBlobDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open("fs-blobs-db", 1);
      req.onupgradeneeded = (e) => {
        e.target.result.createObjectStore("blobs", { keyPath: "path" });
      };
      req.onsuccess = (e) => {
        this.blobDB = e.target.result;
        resolve();
      };
      req.onerror = (e) => reject(e);
    });
  }

  _clearBlobStore() {
    return new Promise((resolve) => {
      if (!this.blobDB) return resolve();
      try {
        const tx = this.blobDB.transaction("blobs", "readwrite");
        tx.objectStore("blobs").clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  _putBlob(fullPath, blob) {
    return new Promise((resolve, reject) => {
      const tx = this.blobDB.transaction("blobs", "readwrite");
      tx.objectStore("blobs").put({ path: fullPath, blob });
      tx.oncomplete = resolve;
      tx.onerror = reject;
    });
  }

  _getBlobByFullPath(fullPath) {
    return new Promise((resolve, reject) => {
      const tx = this.blobDB.transaction("blobs", "readonly");
      const req = tx.objectStore("blobs").get(fullPath);
      req.onsuccess = () => resolve(req.result?.blob ?? null);
      req.onerror = reject;
    });
  }

  _deleteBlobByFullPath(fullPath) {
    return new Promise((resolve, reject) => {
      const tx = this.blobDB.transaction("blobs", "readwrite");
      tx.objectStore("blobs").delete(fullPath);
      tx.oncomplete = resolve;
      tx.onerror = reject;
    });
  }

  _renameBlobByFullPath(oldPath, newPath) {
    return new Promise((resolve, reject) => {
      const tx = this.blobDB.transaction("blobs", "readwrite");
      const store = tx.objectStore("blobs");
      const req = store.get(oldPath);
      req.onsuccess = () => {
        if (req.result) {
          store.delete(oldPath);
          store.put({ path: newPath, blob: req.result.blob });
        }
        resolve();
      };
      req.onerror = reject;
    });
  }
}
