"use client";

import { useState } from "react";
import { createBrowserClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const ADMIN_ROLES = ["admin", "owner", "manager"];

type AuthMode = "password" | "magic-link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<AuthMode>("password");
  const router = useRouter();

  const handlePasswordSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createBrowserClient();

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(
        authError.message === "Invalid login credentials"
          ? "Invalid email or password. Try again or use a magic link."
          : authError.message
      );
      setLoading(false);
      return;
    }

    // Role-based routing: non-admin users go to employee portal
    const { data: { user: signedInUser } } = await supabase.auth.getUser();
    let destination = "/";
    if (signedInUser) {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("roles")
        .eq("id", signedInUser.id)
        .single();
      const userRoles: string[] = profileData?.roles ?? [];
      const hasAdminRole = userRoles.some((r) => ADMIN_ROLES.includes(r));
      if (!hasAdminRole && userRoles.length > 0) {
        destination = "/employee";
      }
    }

    router.push(destination);
    router.refresh();
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createBrowserClient();

    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
            Meridian
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Fitness Studio Operating System
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8">
          {sent ? (
            <div className="text-center py-4">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50">
                <svg
                  className="h-6 w-6 text-primary"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
                  />
                </svg>
              </div>
              <h2 className="text-lg font-medium text-gray-900">
                Check your email
              </h2>
              <p className="mt-2 text-sm text-gray-500">
                We sent a magic link to{" "}
                <span className="font-medium text-gray-700">{email}</span>.
                Click the link to sign in.
              </p>
              <button
                onClick={() => {
                  setSent(false);
                  setEmail("");
                }}
                className="mt-6 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
              >
                Use a different email
              </button>
            </div>
          ) : (
            <>
              <h2 className="text-lg font-medium text-gray-900 mb-1">
                Sign in
              </h2>
              <p className="text-sm text-gray-500 mb-6">
                {mode === "password"
                  ? "Enter your credentials to access the dashboard."
                  : "Enter your email to receive a magic link."}
              </p>

              <form
                onSubmit={mode === "password" ? handlePasswordSignIn : handleMagicLink}
                className="space-y-4"
              >
                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-gray-700 mb-1.5"
                  >
                    Email address
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    autoFocus
                    className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow"
                  />
                </div>

                {mode === "password" && (
                  <div>
                    <label
                      htmlFor="password"
                      className="block text-sm font-medium text-gray-700 mb-1.5"
                    >
                      Password
                    </label>
                    <input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      required
                      className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow"
                    />
                  </div>
                )}

                {error && (
                  <p className="text-sm text-red-600">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={loading || !email || (mode === "password" && !password)}
                  className="w-full rounded-lg bg-primary px-3.5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading
                    ? mode === "password" ? "Signing in..." : "Sending..."
                    : mode === "password" ? "Sign In" : "Send Magic Link"}
                </button>
              </form>

              {/* Divider */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-white px-2 text-gray-400">or</span>
                </div>
              </div>

              {/* Toggle auth mode */}
              <button
                type="button"
                onClick={() => {
                  setMode(mode === "password" ? "magic-link" : "password");
                  setError(null);
                  setPassword("");
                }}
                className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                {mode === "password"
                  ? "Sign in with Magic Link"
                  : "Sign in with Password"}
              </button>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">
          Secure authentication powered by Supabase
        </p>
      </div>
    </div>
  );
}
