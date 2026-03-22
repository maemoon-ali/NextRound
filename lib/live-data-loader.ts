/**
 * Legacy shim — all data now comes from the LiveData API via lib/livedata-api.ts.
 * This file is kept only for backward-compatibility type exports.
 */

export type { CompanyMeta } from "./livedata-api";

/** @deprecated Use searchPeople() from lib/livedata-api.ts instead. */
export function loadLiveData() {
  return [];
}

/** @deprecated Use getCompanyMetaFromApi() from lib/livedata-api.ts instead. */
export function getCompanyMetaFromLiveData() {
  return null;
}
