import { useEffect, useState, type RefObject } from 'react';
import { renderNodeToPng } from '../lib/exportImage';

export type ReportImage =
  | { status: 'preparing' }
  | { status: 'ready'; blob: Blob }
  | { status: 'error'; message: string };

const SETTLE_MS = 700;

// Prepara la imagen del informe en cuanto la pantalla se asienta, para que al pulsar "Compartir"
// ya esté lista. `version` cambia cuando cambia el contenido y obliga a prepararla de nuevo.
export function useReportImage(ref: RefObject<HTMLElement | null>, version: unknown): ReportImage {
  const [image, setImage] = useState<ReportImage>({ status: 'preparing' });

  useEffect(() => {
    let cancelled = false;
    setImage({ status: 'preparing' });
    const timer = setTimeout(() => {
      const node = ref.current;
      if (!node) return;
      renderNodeToPng(node).then(
        (blob) => {
          if (!cancelled) setImage({ status: 'ready', blob });
        },
        (e: unknown) => {
          if (!cancelled) setImage({ status: 'error', message: e instanceof Error ? e.message : 'Error desconocido' });
        },
      );
    }, SETTLE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [ref, version]);

  return image;
}
