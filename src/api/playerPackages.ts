import { request } from "./http";

export interface CoachPackage {
  id: number | string;
  name: string;
  description?: string;
  lesson_count: number;
  total_price: number | string;
  validity_months?: number | null;
  lesson_types_allowed?: string[];
  is_active?: boolean;
  [key: string]: unknown;
}

export interface CoachPackageListResponse {
  packages?: CoachPackage[];
}

// Snapshot of the purchased package captured at purchase time (lives on
// metadata.package_snapshot in the raw payload). Present in the response but
// previously untyped.
export interface PackageSnapshot {
  name?: string;
  description?: string;
  lesson_count?: number;
  total_price?: string | number;
  validity_months?: number;
}

export interface PackagePurchaseMetadata {
  package_snapshot?: PackageSnapshot;
  charged_at?: string;
  [key: string]: unknown;
}

export interface PackagePurchase {
  id?: number | string;
  coach_id?: number | string;
  coach_package_id?: number | string;
  credits_total?: number;
  credits_used?: number;
  credits_remaining?: number;
  // Present in the raw payload but previously dropped from this type.
  amount_paid?: string;
  currency?: string;
  expires_at?: string | null;
  purchased_at?: string | null;
  reserved_at?: string | null;
  created_at?: string | null;
  status?: string;
  paid?: boolean;
  reserved_payment_method_id?: string | null;
  stripe_payment_intent_id?: string | null;
  charged_payment_intent_id?: string | null;
  lesson_types_allowed?: string[];
  metadata?: PackagePurchaseMetadata;
  [key: string]: unknown;
}

export interface PackageCreditsResponse {
  purchases?: PackagePurchase[];
}

export interface PackageCreditsBalanceResponse {
  available?: number;
  held?: number;
  total?: number;
}

export interface PurchasePackageResponse {
  purchase?: PackagePurchase;
  paymentIntent?: {
    id?: string;
    status?: string;
    client_secret?: string;
    [key: string]: unknown;
  } | null;
  [key: string]: unknown;
}

export interface FetchCoachPackagesParams {
  token?: string;
  coachId: number | string;
  signal?: AbortSignal;
}

export interface FetchPackageCreditsParams {
  token: string;
  // Omit to request all of the player's credits across coaches (the endpoint drops
  // the coachId filter when it's absent). Per-coach callers still pass it.
  coachId?: number | string;
  includeExpired?: boolean;
  signal?: AbortSignal;
}

export interface FetchPackageCreditsBalanceParams {
  token: string;
  coachId?: number | string;
  lessonType?: string;
  signal?: AbortSignal;
}

export interface PurchaseCoachPackageParams {
  token: string;
  packageId: number | string;
  paymentMethodId: string;
  idempotencyKey?: string;
}

export const isReservedPackagePurchase = (purchase?: PackagePurchase | null) =>
  purchase?.status === "reserved" || purchase?.paid === false;

export const isActivePackagePurchase = (purchase?: PackagePurchase | null) =>
  Boolean(purchase) &&
  !isReservedPackagePurchase(purchase) &&
  ["succeeded", "partially_used", "exhausted"].includes(String(purchase?.status ?? ""));

export const getPackageCreditsRemaining = (purchase?: PackagePurchase | null) => {
  if (!purchase || isReservedPackagePurchase(purchase)) return 0;
  const remaining = Number(purchase.credits_remaining ?? 0);
  return Number.isFinite(remaining) ? Math.max(remaining, 0) : 0;
};

export interface ConsumePackageCreditsParams {
  token: string;
  coachId: number | string;
  lessonType: string;
  lessonId: number | string;
  purchaseId?: number | string;
  participantId?: number | string;
}

export interface ConsumePackageCreditsResponse {
  purchase?: PackagePurchase;
  usage?: {
    id?: number | string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export const fetchCoachPackages = ({ token, coachId, signal }: FetchCoachPackagesParams) =>
  request<CoachPackageListResponse>("/player/packages", {
    token,
    signal,
    query: {
      coachId,
    },
  });

export const fetchPackageCredits = ({
  token,
  coachId,
  includeExpired = false,
  signal,
}: FetchPackageCreditsParams) =>
  request<PackageCreditsResponse>("/player/packages/credits", {
    token,
    authScheme: "Token",
    signal,
    query: {
      coachId,
      includeExpired,
    },
  });

export const fetchPackageCreditsBalance = ({ token, coachId, lessonType, signal }: FetchPackageCreditsBalanceParams) =>
  request<PackageCreditsBalanceResponse>("/player/packages/credits/balance", {
    token,
    authScheme: "Token",
    signal,
    query: {
      coachId,
      lessonType,
    },
  });

const packageCheckoutStorageKey = (packageId: number | string, paymentMethodId: string) =>
  `package-checkout:${packageId}:${paymentMethodId}`;

const createCheckoutIdempotencyKey = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const getCheckoutIdempotencyKey = (packageId: number | string, paymentMethodId: string) => {
  const storageKey = packageCheckoutStorageKey(packageId, paymentMethodId);
  try {
    const existing = window.sessionStorage.getItem(storageKey);
    if (existing) return existing;
    const created = createCheckoutIdempotencyKey();
    window.sessionStorage.setItem(storageKey, created);
    return created;
  } catch {
    return createCheckoutIdempotencyKey();
  }
};

const clearCheckoutIdempotencyKey = (packageId: number | string, paymentMethodId: string) => {
  try {
    window.sessionStorage.removeItem(packageCheckoutStorageKey(packageId, paymentMethodId));
  } catch {
    // A storage failure only affects retry convenience; it must not block checkout.
  }
};

export const purchaseCoachPackage = async ({
  token,
  packageId,
  paymentMethodId,
  idempotencyKey,
}: PurchaseCoachPackageParams) => {
  const checkoutIdempotencyKey =
    idempotencyKey || getCheckoutIdempotencyKey(packageId, paymentMethodId);
  try {
    const response = await request<PurchasePackageResponse>(`/player/packages/${packageId}/reserve`, {
      method: "POST",
      token,
      authScheme: "Token",
      body: {
        payment_method_id: paymentMethodId,
        idempotency_key: checkoutIdempotencyKey,
      },
    });
    clearCheckoutIdempotencyKey(packageId, paymentMethodId);
    return response;
  } catch (error) {
    const status = (error as Error & { status?: number }).status;
    if (status === 402 || status === 409) {
      clearCheckoutIdempotencyKey(packageId, paymentMethodId);
    }
    throw error;
  }
};

export const reserveCoachPackage = purchaseCoachPackage;

export const consumePackageCredits = ({
  token,
  coachId,
  lessonType,
  lessonId,
  purchaseId,
  participantId,
}: ConsumePackageCreditsParams) =>
  request<ConsumePackageCreditsResponse>("/player/packages/credits/consume", {
    method: "POST",
    token,
    authScheme: "Token",
    body: {
      coachId,
      lessonType,
      lessonId,
      purchaseId,
      ...(participantId != null ? { participantId } : {}),
    },
  });
