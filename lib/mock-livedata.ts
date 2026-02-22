/**
 * Mock workforce data: 30–40 companies, varied locations.
 * People Data Dictionary: level, function, location_details, started_at_details.
 */

import type { LiveDataPerson, LiveDataJob, LocationDetails } from "./livedata-types";

/** Company logos (Clearbit/favicon). Stored with workforce data. */
export const COMPANY_LOGOS: Record<string, string> = {
  Stripe: "https://logo.clearbit.com/stripe.com",
  Vercel: "https://logo.clearbit.com/vercel.com",
  Notion: "https://logo.clearbit.com/notion.so",
  Figma: "https://logo.clearbit.com/figma.com",
  Meta: "https://logo.clearbit.com/meta.com",
  Anthropic: "https://logo.clearbit.com/anthropic.com",
  Google: "https://logo.clearbit.com/google.com",
  OpenAI: "https://logo.clearbit.com/openai.com",
  Airbnb: "https://logo.clearbit.com/airbnb.com",
  Linear: "https://logo.clearbit.com/linear.app",
  Salesforce: "https://logo.clearbit.com/salesforce.com",
  HubSpot: "https://logo.clearbit.com/hubspot.com",
  Amazon: "https://logo.clearbit.com/amazon.com",
  Slack: "https://logo.clearbit.com/slack.com",
  Microsoft: "https://logo.clearbit.com/microsoft.com",
  Apple: "https://logo.clearbit.com/apple.com",
  Netflix: "https://logo.clearbit.com/netflix.com",
  Adobe: "https://logo.clearbit.com/adobe.com",
  Spotify: "https://logo.clearbit.com/spotify.com",
  Dropbox: "https://logo.clearbit.com/dropbox.com",
  Square: "https://logo.clearbit.com/squareup.com",
  Asana: "https://logo.clearbit.com/asana.com",
  Atlassian: "https://logo.clearbit.com/atlassian.com",
  Twilio: "https://logo.clearbit.com/twilio.com",
  Snowflake: "https://logo.clearbit.com/snowflake.com",
  Databricks: "https://logo.clearbit.com/databricks.com",
  Nvidia: "https://logo.clearbit.com/nvidia.com",
  GitHub: "https://logo.clearbit.com/github.com",
  MongoDB: "https://logo.clearbit.com/mongodb.com",
  Zoom: "https://logo.clearbit.com/zoom.us",
  DocuSign: "https://logo.clearbit.com/docusign.com",
  Okta: "https://logo.clearbit.com/okta.com",
  ServiceNow: "https://logo.clearbit.com/servicenow.com",
  Workday: "https://logo.clearbit.com/workday.com",
  IBM: "https://logo.clearbit.com/ibm.com",
  Oracle: "https://logo.clearbit.com/oracle.com",
  Cisco: "https://logo.clearbit.com/cisco.com",
  Elastic: "https://logo.clearbit.com/elastic.co",
  HashiCorp: "https://logo.clearbit.com/hashicorp.com",
  GitLab: "https://logo.clearbit.com/gitlab.com",
  Twitch: "https://logo.clearbit.com/twitch.tv",
  Lyft: "https://logo.clearbit.com/lyft.com",
  Uber: "https://logo.clearbit.com/uber.com",
  DoorDash: "https://logo.clearbit.com/doordash.com",
  Coinbase: "https://logo.clearbit.com/coinbase.com",
};

/** Company careers / jobs page URLs for Apply button. */
export const COMPANY_CAREERS: Record<string, string> = {
  Stripe: "https://stripe.com/jobs",
  Vercel: "https://vercel.com/careers",
  Notion: "https://www.notion.so/careers",
  Figma: "https://www.figma.com/careers",
  Meta: "https://www.metacareers.com",
  Anthropic: "https://www.anthropic.com/careers",
  Google: "https://careers.google.com",
  OpenAI: "https://openai.com/careers",
  Airbnb: "https://careers.airbnb.com",
  Linear: "https://linear.app/careers",
  Salesforce: "https://www.salesforce.com/company/careers",
  HubSpot: "https://www.hubspot.com/careers",
  Amazon: "https://www.amazon.jobs",
  Slack: "https://slack.com/careers",
  Microsoft: "https://careers.microsoft.com",
  Apple: "https://jobs.apple.com",
  Netflix: "https://jobs.netflix.com",
  Adobe: "https://careers.adobe.com",
  Spotify: "https://www.spotifyjobs.com",
  Dropbox: "https://www.dropbox.com/jobs",
  Atlassian: "https://www.atlassian.com/company/careers",
  Twilio: "https://www.twilio.com/company/jobs",
  Snowflake: "https://www.snowflake.com/careers",
  Databricks: "https://www.databricks.com/company/careers",
  Nvidia: "https://www.nvidia.com/en-us/about-nvidia/careers",
  GitHub: "https://github.com/careers",
  MongoDB: "https://www.mongodb.com/careers",
  Zoom: "https://careers.zoom.us",
  DocuSign: "https://www.docusign.com/company/careers",
  Okta: "https://www.okta.com/company/careers",
  ServiceNow: "https://www.servicenow.com/careers",
  Workday: "https://workday.com/careers",
  IBM: "https://www.ibm.com/careers",
  Oracle: "https://www.oracle.com/careers",
  Cisco: "https://www.cisco.com/c/en/us/about/careers.html",
  Elastic: "https://www.elastic.co/careers",
  HashiCorp: "https://www.hashicorp.com/careers",
  GitLab: "https://about.gitlab.com/jobs",
  Twitch: "https://www.twitch.tv/jobs",
  Lyft: "https://www.lyft.com/careers",
  Uber: "https://www.uber.com/careers",
  DoorDash: "https://www.doordash.com/careers",
  Coinbase: "https://www.coinbase.com/careers",
  Square: "https://block.xyz/careers",
};

function loc(city: string, region: string, country: string): { location: string; location_details: LocationDetails } {
  return {
    location: `${city}, ${region}`,
    location_details: { city, region, country },
  };
}

function job(
  title: string,
  company: string,
  level: LiveDataJob["level"],
  fn: LiveDataJob["function"],
  started: string,
  endDate?: string,
  salary?: number,
  locationStr?: string,
  locationDetails?: LocationDetails
): LiveDataJob {
  const logoUrl = COMPANY_LOGOS[company];
  const locLabel = locationStr ?? "San Francisco, CA";
  const details = locationDetails ?? { city: "San Francisco", region: "CA", country: "US" };
  return {
    title,
    level,
    function: fn,
    company: {
      name: company,
      industry: "Technology",
      employee_count: 500,
      ...(logoUrl && { logo_url: logoUrl }),
    },
    started_at: started,
    started_at_details: { confidence: "validated", is_first_at_company: !endDate },
    end_date: endDate,
    salary,
    location: locLabel,
    location_details: details,
  };
}

const SF = loc("San Francisco", "CA", "US");
const NYC = loc("New York", "NY", "US");
const SEA = loc("Seattle", "WA", "US");
const AUS = loc("Austin", "TX", "US");
const BOS = loc("Boston", "MA", "US");
const DEN = loc("Denver", "CO", "US");
const LA = loc("Los Angeles", "CA", "US");
const CHI = loc("Chicago", "IL", "US");
const REM = loc("Remote", "Remote", "US");

export const MOCK_PEOPLE: LiveDataPerson[] = [
  {
    id: "p1",
    job_history: [
      job("Software Engineer Intern", "Stripe", "intern", "engineering", "2020-06", "2020-08", 72000),
      job("Software Engineer", "Stripe", "entry", "engineering", "2021-06", "2023-05", 145000),
    ],
    current_position: job("Senior Software Engineer", "Vercel", "senior", "engineering", "2023-06", undefined, 195000, SF.location, SF.location_details),
  },
  {
    id: "p2",
    job_history: [
      job("Product Intern", "Notion", "intern", "product", "2019-05", "2019-08", 65000),
      job("Associate Product Manager", "Notion", "entry", "product", "2020-07", "2022-06", 120000),
    ],
    current_position: job("Product Manager", "Figma", "manager", "product", "2022-07", undefined, 175000, SF.location, SF.location_details),
  },
  {
    id: "p3",
    job_history: [
      job("Data Science Intern", "Meta", "intern", "data_science", "2020-06", "2020-09", 80000),
      job("Data Scientist", "Meta", "entry", "data_science", "2021-06", "2023-04", 155000),
    ],
    current_position: job("Senior Data Scientist", "Anthropic", "senior", "data_science", "2023-05", undefined, 220000, SF.location, SF.location_details),
  },
  {
    id: "p4",
    job_history: [
      job("Software Engineer", "Google", "entry", "engineering", "2018-07", "2021-06", 130000),
      job("Senior Software Engineer", "Google", "senior", "engineering", "2021-07", "2024-01", 185000),
    ],
    current_position: job("Staff Engineer", "OpenAI", "director", "engineering", "2024-02", undefined, 280000, SF.location, SF.location_details),
  },
  {
    id: "p5",
    job_history: [
      job("Design Intern", "Airbnb", "intern", "design", "2019-06", "2019-09", 60000),
      job("Product Designer", "Airbnb", "entry", "design", "2020-06", "2023-02", 135000),
    ],
    current_position: job("Senior Product Designer", "Linear", "senior", "design", "2023-03", undefined, 185000, NYC.location, NYC.location_details),
  },
  {
    id: "p6",
    job_history: [
      job("Sales Development Rep", "Salesforce", "entry", "sales", "2017-06", "2019-05", 70000),
      job("Account Executive", "Salesforce", "senior", "sales", "2019-06", "2022-08", 140000),
    ],
    current_position: job("Senior Account Executive", "HubSpot", "senior", "sales", "2022-09", undefined, 180000, BOS.location, BOS.location_details),
  },
  {
    id: "p7",
    job_history: [
      job("Software Engineer", "Amazon", "entry", "engineering", "2019-07", "2022-04", 125000),
      job("Software Engineer II", "Amazon", "senior", "engineering", "2022-05", "2024-03", 165000),
    ],
    current_position: job("Senior Software Engineer", "Stripe", "senior", "engineering", "2024-04", undefined, 210000, SF.location, SF.location_details),
  },
  {
    id: "p8",
    job_history: [
      job("Marketing Coordinator", "Slack", "entry", "marketing", "2018-08", "2020-12", 68000),
      job("Product Marketing Manager", "Slack", "manager", "marketing", "2021-01", "2023-06", 145000),
    ],
    current_position: job("Senior Product Marketing Manager", "Notion", "senior", "marketing", "2023-07", undefined, 175000, NYC.location, NYC.location_details),
  },
  {
    id: "p9",
    job_history: [
      job("Engineering Intern", "Stripe", "intern", "engineering", "2021-05", "2021-08", 75000),
      job("Software Engineer", "Stripe", "entry", "engineering", "2022-06", "2024-05", 150000),
    ],
    current_position: job("Software Engineer", "Vercel", "entry", "engineering", "2024-06", undefined, 165000, SF.location, SF.location_details),
  },
  {
    id: "p10",
    job_history: [
      job("Product Manager Intern", "Figma", "intern", "product", "2020-06", "2020-09", 70000),
      job("Associate Product Manager", "Figma", "entry", "product", "2021-06", "2023-08", 130000),
    ],
    current_position: job("Product Manager", "Vercel", "manager", "product", "2023-09", undefined, 170000, REM.location, REM.location_details),
  },
  {
    id: "p11",
    job_history: [
      job("SWE Intern", "Microsoft", "intern", "engineering", "2019-06", "2019-09", 85000),
      job("Software Engineer", "Microsoft", "entry", "engineering", "2020-07", "2023-04", 145000),
    ],
    current_position: job("Senior Software Engineer", "Microsoft", "senior", "engineering", "2023-05", undefined, 195000, SEA.location, SEA.location_details),
  },
  {
    id: "p12",
    job_history: [
      job("Product Analyst", "Google", "entry", "product", "2018-08", "2021-05", 115000),
      job("Product Manager", "Netflix", "manager", "product", "2021-06", "2023-12", 220000),
    ],
    current_position: job("Product Manager", "Netflix", "manager", "product", "2021-06", undefined, 220000, LA.location, LA.location_details),
  },
  {
    id: "p13",
    job_history: [
      job("Design Intern", "Adobe", "intern", "design", "2020-06", "2020-09", 62000),
      job("UX Designer", "Adobe", "entry", "design", "2021-01", "2023-06", 130000),
    ],
    current_position: job("Senior UX Designer", "Adobe", "senior", "design", "2023-07", undefined, 175000, SF.location, SF.location_details),
  },
  {
    id: "p14",
    job_history: [
      job("Data Analyst", "Spotify", "entry", "data_science", "2019-07", "2022-03", 105000),
      job("Data Scientist", "Spotify", "senior", "data_science", "2022-04", undefined, 185000, NYC.location, NYC.location_details),
    ],
    current_position: job("Data Scientist", "Spotify", "senior", "data_science", "2022-04", undefined, 185000, NYC.location, NYC.location_details),
  },
  {
    id: "p15",
    job_history: [
      job("Software Engineer", "Dropbox", "entry", "engineering", "2018-06", "2021-08", 135000),
      job("Senior Software Engineer", "Dropbox", "senior", "engineering", "2021-09", undefined, 195000, SF.location, SF.location_details),
    ],
    current_position: job("Senior Software Engineer", "Dropbox", "senior", "engineering", "2021-09", undefined, 195000, SF.location, SF.location_details),
  },
  {
    id: "p16",
    job_history: [
      job("Support Engineer", "Atlassian", "entry", "engineering", "2017-09", "2020-06", 95000),
      job("Software Engineer", "Atlassian", "senior", "engineering", "2020-07", undefined, 175000, AUS.location, AUS.location_details),
    ],
    current_position: job("Software Engineer", "Atlassian", "senior", "engineering", "2020-07", undefined, 175000, AUS.location, AUS.location_details),
  },
  {
    id: "p17",
    job_history: [
      job("SDR", "Twilio", "entry", "sales", "2019-05", "2021-04", 72000),
      job("Account Executive", "Twilio", "senior", "sales", "2021-05", undefined, 165000, DEN.location, DEN.location_details),
    ],
    current_position: job("Account Executive", "Twilio", "senior", "sales", "2021-05", undefined, 165000, DEN.location, DEN.location_details),
  },
  {
    id: "p18",
    job_history: [
      job("Data Engineer", "Snowflake", "entry", "data_science", "2020-06", "2023-02", 155000),
      job("Senior Data Engineer", "Databricks", "senior", "data_science", "2023-03", undefined, 210000, SF.location, SF.location_details),
    ],
    current_position: job("Senior Data Engineer", "Databricks", "senior", "data_science", "2023-03", undefined, 210000, SF.location, SF.location_details),
  },
  {
    id: "p19",
    job_history: [
      job("ML Intern", "Nvidia", "intern", "data_science", "2021-05", "2021-08", 90000),
      job("ML Engineer", "Nvidia", "entry", "engineering", "2022-01", undefined, 190000, SF.location, SF.location_details),
    ],
    current_position: job("ML Engineer", "Nvidia", "entry", "engineering", "2022-01", undefined, 190000, SF.location, SF.location_details),
  },
  {
    id: "p20",
    job_history: [
      job("Software Engineer", "GitHub", "entry", "engineering", "2019-08", "2022-11", 150000),
      job("Senior Software Engineer", "GitHub", "senior", "engineering", "2022-12", undefined, 205000, REM.location, REM.location_details),
    ],
    current_position: job("Senior Software Engineer", "GitHub", "senior", "engineering", "2022-12", undefined, 205000, REM.location, REM.location_details),
  },
  {
    id: "p21",
    job_history: [
      job("Backend Engineer", "MongoDB", "entry", "engineering", "2020-07", "2023-04", 145000),
      job("Senior Backend Engineer", "MongoDB", "senior", "engineering", "2023-05", undefined, 195000, NYC.location, NYC.location_details),
    ],
    current_position: job("Senior Backend Engineer", "MongoDB", "senior", "engineering", "2023-05", undefined, 195000, NYC.location, NYC.location_details),
  },
  {
    id: "p22",
    job_history: [
      job("Solutions Engineer", "Zoom", "entry", "sales", "2018-06", "2021-05", 88000),
      job("Senior Solutions Engineer", "Zoom", "senior", "sales", "2021-06", undefined, 160000, SF.location, SF.location_details),
    ],
    current_position: job("Senior Solutions Engineer", "Zoom", "senior", "sales", "2021-06", undefined, 160000, SF.location, SF.location_details),
  },
  {
    id: "p23",
    job_history: [
      job("Product Manager", "DocuSign", "manager", "product", "2019-09", "2022-08", 165000),
      job("Senior Product Manager", "DocuSign", "manager", "product", "2022-09", undefined, 195000, SF.location, SF.location_details),
    ],
    current_position: job("Senior Product Manager", "DocuSign", "manager", "product", "2022-09", undefined, 195000, SF.location, SF.location_details),
  },
  {
    id: "p24",
    job_history: [
      job("Security Engineer", "Okta", "entry", "engineering", "2020-03", "2023-01", 155000),
      job("Senior Security Engineer", "Okta", "senior", "engineering", "2023-02", undefined, 200000, SF.location, SF.location_details),
    ],
    current_position: job("Senior Security Engineer", "Okta", "senior", "engineering", "2023-02", undefined, 200000, SF.location, SF.location_details),
  },
  {
    id: "p25",
    job_history: [
      job("Consultant", "ServiceNow", "entry", "operations", "2018-07", "2021-06", 105000),
      job("Senior Consultant", "ServiceNow", "senior", "operations", "2021-07", undefined, 155000, CHI.location, CHI.location_details),
    ],
    current_position: job("Senior Consultant", "ServiceNow", "senior", "operations", "2021-07", undefined, 155000, CHI.location, CHI.location_details),
  },
  {
    id: "p26",
    job_history: [
      job("Software Engineer", "Workday", "entry", "engineering", "2019-06", "2022-08", 135000),
      job("Senior Software Engineer", "Workday", "senior", "engineering", "2022-09", undefined, 185000, DEN.location, DEN.location_details),
    ],
    current_position: job("Senior Software Engineer", "Workday", "senior", "engineering", "2022-09", undefined, 185000, DEN.location, DEN.location_details),
  },
  {
    id: "p27",
    job_history: [
      job("Research Engineer", "IBM", "entry", "engineering", "2017-08", "2020-12", 120000),
      job("Senior Research Engineer", "IBM", "senior", "engineering", "2021-01", undefined, 170000, NYC.location, NYC.location_details),
    ],
    current_position: job("Senior Research Engineer", "IBM", "senior", "engineering", "2021-01", undefined, 170000, NYC.location, NYC.location_details),
  },
  {
    id: "p28",
    job_history: [
      job("Software Engineer", "Oracle", "entry", "engineering", "2018-09", "2022-03", 125000),
      job("Senior Software Engineer", "Oracle", "senior", "engineering", "2022-04", undefined, 175000, AUS.location, AUS.location_details),
    ],
    current_position: job("Senior Software Engineer", "Oracle", "senior", "engineering", "2022-04", undefined, 175000, AUS.location, AUS.location_details),
  },
  {
    id: "p29",
    job_history: [
      job("Network Engineer", "Cisco", "entry", "engineering", "2019-04", "2022-06", 115000),
      job("Senior Network Engineer", "Cisco", "senior", "engineering", "2022-07", undefined, 165000, SF.location, SF.location_details),
    ],
    current_position: job("Senior Network Engineer", "Cisco", "senior", "engineering", "2022-07", undefined, 165000, SF.location, SF.location_details),
  },
  {
    id: "p30",
    job_history: [
      job("Software Engineer", "Elastic", "entry", "engineering", "2020-05", "2023-02", 150000),
      job("Senior Software Engineer", "Elastic", "senior", "engineering", "2023-03", undefined, 200000, REM.location, REM.location_details),
    ],
    current_position: job("Senior Software Engineer", "Elastic", "senior", "engineering", "2023-03", undefined, 200000, REM.location, REM.location_details),
  },
  {
    id: "p31",
    job_history: [
      job("DevOps Engineer", "HashiCorp", "entry", "engineering", "2019-11", "2022-09", 155000),
      job("Senior DevOps Engineer", "HashiCorp", "senior", "engineering", "2022-10", undefined, 205000, SF.location, SF.location_details),
    ],
    current_position: job("Senior DevOps Engineer", "HashiCorp", "senior", "engineering", "2022-10", undefined, 205000, SF.location, SF.location_details),
  },
  {
    id: "p32",
    job_history: [
      job("Software Engineer", "GitLab", "entry", "engineering", "2020-08", "2023-05", 145000),
      job("Senior Software Engineer", "GitLab", "senior", "engineering", "2023-06", undefined, 195000, REM.location, REM.location_details),
    ],
    current_position: job("Senior Software Engineer", "GitLab", "senior", "engineering", "2023-06", undefined, 195000, REM.location, REM.location_details),
  },
  {
    id: "p33",
    job_history: [
      job("Product Manager", "Twitch", "manager", "product", "2019-06", "2022-04", 160000),
      job("Senior Product Manager", "Twitch", "manager", "product", "2022-05", undefined, 195000, SF.location, SF.location_details),
    ],
    current_position: job("Senior Product Manager", "Twitch", "manager", "product", "2022-05", undefined, 195000, SF.location, SF.location_details),
  },
  {
    id: "p34",
    job_history: [
      job("Software Engineer", "Lyft", "entry", "engineering", "2018-07", "2021-09", 155000),
      job("Senior Software Engineer", "Lyft", "senior", "engineering", "2021-10", undefined, 200000, SF.location, SF.location_details),
    ],
    current_position: job("Senior Software Engineer", "Lyft", "senior", "engineering", "2021-10", undefined, 200000, SF.location, SF.location_details),
  },
  {
    id: "p35",
    job_history: [
      job("Data Scientist", "Uber", "entry", "data_science", "2019-05", "2022-06", 165000),
      job("Senior Data Scientist", "Uber", "senior", "data_science", "2022-07", undefined, 215000, SF.location, SF.location_details),
    ],
    current_position: job("Senior Data Scientist", "Uber", "senior", "data_science", "2022-07", undefined, 215000, SF.location, SF.location_details),
  },
  {
    id: "p36",
    job_history: [
      job("Software Engineer", "DoorDash", "entry", "engineering", "2020-04", "2023-01", 160000),
      job("Senior Software Engineer", "DoorDash", "senior", "engineering", "2023-02", undefined, 210000, SF.location, SF.location_details),
    ],
    current_position: job("Senior Software Engineer", "DoorDash", "senior", "engineering", "2023-02", undefined, 210000, SF.location, SF.location_details),
  },
  {
    id: "p37",
    job_history: [
      job("Software Engineer", "Coinbase", "entry", "engineering", "2019-08", "2022-10", 175000),
      job("Senior Software Engineer", "Coinbase", "senior", "engineering", "2022-11", undefined, 230000, SF.location, SF.location_details),
    ],
    current_position: job("Senior Software Engineer", "Coinbase", "senior", "engineering", "2022-11", undefined, 230000, SF.location, SF.location_details),
  },
  {
    id: "p38",
    job_history: [
      job("Product Designer", "Square", "entry", "design", "2018-09", "2021-11", 125000),
      job("Senior Product Designer", "Square", "senior", "design", "2021-12", undefined, 175000, SF.location, SF.location_details),
    ],
    current_position: job("Senior Product Designer", "Square", "senior", "design", "2021-12", undefined, 175000, SF.location, SF.location_details),
  },
  {
    id: "p39",
    job_history: [
      job("Software Engineer", "Apple", "entry", "engineering", "2017-06", "2020-08", 165000),
      job("Senior Software Engineer", "Apple", "senior", "engineering", "2020-09", undefined, 220000, SF.location, SF.location_details),
    ],
    current_position: job("Senior Software Engineer", "Apple", "senior", "engineering", "2020-09", undefined, 220000, SF.location, SF.location_details),
  },
  {
    id: "p40",
    job_history: [
      job("Marketing Manager", "HubSpot", "manager", "marketing", "2019-03", "2022-05", 140000),
      job("Senior Marketing Manager", "HubSpot", "manager", "marketing", "2022-06", undefined, 175000, BOS.location, BOS.location_details),
    ],
    current_position: job("Senior Marketing Manager", "HubSpot", "manager", "marketing", "2022-06", undefined, 175000, BOS.location, BOS.location_details),
  },
  {
    id: "p41",
    job_history: [],
    current_position: job("Software Engineering Intern", "Stripe", "intern", "engineering", "2024-06", undefined, 88000, SF.location, SF.location_details),
  },
  {
    id: "p42",
    job_history: [],
    current_position: job("Product Management Intern", "Notion", "intern", "product", "2024-05", undefined, 72000, NYC.location, NYC.location_details),
  },
  {
    id: "p43",
    job_history: [],
    current_position: job("Data Science Intern", "Meta", "intern", "data_science", "2024-06", undefined, 85000, SF.location, SF.location_details),
  },
  {
    id: "p44",
    job_history: [],
    current_position: job("Design Intern", "Figma", "intern", "design", "2024-06", undefined, 68000, SF.location, SF.location_details),
  },
  {
    id: "p45",
    job_history: [
      job("Software Engineer Intern", "Google", "intern", "engineering", "2023-06", "2023-09", 90000),
    ],
    current_position: job("Software Engineer", "Vercel", "entry", "engineering", "2024-01", undefined, 155000, SF.location, SF.location_details),
  },
];
