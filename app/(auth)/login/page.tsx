import { redirect } from "next/navigation";
import { GraduationCap, Sparkles } from "lucide-react";
import { LoginForm } from "@/components/forms/login-form";
import { Card, CardContent } from "@/components/ui/card";
import { getSessionUser } from "@/lib/auth/session";

const demoAccounts = [
  { role: "Admin", email: "admin@aqtas.school" },
  { role: "Teacher", email: "teacher1@aqtas.school" },
  { role: "Parent", email: "parent1@aqtas.school" },
  { role: "Student", email: "student1@aqtas.school" },
];

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.15fr_0.85fr]">
      <div className="relative hidden overflow-hidden bg-[linear-gradient(135deg,#0c2747,#1456c2_52%,#0f766e)] p-10 text-white lg:block">
        <div className="relative z-10 flex h-full flex-col justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-white/12 p-3">
              <GraduationCap className="h-7 w-7" />
            </div>
            <div>
              <p className="text-xl font-bold">Aqtas Diary</p>
              <p className="text-sm text-blue-100/80">AI-first school intelligence platform</p>
            </div>
          </div>

          <div className="max-w-xl space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-medium">
              <Sparkles className="h-4 w-4" />
              Grounded summaries, risk insights, and teacher copilots
            </div>
            <h1 className="text-5xl font-bold leading-tight">
              A serious modern electronic diary built for students, parents, teachers, and admins.
            </h1>
            <p className="max-w-lg text-lg leading-8 text-blue-50/84">
              Stay on top of schedules, grades, homework, attendance, messaging, analytics, and AI guidance from one trusted dashboard.
            </p>
          </div>

          <Card className="border-white/18 bg-white/14 text-white shadow-[0_24px_70px_-24px_rgba(5,10,25,0.6)]">
            <CardContent className="grid gap-4 py-6 md:grid-cols-2">
              {demoAccounts.map((account) => (
                <div
                  key={account.email}
                  className="rounded-2xl border border-white/18 bg-[rgba(13,27,48,0.18)] p-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur-sm"
                >
                  <p className="text-xs uppercase tracking-[0.18em] text-white/80">{account.role}</p>
                  <p className="mt-2 text-sm font-semibold text-white">{account.email}</p>
                  <p className="mt-1 text-xs font-medium text-white/80">Password: Demo123!</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.22),transparent_26%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.18),transparent_24%)]" />
      </div>

      <div className="flex items-center justify-center p-6 lg:p-10">
        <Card className="w-full max-w-md bg-white/90">
          <CardContent className="space-y-8 py-8">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">Welcome back</p>
              <h2 className="mt-3 text-3xl font-bold text-slate-900">Sign in to your school workspace</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                Use one of the seeded demo accounts or your own credentials after seeding the database.
              </p>
            </div>
            <LoginForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
