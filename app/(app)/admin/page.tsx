"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAppData } from "@/lib/hooks/useAppData";
import { PageHeader } from "@/components/PageHeader";
import { ChevronLeft, Trash2, Plus } from "lucide-react";
import type { Welcomer, BibleStudyGroup } from "@/types/database";

const SUGGESTED_COLORS = [
  "#C8755B", // terracotta
  "#A7B5A0", // sage
  "#172B3A", // navy
  "#66727A", // slate
  "#B85C5C", // error red (muted)
  "#C28A45", // warning ochre
  "#5E8065", // success green
  "#8B7355", // brown
];

export default function AdminPage() {
  const supabase = createClient();
  const { profile, welcomers, bibleStudyGroups, settings, loading, refresh } =
    useAppData();

  const [checkingAccess, setCheckingAccess] = useState(true);

  useEffect(() => {
    if (!loading) setCheckingAccess(false);
  }, [loading]);

  if (checkingAccess) {
    return <div className="pt-12 text-center text-body text-textSecondary">Loading…</div>;
  }

  if (profile && profile.role !== "admin") {
    return (
      <div className="pb-24">
        <PageHeader title="Admin" />
        <div className="max-w-2xl mx-auto px-5 -mt-3">
          <div className="card p-6 text-center">
            <p className="text-body text-textSecondary">
              This section is only available to admins.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-24">
      <PageHeader
        title="Admin & Settings"
        action={
          <Link
            href="/more"
            className="w-11 h-11 rounded-button bg-white/10 flex items-center justify-center shrink-0"
          >
            <ChevronLeft className="w-5 h-5 text-secondary" />
          </Link>
        }
      />

      <div className="max-w-2xl mx-auto px-5 -mt-3 space-y-6">
        <WelcomersSection welcomers={welcomers} supabase={supabase} refresh={refresh} />
        <BibleStudyGroupsSection
          groups={bibleStudyGroups}
          supabase={supabase}
          refresh={refresh}
        />
        <SettingsSection settings={settings} supabase={supabase} refresh={refresh} />
      </div>
    </div>
  );
}

function WelcomersSection({
  welcomers,
  supabase,
  refresh,
}: {
  welcomers: Welcomer[];
  supabase: ReturnType<typeof createClient>;
  refresh: () => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(SUGGESTED_COLORS[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addWelcomer(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase
      .from("welcomers")
      .insert({ name: name.trim(), color_hex: color });
    if (insertError) {
      setError(insertError.message);
    } else {
      setName("");
      await refresh();
    }
    setSaving(false);
  }

  async function removeWelcomer(id: string) {
    await supabase.from("welcomers").update({ active: false }).eq("id", id);
    await refresh();
  }

  return (
    <div>
      <h3 className="mb-3">Welcomers</h3>
      <div className="card p-4 space-y-3 mb-3">
        {welcomers.length === 0 && (
          <p className="text-body text-textSecondary">No welcomers yet.</p>
        )}
        {welcomers.map((w) => (
          <div key={w.id} className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span
                className="w-3.5 h-3.5 rounded-full shrink-0"
                style={{ backgroundColor: w.color_hex }}
              />
              <span className="text-body text-textPrimary">{w.name}</span>
            </div>
            <button
              onClick={() => removeWelcomer(w.id)}
              className="w-9 h-9 flex items-center justify-center text-textSecondary hover:text-error"
              aria-label={`Remove ${w.name}`}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      <form onSubmit={addWelcomer} className="card p-4 space-y-3">
        <div>
          <label className="label-field" htmlFor="welcomerName">
            Add welcomer
          </label>
          <input
            id="welcomerName"
            className="input-field"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
          />
        </div>
        <div>
          <span className="label-field">Colour accent</span>
          <div className="flex gap-2 flex-wrap">
            {SUGGESTED_COLORS.map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => setColor(c)}
                className={`w-9 h-9 rounded-full border-2 ${
                  color === c ? "border-primary" : "border-transparent"
                }`}
                style={{ backgroundColor: c }}
                aria-label={`Choose colour ${c}`}
              />
            ))}
          </div>
        </div>
        {error && <p className="text-body text-error">{error}</p>}
        <button type="submit" className="btn-secondary w-full" disabled={saving}>
          <Plus className="w-4 h-4" />
          Add welcomer
        </button>
      </form>
    </div>
  );
}

function BibleStudyGroupsSection({
  groups,
  supabase,
  refresh,
}: {
  groups: BibleStudyGroup[];
  supabase: ReturnType<typeof createClient>;
  refresh: () => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  async function addGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    await supabase.from("bible_study_groups").insert({ name: name.trim() });
    setName("");
    await refresh();
    setSaving(false);
  }

  async function removeGroup(id: string) {
    await supabase.from("bible_study_groups").update({ active: false }).eq("id", id);
    await refresh();
  }

  return (
    <div>
      <h3 className="mb-3">Bible study groups</h3>
      <div className="card p-4 space-y-3 mb-3">
        {groups.length === 0 && (
          <p className="text-body text-textSecondary">No groups yet.</p>
        )}
        {groups.map((g) => (
          <div key={g.id} className="flex items-center justify-between">
            <span className="text-body text-textPrimary">{g.name}</span>
            <button
              onClick={() => removeGroup(g.id)}
              className="w-9 h-9 flex items-center justify-center text-textSecondary hover:text-error"
              aria-label={`Remove ${g.name}`}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      <form onSubmit={addGroup} className="card p-4 space-y-3">
        <div>
          <label className="label-field" htmlFor="groupName">
            Add group
          </label>
          <input
            id="groupName"
            className="input-field"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Tuesday Evening"
          />
        </div>
        <button type="submit" className="btn-secondary w-full" disabled={saving}>
          <Plus className="w-4 h-4" />
          Add group
        </button>
      </form>
    </div>
  );
}

function SettingsSection({
  settings,
  supabase,
  refresh,
}: {
  settings: Record<string, string>;
  supabase: ReturnType<typeof createClient>;
  refresh: () => Promise<void>;
}) {
  const [ministerEmail, setMinisterEmail] = useState(settings.minister_email ?? "");
  const [yaWorkerEmail, setYaWorkerEmail] = useState(settings.ya_worker_email ?? "");
  const [churchName, setChurchName] = useState(settings.church_name ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setMinisterEmail(settings.minister_email ?? "");
    setYaWorkerEmail(settings.ya_worker_email ?? "");
    setChurchName(settings.church_name ?? "");
  }, [settings]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    await Promise.all([
      supabase
        .from("app_settings")
        .update({ value: ministerEmail })
        .eq("key", "minister_email"),
      supabase
        .from("app_settings")
        .update({ value: yaWorkerEmail })
        .eq("key", "ya_worker_email"),
      supabase
        .from("app_settings")
        .update({ value: churchName })
        .eq("key", "church_name"),
    ]);
    await refresh();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div>
      <h3 className="mb-3">Notification settings</h3>
      <form onSubmit={handleSave} className="card p-4 space-y-4">
        <div>
          <label className="label-field" htmlFor="churchName">
            Church display name
          </label>
          <input
            id="churchName"
            className="input-field"
            value={churchName}
            onChange={(e) => setChurchName(e.target.value)}
          />
        </div>
        <div>
          <label className="label-field" htmlFor="ministerEmail">
            Minister email (3-week & Bible study prompts)
          </label>
          <input
            id="ministerEmail"
            type="email"
            className="input-field"
            value={ministerEmail}
            onChange={(e) => setMinisterEmail(e.target.value)}
          />
        </div>
        <div>
          <label className="label-field" htmlFor="yaWorkerEmail">
            YA worker email (for Young Adults visitors)
          </label>
          <input
            id="yaWorkerEmail"
            type="email"
            className="input-field"
            value={yaWorkerEmail}
            onChange={(e) => setYaWorkerEmail(e.target.value)}
          />
        </div>
        <button type="submit" className="btn-primary w-full" disabled={saving}>
          {saving ? "Saving…" : saved ? "Saved ✓" : "Save settings"}
        </button>
        <p className="text-small text-textSecondary">
          The Resend API key and Supabase service role key are configured as
          server-side secrets, not here — see the README for setup.
        </p>
      </form>
    </div>
  );
}
