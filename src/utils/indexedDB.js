const DATABASE_NAME = "whiteboard-database";
const DATABASE_VERSION = 1;
const STORE_NAME = "boards";
const BOARD_KEY = "current-board";

const openDatabase = () => {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
};

export const saveBoardToDB = async (elements) => {
  const database = await openDatabase();

  const serializableElements = JSON.parse(
    JSON.stringify(elements, (key, value) => {
      if (key === "path" || key === "roughEle") {
        return undefined;
      }

      return value;
    }),
  );

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");

    const store = transaction.objectStore(STORE_NAME);
    store.put(serializableElements, BOARD_KEY);

    transaction.oncomplete = () => {
      database.close();
      resolve();
    };

    transaction.onerror = () => {
      database.close();
      reject(transaction.error);
    };
  });
};

export const loadBoardFromDB = async () => {
  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readonly");

    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(BOARD_KEY);

    request.onsuccess = () => {
      database.close();
      resolve(request.result || []);
    };

    request.onerror = () => {
      database.close();
      reject(request.error);
    };
  });
};
