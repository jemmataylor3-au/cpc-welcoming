"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  Profile,
  Welcomer,
  BibleStudyGroup,
  AppSetting,
  NotificationRecipient,
} from "@/types/database";

interface AppDataContextValue {
  profile: Profile | null;
  welcomers: Welcomer[];
  bibleStudyGroups: BibleStudyGroup[];
  profiles: Profile[];
  notificationRecipients: NotificationRecipient[];
  settings: Record<string, string>;
  loading: boolean;
  refresh: () => Promise<void>;
}

const AppDataContext = createContext<AppDataContextValue | undefined>(undefined);

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [welcomers, setWelcomers] = useState<Welcomer[]>([]);
  const [bibleStudyGroups, setBibleStudyGroups] = useState<BibleStudyGroup[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [notificationRecipients, setNotificationRecipients] = useState<
    NotificationRecipient[]
  >([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    const [
      profileRes,
      welcomersRes,
      groupsRes,
      settingsRes,
      profilesRes,
      recipientsRes,
    ] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase.from("welcomers").select("*").eq("active", true).order("name"),
      supabase
        .from("bible_study_groups")
        .select("*")
        .eq("active", true)
        .order("name"),
      supabase.from("app_settings").select("*"),
      // Full profile list — used to show "who wrote this note" attribution,
      // which can be any team member, not just the assigned welcomer.
      supabase.from("profiles").select("*").order("full_name"),
      supabase
        .from("notification_recipients")
        .select("*")
        .eq("active", true)
        .order("name"),
    ]);

    setProfile((profileRes.data as Profile) ?? null);
    setWelcomers((welcomersRes.data as Welcomer[]) ?? []);
    setBibleStudyGroups((groupsRes.data as BibleStudyGroup[]) ?? []);
    setProfiles((profilesRes.data as Profile[]) ?? []);
    setNotificationRecipients(
      (recipientsRes.data as NotificationRecipient[]) ?? []
    );

    const settingsMap: Record<string, string> = {};
    ((settingsRes.data as AppSetting[]) ?? []).forEach((s) => {
      settingsMap[s.key] = s.value;
    });
    setSettings(settingsMap);

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    refresh();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      refresh();
    });
    return () => subscription.unsubscribe();
  }, [refresh, supabase]);

  return (
    <AppDataContext.Provider
      value={{
        profile,
        welcomers,
        bibleStudyGroups,
        profiles,
        notificationRecipients,
        settings,
        loading,
        refresh,
      }}
    >
      {children}
    </AppDataContext.Provider>
  );
}

export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("useAppData must be used within AppDataProvider");
  return ctx;
}
