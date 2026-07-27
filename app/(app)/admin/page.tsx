"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAppData } from "@/lib/hooks/useAppData";
import { PageHeader } from "@/components/PageHeader";
import { ChevronLeft, Trash2, Plus } from "lucide-react";
import type { Welcomer, BibleStudyGroup, Profile, EmailTemplate } from "@/types/database";

const SUGGESTED_COLORS = [
  "#103349", // navy
  "#5DBE80", // green
  "#67BAB4", // teal
  "#53796E", // moss
  "#98454B", // wine
  "#AC8691", // mauve
  "#CC9DBD", // orchid
  "#0E1F27", // ink
]

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
        <UsersSection supabase={supabase} welcomers={welcomers} />
        <WelcomersSection welcomers={welcomers} supabase={supabase} refresh={refresh} />
        <EmailTemplatesSection supabase={supabase} />
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
  const [ministerEmail2, setMinisterEmail2] = useState(settings.minister_email_2 ?? "");
  const [yaWorkerEmail, setYaWorkerEmail] = useState(settings.ya_worker_email ?? "");
  const [churchName, setChurchName] = useState(settings.church_name ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setMinisterEmail(settings.minister_email ?? "");
    setMinisterEmail2(settings.minister_email_2 ?? "");
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
        .update({ value: ministerEmail2 })
        .eq("key", "minister_email_2"),
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
          <label className="label-field" htmlFor="ministerEmail2">
            Second minister email (optional)
          </label>
          <input
            id="ministerEmail2"
            type="email"
            className="input-field"
            value={ministerEmail2}
            onChange={(e) => setMinisterEmail2(e.target.value)}
            placeholder="Leave blank if not needed"
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


function UsersSection({
  supabase,
  welcomers,
}: {
  supabase: ReturnType<typeof createClient>;
  welcomers: Welcomer[];
}) {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("profiles").select("*").order("full_name");
    setUsers((data as Profile[]) ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  async function setApproved(id: string, approved: boolean) {
    setSavingId(id);
    await supabase.from("profiles").update({ approved }).eq("id", id);
    await load();
    setSavingId(null);
  }

  async function setRole(id: string, role: "admin" | "welcomer") {
    setSavingId(id);
    await supabase.from("profiles").update({ role }).eq("id", id);
    await load();
    setSavingId(null);
  }

  // Links a login to a welcomer name. This is what lets the automated
  // "check in on this visitor" nudge know which inbox to email when a
  // visitor assigned to that welcomer goes quiet.
  async function setLinkedWelcomer(id: string, welcomerId: string) {
    setSavingId(id);
    await supabase
      .from("profiles")
      .update({ welcomer_id: welcomerId || null })
      .eq("id", id);
    await load();
    setSavingId(null);
  }

  const pending = users.filter((u) => !u.approved);
  const approved = users.filter((u) => u.approved);

  return (
    <div>
      <h3 className="mb-3">Users</h3>

      {loading && <p className="text-body text-textSecondary">Loading…</p>}

      {!loading && pending.length > 0 && (
        <div className="card p-4 mb-3 border-accent/40 bg-accent/5">
          <h4 className="mb-3">Awaiting approval ({pending.length})</h4>
          <div className="space-y-3">
            {pending.map((u) => (
              <div key={u.id} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-body text-textPrimary truncate">{u.full_name}</p>
                  <p className="text-small text-textSecondary truncate">{u.email}</p>
                </div>
                <button
                  className="btn-primary h-10 px-4 shrink-0"
                  disabled={savingId === u.id}
                  onClick={() => setApproved(u.id, true)}
                >
                  Approve
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && (
        <div className="card p-4">
          <h4 className="mb-3">Approved ({approved.length})</h4>
          <div className="space-y-3">
            {approved.map((u) => (
              <div key={u.id} className="border-b border-border last:border-0 pb-3 last:pb-0">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <p className="text-body text-textPrimary truncate">{u.full_name}</p>
                    <p className="text-small text-textSecondary truncate">{u.email}</p>
                  </div>
                  <button
                    className="w-9 h-9 flex items-center justify-center text-textSecondary hover:text-error shrink-0"
                    disabled={savingId === u.id}
                    onClick={() => setApproved(u.id, false)}
                    aria-label={`Revoke access for ${u.full_name}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="label-field">Permissions</label>
                    <select
                      className="input-field h-10 text-small"
                      value={u.role}
                      disabled={savingId === u.id}
                      onChange={(e) => setRole(u.id, e.target.value as "admin" | "welcomer")}
                    >
                      <option value="welcomer">Welcomer</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div>
                    <label className="label-field">Welcomer name</label>
                    <select
                      className="input-field h-10 text-small"
                      value={u.welcomer_id ?? ""}
                      disabled={savingId === u.id}
                      onChange={(e) => setLinkedWelcomer(u.id, e.target.value)}
                    >
                      <option value="">Not linked</option>
                      {welcomers.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-small text-textSecondary mt-3">
            <strong>Permissions</strong> controls what they can do in the app —
            admins additionally get this settings screen and can delete visitors.
            <br />
            <strong>Welcomer name</strong> links this login to a name from the
            welcomer list, so automated "check in on this visitor" reminders
            reach the right inbox.
            <br />
            Revoking access (bin icon) keeps the account but blocks it from
            seeing any data until approved again.
          </p>
        </div>
      )}
    </div>
  );
}

function EmailTemplatesSection({ supabase }: { supabase: ReturnType<typeof createClient> }) {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [draftSubject, setDraftSubject] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedKey, setSavedKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("email_templates").select("*").order("label");
    setTemplates((data as EmailTemplate[]) ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  function openTemplate(t: EmailTemplate) {
    setOpenKey(t.key);
    setDraftSubject(t.subject);
    setDraftBody(t.body);
  }

  async function save(key: string) {
    setSaving(true);
    await supabase
      .from("email_templates")
      .update({ subject: draftSubject, body: draftBody, updated_at: new Date().toISOString() })
      .eq("key", key);
    await load();
    setSaving(false);
    setOpenKey(null);
    setSavedKey(key);
    setTimeout(() => setSavedKey(null), 2500);
  }

  return (
    <div>
      <h3 className="mb-3">Email wording</h3>
      {loading && <p className="text-body text-textSecondary">Loading…</p>}
      <div className="space-y-3">
        {templates.map((t) => (
          <div key={t.key} className="card p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-h4 text-textPrimary">{t.label}</p>
                {savedKey === t.key && (
                  <p className="text-small text-success">Saved</p>
                )}
              </div>
              <button
                className="btn-secondary h-10 px-4 shrink-0"
                onClick={() => (openKey === t.key ? setOpenKey(null) : openTemplate(t))}
              >
                {openKey === t.key ? "Close" : "Edit"}
              </button>
            </div>

            {openKey === t.key && (
              <div className="mt-4 space-y-3">
                {t.description && (
                  <p className="text-small text-textSecondary">{t.description}</p>
                )}
                <div>
                  <label className="label-field">Subject</label>
                  <input
                    className="input-field"
                    value={draftSubject}
                    onChange={(e) => setDraftSubject(e.target.value)}
                  />
                </div>
                <div>
                  <label className="label-field">Message</label>
                  <textarea
                    className="input-field h-40 py-3"
                    value={draftBody}
                    onChange={(e) => setDraftBody(e.target.value)}
                  />
                </div>
                <button
                  className="btn-primary w-full"
                  disabled={saving}
                  onClick={() => save(t.key)}
                >
                  {saving ? "Saving…" : "Save wording"}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
