/**
 * Types aligned with LiveDataTechnologies People Data Dictionary
 * https://docs.gotlivedata.com/docs/notion-dd-preview
 */

export type JobLevel =
  | "intern"
  | "entry"
  | "senior"
  | "manager"
  | "director"
  | "vp"
  | "c_suite";

export type JobFunction =
  | "engineering"
  | "product"
  | "design"
  | "sales"
  | "marketing"
  | "operations"
  | "finance"
  | "data_science"
  | "customer_success";

export type RoleType = "intern" | "full-time" | "part-time" | "contract" | "freelance";

export type StartedAtConfidence = "validated" | "low" | "medium" | "high";

export interface StartedAtDetails {
  confidence: StartedAtConfidence;
  is_first_at_company?: boolean;
}

export interface LocationDetails {
  zip_code?: string;
  msa?: string;
  city?: string;
  region?: string;
  country?: string;
}

export interface Company {
  name: string;
  industry?: string;
  employee_count?: number;
  domain?: string;
  country?: string;
  /** URL to company logo image (e.g. from Clearbit or static asset). */
  logo_url?: string;
}

export interface LiveDataJob {
  title: string;
  level: JobLevel;
  function: JobFunction;
  company: Company;
  location?: string;
  location_details?: LocationDetails;
  started_at: string; // ISO date
  started_at_details?: StartedAtDetails;
  end_date?: string;
  role_type?: RoleType;
  salary?: number; // annual, for our mock data
}

export interface LiveDataPerson {
  id: string;
  /** Display name for UI (e.g. "Sarah Chen"). */
  display_name?: string;
  /** LinkedIn profile URL. */
  linkedin_url?: string;
  job_history: LiveDataJob[];
  current_position: LiveDataJob; // their current job (where they are "now")
}

export type DegreeType =
  | "Associate"
  | "BA"
  | "BS"
  | "BEng"
  | "MS"
  | "MA"
  | "MBA"
  | "MFA"
  | "MEng"
  | "PhD"
  | "JD"
  | "MD"
  | "Other";

export interface UserEducationEntry {
  school_name: string;
  degree_type: DegreeType | "";
  major: string;
  /** Enrollment start year, e.g. 2018 */
  start_year: number;
  /** Graduation year; 0 = in progress */
  end_year: number;
}

export interface UserJobEntry {
  company_name: string;
  years_employment: number;
  salary: number;
  role_type: RoleType;
  title: string;
  level?: JobLevel;
  function?: JobFunction;
  location?: string;
}
