import { orderBy, query } from 'firebase/firestore';
import { useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ImagePreview from '../components/report/ImagePreview';
import ReportView from '../components/report/ReportView';
import { pairName, playerName, useCoachData } from '../data/CoachData';
import { emotionsCol, pointsCol } from '../data/paths';
import { useQuery } from '../data/useQuery';
import { buildReport } from '../domain/analytics/report';
import { formatLabel, reportFileName } from '../domain/format';
import type { Emotion, Match, Player, Point } from '../domain/types';
import { useReportImage } from '../hooks/useReportImage';
import { shareImage } from '../lib/exportImage';

export default function ReportScreen() {
  const { matchId } = useParams();
  const { uid, matches, players, loading } = useCoachData();
  const match = matches.find((m) => m.id === matchId);
  if (loading) return <p className="p-6 text-slate-400">Cargando…</p>;
  if (!match) {
    return (
      <p className="p-6 text-slate-400">
        Partido no encontrado. <Link to="/" className="underline">Volver</Link>
      </p>
    );
  }
  return <Report uid={uid} match={match} players={players} />;
}

function Report({ uid, match, players }: { uid: string; match: Match; players: Player[] }) {
  const pointsQ = useQuery<Point>(useMemo(() => query(pointsCol(uid, match.id), orderBy('order')), [uid, match.id]));
  const emotionsQ = useQuery<Emotion>(
    useMemo(() => query(emotionsCol(uid, match.id), orderBy('timestamp')), [uid, match.id]),
  );

  const report = useMemo(
    () => buildReport(match, pointsQ.data, emotionsQ.data),
    [match, pointsQ.data, emotionsQ.data],
  );

  const pair = pairName(players, match.playerIds);
  const title = `${pair} vs ${match.opponentsName}`;
  const subtitle = `${new Date(match.date).toLocaleDateString('es-ES')} · ${formatLabel(match.format)}`;

  // Las consultas entregan una lista nueva en cada instantánea, aunque los datos sean los mismos
  // (por ejemplo, al sincronizar). Se prepara la imagen solo cuando cambia el contenido del informe.
  const contentKey = useMemo(() => JSON.stringify([report, title, subtitle]), [report, title, subtitle]);

  const cardRef = useRef<HTMLDivElement>(null);
  const image = useReportImage(cardRef, contentKey);
  const [message, setMessage] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);

  // Se llama directamente desde el toque: la imagen ya está preparada (ver useReportImage).
  const share = () => {
    if (image.status !== 'ready') return;
    setMessage(null);
    void shareImage(image.blob, reportFileName(pair, match.date), title).then(
      (result) =>
        setMessage(result === 'downloaded' ? 'Imagen guardada en tus descargas. Si no la encuentras, usa «Ver imagen».' : null),
      () => setMessage('No se pudo compartir la imagen. Prueba con «Ver imagen».'),
    );
  };

  // Solo se espera a los puntos: una consulta vacía y sin caché (sin emociones, por ejemplo) puede
  // tardar unos segundos en responder sin red, y el informe puede pintarse ya sin ellas.
  if (pointsQ.loading) return <p className="p-6 text-slate-400">Cargando…</p>;

  const ready = image.status === 'ready' && report.played.length > 0;

  return (
    <div className="mx-auto h-full max-w-xl overflow-y-auto">
      <div className="flex items-center justify-between p-3 text-sm text-slate-400">
        <Link to="/" className="py-2">← Partidos</Link>
        {match.status === 'in_progress' && (
          <Link to={`/partido/${match.id}`} className="px-2 py-2">Volver al registro</Link>
        )}
      </div>

      <ReportView
        ref={cardRef}
        report={report}
        title={title}
        subtitle={subtitle}
        name={(id) => playerName(players, id)}
      />

      <div className="space-y-2 p-4">
        <button
          onClick={share}
          disabled={!ready}
          className="h-14 w-full rounded-xl bg-blue-600 text-lg font-bold active:brightness-125 disabled:opacity-40"
        >
          {image.status === 'preparing' ? 'Preparando imagen…' : 'Compartir informe'}
        </button>
        <button
          onClick={() => setPreviewing(true)}
          disabled={!ready}
          className="h-11 w-full rounded-xl bg-slate-800 font-bold active:brightness-125 disabled:opacity-40"
        >
          Ver imagen
        </button>
        {image.status === 'error' && (
          <p className="text-center text-sm text-red-400">No se pudo preparar la imagen: {image.message}</p>
        )}
        {message && <p className="text-center text-sm text-slate-400">{message}</p>}
      </div>

      {previewing && image.status === 'ready' && <ImagePreview blob={image.blob} onClose={() => setPreviewing(false)} />}
    </div>
  );
}
