import type { UseApiRequestOptions } from "./useApiRequest";
import { useApiRequest } from "./useApiRequest";
import {
  addFavorite,
  blockPlayer,
  fetchBlockedPlayers,
  fetchCoachDetailsById,
  fetchPlayerDetails,
  getAllCoachesSchedules,
  getAllLocation,
  getCheckLocation,
  getNearestCoaches,
  getPlayerCoaches,
  getPlayerExternalLessonById,
  getPlayerExternalLessons,
  getPlayerFutureGroupLessons,
  getPlayerFutureLessons,
  getPlayerUpcomingLessonsHub,
  getSuggestedPlayerCheckLocation,
  getUserVerificationLevel,
  listFavorites,
  recordExternalLessonClick,
  removeFavorite,
  requestCoachPlayer,
  unblockPlayer,
  updateCoachStatus,
  updatePlayerFutureLessons,
  verifyUserLevel,
  type AllCoachesSchedulesParams,
  type BlockPlayerParams,
  type FetchCoachDetailsByIdParams,
  type FetchPlayerDetailsParams,
  type FavoriteParams,
  type GetCheckLocationParams,
  type ListFavoritesParams,
  type NearestCoachesParams,
  type PlayerCoachesParams,
  type PlayerExternalLessonByIdParams,
  type PlayerExternalLessonsParams,
  type PlayerFutureGroupLessonsParams,
  type PlayerFutureLessonsParams,
  type PlayerUpcomingLessonsHubParams,
  type PlayerTokenOnlyParams,
  type RecordExternalLessonClickParams,
  type RequestCoachPlayerParams,
  type SuggestedPlayerCheckLocationParams,
  type UpdateCoachStatusParams,
  type UpdatePlayerFutureLessonsParams,
  type VerifyUserLevelParams,
} from "../api/playerHome";

export const usePlayerFutureLessons = (
  params: PlayerFutureLessonsParams,
  options?: UseApiRequestOptions<PlayerFutureLessonsParams>,
) => useApiRequest(getPlayerFutureLessons, params, options);

export const usePlayerFutureGroupLessons = (
  params: PlayerFutureGroupLessonsParams,
  options?: UseApiRequestOptions<PlayerFutureGroupLessonsParams>,
) => useApiRequest(getPlayerFutureGroupLessons, params, options);

export const usePlayerExternalLessons = (
  params: PlayerExternalLessonsParams,
  options?: UseApiRequestOptions<PlayerExternalLessonsParams>,
) => useApiRequest(getPlayerExternalLessons, params, options);

export const usePlayerExternalLessonById = (
  params: PlayerExternalLessonByIdParams,
  options?: UseApiRequestOptions<PlayerExternalLessonByIdParams>,
) => useApiRequest(getPlayerExternalLessonById, params, options);

export const usePlayerUpcomingLessonsHub = (
  params: PlayerUpcomingLessonsHubParams,
  options?: UseApiRequestOptions<PlayerUpcomingLessonsHubParams>,
) => useApiRequest(getPlayerUpcomingLessonsHub, params, options);

export const usePlayerCoaches = (
  params: PlayerCoachesParams = {},
  options?: UseApiRequestOptions<PlayerCoachesParams>,
) => useApiRequest(getPlayerCoaches, params, options);

export const useFetchCoachDetailsById = (
  params: FetchCoachDetailsByIdParams,
  options?: UseApiRequestOptions<FetchCoachDetailsByIdParams>,
) => useApiRequest(fetchCoachDetailsById, params, options);

export const useNearestCoaches = (
  params: NearestCoachesParams,
  options?: UseApiRequestOptions<NearestCoachesParams>,
) => useApiRequest(getNearestCoaches, params, options);

export const useAllLocation = (
  params: PlayerTokenOnlyParams,
  options?: UseApiRequestOptions<PlayerTokenOnlyParams>,
) => useApiRequest(getAllLocation, params, options);

export const useRecordExternalLessonClick = (
  params: RecordExternalLessonClickParams,
  options?: UseApiRequestOptions<RecordExternalLessonClickParams>,
) => useApiRequest(recordExternalLessonClick, params, { immediate: false, ...(options ?? {}) });

export const useUpdatePlayerFutureLessons = (
  params: UpdatePlayerFutureLessonsParams,
  options?: UseApiRequestOptions<UpdatePlayerFutureLessonsParams>,
) => useApiRequest(updatePlayerFutureLessons, params, { immediate: false, ...(options ?? {}) });

export const useUpdateCoachStatus = (
  params: UpdateCoachStatusParams,
  options?: UseApiRequestOptions<UpdateCoachStatusParams>,
) => useApiRequest(updateCoachStatus, params, { immediate: false, ...(options ?? {}) });

export const useRequestCoachPlayer = (
  params: RequestCoachPlayerParams,
  options?: UseApiRequestOptions<RequestCoachPlayerParams>,
) => useApiRequest(requestCoachPlayer, params, { immediate: false, ...(options ?? {}) });

export const useCheckLocation = (
  params: GetCheckLocationParams,
  options?: UseApiRequestOptions<GetCheckLocationParams>,
) => useApiRequest(getCheckLocation, params, options);

export const useFetchPlayerDetails = (
  params: FetchPlayerDetailsParams,
  options?: UseApiRequestOptions<FetchPlayerDetailsParams>,
) => useApiRequest(fetchPlayerDetails, params, options);

export const useSuggestedPlayerCheckLocation = (
  params: SuggestedPlayerCheckLocationParams,
  options?: UseApiRequestOptions<SuggestedPlayerCheckLocationParams>,
) => useApiRequest(getSuggestedPlayerCheckLocation, params, options);

export const useAddFavorite = (
  params: FavoriteParams,
  options?: UseApiRequestOptions<FavoriteParams>,
) => useApiRequest(addFavorite, params, { immediate: false, ...(options ?? {}) });

export const useRemoveFavorite = (
  params: FavoriteParams,
  options?: UseApiRequestOptions<FavoriteParams>,
) => useApiRequest(removeFavorite, params, { immediate: false, ...(options ?? {}) });

export const useListFavorites = (
  params: ListFavoritesParams,
  options?: UseApiRequestOptions<ListFavoritesParams>,
) => useApiRequest(listFavorites, params, options);

export const useUserVerificationLevel = (
  params: PlayerTokenOnlyParams,
  options?: UseApiRequestOptions<PlayerTokenOnlyParams>,
) => useApiRequest(getUserVerificationLevel, params, options);

export const useVerifyUserLevel = (
  params: VerifyUserLevelParams,
  options?: UseApiRequestOptions<VerifyUserLevelParams>,
) => useApiRequest(verifyUserLevel, params, { immediate: false, ...(options ?? {}) });

export const useAllCoachesSchedules = (
  params: AllCoachesSchedulesParams,
  options?: UseApiRequestOptions<AllCoachesSchedulesParams>,
) => useApiRequest(getAllCoachesSchedules, params, options);

export const useBlockPlayer = (
  params: BlockPlayerParams,
  options?: UseApiRequestOptions<BlockPlayerParams>,
) => useApiRequest(blockPlayer, params, { immediate: false, ...(options ?? {}) });

export const useUnblockPlayer = (
  params: BlockPlayerParams,
  options?: UseApiRequestOptions<BlockPlayerParams>,
) => useApiRequest(unblockPlayer, params, { immediate: false, ...(options ?? {}) });

export const useFetchBlockedPlayers = (
  params: PlayerTokenOnlyParams,
  options?: UseApiRequestOptions<PlayerTokenOnlyParams>,
) => useApiRequest(fetchBlockedPlayers, params, options);
