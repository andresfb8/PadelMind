import { useEffect, useState } from 'react';

// Muestra la imagen ya generada para guardarla o compartirla manteniéndola pulsada. Es el recurso
// de reserva si el menú de compartir o la descarga no funcionan en el dispositivo.
export default function ImagePreview({ blob, onClose }: { blob: Blob; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const objectUrl = URL.createObjectURL(blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [blob]);

  return (
    <div
      className="fixed inset-0 z-40 flex flex-col bg-black/90"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-center justify-between gap-3 p-3 text-sm">
        <p className="text-slate-300">Mantén pulsada la imagen para guardarla o compartirla.</p>
        <button onClick={onClose} className="shrink-0 px-3 py-2 font-bold">
          Cerrar
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {url && (
          <img
            src={url}
            alt="Informe del partido"
            className="mx-auto w-full max-w-xl"
            style={{ WebkitTouchCallout: 'default', userSelect: 'auto' }}
          />
        )}
      </div>
    </div>
  );
}
