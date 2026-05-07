import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const INVALIDATE = Symbol("invalidate");

const hashKey = (key) => {
  if (Array.isArray(key)) return JSON.stringify(key);
  if (typeof key === "string") return key;
  return JSON.stringify(key || []);
};

class QueryClient {
  constructor() {
    this.cache = new Map();
    this.subscribers = new Map();
  }

  getQueryData(queryKey) {
    return this.cache.get(hashKey(queryKey));
  }

  setQueryData(queryKey, updater) {
    const key = hashKey(queryKey);
    const previous = this.cache.get(key);
    const value =
      typeof updater === "function" ? updater(previous) : updater;
    this.cache.set(key, value);
    this.#notify(key, value);
    return value;
  }

  invalidateQueries({ queryKey }) {
    const key = hashKey(queryKey);
    this.cache.delete(key);
    this.#notify(key, INVALIDATE);
  }

  subscribe(queryKey, listener) {
    const key = hashKey(queryKey);
    const listeners = this.subscribers.get(key) || new Set();
    listeners.add(listener);
    this.subscribers.set(key, listeners);
    return () => {
      const current = this.subscribers.get(key);
      if (!current) return;
      current.delete(listener);
      if (!current.size) {
        this.subscribers.delete(key);
      }
    };
  }

  #notify(key, value) {
    const listeners = this.subscribers.get(key);
    if (!listeners || !listeners.size) return;
    listeners.forEach((listener) => {
      try {
        listener(value);
      } catch (error) {
        console.error("Query listener error", error);
      }
    });
  }
}

const QueryClientContext = createContext(null);

const QueryClientProvider = ({ client, children }) => {
  if (!client) {
    throw new Error("QueryClientProvider requires a client instance");
  }
  const value = useMemo(() => client, [client]);
  return createElement(QueryClientContext.Provider, { value }, children);
};

const useQueryClient = () => {
  const client = useContext(QueryClientContext);
  if (!client) {
    throw new Error("useQueryClient must be used within a QueryClientProvider");
  }
  return client;
};

const useQuery = ({ queryKey, queryFn, enabled = true, retry = false }) => {
  const client = useQueryClient();
  const key = useMemo(() => hashKey(queryKey), [queryKey]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableQueryKey = useMemo(() => queryKey, [key]);
  const queryFnRef = useRef(queryFn);
  queryFnRef.current = queryFn;

  const getInitialState = useCallback(() => {
    const cached = client.getQueryData(stableQueryKey);
    if (cached !== undefined) {
      return { status: "success", data: cached, error: null };
    }
    return {
      status: enabled ? "loading" : "idle",
      data: cached,
      error: null,
    };
  }, [client, stableQueryKey, enabled]);

  const [state, setState] = useState(getInitialState);

  useEffect(() => {
    setState(getInitialState());
  }, [getInitialState, key]);

  const execute = useCallback(async () => {
    if (!enabled || typeof queryFnRef.current !== "function") return undefined;
    setState((prev) => ({ ...prev, status: "loading", error: null }));
    let attempts = 0;
    const run = async () => {
      attempts += 1;
      try {
        const result = await queryFnRef.current();
        client.setQueryData(stableQueryKey, result);
        setState({ status: "success", data: result, error: null });
        return result;
      } catch (error) {
        if (retry && attempts <= 3) {
          return run();
        }
        setState({ status: "error", data: undefined, error });
        throw error;
      }
    };
    return run();
  }, [client, stableQueryKey, enabled, retry]);

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    if (state.status === "loading" || state.status === "idle") {
      execute().catch(() => {
        /* handled in state */
      });
    }
    const unsubscribe = client.subscribe(stableQueryKey, (value) => {
      if (cancelled) return;
      if (value === INVALIDATE) {
        execute().catch(() => {
          /* handled */
        });
        return;
      }
      setState({ status: "success", data: value, error: null });
    });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [client, execute, key, stableQueryKey, enabled, state.status]);

  const refetch = useCallback(() => execute(), [execute]);

  return {
    data: state.data,
    error: state.error,
    status: state.status,
    isLoading: state.status === "loading",
    isError: state.status === "error",
    isSuccess: state.status === "success",
    refetch,
  };
};

const useMutation = ({ mutationFn, onSuccess, onError, onSettled } = {}) => {
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);

  const mutateAsync = useCallback(
    async (variables) => {
      if (typeof mutationFn !== "function") {
        throw new Error("mutationFn must be a function");
      }
      setStatus("pending");
      setError(null);
      try {
        const result = await mutationFn(variables);
        setStatus("success");
        onSuccess?.(result, variables, undefined);
        onSettled?.(result, null, variables, undefined);
        return result;
      } catch (err) {
        setStatus("error");
        setError(err);
        onError?.(err, variables, undefined);
        onSettled?.(undefined, err, variables, undefined);
        throw err;
      }
    },
    [mutationFn, onError, onSettled, onSuccess],
  );

  const mutate = useCallback(
    (variables) => {
      mutateAsync(variables).catch(() => {
        /* error already stored */
      });
    },
    [mutateAsync],
  );

  return {
    mutate,
    mutateAsync,
    status,
    error,
    isPending: status === "pending",
    isError: status === "error",
    isSuccess: status === "success",
  };
};

const createQueryClient = () => new QueryClient();

export {
  QueryClient,
  QueryClientProvider,
  createQueryClient,
  useMutation,
  useQuery,
  useQueryClient,
};
