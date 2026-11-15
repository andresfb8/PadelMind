import { useEffect, useState } from 'react';
import { redirectError, signInWithGoogle } from '../data/auth';

export default function LoginScreen() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void redirectError().then((message) => {
      if (message) setError(message);
    });
  }, []);

  const enter = () => {
    setError(null);
    signInWithGoogle().catch((e: unknown) => {
      setError(e instanceof Error ? e.message : 'No se pudo iniciar sesión');
    });
  };

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-2xl font-bold">Padel Mind &amp; Match</h1>
      <button onClick={enter} className="rounded-xl bg-blue-600 px-6 py-4 text-lg font-bold active:brightness-125">
        Entrar con Google
      </button>
      {error && <p className="text-center text-sm text-red-400">{error}</p>}
    </div>
  );
}
