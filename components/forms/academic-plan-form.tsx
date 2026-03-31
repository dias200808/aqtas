"use client";

import { AppLanguage, PlanPeriod, PlanStatus } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { AppLocale } from "@/lib/i18n";

function splitLines(value: string) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function AcademicPlanForm({
  classes,
  subjects,
  locale,
}: {
  classes: Array<{ id: string; name: string }>;
  subjects: Array<{ id: string; name: string }>;
  locale: AppLocale;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [academicYear, setAcademicYear] = useState("2025/2026");
  const [period, setPeriod] = useState<PlanPeriod>(PlanPeriod.ANNUAL);
  const [status, setStatus] = useState<PlanStatus>(PlanStatus.ACTIVE);
  const [objective, setObjective] = useState("");
  const [termLabel, setTermLabel] = useState(locale === "ru" ? "1 четверть" : "Term 1");
  const [classId, setClassId] = useState(classes[0]?.id ?? "");
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? "");
  const [plannedLessons, setPlannedLessons] = useState(18);
  const [completedLessons, setCompletedLessons] = useState(4);
  const [expectedOutcomes, setExpectedOutcomes] = useState(
    locale === "ru"
      ? "Ученик понимает ключевые понятия темы\nУченик выполняет базовые задания самостоятельно"
      : "Students understand the core concepts\nStudents complete the core tasks independently",
  );
  const [checkpoints, setCheckpoints] = useState(
    locale === "ru"
      ? "Короткий квиз по теме\nПрактическая работа в конце блока"
      : "Short topic quiz\nEnd-of-unit practice task",
  );

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const response = await fetch("/api/academic-plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        classId,
        subjectId,
        title,
        academicYear,
        period,
        status,
        termLabel,
        objective,
        expectedOutcomes: splitLines(expectedOutcomes),
        checkpoints: splitLines(checkpoints),
        plannedLessons,
        completedLessons,
        language: locale === "ru" ? AppLanguage.RU : AppLanguage.EN,
      }),
    });

    const result = await response.json();
    if (!response.ok) {
      toast.error(result.error || (locale === "ru" ? "Не удалось создать план" : "Unable to create plan"));
      return;
    }

    toast.success(locale === "ru" ? "План сохранен" : "Plan saved");
    setTitle("");
    setObjective("");
    router.refresh();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{locale === "ru" ? "Новый академический план" : "New academic plan"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={onSubmit}>
          <div className="grid gap-4 xl:grid-cols-3">
            <div className="space-y-2">
              <Label>{locale === "ru" ? "Класс" : "Class"}</Label>
              <Select value={classId} onChange={(event) => setClassId(event.target.value)}>
                {classes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{locale === "ru" ? "Предмет" : "Subject"}</Label>
              <Select value={subjectId} onChange={(event) => setSubjectId(event.target.value)}>
                {subjects.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{locale === "ru" ? "Период" : "Period"}</Label>
              <Select value={period} onChange={(event) => setPeriod(event.target.value as PlanPeriod)}>
                <option value={PlanPeriod.ANNUAL}>{locale === "ru" ? "Годовой" : "Annual"}</option>
                <option value={PlanPeriod.QUARTER}>{locale === "ru" ? "Четверть" : "Quarter"}</option>
                <option value={PlanPeriod.MONTHLY}>{locale === "ru" ? "Месяц" : "Monthly"}</option>
                <option value={PlanPeriod.WEEKLY}>{locale === "ru" ? "Неделя" : "Weekly"}</option>
                <option value={PlanPeriod.LESSON}>{locale === "ru" ? "Поурочный" : "Lesson-by-lesson"}</option>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <div className="space-y-2">
              <Label>{locale === "ru" ? "Название плана" : "Plan title"}</Label>
              <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={locale === "ru" ? "Например: Годовой план по математике для 5А" : "For example: Annual mathematics plan for 5A"} />
            </div>
            <div className="space-y-2">
              <Label>{locale === "ru" ? "Учебный год" : "Academic year"}</Label>
              <Input value={academicYear} onChange={(event) => setAcademicYear(event.target.value)} />
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <div className="space-y-2">
              <Label>{locale === "ru" ? "Статус" : "Status"}</Label>
              <Select value={status} onChange={(event) => setStatus(event.target.value as PlanStatus)}>
                <option value={PlanStatus.DRAFT}>{locale === "ru" ? "Черновик" : "Draft"}</option>
                <option value={PlanStatus.ACTIVE}>{locale === "ru" ? "Активный" : "Active"}</option>
                <option value={PlanStatus.COMPLETED}>{locale === "ru" ? "Завершен" : "Completed"}</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{locale === "ru" ? "Метка периода" : "Term label"}</Label>
              <Input value={termLabel} onChange={(event) => setTermLabel(event.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{locale === "ru" ? "Цель и логика плана" : "Objective and planning logic"}</Label>
            <Textarea value={objective} onChange={(event) => setObjective(event.target.value)} placeholder={locale === "ru" ? "Опишите ожидаемый результат, структуру тем и логику оценивания..." : "Describe the expected outcomes, topic flow, and assessment logic..."} />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <div className="space-y-2">
              <Label>{locale === "ru" ? "Ожидаемые результаты" : "Expected outcomes"}</Label>
              <Textarea value={expectedOutcomes} onChange={(event) => setExpectedOutcomes(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{locale === "ru" ? "Контрольные точки" : "Checkpoints"}</Label>
              <Textarea value={checkpoints} onChange={(event) => setCheckpoints(event.target.value)} />
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <div className="space-y-2">
              <Label>{locale === "ru" ? "Запланировано уроков" : "Planned lessons"}</Label>
              <Input type="number" value={plannedLessons} onChange={(event) => setPlannedLessons(Number(event.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>{locale === "ru" ? "Проведено уроков" : "Completed lessons"}</Label>
              <Input type="number" value={completedLessons} onChange={(event) => setCompletedLessons(Number(event.target.value))} />
            </div>
          </div>

          <Button type="submit">
            {locale === "ru" ? "Сохранить план" : "Save plan"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
