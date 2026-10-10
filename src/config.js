// src/config.js

// Lista de UIDs de Firebase Auth permitidos para acceder al panel de administración.
export const ADMIN_UIDS = [
  "8BgNvErBfxcEyKgVbNO6S2Y1vcH2", // Presidente C.D. Gorditos C.F
];

// Helper para verificar si un UID es administrador en el cliente
export const checkIsAdmin = (uid) => {
  return ADMIN_UIDS.includes(uid);
};
