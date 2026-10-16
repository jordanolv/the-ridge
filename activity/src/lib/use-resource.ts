import { useCallback, useEffect, useState } from 'react';

type Resource<T> = { status: 'loading' } | { status: 'error' } | { status: 'ready'; data: T };

/** Charge les données d'une section ; `reload` relance le chargement sans repasser par l'état vide. */
export function useResource<T>(load: () => Promise<T>) {
  const [resource, setResource] = useState<Resource<T>>({ status: 'loading' });

  const reload = useCallback(() => {
    load()
      .then(data => setResource({ status: 'ready', data }))
      .catch(error => {
        console.error(error);
        setResource(current => (current.status === 'ready' ? current : { status: 'error' }));
      });
  }, [load]);

  useEffect(reload, [reload]);

  return { resource, reload };
}
