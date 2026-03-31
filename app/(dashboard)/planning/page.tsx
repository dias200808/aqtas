import { Role } from "@prisma/client";
import { AcademicPlanForm } from "@/components/forms/academic-plan-form";
import { PlanProgressButton } from "@/components/forms/plan-progress-button";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/session";
import { translate } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { buildPlanningOptions, listAcademicPlans } from "@/features/planning/service";

export default async function PlanningPage() {
  const user = await requireRole([Role.ADMIN, Role.TEACHER]);
  const locale = await getLocale();
  const [options, plans] = await Promise.all([
    buildPlanningOptions(user),
    listAcademicPlans(user),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        title={translate(locale, "planning.title")}
        description={translate(locale, "planning.description")}
      />

      <AcademicPlanForm
        classes={options.classes.map((item) => ({ id: item.id, name: item.name }))}
        subjects={options.subjects.map((item) => ({ id: item.id, name: item.name }))}
        locale={locale}
      />

      <div className="grid gap-6 xl:grid-cols-2">
        {plans.map((plan) => {
          const completion = Math.min(100, Math.round((plan.completedLessons / Math.max(plan.plannedLessons, 1)) * 100));
          const expectedOutcomes = Array.isArray(plan.expectedOutcomes) ? (plan.expectedOutcomes as string[]) : [];
          const checkpoints = Array.isArray(plan.checkpoints) ? (plan.checkpoints as string[]) : [];

          return (
            <Card key={plan.id}>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle>{plan.title}</CardTitle>
                    <p className="mt-2 text-sm text-[var(--muted)]">
                      {plan.academicYear} · {plan.termLabel || plan.period} · {plan.schoolClass?.name || "General"} · {plan.subject?.name || "Subject"}
                    </p>
                  </div>
                  <Badge
                    variant={
                      plan.status === "COMPLETED"
                        ? "success"
                        : plan.status === "ACTIVE"
                          ? "info"
                          : "warning"
                    }
                  >
                    {plan.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm leading-6 text-slate-700">{plan.objective}</p>

                <div className="rounded-2xl border bg-slate-50/80 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900">{translate(locale, "planning.progress")}</p>
                    <p className="text-sm font-semibold text-slate-700">{completion}%</p>
                  </div>
                  <div className="mt-3 h-3 rounded-full bg-slate-200">
                    <div className="h-3 rounded-full bg-[linear-gradient(90deg,#1456c2,#0f766e)]" style={{ width: `${completion}%` }} />
                  </div>
                  <p className="mt-3 text-sm text-slate-700">
                    {plan.completedLessons} / {plan.plannedLessons} {locale === "ru" ? "уроков проведено" : "lessons completed"}
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border bg-white/85 p-4">
                    <p className="text-sm font-semibold text-slate-900">{translate(locale, "planning.outcomes")}</p>
                    <ul className="mt-3 space-y-2 text-sm text-slate-700">
                      {expectedOutcomes.map((item) => (
                        <li key={item}>• {item}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-2xl border bg-white/85 p-4">
                    <p className="text-sm font-semibold text-slate-900">{translate(locale, "planning.checkpoints")}</p>
                    <ul className="mt-3 space-y-2 text-sm text-slate-700">
                      {checkpoints.map((item) => (
                        <li key={item}>• {item}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <PlanProgressButton
                  planId={plan.id}
                  completedLessons={plan.completedLessons}
                  plannedLessons={plan.plannedLessons}
                  locale={locale}
                />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
