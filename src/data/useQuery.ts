import { onSnapshot, type Query } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { reportWriteError } from './writeErrors';

export type QueryState<T> = {
  data: T[];
  loading: boolean;
  pending: number;      // documentos con escrituras sin sincronizar
  hasPending: boolean;  // hay algún cambio sin sincronizar, incluidos borrados
};

// `q` debe venir de useMemo: una consulta nueva en cada render reiniciaría la suscripción.
export function useQuery<T>(q: Query): QueryState<T> {
  const [state, setState] = useState<QueryState<T>>({ data: [], loading: true, pending: 0, hasPending: false });

  useEffect(() => {
    return onSnapshot(
      q,
      { includeMetadataChanges: true },
      (snap) => {
        setState({
          data: snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T),
          loading: false,
          pending: snap.docs.filter((d) => d.metadata.hasPendingWrites).length,
          hasPending: snap.metadata.hasPendingWrites,
        });
      },
      (e) => {
        // Por ejemplo, reglas sin publicar: sin esto la app se quedaría en "Cargando…".
        reportWriteError(`No se pudieron leer los datos: ${e.message}`);
        setState((prev) => ({ ...prev, loading: false }));
      },
    );
  }, [q]);

  return state;
}
