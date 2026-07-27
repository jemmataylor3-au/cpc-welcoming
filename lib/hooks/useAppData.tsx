"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile, Welcomer, BibleStudyGroup, AppSetting } from "@/types/database";

interface AppDataContextValue {
  profile: Profile | null;
  welcomers: Welcomer[];
  bibleStudyGroups: BibleStudyGroup[];
  profiles: Profile[];
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

    const [profileRes, welcomersRes, groupsRes, settingsRes, profilesRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase.from("welcomers").select("*").eq("active", true).order("name"),
      supabase
        .from("bible_study_groups")
        .select("*")
        .eq("active", true)
        .order("name"),
      supabase.from("app_settings").select("*"),
      supabase.from("profiles").select("*").order("full_name"),
    ]);

    setProfile((profileRes.data as Profile) ?? null);
    setWelcomers((welcomersRes.data as Welcomer[]) ?? []);
    setBibleStudyGroups((groupsRes.data as BibleStudyGroup[]) ?? []);
    setProfiles((profilesRes.data as Profile[]) ?? []);

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
      value={{ profile, welcomers, bibleStudyGroups, profiles, settings, loading, refresh }}
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