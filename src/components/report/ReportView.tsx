import type { Ref } from 'react';
import type { Report } from '../../domain/analytics/report';
import MomentumChart from './MomentumChart';
import {
  ClosingSection,
  EmotionsSection,
  PressureSection,
  ResilienceSection,
  Section,
  TechnicalSection,
  type NameOf,
} from './ReportSections';

type Props = {
  report: Report;
  title: string;
  subtitle: string;
  name: NameOf;
  ref?: Ref<HTMLDivElement>;
};

// El informe completo. `ref` apunta al elemento que se convierte en imagen al compartir.
export default function ReportView({ report, title, subtitle, name, ref }: Props) {
  return (
    <div ref={ref} className="bg-[#0b0f14] p-4 text-slate-100">
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-lg font-bold">{title}</p>
          <p className="text-xs text-slate-400">{subtitle}</p>
        </div>
        <p className="shrink-0 text-lg font-bold">{report.setsText}</p>
      </div>

      {report.played.length === 0 ? (
        <p className="mt-8 text-center text-slate-400">Todavía no hay puntos registrados.</p>
      ) : (
        <>
          <Section title="1 · Momentum">
            <MomentumChart momentum={report.momentum} />
          </Section>
          <Section title="2 · Resumen técnico">
            <TechnicalSection rows={report.technical} withoutDetail={report.withoutDetail} name={name} />
          </Section>
          <Section title="3 · Bajo presión">
            <PressureSection pressure={report.pressure} />
          </Section>
          <Section title="4 · Síndrome de cierre">
            <ClosingSection closing={report.closing} />
          </Section>
          <Section title="5 · Resiliencia">
            <ResilienceSection rows={report.resilience} name={name} />
          </Section>
          <Section title="6 · Efecto de las emociones">
            <EmotionsSection
              effects={report.emotions}
              summary={report.emotionSummary}
              pointsWon={report.pointsWon}
              name={name}
            />
          </Section>
        </>
      )}
    </div>
  );
}
