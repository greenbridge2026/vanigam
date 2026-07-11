import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

let db = null;
let isFirebaseConfigured = false;

if (firebaseConfig.apiKey && firebaseConfig.projectId) {
  try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    isFirebaseConfigured = true;
    console.log('✅ Firebase Client: Firestore initialized successfully');
  } catch (err) {
    console.error('❌ Firebase Client: Failed to initialize SDK:', err);
  }
} else {
  console.warn('⚠️ Firebase Client: Configuration environment variables are missing. App will fall back to Express HTTP polling.');
}

export { db, isFirebaseConfigured };
