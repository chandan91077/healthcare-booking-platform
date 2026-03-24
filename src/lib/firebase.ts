import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBJrYrcsFMkDCHk-7Hb3eAfIo1MzYGQ1MM",
  authDomain: "mediconnect-8536b.firebaseapp.com",
  projectId: "mediconnect-8536b",
  storageBucket: "mediconnect-8536b.firebasestorage.app",
  messagingSenderId: "686900284890",
  appId: "1:686900284890:android:ee7a9aee288049b39984e3",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
