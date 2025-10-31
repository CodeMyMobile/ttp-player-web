import { useCallback, useEffect, useMemo, useState } from "react";

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
  const stableParams = useMemo(() => params, [serializedParams]);

  const execute = useCallback(
    async (overrideParams?: Partial<TParams>) => {
      const finalParams = {
        ...stableParams,
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
    [fetcher, stableParams, serializedParams],
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
