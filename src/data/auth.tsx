import {
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User,
} from 'firebase/auth';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { auth } from './firebase';

// undefined = todavía no se sabe; null = sin sesión
type AuthState = { user: User | null | undefined };

const Ctx = createContext<AuthState>({ user: undefined });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  useEffect(() => onAuthStateChanged(auth, setUser), []);
  return <Ctx.Provider value={{ user }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);

// App instalada en la pantalla de inicio (iOS expone `navigator.standalone`).
function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as { standalone?: boolean }).standalone === true
  );
}

export async function signInWithGoogle(): Promise<void> {
  const provider = new GoogleAuthProvider();
  // En la app instalada las ventanas emergentes pueden abrirse y no volver nunca: se usa redirección.
  if (isStandalone()) {
    await signInWithRedirect(auth, provider);
    return;
  }
  try {
    await signInWithPopup(auth, provider);
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
      await signInWithRedirect(auth, provider);
      return;
    }
    throw e;
  }
}

export const signOutUser = () => signOut(auth);

// Errores de un acceso por redirección que acaba de volver a la app.
export const redirectError = () =>
  getRedirectResult(auth).then(
    () => null,
    (e: unknown) => (e instanceof Error ? e.message : 'No se pudo iniciar sesión'),
  );
