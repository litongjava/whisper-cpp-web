import { models } from "@/app/constants/models";

export const openDb = async (dbName, storeName) => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);
    request.onerror = (event) => reject(event.target.error);
    request.onsuccess = (event) => resolve(event.target.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      db.createObjectStore(storeName, { keyPath: "key" });
    };
  });
};

export const getModelFromDB = async (key) => {
  const db = await openDb("modelStoreDB", "models");
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["models"], "readonly");
    const store = transaction.objectStore("models");
    const request = store.get(key);
    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) => reject(event.target.error);
  });
};

export const saveModelToDB = async (key, data) => {
  const db = await openDb("modelStoreDB", "models");
  const transaction = db.transaction(["models"], "readwrite");
  const store = transaction.objectStore("models");
  return new Promise((resolve, reject) => {
    const request = store.put({ key, data });
    request.onsuccess = () => resolve();
    request.onerror = (event) => reject(event.target.error);
  });
};

export async function getModelBuffer(modelKey: string) {
  let modelData = await getModelFromDB(modelKey);
  if (!modelData) {
    console.log("Downloading model...");
    const modelUrl = models[modelKey];
    const response = await fetch(modelUrl);
    const buffer = await response.arrayBuffer();
    await saveModelToDB(modelKey, buffer);
    modelData = { data: buffer };
    console.log("Model saved to IndexedDB.");
  } else {
    console.log("Model loaded from IndexedDB.");
  }
  return modelData;
}
