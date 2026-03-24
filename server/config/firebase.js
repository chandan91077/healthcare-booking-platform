// Firebase Admin SDK initialization.
// Reads service account from serviceAccountKey.json (not committed to git).
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const keyPath = path.join(__dirname, '..', 'serviceAccountKey.json');

if (!admin.apps.length) {
    if (fs.existsSync(keyPath)) {
        const serviceAccount = require(keyPath);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
        });
    } else {
        console.error(
            '⚠️  serviceAccountKey.json not found. Firebase Admin will not be initialized.\n' +
            '   Download it from Firebase Console → Project Settings → Service Accounts.'
        );
    }
}

module.exports = admin;
