import { models } from "@/app/constants/models";

// 定义 ModelData 接口
interface ModelData {
  data: ArrayBuffer;
}

export const openDb = async (dbName:string, storeName:string) => {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);
    // @ts-ignore
    request.onerror = (event) => reject(event.target?.error);
    // @ts-ignore
    request.onsuccess = (event) => resolve(event.target?.result);
    request.onupgradeneeded = (event) => {
      // @ts-ignore
      const db:IDBDatabase = event.target?.result;
      db.createObjectStore(storeName, { keyPath: "key" });
    };
  });
};

export const getModelFromDB = async (key: string): Promise<ModelData | undefined> => {
  const db = await openDb("modelStoreDB", "models");
  return new Promise<ModelData | undefined>((resolve, reject) => {
    const transaction = db.transaction(["models"], "readonly");
    const store = transaction.objectStore("models");
    const request = store.get(key);
    request.onsuccess = (event) => {
      // @ts-ignore
      const result = event.target?.result;
      if (result) {
        resolve(result as ModelData);
      } else {
        resolve(undefined);
      }
    };
    // @ts-ignore
    request.onerror = (event) => reject(event.target?.error);
  });
};



export const saveModelToDB = async (key:string, data:any) => {
  const db = await openDb("modelStoreDB", "models");
  const transaction = db.transaction(["models"], "readwrite");
  const store = transaction.objectStore("models");
  return new Promise((resolve, reject) => {
    const request = store.put({ key, data });
    request.onsuccess = (ev) => resolve(ev);
    // @ts-ignore
    request.onerror = (event) => reject(event.target?.error);
  });
};

export async function getModelBuffer(modelKey: string): Promise<ModelData> {
  let modelData = await getModelFromDB(modelKey);
  if (!modelData) {
    console.log("Downloading model...");
    // @ts-ignore
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
