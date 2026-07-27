"use client";

import { AppDataProvider, useAppData } from "@/lib/hooks/useAppData";
import { BottomNav } from "@/components/BottomNav";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Clock } from "lucide-react";

// Gate: an account exists but an admin hasn't approved it yet. Database
// policies already block their access to any real data — this screen just
// explains why the app looks empty rather than showing broken pages.
function ApprovalGate({ children }: { children: React.ReactNode }) {
  const { profile, loading } = useAppData();
  const supabase = createClient();
  const router = useRouter();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-body text-textSecondary">Loading…</p>
      </div>
    );
  }

  if (profile && !profile.approved) {
    return (
      <div className="min-h-screen bg-background flex flex-col justify-center px-6 py-12">
        <div className="w-full max-w-sm mx-auto text-center">
          <div className="w-14 h-14 rounded-feature bg-secondary flex items-center justify-center mb-4 mx-auto">
            <Clock className="w-7 h-7 text-primary" strokeWidth={2} />
          </div>
          <h1 className="font-display text-h1 text-primary mb-2">Awaiting approval</h1>
          <p className="text-body text-textSecondary mb-6">
            Your account has been created, but an admin needs to approve it
            before you can see visitor information. You'll be able to sign
            straight in once that's done.
          </p>
          <button
            className="btn-secondary w-full"
            onClick={async () => {
              await supabase.auth.signOut();
              router.push("/login");
              router.refresh();
            }}
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-background">{children}</div>
      <BottomNav />
    </>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppDataProvider>
      <ApprovalGate>{children}</ApprovalGate>
    </AppDataProvider>
  );
}
