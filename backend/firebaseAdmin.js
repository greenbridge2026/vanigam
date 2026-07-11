import admin from 'firebase-admin';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from root directory
dotenv.config({ path: path.join(__dirname, '../.env') });

let db = null;
let isMock = false;

function getFirebaseCredentials() {
  // 1. Try Service Account Path
  const saPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (saPath) {
    const resolvedPath = path.resolve(__dirname, '..', saPath);
    if (fs.existsSync(resolvedPath)) {
      try {
        const serviceAccount = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
        return admin.credential.cert(serviceAccount);
      } catch (e) {
        console.error('Error parsing service account file:', e);
      }
    }
  }

  // 2. Try individual environment variables
  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    try {
      // Replace escaped newlines
      const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
      return admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: privateKey,
      });
    } catch (e) {
      console.error('Error constructing credentials from env variables:', e);
    }
  }

  return null;
}

try {
  const credential = getFirebaseCredentials();
  if (credential) {
    admin.initializeApp({
      credential,
      projectId: process.env.FIREBASE_PROJECT_ID || undefined
    });
    db = admin.firestore();
    console.log('✅ Firebase Admin: Connected to Firestore database');
  } else {
    console.warn('⚠️ Firebase Admin: Credentials not found in .env or serviceAccountKey.json. Server will fall back to local db.json database.');
    isMock = true;
  }
} catch (err) {
  console.error('❌ Firebase Admin: Failed to initialize. Falling back to db.json:', err);
  isMock = true;
}

export { db, isMock, admin };
