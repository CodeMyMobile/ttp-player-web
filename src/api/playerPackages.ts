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

export interface PackagePurchase {
  id?: number | string;
  coach_id?: number | string;
  coach_package_id?: number | string;
  credits_total?: number;
  credits_used?: number;
  credits_remaining?: number;
  expires_at?: string | null;
  purchased_at?: string | null;
  status?: string;
  lesson_types_allowed?: string[];
  metadata?: Record<string, unknown>;
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
  coachId: number | string;
  includeExpired?: boolean;
  signal?: AbortSignal;
}

export interface FetchPackageCreditsBalanceParams {
  token: string;
  coachId?: number | string;
  signal?: AbortSignal;
}

export interface PurchaseCoachPackageParams {
  token: string;
  packageId: number | string;
  paymentMethodId: string;
}

export interface ConsumePackageCreditsParams {
  token: string;
  coachId: number | string;
  lessonType: string;
  lessonId?: number | string;
  purchaseId?: number | string;
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
    signal,
    query: {
      coachId,
      includeExpired,
    },
  });

export const fetchPackageCreditsBalance = ({ token, coachId, signal }: FetchPackageCreditsBalanceParams) =>
  request<PackageCreditsBalanceResponse>("/player/packages/credits/balance", {
    token,
    signal,
    query: {
      coachId,
    },
  });

export const purchaseCoachPackage = ({ token, packageId, paymentMethodId }: PurchaseCoachPackageParams) =>
  request<PurchasePackageResponse>(`/player/packages/${packageId}/purchase`, {
    method: "POST",
    token,
    body: {
      payment_method_id: paymentMethodId,
    },
  });

export const consumePackageCredits = ({
  token,
  coachId,
  lessonType,
  lessonId,
  purchaseId,
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
    },
  });
