import { SHOTS, SHOT_LABEL, ZONES, ZONE_LABEL } from '../domain/helpers';
import type { Shot, Zone } from '../domain/types';

type Props = {
  onPick: (shot: Shot) => void;
  selected?: Shot | null;
  // Solo en modo vídeo: añade la fila de zona.
  zone?: { selected: Zone | null; onPick: (zone: Zone) => void };
};

// Con la zona (modo vídeo) el panel queda abierto, así que se compacta: sin título y botones más bajos,
// para tapar lo menos posible el marcador en pantallas pequeñas.
const chip = (active: boolean, compact: boolean) =>
  `${compact ? 'h-10' : 'h-11'} rounded-lg text-sm font-semibold active:brightness-125 ${active ? 'bg-blue-600' : 'bg-slate-700'}`;

export default function ShotRow({ onPick, selected = null, zone }: Props) {
  const compact = zone !== undefined;
  return (
    <div className="absolute inset-x-0 bottom-0 z-10 space-y-1 rounded-xl bg-[#0b0f14] p-2">
      {!compact && <p className="text-center text-xs text-slate-400">¿Con qué golpe? (opcional)</p>}
      <div className="grid grid-cols-4 gap-2">
        {SHOTS.map((shot) => (
          <button key={shot} onClick={() => onPick(shot)} className={chip(selected === shot, compact)}>
            {SHOT_LABEL[shot]}
          </button>
        ))}
      </div>
      {zone && (
        <div className="grid grid-cols-2 gap-2">
          {ZONES.map((z) => (
            <button key={z} onClick={() => zone.onPick(z)} className={chip(zone.selected === z, compact)}>
              {ZONE_LABEL[z]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
