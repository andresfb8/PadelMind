import type { Outcome } from '../domain/types';

type Register = (outcome: Outcome, playerId: string | null) => void;

const BTN = 'rounded-xl font-bold text-white active:scale-95 active:brightness-125 disabled:opacity-30';

function PlayerColumn(props: { name: string; playerId: string; disabled: boolean; onRegister: Register }) {
  const { playerId, disabled, onRegister } = props;
  return (
    <div className="flex flex-1 flex-col gap-2">
      <p className="truncate text-center text-xs uppercase tracking-wide text-slate-400">{props.name}</p>
      <button disabled={disabled} onClick={() => onRegister('winner_nuestro', playerId)} className={`${BTN} h-16 bg-green-700`}>
        Winner
      </button>
      <button disabled={disabled} onClick={() => onRegister('no_forzado_nuestro', playerId)} className={`${BTN} h-16 bg-amber-700`}>
        No forzado
      </button>
      <button disabled={disabled} onClick={() => onRegister('forzado_nuestro', playerId)} className={`${BTN} h-16 bg-red-700`}>
        Forzado
      </button>
    </div>
  );
}

export default function OutcomeButtons(props: {
  left: { id: string; name: string };
  right: { id: string; name: string };
  disabled: boolean;
  onRegister: Register;
}) {
  const { disabled, onRegister } = props;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <PlayerColumn name={props.left.name} playerId={props.left.id} disabled={disabled} onRegister={onRegister} />
        <PlayerColumn name={props.right.name} playerId={props.right.id} disabled={disabled} onRegister={onRegister} />
      </div>
      <div className="flex gap-2">
        <button disabled={disabled} onClick={() => onRegister('error_rival', null)} className={`${BTN} h-14 flex-1 bg-green-700`}>
          Error rival
        </button>
        <button disabled={disabled} onClick={() => onRegister('winner_rival', null)} className={`${BTN} h-14 flex-1 bg-red-700`}>
          Winner rival
        </button>
      </div>
      <div className="flex gap-2">
        <button disabled={disabled} onClick={() => onRegister('nuestro_sin_detalle', null)} className={`${BTN} h-10 flex-1 bg-slate-700 text-sm`}>
          Punto nuestro
        </button>
        <button disabled={disabled} onClick={() => onRegister('rival_sin_detalle', null)} className={`${BTN} h-10 flex-1 bg-slate-700 text-sm`}>
          Punto rival
        </button>
      </div>
    </div>
  );
}
