import { Role } from "@prisma/client";
import { TrendChart, DonutChart } from "@/components/dashboard/charts";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/session";
import { translate } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { buildAdminOverview } from "@/features/reports/service";

export default async function AnalyticsPage() {
  const user = await requireRole([Role.ADMIN]);
  const locale = await getLocale();
  const overview = await buildAdminOverview(user);

  return (
    <div className="space-y-8">
      <PageHeader title={translate(locale, "analytics.title")} description={translate(locale, "analytics.description")} />
      <div className="grid gap-6 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>{translate(locale, "analytics.userMix")}</CardTitle>
          </CardHeader>
          <CardContent>
            <DonutChart
              data={[
                { label: "Students", value: overview.studentCount },
                { label: "Teachers", value: overview.teacherCount },
                { label: "Parents", value: overview.parentCount },
              ]}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{translate(locale, "analytics.activitySignals")}</CardTitle>
          </CardHeader>
          <CardContent>
            <TrendChart
              data={[
                { label: "Users", value: overview.userCount },
                { label: "Announcements", value: overview.announcementCount },
                { label: "Events", value: overview.eventCount },
              ]}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{translate(locale, "analytics.teachingOps")}</CardTitle>
          </CardHeader>
          <CardContent>
            <TrendChart
              data={[
                { label: locale === "ru" ? "Уроки" : "Lessons", value: overview.lessonPackageCount },
                { label: locale === "ru" ? "Сессии доски" : "Board sessions", value: overview.boardSessionCount },
                { label: locale === "ru" ? "Планы" : "Plans", value: overview.academicPlanCount },
              ]}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
