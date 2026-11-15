import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';

// Desplegada, la app usa su propio dominio para el acceso con Google (vercel.json
// redirige /__/auth/ a Firebase); es lo que permite iniciar sesión en la app instalada en iOS.
// En local no existe esa redirección, así que se usa el dominio de Firebase.
const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);
const authDomain = import.meta.env.PROD && !isLocal ? window.location.host : import.meta.env.VITE_FIREBASE_AUTH_DOMAIN;

const app = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
});

export const auth = getAuth(app);

// Caché persistente: las escrituras se aplican en local y suben cuando hay red.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});
