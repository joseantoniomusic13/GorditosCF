// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyD3xCdhJUSRXLVYDJezwfHS2J1YZsdMyJ8",
  authDomain: "gorditoscf-49fcc.firebaseapp.com",
  projectId: "gorditoscf-49fcc",
  storageBucket: "gorditoscf-49fcc.firebasestorage.app",
  messagingSenderId: "1065234036943",
  appId: "1:1065234036943:web:1f0e1363908ac1b88a1fba",
  measurementId: "G-16WC2J191F"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Exportar servicios listos para usar
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);