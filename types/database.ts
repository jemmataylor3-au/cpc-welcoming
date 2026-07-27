// Hand-written types mirroring the Supabase schema (supabase/migrations).
// If you prefer generated types, run:
//   npx supabase gen types typescript --project-id <ref> > types/database.ts
// and re-export the convenience aliases below from that file instead.

export type AppRole = "admin" | "welcomer";

export type ReasonForAttendance =
  | "Looking for a new church"
  | "New to faith"
  | "New to faith + Looking for a new church"
  | "Just visiting"
  | "Other";

export type AgeCategory =
  | "Youth"
  | "Young Adult"
  | "Young Family"
  | "Established Family"
  | "Midlife / Empty Nester"
  | "Senior"
  | "Over 30";

export type ChurchService = "Swansea" | "Charlestown AM" | "Sunday@6";

export type BibleStudyStatus =
  | "Joined Bible Study"
  | "Not Involved"
  | "Not Yet (remind in 6 weeks)";

export type VisitorStatus = "Active" | "Settled" | "Archived";

export type ArchiveReasonCategory =
  | "Moved away"
  | "Joined another local church"
  | "No longer responsive"
  | "Committed to another church"
  | "Other";

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: AppRole;
  welcomer_id: string | null;
  approved: boolean;
  created_at: string;
  updated_at: string;
}

export interface Welcomer {
  id: string;
  name: string;
  color_hex: string;
  active: boolean;
  services: ChurchService[];
  created_at: string;
}

export interface BibleStudyGroup {
  id: string;
  name: string;
  active: boolean;
  created_at: string;
}

export interface AppSetting {
  key: string;
  value: string;
  description: string | null;
  updated_at: string;
  updated_by: string | null;
}

export interface Visitor {
  id: string;
  name: string;
  email: string | null;
  phone_number: string | null;
  date_first_attended: string;

  reason_for_attendance: ReasonForAttendance;
  age_category: AgeCategory;
  service: ChurchService;
  is_returning: boolean;

  welcomer_id: string | null;
  welcomer_other: string | null;
  entered_by: string | null;

  week1_attended: boolean;
  week1_date: string | null;
  week1_notes: string | null;
  week1_notes_by: string | null;
  week2_attended: boolean;
  week2_date: string | null;
  week2_notes: string | null;
  week2_notes_by: string | null;
  week3_attended: boolean;
  week3_date: string | null;
  week3_notes: string | null;
  week3_notes_by: string | null;
  extra_notes: string | null;

  catchup_flag: boolean;
  catchup_date: string | null;
  catchup_arranged: boolean;

  elvanto_conversation: boolean;
  bible_study_status: BibleStudyStatus;
  bible_study_group_id: string | null;
  bible_study_reminder_due_at: string | null;

  three_week_prompt_sent_at: string | null;
  welcomer_nudge_sent_at: string | null;
  archive_prompt_dismissed_at: string | null;
  settled_prompt_seen: boolean;

  status: VisitorStatus;
  settled_at: string | null;
  archive_reason: string | null;
  archive_reason_category: ArchiveReasonCategory | null;
  archived_at: string | null;

  created_at: string;
  updated_at: string;
}

export interface VisitorWithRelations extends Visitor {
  welcomer?: Welcomer | null;
  bible_study_group?: BibleStudyGroup | null;
  entered_by_profile?: Profile | null;
}

export interface ActivityLogEntry {
  id: string;
  visitor_id: string;
  actor_id: string | null;
  action: string;
  detail: string | null;
  created_at: string;
}

export interface VisitPeriod {
  id: string;
  visitor_id: string;
  period_number: number;
  started_on: string | null;
  week1_attended: boolean;
  week1_date: string | null;
  week1_notes: string | null;
  week2_attended: boolean;
  week2_date: string | null;
  week2_notes: string | null;
  week3_attended: boolean;
  week3_date: string | null;
  week3_notes: string | null;
  closed_at: string;
  closed_by: string | null;
  created_at: string;
}

export interface NotificationRecipient {
  id: string;
  name: string;
  email: string | null;
  services: ChurchService[];
  all_young_adults: boolean;
  active: boolean;
  created_at: string;
}

export interface EmailLogEntry {
  id: string;
  visitor_id: string | null;
  email_type: string;
  recipient: string;
  status: string;
  error_message: string | null;
  created_at: string;
}

export interface EmailTemplate {
  key: string;
  label: string;
  subject: string;
  body: string;
  description: string | null;
  updated_at: string;
  updated_by: string | null;
}

export interface PendingVisitor {
  id: string;
  name: string;
  email: string | null;
  phone_number: string | null;
  service: ChurchService;
  reason_for_attendance: ReasonForAttendance;
  message: string | null;
  submitted_at: string;
  claimed: boolean;
  claimed_by: string | null;
  claimed_at: string | null;
  resulting_visitor_id: string | null;
}

export const REASON_OPTIONS: ReasonForAttendance[] = [
  "Looking for a new church",
  "New to faith",
  "New to faith + Looking for a new church",
  "Just visiting",
  "Other",
];

export const AGE_CATEGORY_OPTIONS: AgeCategory[] = [
  "Youth",
  "Young Adult",
  "Young Family",
  "Established Family",
  "Midlife / Empty Nester",
  "Senior",
  // Legacy bucket from the original spreadsheet import. Kept so existing
  // records stay truthfully labelled until recategorised by hand.
  "Over 30",
];

export const SERVICE_OPTIONS: ChurchService[] = [
  "Swansea",
  "Charlestown AM",
  "Sunday@6",
];

export const BIBLE_STUDY_STATUS_OPTIONS: BibleStudyStatus[] = [
  "Joined Bible Study",
  "Not Involved",
  "Not Yet (remind in 6 weeks)",
];

export const ARCHIVE_REASON_OPTIONS: ArchiveReasonCategory[] = [
  "Moved away",
  "Joined another local church",
  "No longer responsive",
  "Committed to another church",
  "Other",
];
