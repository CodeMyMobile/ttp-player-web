import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface UseApiRequestOptions<TParams extends Record<string, unknown>> {
  skip?: boolean;
  immediate?: boolean;
  paramsSerializer?: (params: TParams) => string;
}

export interface UseApiRequestResult<
  TData,
  TParams extends Record<string, unknown>,
> {
  data: TData | undefined;
  error: Error | undefined;
  loading: boolean;
  refetch: (overrideParams?: Partial<TParams>) => Promise<TData>;
}

const defaultSerializer = (params: Record<string, unknown>) => JSON.stringify(params);

export function useApiRequest<
  TData,
  TParams extends Record<string, unknown>,
>(
  fetcher: (params: TParams) => Promise<TData>,
  params: TParams,
  { skip = false, immediate = true, paramsSerializer }: UseApiRequestOptions<TParams> = {},
): UseApiRequestResult<TData, TParams> {
  const [data, setData] = useState<TData>();
  const [error, setError] = useState<Error>();
  const [loading, setLoading] = useState(false);

  const serializer = paramsSerializer ?? defaultSerializer;
  const serializedParams = useMemo(() => serializer(params), [params, serializer]);

  // The params go through a ref, and only their SERIALIZED form is a dependency
  // below.
  //
  // Depending on the params object itself made a caller that built it inline —
  // `useMemo(() => ({ user }), [user])` with a `user` that is rebuilt whenever
  // the auth session syncs — refetch on identity alone. Each fetch re-rendered,
  // each re-render produced a new object, and a request that 401'd refreshed the
  // session, which fired auth:session-refreshed, which rebuilt `user` again. The
  // browser ran out of sockets: GET /leagues, ERR_INSUFFICIENT_RESOURCES.
  //
  // Serialized params still refetch on a real change of value, which is the
  // behaviour every caller wants; identity churn now costs nothing.
  const paramsRef = useRef(params);
  paramsRef.current = params;

  const execute = useCallback(
    async (overrideParams?: Partial<TParams>) => {
      const finalParams = {
        ...paramsRef.current,
        ...(overrideParams ?? {}),
      } as TParams;

      setLoading(true);
      setError(undefined);
      try {
        const result = await fetcher(finalParams);
        setData(result);
        return result;
      } catch (err) {
        setError(err as Error);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [fetcher, serializedParams],
  );

  useEffect(() => {
    if (skip || !immediate) {
      return;
    }
    void execute();
  }, [execute, skip, immediate, serializedParams]);

  return {
    data,
    error,
    loading,
    refetch: execute,
  };
}
