import { toBlob } from 'html-to-image';

export const REPORT_BACKGROUND = '#0b0f14';

// Convierte un elemento en una imagen PNG (el doble de resolución que en pantalla).
export async function renderNodeToPng(node: HTMLElement): Promise<Blob> {
  const options = { pixelRatio: 2, backgroundColor: REPORT_BACKGROUND };
  // Safari a veces devuelve una imagen incompleta en la primera pasada: se descarta y se repite.
  await toBlob(node, options);
  const blob = await toBlob(node, options);
  if (!blob) throw new Error('No se pudo generar la imagen');
  return blob;
}

export type ShareResult = 'shared' | 'downloaded' | 'cancelled';

// Abre el menú de compartir del sistema con la imagen; si el dispositivo no lo permite, la descarga.
// Hay que llamarla directamente desde el toque del usuario, sin esperar nada antes: iOS rechaza
// compartir si ha pasado tiempo desde el toque. Por eso la imagen se prepara antes (useReportImage).
export function shareImage(blob: Blob, filename: string, title: string): Promise<ShareResult> {
  const file = new File([blob], filename, { type: 'image/png' });
  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    return navigator.share({ files: [file], title }).then(
      () => 'shared' as const,
      (e: unknown) => {
        if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled' as const;
        downloadBlob(blob, filename);
        return 'downloaded' as const;
      },
    );
  }
  downloadBlob(blob, filename);
  return Promise.resolve('downloaded');
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
