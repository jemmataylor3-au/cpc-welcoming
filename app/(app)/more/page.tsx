"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAppData } from "@/lib/hooks/useAppData";
import { PageHeader } from "@/components/PageHeader";
import { Settings, LogOut, User, Bell, BellOff, BarChart3, UserPlus } from "lucide-react";
import { usePushNotifications } from "@/lib/hooks/usePushNotifications";

export default function MorePage() {
  const router = useRouter();
  const supabase = createClient();
  const { profile } = useAppData();
  const push = usePushNotifications();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const isIOS =
    typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone =
    typeof window !== "undefined" &&
    window.matchMedia("(display-mode: standalone)").matches;

  return (
    <div className="pb-24">
      <PageHeader title="More" subtitle="Account and settings" />

      <div className="max-w-2xl mx-auto px-5 -mt-3 space-y-3">
        <div className="card p-4 flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-secondary flex items-center justify-center shrink-0">
            <User className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-h4 text-textPrimary">{profile?.full_name}</p>
            <p className="text-small text-textSecondary capitalize">{profile?.role}</p>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center gap-3 mb-2">
            {push.subscribed ? (
              <Bell className="w-5 h-5 text-primary shrink-0" />
            ) : (
              <BellOff className="w-5 h-5 text-textSecondary shrink-0" />
            )}
            <p className="text-h4 text-textPrimary">Push notifications</p>
          </div>

          {!push.supported && (
            <p className="text-body text-textSecondary">
              Notifications aren't supported in this browser.
            </p>
          )}

          {push.supported && isIOS && !isStandalone && (
            <p className="text-body text-textSecondary">
              On iPhone, notifications only work once this app is added to
              your home screen. Tap the Share button in Safari, then{" "}
              <strong>Add to Home Screen</strong>, then open the app from
              that icon and come back to this page.
            </p>
          )}

          {push.supported && (!isIOS || isStandalone) && (
            <>
              <p className="text-body text-textSecondary mb-3">
                {push.subscribed
                  ? "You'll get reminders and prompts sent straight to this device."
                  : "Turn these on to get reminder notifications on your phone instead of email."}
              </p>
              {push.error && (
                <p className="text-body text-error bg-error/10 rounded-input px-3 py-2 mb-3">
                  {push.error}
                </p>
              )}
              <button
                className={push.subscribed ? "btn-secondary w-full" : "btn-primary w-full"}
                onClick={push.subscribed ? push.unsubscribe : push.subscribe}
                disabled={push.loading}
              >
                {push.loading
                  ? "Please wait…"
                  : push.subscribed
                  ? "Turn off notifications"
                  : "Turn on notifications"}
              </button>
            </>
          )}
        </div>

        <Link href="/visitors/pending" className="card p-4 flex items-center gap-3">
          <UserPlus className="w-5 h-5 text-primary" />
          <span className="text-body text-textPrimary">New submissions</span>
        </Link>

        <Link href="/reports" className="card p-4 flex items-center gap-3">
          <BarChart3 className="w-5 h-5 text-primary" />
          <span className="text-body text-textPrimary">Reports</span>
        </Link>

        {profile?.role === "admin" && (
          <Link href="/admin" className="card p-4 flex items-center gap-3">
            <Settings className="w-5 h-5 text-primary" />
            <span className="text-body text-textPrimary">Admin & Settings</span>
          </Link>
        )}

        <button
          onClick={handleSignOut}
          className="card p-4 flex items-center gap-3 w-full text-left"
        >
          <LogOut className="w-5 h-5 text-error" />
          <span className="text-body text-error">Sign out</span>
        </button>
      </div>
    </div>
  );
}
