import type { ReactNode } from 'react';
import type { EmotionEffect, EmotionSummary } from '../../domain/analytics/emotions';
import type { Closing, Pressure } from '../../domain/analytics/pressure';
import { topUnforcedShot, type PlayerTechnical } from '../../domain/analytics/technical';
import type { Ratio } from '../../domain/analytics/types';
import { percentText, ratioText, ratioValue, signed } from '../../domain/format';
import { EMOTION_LABEL, SHOT_LABEL } from '../../domain/helpers';

export type NameOf = (playerId: string) => string;
type Tone = 'good' | 'bad' | undefined;

const TONE_CLASS = { good: 'text-green-400', bad: 'text-red-400' };

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-5">
      <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400">{title}</h2>
      <div className="rounded-xl bg-slate-900 p-3">{children}</div>
    </section>
  );
}

function Stat({ value, label, tone }: { value: string; label: string; tone?: Tone }) {
  return (
    <div className="text-center">
      <p className={`text-2xl font-bold ${tone ? TONE_CLASS[tone] : ''}`}>{value}</p>
      <p className="text-xs text-slate-400">{label}</p>
    </div>
  );
}

const countLabel = (r: Ratio) => (r.total === 0 ? 'sin casos' : ratioText(r));

// Un solo error con un golpe no es un patrón: solo se señala a partir de este número.
const MIN_SHOT_ERRORS = 2;

export function TechnicalSection({
  rows,
  withoutDetail,
  name,
}: {
  rows: PlayerTechnical[];
  withoutDetail: number;
  name: NameOf;
}) {
  return (
    <>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-slate-400">
            <th className="py-1 text-left font-semibold" />
            <th className="font-semibold">Winners</th>
            <th className="font-semibold">No forz.</th>
            <th className="font-semibold">Forzados</th>
            <th className="font-semibold">Balance</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.playerId} className="border-t border-slate-800 text-center">
              <td className="py-2 text-left">{name(r.playerId)}</td>
              <td>{r.winners}</td>
              <td>{r.unforced}</td>
              <td>{r.forced}</td>
              <td className={`font-bold ${r.balance < 0 ? TONE_CLASS.bad : r.balance > 0 ? TONE_CLASS.good : ''}`}>
                {signed(r.balance)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.map((r) => {
        const top = topUnforcedShot(r);
        return top && top.count >= MIN_SHOT_ERRORS ? (
          <p key={r.playerId} className="mt-2 text-xs text-slate-400">
            {name(r.playerId)} falla sobre todo de {SHOT_LABEL[top.shot].toLowerCase()} ({top.count} de {top.of} no
            forzados con golpe anotado).
          </p>
        ) : null;
      })}
      {withoutDetail > 0 && (
        <p className="mt-2 text-xs text-slate-400">
          {withoutDetail} {withoutDetail === 1 ? 'punto' : 'puntos'} sin detalle: cuentan en el marcador, no aquí.
        </p>
      )}
    </>
  );
}

export function PressureSection({ pressure }: { pressure: Pressure }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <Stat value={countLabel(pressure.golden)} label="puntos de oro ganados" />
      <Stat value={countLabel(pressure.breakConverted)} label="bolas de break convertidas" />
      <Stat value={countLabel(pressure.breakSaved)} label="bolas de break salvadas" />
    </div>
  );
}

export function ClosingSection({ closing }: { closing: Closing }) {
  const a = ratioValue(closing.closing);
  const b = ratioValue(closing.rest);
  const tone: Tone = a !== null && b !== null ? (a < b ? 'bad' : 'good') : undefined;
  return (
    <div className="grid grid-cols-2 gap-2">
      <Stat
        value={percentText(closing.closing)}
        tone={tone}
        label={`puntos ganados sacando para cerrar set (${closing.closing.total})`}
      />
      <Stat value={percentText(closing.rest)} label={`puntos ganados en el resto del partido (${closing.rest.total})`} />
    </div>
  );
}

export function ResilienceSection({ rows, name }: { rows: { playerId: string; ratio: Ratio }[]; name: NameOf }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {rows.map((r) => (
        <Stat
          key={r.playerId}
          value={percentText(r.ratio)}
          label={`${name(r.playerId)}: gana el punto siguiente a un no forzado suyo (${countLabel(r.ratio)})`}
        />
      ))}
    </div>
  );
}

export function EmotionsSection({
  effects,
  summary,
  pointsWon,
  name,
}: {
  effects: EmotionEffect[];
  summary: EmotionSummary[];
  pointsWon: Ratio;
  name: NameOf;
}) {
  if (effects.length === 0) return <p className="text-sm text-slate-400">No se anotó ninguna emoción en este partido.</p>;
  return (
    <>
      {effects.map((e) => {
        const rate = ratioValue(e.window);
        const tone: Tone = rate === null ? undefined : rate < 0.5 ? 'bad' : rate > 0.5 ? 'good' : undefined;
        return (
          <div key={e.emotionId} className="flex justify-between gap-3 border-b border-slate-800 py-2 text-xs last:border-0">
            <span>
              {name(e.playerId)} · {EMOTION_LABEL[e.tag]} · {e.contextLabel}
            </span>
            <span className={`shrink-0 text-right ${tone ? TONE_CLASS[tone] : 'text-slate-400'}`}>
              {e.window.total === 0
                ? 'sin puntos después'
                : `${e.window.won} de ${e.window.total} siguientes${
                    e.unforcedByPlayer > 0 ? ` · ${e.unforcedByPlayer} no forz. suyos` : ''
                  }`}
            </span>
          </div>
        );
      })}
      <h3 className="mb-1 mt-3 text-xs font-bold text-slate-400">Por jugador y emoción</h3>
      {summary.map((s) => (
        <p key={`${s.playerId}${s.tag}`} className="py-1 text-xs">
          {name(s.playerId)} · {EMOTION_LABEL[s.tag]} ({s.count}):{' '}
          {s.afterTag.total === 0
            ? 'sin puntos después.'
            : `gana ${percentText(s.afterTag)} de los puntos siguientes frente a ${percentText(pointsWon)} en el partido.`}
        </p>
      ))}
      <p className="mt-2 text-[10px] text-slate-500">
        Pocas emociones por partido: son pistas, no conclusiones. El patrón fiable sale al sumar varios partidos.
      </p>
    </>
  );
}
