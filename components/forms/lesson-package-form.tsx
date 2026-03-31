"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AppLanguage, LessonGenerationMode } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { lessonPackageSchema } from "@/lib/validators";
import type { AppLocale } from "@/lib/i18n";

type FormValues = z.input<typeof lessonPackageSchema>;

export function LessonPackageForm({
  classes,
  subjects,
  locale,
}: {
  classes: Array<{ id: string; name: string }>;
  subjects: Array<{ id: string; name: string }>;
  locale: AppLocale;
}) {
  const router = useRouter();
  const form = useForm<FormValues>({
    resolver: zodResolver(lessonPackageSchema),
    defaultValues: {
      classId: classes[0]?.id ?? "",
      subjectId: subjects[0]?.id ?? "",
      topic: "",
      title: "",
      objective: "",
      durationMinutes: 45,
      complexityLevel: locale === "ru" ? "Базовый" : "Core",
      language: locale === "ru" ? AppLanguage.RU : AppLanguage.EN,
      generationMode: LessonGenerationMode.BOARD,
      lessonStyle: locale === "ru" ? "Интерактивный" : "Interactive",
      activityCount: 4,
      includeQuiz: true,
      includeWorksheet: true,
      includeHomework: true,
      includeSummary: true,
      includeSlides: true,
      teacherNotes: "",
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    const response = await fetch("/api/lessons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const result = await response.json();

    if (!response.ok) {
      toast.error(result.error || (locale === "ru" ? "Не удалось создать урок" : "Unable to create lesson"));
      return;
    }

    toast.success(locale === "ru" ? "Урок создан" : "Lesson created");
    router.push(`/lesson-studio/${result.data.id}`);
    router.refresh();
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{locale === "ru" ? "Создать AI-урок" : "Create AI lesson"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={onSubmit}>
          <div className="grid gap-4 xl:grid-cols-3">
            <div className="space-y-2">
              <Label>{locale === "ru" ? "Класс" : "Class"}</Label>
              <Select {...form.register("classId")}>
                {classes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{locale === "ru" ? "Предмет" : "Subject"}</Label>
              <Select {...form.register("subjectId")}>
                {subjects.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{locale === "ru" ? "Язык" : "Language"}</Label>
              <Select {...form.register("language")}>
                <option value={AppLanguage.RU}>Русский</option>
                <option value={AppLanguage.EN}>English</option>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <div className="space-y-2">
              <Label>{locale === "ru" ? "Тема" : "Topic"}</Label>
              <Input {...form.register("topic")} placeholder={locale === "ru" ? "Например: Дроби" : "For example: Fractions"} />
            </div>
            <div className="space-y-2">
              <Label>{locale === "ru" ? "Название урока" : "Lesson title"}</Label>
              <Input {...form.register("title")} placeholder={locale === "ru" ? "Урок по теме дробей" : "Fractions in context"} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{locale === "ru" ? "Цель урока" : "Lesson objective"}</Label>
            <Textarea
              {...form.register("objective")}
              placeholder={
                locale === "ru"
                  ? "Что ученики должны понять и уметь к концу урока?"
                  : "What should students understand and be able to do by the end?"
              }
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-4">
            <div className="space-y-2">
              <Label>{locale === "ru" ? "Минут" : "Minutes"}</Label>
              <Input type="number" {...form.register("durationMinutes", { valueAsNumber: true })} />
            </div>
            <div className="space-y-2">
              <Label>{locale === "ru" ? "Сложность" : "Complexity"}</Label>
              <Input {...form.register("complexityLevel")} />
            </div>
            <div className="space-y-2">
              <Label>{locale === "ru" ? "Режим" : "Mode"}</Label>
              <Select {...form.register("generationMode")}>
                <option value={LessonGenerationMode.BOARD}>{locale === "ru" ? "Интерактивная доска" : "Board lesson"}</option>
                <option value={LessonGenerationMode.FULL}>{locale === "ru" ? "Полный урок" : "Full lesson"}</option>
                <option value={LessonGenerationMode.QUIZ}>{locale === "ru" ? "Только квиз" : "Quiz only"}</option>
                <option value={LessonGenerationMode.HOMEWORK}>{locale === "ru" ? "Только домашнее" : "Homework only"}</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{locale === "ru" ? "Активностей" : "Activities"}</Label>
              <Input type="number" {...form.register("activityCount", { valueAsNumber: true })} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{locale === "ru" ? "Стиль урока" : "Lesson style"}</Label>
            <Input {...form.register("lessonStyle")} placeholder={locale === "ru" ? "Практический, интерактивный, спокойный..." : "Practical, interactive, calm..."} />
          </div>

          <div className="space-y-2">
            <Label>{locale === "ru" ? "Заметки для AI" : "Notes for AI"}</Label>
            <Textarea
              {...form.register("teacherNotes")}
              placeholder={
                locale === "ru"
                  ? "Например: добавить больше устных вопросов и один быстрый опрос в середине урока."
                  : "For example: add more oral checks and one mid-lesson poll."
              }
            />
          </div>

          <div className="grid gap-3 rounded-2xl border bg-slate-50/80 p-4 md:grid-cols-2 xl:grid-cols-5">
            {[
              { key: "includeSlides", labelRu: "Слайды", labelEn: "Slides" },
              { key: "includeQuiz", labelRu: "Квиз", labelEn: "Quiz" },
              { key: "includeWorksheet", labelRu: "Практика", labelEn: "Practice" },
              { key: "includeHomework", labelRu: "Домашнее", labelEn: "Homework" },
              { key: "includeSummary", labelRu: "Итог", labelEn: "Summary" },
            ].map((item) => (
              <label key={item.key} className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input type="checkbox" {...form.register(item.key as keyof FormValues)} className="h-4 w-4 rounded border-slate-300" />
                <span>{locale === "ru" ? item.labelRu : item.labelEn}</span>
              </label>
            ))}
          </div>

          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting
              ? locale === "ru"
                ? "Создание..."
                : "Creating..."
              : locale === "ru"
                ? "Создать урок"
                : "Create lesson"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
