export default function SyncBadge(props: { hasPending: boolean; pendingPoints: number }) {
  if (!props.hasPending) return <p className="text-right text-xs text-slate-500">Todo guardado</p>;
  const text =
    props.pendingPoints > 0
      ? `${props.pendingPoints} ${props.pendingPoints === 1 ? 'punto' : 'puntos'} sin sincronizar`
      : 'Cambios sin sincronizar';
  return <p className="text-right text-xs text-amber-400">{text}</p>;
}
