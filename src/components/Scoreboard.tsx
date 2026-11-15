import { situationTag } from '../domain/helpers';
import type { MatchState } from '../domain/scoring';
import type { Side } from '../domain/types';

function Row(props: { name: string; side: Side; state: MatchState }) {
  const { state, side } = props;
  const s = state.situation;
  const pick = (v: { us: number; them: number }) => (side === 'us' ? v.us : v.them);
  return (
    <div className="flex items-center gap-3 py-1">
      <span className={`h-2.5 w-2.5 rounded-full ${s?.server === side ? 'bg-yellow-400' : 'bg-transparent'}`} />
      <span className="min-w-0 flex-1 truncate">{props.name}</span>
      {state.completedSets.map((set, i) => (
        <span key={i} className="w-6 text-center text-lg text-slate-400">{pick(set)}</span>
      ))}
      {s && (
        <>
          <span className="w-6 text-center text-lg font-bold">{side === 'us' ? s.gamesUs : s.gamesThem}</span>
          <span className="w-10 rounded bg-slate-900 text-center text-xl font-bold">
            {side === 'us' ? s.pointLabelUs : s.pointLabelThem}
          </span>
        </>
      )}
    </div>
  );
}

export default function Scoreboard(props: { usName: string; themName: string; state: MatchState }) {
  const tag = props.state.finished
    ? `PARTIDO TERMINADO · gana ${props.state.winner === 'us' ? props.usName : props.themName}`
    : situationTag(props.state.situation);
  return (
    <div className="flash rounded-xl bg-[#141b24] px-3 py-2">
      <Row name={props.usName} side="us" state={props.state} />
      <Row name={props.themName} side="them" state={props.state} />
      <p className="h-5 text-center text-xs font-bold text-yellow-400">{tag}</p>
    </div>
  );
}
