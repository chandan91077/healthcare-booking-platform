// Firebase Admin SDK initialization.
// Supports either FIREBASE_SERVICE_ACCOUNT_JSON (recommended for deployment)
// or local serviceAccountKey.json for development.
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const keyPath = path.join(__dirname, '..', 'serviceAccountKey.json');

let initError = null;

const normalizeServiceAccount = (serviceAccount) => {
    if (!serviceAccount || typeof serviceAccount !== 'object') {
        return null;
    }

    if (typeof serviceAccount.private_key === 'string') {
        serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }

    return serviceAccount;
};

const initFromEnv = () => {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!raw) {
        return false;
    }

    try {
        const parsed = normalizeServiceAccount(JSON.parse(raw));
        admin.initializeApp({
            credential: admin.credential.cert(parsed),
            projectId: parsed.project_id || process.env.FIREBASE_PROJECT_ID,
        });
        return true;
    } catch (error) {
        initError = error;
        console.error('Firebase Admin init from FIREBASE_SERVICE_ACCOUNT_JSON failed:', error.message);
        return false;
    }
};

const initFromFile = () => {
    if (!fs.existsSync(keyPath)) {
        return false;
    }

    try {
        const serviceAccount = normalizeServiceAccount(require(keyPath));
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            projectId: serviceAccount.project_id || process.env.FIREBASE_PROJECT_ID,
        });
        return true;
    } catch (error) {
        initError = error;
        console.error('Firebase Admin init from serviceAccountKey.json failed:', error.message);
        return false;
    }
};

if (!admin.apps.length) {
    const initialized = initFromEnv() || initFromFile();
    if (!initialized) {
        console.error(
            'Firebase Admin is not initialized. Set FIREBASE_SERVICE_ACCOUNT_JSON in deployment ' +
            'or add server/serviceAccountKey.json for local development.'
        );
    }
}

const isFirebaseReady = () => admin.apps.length > 0;

const getFirebaseProjectId = () => {
    if (!isFirebaseReady()) {
        return process.env.FIREBASE_PROJECT_ID || null;
    }

    return admin.app().options.projectId || process.env.FIREBASE_PROJECT_ID || null;
};

const getFirebaseInitError = () => initError;

module.exports = {
    admin,
    isFirebaseReady,
    getFirebaseProjectId,
    getFirebaseInitError,
};
