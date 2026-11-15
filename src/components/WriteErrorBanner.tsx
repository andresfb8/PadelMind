import { clearWriteErrors, useWriteErrors } from '../data/writeErrors';

export default function WriteErrorBanner() {
  const errors = useWriteErrors();
  if (errors.length === 0) return null;
  return (
    <div
      className="fixed inset-x-0 top-0 z-50 bg-red-700 p-3 text-sm"
      style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)' }}
    >
      {errors.map((e, i) => (
        <p key={i}>{e}</p>
      ))}
      <button onClick={clearWriteErrors} className="mt-2 rounded bg-red-900 px-3 py-1 font-bold">
        Entendido
      </button>
    </div>
  );
}
