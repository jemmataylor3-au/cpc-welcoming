"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Heart } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signupSuccess, setSignupSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === "signin") {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
        router.push("/");
        router.refresh();
      } else {
        if (!fullName.trim()) {
          throw new Error("Please enter your full name.");
        }
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName.trim() } },
        });
        if (signUpError) throw signUpError;
        setSignupSuccess(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center px-6 py-12">
      <div className="w-full max-w-sm mx-auto">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-feature bg-primary flex items-center justify-center mb-4">
            <Heart className="w-7 h-7 text-secondary" strokeWidth={2} />
          </div>
          <h1 className="font-display text-h1 text-center text-primary">
            CPC Welcoming
          </h1>
          <p className="text-body text-textSecondary text-center mt-2">
            Charlestown Presbyterian Church
          </p>
        </div>

        <div className="card p-6">
          {signupSuccess ? (
            <div className="text-center py-4">
              <h3 className="mb-2">Check your email</h3>
              <p className="text-body text-textSecondary">
                We've sent a confirmation link to <strong>{email}</strong>.
                Confirm your address, then sign in below.
              </p>
              <button
                className="btn-secondary w-full mt-6"
                onClick={() => {
                  setSignupSuccess(false);
                  setMode("signin");
                }}
              >
                Back to sign in
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <h3 className="mb-1">
                {mode === "signin" ? "Sign in" : "Create your account"}
              </h3>

              {mode === "signup" && (
                <div>
                  <label className="label-field" htmlFor="fullName">
                    Full name
                  </label>
                  <input
                    id="fullName"
                    className="input-field"
                    type="text"
                    autoComplete="name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>
              )}

              <div>
                <label className="label-field" htmlFor="email">
                  Email
                </label>
                <input
                  id="email"
                  className="input-field"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="label-field" htmlFor="password">
                  Password
                </label>
                <input
                  id="password"
                  className="input-field"
                  type="password"
                  autoComplete={
                    mode === "signin" ? "current-password" : "new-password"
                  }
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={6}
                  required
                />
              </div>

              {error && (
                <p className="text-body text-error bg-error/10 rounded-input px-3 py-2">
                  {error}
                </p>
              )}

              <button type="submit" className="btn-primary w-full" disabled={loading}>
                {loading
                  ? "Please wait…"
                  : mode === "signin"
                  ? "Sign in"
                  : "Create account"}
              </button>

              <button
                type="button"
                className="text-body text-textSecondary text-center w-full underline underline-offset-2"
                onClick={() => {
                  setError(null);
                  setMode(mode === "signin" ? "signup" : "signin");
                }}
              >
                {mode === "signin"
                  ? "New here? Create an account"
                  : "Already have an account? Sign in"}
              </button>
            </form>
          )}
        </div>

        <p className="text-caption text-textSecondary text-center mt-6">
          The first person to sign up becomes the admin. Everyone after that
          can be assigned a role from Admin → Users.
        </p>
      </div>
    </div>
  );
}
