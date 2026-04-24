/// <reference types="vite/client" />
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, deleteDoc, onSnapshot, query, where, orderBy, serverTimestamp, getDocFromServer } from 'firebase/firestore';
import defaultFirebaseConfig from '../firebase-applet-config.json';

const getEnv = (key: string, fallback: string) => {
  const val = (import.meta as any).env[key];
  if (!val || val === 'your_api_key_here' || val === 'YOUR_API_KEY') {
    return fallback;
  }
  if (key === 'VITE_FIREBASE_API_KEY' && !val.startsWith('AIza')) {
    return fallback;
  }
  return val;
}

const firebaseConfig = {
  apiKey: getEnv('VITE_FIREBASE_API_KEY', defaultFirebaseConfig.apiKey),
  authDomain: getEnv('VITE_FIREBASE_AUTH_DOMAIN', defaultFirebaseConfig.authDomain),
  projectId: getEnv('VITE_FIREBASE_PROJECT_ID', defaultFirebaseConfig.projectId),
  storageBucket: getEnv('VITE_FIREBASE_STORAGE_BUCKET', defaultFirebaseConfig.storageBucket),
  messagingSenderId: getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID', defaultFirebaseConfig.messagingSenderId),
  appId: getEnv('VITE_FIREBASE_APP_ID', defaultFirebaseConfig.appId),
  measurementId: getEnv('VITE_FIREBASE_MEASUREMENT_ID', defaultFirebaseConfig.measurementId || ''),
  firestoreDatabaseId: getEnv('VITE_FIREBASE_DATABASE_ID', (defaultFirebaseConfig as any).firestoreDatabaseId || '')
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId as string);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const signIn = () => signInWithPopup(auth, googleProvider);
export const signOut = () => auth.signOut();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
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
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Connection test
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();
