import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDocs, 
  query, 
  orderBy, 
  serverTimestamp,
  getDoc,
  getDocFromServer,
  onSnapshot,
  setDoc,
  initializeFirestore
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Custom Error Handler for Firestore
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Connection test
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();

// --- API Functions ---

export const getNotices = async () => {
  const path = 'notices';
  try {
    const q = query(collection(db, path), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
};

export const addNotice = async (notice: { title: string; date: string; badge: string; content?: string }) => {
  const path = 'notices';
  try {
    return await addDoc(collection(db, path), {
      title: notice.title.slice(0, 500),
      date: notice.date.slice(0, 20),
      badge: notice.badge.slice(0, 50),
      content: (notice.content || '').slice(0, 10000),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
};

export const deleteNotice = async (id: string) => {
  const path = `notices/${id}`;
  try {
    await deleteDoc(doc(db, 'notices', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
};

export const updateNotice = async (id: string, data: Partial<{ title: string; date: string; badge: string; content: string }>) => {
  const path = `notices/${id}`;
  try {
    const payload: Record<string, any> = { updatedAt: serverTimestamp() };
    if (data.title !== undefined) payload.title = data.title.slice(0, 500);
    if (data.date !== undefined) payload.date = data.date.slice(0, 20);
    if (data.badge !== undefined) payload.badge = data.badge.slice(0, 50);
    if (data.content !== undefined) payload.content = data.content.slice(0, 10000);
    await updateDoc(doc(db, 'notices', id), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
};

export const getGallery = async () => {
  const path = 'gallery';
  try {
    const q = query(collection(db, path), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
};

export const addGalleryItem = async (item: { src: string; title: string; category: string }) => {
  const path = 'gallery';
  try {
    return await addDoc(collection(db, path), {
      src: item.src.slice(0, 1000000),
      title: item.title.slice(0, 200),
      category: item.category,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
};

export const deleteGalleryItem = async (id: string) => {
  const path = `gallery/${id}`;
  try {
    await deleteDoc(doc(db, 'gallery', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
};

export const updateGalleryItem = async (id: string, data: Partial<{ src: string; title: string; category: string }>) => {
  const path = `gallery/${id}`;
  try {
    const payload: Record<string, any> = { updatedAt: serverTimestamp() };
    if (data.src !== undefined) payload.src = data.src.slice(0, 1000000);
    if (data.title !== undefined) payload.title = data.title.slice(0, 200);
    if (data.category !== undefined) payload.category = data.category;
    await updateDoc(doc(db, 'gallery', id), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
};

export const getMainConfig = async () => {
  const path = 'config/main';
  try {
    const docSnap = await getDoc(doc(db, path));
    if (docSnap.exists()) {
      return docSnap.data();
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return null;
  }
};

export const updateMainConfig = async (data: any) => {
  const path = 'config/main';
  try {
    await setDoc(doc(db, path), data, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const sendEmailNotification = async (data: { name: string; phone: string; email: string; program: string; message: string }) => {
  try {
    const res = await fetch('https://formsubmit.co/ajax/nanalaa@naver.com', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        _subject: `[한국공예치료사협회] 새 수강/상담 신청: ${data.name}님 (${data.program})`,
        "신청자 성함": data.name,
        "연락처": data.phone,
        "신청자 이메일": data.email || "미입력",
        "신청 과정": data.program,
        "문의 및 요청사항": data.message || "없음",
        "접수일시": new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
        _template: "table"
      })
    });
    return res.ok;
  } catch (error) {
    console.warn("이메일 발송 알림 오류 (DB에는 안전하게 저장됨):", error);
    return false;
  }
};

export const addApplication = async (data: { name: string; phone: string; email: string; program: string; message: string }) => {
  const path = 'applications';
  try {
    const docRef = await addDoc(collection(db, path), {
      name: data.name.slice(0, 100),
      phone: data.phone.slice(0, 50),
      email: (data.email || '').slice(0, 200),
      program: data.program.slice(0, 200),
      message: (data.message || '').slice(0, 5000),
      status: 'pending',
      createdAt: serverTimestamp(),
    });

    // nanalaa@naver.com 네이버 메일로 실시간 알림 전송 (비동기 백그라운드)
    sendEmailNotification(data).catch(() => {});

    return docRef;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
};

export const getApplications = async () => {
  const path = 'applications';
  try {
    const q = query(collection(db, path), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
};

export const deleteApplication = async (id: string) => {
  const path = `applications/${id}`;
  try {
    await deleteDoc(doc(db, 'applications', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
};
