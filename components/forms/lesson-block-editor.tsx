"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, GripVertical, WandSparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { AppLocale } from "@/lib/i18n";

type LessonBlock = {
  id: string;
  orderIndex: number;
  blockType: string;
  title: string;
  instructions: string | null;
  contentJson: unknown;
  settingsJson: unknown;
  answerKeyJson: unknown;
  hint: string | null;
  teacherNote: string | null;
  estimatedSeconds: number | null;
  isGradable: boolean;
  isPracticeOnly: boolean;
};

type BlockTemplate = {
  value: string;
  ru: string;
  en: string;
  descRu: string;
  descEn: string;
};

const blockTemplates: BlockTemplate[] = [
  { value: "intro", ru: "Старт урока", en: "Lesson intro", descRu: "Заголовок и цель", descEn: "Title and goal" },
  { value: "explanation", ru: "Объяснение", en: "Explanation", descRu: "Текст и пример", descEn: "Text and example" },
  { value: "discussion", ru: "Обсуждение", en: "Discussion", descRu: "Вопрос для класса", descEn: "Prompt for the class" },
  { value: "single-choice", ru: "Один ответ", en: "Single choice", descRu: "Тест с одним ответом", descEn: "One correct option" },
  { value: "multiple-choice", ru: "Несколько ответов", en: "Multiple choice", descRu: "Тест с несколькими ответами", descEn: "Multiple correct options" },
  { value: "true-false", ru: "Верно / неверно", en: "True / false", descRu: "Быстрая проверка", descEn: "Quick check" },
  { value: "short-answer", ru: "Короткий ответ", en: "Short answer", descRu: "Формула или решение", descEn: "Formula or short solution" },
  { value: "matching", ru: "Соедини пары", en: "Matching", descRu: "Время и человек", descEn: "Time and person" },
  { value: "connect", ru: "Связать элементы", en: "Connect items", descRu: "Формула и результат", descEn: "Formula and result" },
  { value: "sort-order", ru: "Порядок шагов", en: "Sort order", descRu: "Шаги решения", descEn: "Order the steps" },
  { value: "poll", ru: "Опрос", en: "Poll", descRu: "Без оценки", descEn: "Non-graded poll" },
  { value: "summary", ru: "Итог", en: "Summary", descRu: "Подведение итогов", descEn: "Wrap-up" },
  { value: "homework", ru: "Домашнее", en: "Homework", descRu: "Что сделать дома", descEn: "Post-class task" },
];

function prettyJson(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2);
}

function splitLines(value: string) {
  return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
}

function joinLines(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item)).join("\n") : "";
}

function formatIndexes(value: unknown) {
  return Array.isArray(value) ? value.map((item) => Number(item) + 1).join(", ") : "";
}

function parseJson(text: string) {
  return JSON.parse(text || "{}");
}

function blockLabel(locale: AppLocale, type: string) {
  const template = blockTemplates.find((item) => item.value === type);
  return template ? (locale === "ru" ? template.ru : template.en) : type;
}

function templateDefaults(type: string, title: string, locale: AppLocale) {
  if (type === "single-choice") return { contentJson: { question: title, options: ["Option 1", "Option 2", "Option 3"] }, answerKeyJson: { answerIndex: 0 } };
  if (type === "multiple-choice") return { contentJson: { question: title, options: ["Option 1", "Option 2", "Option 3", "Option 4"] }, answerKeyJson: { answers: [0] } };
  if (type === "true-false") return { contentJson: { question: title, options: ["True", "False"] }, answerKeyJson: { answer: true } };
  if (type === "short-answer") return { contentJson: { question: title }, answerKeyJson: { acceptedAnswers: [] } };
  if (type === "matching" || type === "connect") {
    return {
      contentJson: { question: title, leftItems: ["Item 1", "Item 2", "Item 3"], rightItems: ["Answer 1", "Answer 2", "Answer 3"] },
      answerKeyJson: { matches: [{ leftIndex: 0, rightIndex: 0 }, { leftIndex: 1, rightIndex: 1 }, { leftIndex: 2, rightIndex: 2 }] },
    };
  }
  if (type === "sort-order") return { contentJson: { question: title, items: ["Step 1", "Step 2", "Step 3"] }, answerKeyJson: { order: [0, 1, 2] } };
  if (type === "discussion") return { contentJson: { task: locale === "ru" ? "Опишите вопрос для обсуждения." : "Describe a discussion prompt." }, answerKeyJson: {} };
  return { contentJson: { body: locale === "ru" ? "Добавьте содержимое блока." : "Add block content." }, answerKeyJson: {} };
}

function renderTeacherFields(block: LessonBlock, locale: AppLocale) {
  const content = (block.contentJson ?? {}) as Record<string, unknown>;
  const answerKey = (block.answerKeyJson ?? {}) as Record<string, unknown>;

  if (["intro", "explanation", "summary", "homework"].includes(block.blockType)) {
    return (
      <div className="space-y-2">
        <Label>{locale === "ru" ? "Текст блока" : "Block text"}</Label>
        <Textarea name="friendlyBody" defaultValue={typeof content.body === "string" ? content.body : ""} className="min-h-[140px]" />
      </div>
    );
  }

  if (block.blockType === "discussion") {
    return (
      <div className="space-y-2">
        <Label>{locale === "ru" ? "Вопрос для обсуждения" : "Discussion prompt"}</Label>
        <Textarea name="friendlyTask" defaultValue={typeof content.task === "string" ? content.task : ""} className="min-h-[120px]" />
      </div>
    );
  }

  if (block.blockType === "single-choice" || block.blockType === "poll") {
    return (
      <div className="grid gap-4">
        <div className="space-y-2">
          <Label>{locale === "ru" ? "Вопрос" : "Question"}</Label>
          <Textarea name="friendlyQuestion" defaultValue={typeof content.question === "string" ? content.question : ""} className="min-h-[100px]" />
        </div>
        <div className="space-y-2">
          <Label>{locale === "ru" ? "Варианты ответа, по одному в строке" : "Answer options, one per line"}</Label>
          <Textarea name="friendlyOptions" defaultValue={joinLines(content.options)} className="min-h-[140px]" />
        </div>
        {block.blockType === "single-choice" ? (
          <div className="space-y-2">
            <Label>{locale === "ru" ? "Номер правильного ответа" : "Correct option number"}</Label>
            <Input name="friendlyCorrectIndex" defaultValue={String(Number(answerKey.answerIndex ?? 0) + 1)} />
          </div>
        ) : null}
      </div>
    );
  }

  if (block.blockType === "multiple-choice") {
    return (
      <div className="grid gap-4">
        <div className="space-y-2">
          <Label>{locale === "ru" ? "Вопрос" : "Question"}</Label>
          <Textarea name="friendlyQuestion" defaultValue={typeof content.question === "string" ? content.question : ""} className="min-h-[100px]" />
        </div>
        <div className="space-y-2">
          <Label>{locale === "ru" ? "Варианты ответа, по одному в строке" : "Answer options, one per line"}</Label>
          <Textarea name="friendlyOptions" defaultValue={joinLines(content.options)} className="min-h-[140px]" />
        </div>
        <div className="space-y-2">
          <Label>{locale === "ru" ? "Номера правильных ответов через запятую" : "Correct option numbers, comma separated"}</Label>
          <Input name="friendlyCorrectIndexes" defaultValue={formatIndexes(answerKey.answers)} placeholder="1, 3" />
        </div>
      </div>
    );
  }

  if (block.blockType === "true-false") {
    return (
      <div className="grid gap-4">
        <div className="space-y-2">
          <Label>{locale === "ru" ? "Утверждение" : "Statement"}</Label>
          <Textarea name="friendlyQuestion" defaultValue={typeof content.question === "string" ? content.question : ""} className="min-h-[100px]" />
        </div>
        <div className="space-y-2">
          <Label>{locale === "ru" ? "Правильный ответ" : "Correct answer"}</Label>
          <Select name="friendlyTrueFalse" defaultValue={String(Boolean(answerKey.answer))}>
            <option value="true">{locale === "ru" ? "Верно" : "True"}</option>
            <option value="false">{locale === "ru" ? "Неверно" : "False"}</option>
          </Select>
        </div>
      </div>
    );
  }

  if (block.blockType === "short-answer") {
    return (
      <div className="grid gap-4">
        <div className="space-y-2">
          <Label>{locale === "ru" ? "Вопрос или задача" : "Question or task"}</Label>
          <Textarea name="friendlyQuestion" defaultValue={typeof content.question === "string" ? content.question : ""} className="min-h-[100px]" />
        </div>
        <div className="space-y-2">
          <Label>{locale === "ru" ? "Подходящие ответы, по одному в строке" : "Accepted answers, one per line"}</Label>
          <Textarea name="friendlyAcceptedAnswers" defaultValue={joinLines(answerKey.acceptedAnswers)} className="min-h-[140px]" />
        </div>
      </div>
    );
  }

  if (block.blockType === "matching" || block.blockType === "connect") {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2 lg:col-span-2">
          <Label>{locale === "ru" ? "Задание" : "Prompt"}</Label>
          <Textarea name="friendlyQuestion" defaultValue={typeof content.question === "string" ? content.question : ""} className="min-h-[100px]" />
        </div>
        <div className="space-y-2">
          <Label>{locale === "ru" ? "Левая колонка" : "Left column"}</Label>
          <Textarea name="friendlyLeftItems" defaultValue={joinLines(content.leftItems)} className="min-h-[160px]" />
        </div>
        <div className="space-y-2">
          <Label>{locale === "ru" ? "Правая колонка" : "Right column"}</Label>
          <Textarea name="friendlyRightItems" defaultValue={joinLines(content.rightItems)} className="min-h-[160px]" />
        </div>
      </div>
    );
  }

  if (block.blockType === "sort-order") {
    return (
      <div className="grid gap-4">
        <div className="space-y-2">
          <Label>{locale === "ru" ? "Задание" : "Prompt"}</Label>
          <Textarea name="friendlyQuestion" defaultValue={typeof content.question === "string" ? content.question : ""} className="min-h-[100px]" />
        </div>
        <div className="space-y-2">
          <Label>{locale === "ru" ? "Правильный порядок шагов" : "Correct order of steps"}</Label>
          <Textarea name="friendlyOrderItems" defaultValue={joinLines(content.items)} className="min-h-[160px]" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label>{locale === "ru" ? "Текст блока" : "Block text"}</Label>
      <Textarea name="friendlyBody" defaultValue={typeof content.body === "string" ? content.body : prettyJson(content)} className="min-h-[140px]" />
    </div>
  );
}

export function LessonBlockEditor({
  lessonId,
  locale,
  initialBlocks,
}: {
  lessonId: string;
  locale: AppLocale;
  initialBlocks: LessonBlock[];
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [newBlockType, setNewBlockType] = useState("single-choice");
  const [newTitle, setNewTitle] = useState(locale === "ru" ? "Новый вопрос" : "New question");
  const [expandedId, setExpandedId] = useState<string | null>(initialBlocks[0]?.id ?? null);
  const quickTemplates = useMemo(
    () => blockTemplates.filter((item) => ["single-choice", "matching", "sort-order", "short-answer", "explanation"].includes(item.value)),
    [],
  );

  const saveBlock = async (blockId: string, formData: FormData) => {
    setBusyId(blockId);
    try {
      const blockType = String(formData.get("blockType"));
      const payload = {
        orderIndex: Number(formData.get("orderIndex")),
        blockType,
        title: String(formData.get("title")),
        instructions: String(formData.get("instructions") || ""),
        contentJson: {},
        settingsJson: parseJson(String(formData.get("settingsJson") || "{}")),
        answerKeyJson: {},
        hint: String(formData.get("hint") || ""),
        teacherNote: String(formData.get("teacherNote") || ""),
        estimatedSeconds: Number(formData.get("estimatedSeconds") || 0),
        isGradable: formData.get("isGradable") === "on",
        isPracticeOnly: formData.get("isPracticeOnly") === "on",
      } as Record<string, unknown>;

      const rawContent = parseJson(String(formData.get("rawContentJson") || "{}"));
      const rawAnswer = parseJson(String(formData.get("rawAnswerKeyJson") || "{}"));

      payload.contentJson = rawContent;
      payload.answerKeyJson = rawAnswer;

      const question = String(formData.get("friendlyQuestion") || "");
      if (["intro", "explanation", "summary", "homework"].includes(blockType)) {
        payload.contentJson = { body: String(formData.get("friendlyBody") || "") };
        payload.answerKeyJson = {};
      } else if (blockType === "discussion") {
        payload.contentJson = { task: String(formData.get("friendlyTask") || "") };
        payload.answerKeyJson = {};
      } else if (blockType === "single-choice" || blockType === "poll") {
        payload.contentJson = { question, options: splitLines(String(formData.get("friendlyOptions") || "")) };
        payload.answerKeyJson = blockType === "single-choice" ? { answerIndex: Math.max(0, Number(String(formData.get("friendlyCorrectIndex") || "1")) - 1) } : {};
      } else if (blockType === "multiple-choice") {
        payload.contentJson = { question, options: splitLines(String(formData.get("friendlyOptions") || "")) };
        payload.answerKeyJson = { answers: String(formData.get("friendlyCorrectIndexes") || "").split(",").map((item) => Number(item.trim()) - 1).filter((item) => Number.isInteger(item) && item >= 0) };
      } else if (blockType === "true-false") {
        payload.contentJson = { question, options: ["True", "False"] };
        payload.answerKeyJson = { answer: String(formData.get("friendlyTrueFalse") || "true") === "true" };
      } else if (blockType === "short-answer") {
        payload.contentJson = { question };
        payload.answerKeyJson = { acceptedAnswers: splitLines(String(formData.get("friendlyAcceptedAnswers") || "")) };
      } else if (blockType === "matching" || blockType === "connect") {
        const leftItems = splitLines(String(formData.get("friendlyLeftItems") || ""));
        const rightItems = splitLines(String(formData.get("friendlyRightItems") || ""));
        payload.contentJson = { question, leftItems, rightItems };
        payload.answerKeyJson = { matches: leftItems.map((_, index) => ({ leftIndex: index, rightIndex: index })) };
      } else if (blockType === "sort-order") {
        const items = splitLines(String(formData.get("friendlyOrderItems") || ""));
        payload.contentJson = { question, items };
        payload.answerKeyJson = { order: items.map((_, index) => index) };
      }

      const response = await fetch(`/api/lesson-blocks/${blockId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) {
        toast.error(result.error || (locale === "ru" ? "Не удалось сохранить блок" : "Unable to save block"));
        return;
      }
      toast.success(locale === "ru" ? "Блок сохранен" : "Block saved");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : locale === "ru" ? "Проверьте данные блока" : "Please check block data");
    } finally {
      setBusyId(null);
    }
  };

  const deleteBlock = async (blockId: string) => {
    setBusyId(blockId);
    const response = await fetch(`/api/lesson-blocks/${blockId}`, { method: "DELETE" });
    const result = await response.json();
    setBusyId(null);
    if (!response.ok) {
      toast.error(result.error || (locale === "ru" ? "Не удалось удалить блок" : "Unable to delete block"));
      return;
    }
    toast.success(locale === "ru" ? "Блок удален" : "Block deleted");
    router.refresh();
  };

  const addBlock = async (type = newBlockType, title = newTitle) => {
    const defaults = templateDefaults(type, title, locale);
    const response = await fetch(`/api/lessons/${lessonId}/blocks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderIndex: initialBlocks.length,
        blockType: type,
        title,
        instructions: "",
        contentJson: defaults.contentJson,
        settingsJson: {},
        answerKeyJson: defaults.answerKeyJson,
        hint: "",
        teacherNote: "",
        estimatedSeconds: 120,
        isGradable: ["single-choice", "multiple-choice", "true-false", "short-answer", "matching", "connect", "sort-order"].includes(type),
        isPracticeOnly: !["single-choice", "multiple-choice", "true-false", "short-answer", "matching", "connect", "sort-order"].includes(type),
      }),
    });
    const result = await response.json();
    if (!response.ok) {
      toast.error(result.error || (locale === "ru" ? "Не удалось добавить блок" : "Unable to add block"));
      return;
    }
    toast.success(locale === "ru" ? "Блок добавлен" : "Block added");
    router.refresh();
  };

  const regenerate = async (target: "all" | "interactive" | "summary" | "homework") => {
    const response = await fetch(`/api/lessons/${lessonId}/regenerate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target }),
    });
    const result = await response.json();
    if (!response.ok) {
      toast.error(result.error || (locale === "ru" ? "Не удалось пересобрать блоки" : "Unable to regenerate blocks"));
      return;
    }
    toast.success(locale === "ru" ? "Урок обновлен" : "Lesson regenerated");
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{locale === "ru" ? "Быстрый конструктор блока" : "Quick block builder"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {quickTemplates.map((template) => (
              <button
                key={template.value}
                type="button"
                onClick={() => {
                  setNewBlockType(template.value);
                  setNewTitle(locale === "ru" ? template.ru : template.en);
                  void addBlock(template.value, locale === "ru" ? template.ru : template.en);
                }}
                className="rounded-3xl border bg-white/80 p-4 text-left transition hover:border-blue-300 hover:bg-blue-50/70"
              >
                <p className="text-sm font-semibold text-slate-900">{locale === "ru" ? template.ru : template.en}</p>
                <p className="mt-2 text-xs leading-5 text-[var(--muted)]">{locale === "ru" ? template.descRu : template.descEn}</p>
              </button>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto]">
            <div className="space-y-2">
              <Label>{locale === "ru" ? "Тип задания" : "Block type"}</Label>
              <Select value={newBlockType} onChange={(event) => setNewBlockType(event.target.value)}>
                {blockTemplates.map((template) => (
                  <option key={template.value} value={template.value}>
                    {locale === "ru" ? template.ru : template.en}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{locale === "ru" ? "Название блока" : "Block title"}</Label>
              <Input value={newTitle} onChange={(event) => setNewTitle(event.target.value)} />
            </div>
            <div className="flex items-end">
              <Button type="button" onClick={() => addBlock()}>
                {locale === "ru" ? "Добавить блок" : "Add block"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="outline" onClick={() => regenerate("all")}>
          <WandSparkles className="h-4 w-4" />
          {locale === "ru" ? "Пересобрать весь урок" : "Regenerate full lesson"}
        </Button>
        <Button type="button" variant="outline" onClick={() => regenerate("interactive")}>
          {locale === "ru" ? "Пересобрать тесты" : "Regenerate tests"}
        </Button>
        <Button type="button" variant="outline" onClick={() => regenerate("summary")}>
          {locale === "ru" ? "Обновить итог" : "Regenerate summary"}
        </Button>
        <Button type="button" variant="outline" onClick={() => regenerate("homework")}>
          {locale === "ru" ? "Обновить домашнее" : "Regenerate homework"}
        </Button>
      </div>

      <div className="space-y-4">
        {initialBlocks.map((block) => {
          const expanded = expandedId === block.id;

          return (
            <Card key={block.id}>
              <CardHeader>
                <button
                  type="button"
                  className="flex w-full flex-wrap items-center justify-between gap-3 text-left"
                  onClick={() => setExpandedId(expanded ? null : block.id)}
                >
                  <div className="flex items-center gap-3">
                    <GripVertical className="h-4 w-4 text-[var(--muted)]" />
                    <div>
                      <CardTitle>
                        {block.orderIndex + 1}. {block.title}
                      </CardTitle>
                      <p className="mt-2 text-sm text-[var(--muted)]">{blockLabel(locale, block.blockType)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {block.isGradable ? <Badge variant="info">{locale === "ru" ? "Оценка" : "Gradable"}</Badge> : null}
                    {block.isPracticeOnly ? <Badge variant="neutral">{locale === "ru" ? "Практика" : "Practice"}</Badge> : null}
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white/80 text-slate-700">
                      {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </span>
                  </div>
                </button>
              </CardHeader>

              {expanded ? (
                <CardContent>
                  <form
                    className="grid gap-5"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void saveBlock(block.id, new FormData(event.currentTarget));
                    }}
                  >
                    <div className="grid gap-4 md:grid-cols-4">
                      <div className="space-y-2">
                        <Label>{locale === "ru" ? "Порядок" : "Order"}</Label>
                        <Input name="orderIndex" type="number" defaultValue={block.orderIndex} />
                      </div>
                      <div className="space-y-2">
                        <Label>{locale === "ru" ? "Тип блока" : "Block type"}</Label>
                        <Select name="blockType" defaultValue={block.blockType}>
                          {blockTemplates.map((template) => (
                            <option key={template.value} value={template.value}>
                              {locale === "ru" ? template.ru : template.en}
                            </option>
                          ))}
                        </Select>
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label>{locale === "ru" ? "Название" : "Title"}</Label>
                        <Input name="title" defaultValue={block.title} />
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="space-y-2 md:col-span-2">
                        <Label>{locale === "ru" ? "Инструкция для класса" : "Class instructions"}</Label>
                        <Textarea name="instructions" defaultValue={block.instructions ?? ""} className="min-h-[100px]" />
                      </div>
                      <div className="space-y-2">
                        <Label>{locale === "ru" ? "Время, секунд" : "Time, seconds"}</Label>
                        <Input name="estimatedSeconds" type="number" defaultValue={block.estimatedSeconds ?? 120} />
                      </div>
                    </div>

                    <div className="rounded-3xl border bg-slate-50/80 p-4">
                      <p className="text-sm font-semibold text-slate-900">
                        {locale === "ru" ? "Понятная форма для учителя" : "Teacher-friendly editor"}
                      </p>
                      <div className="mt-4">{renderTeacherFields(block, locale)}</div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>{locale === "ru" ? "Подсказка" : "Hint"}</Label>
                        <Input name="hint" defaultValue={block.hint ?? ""} />
                      </div>
                      <div className="space-y-2">
                        <Label>{locale === "ru" ? "Заметка учителя" : "Teacher note"}</Label>
                        <Input name="teacherNote" defaultValue={block.teacherNote ?? ""} />
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-4">
                      <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                        <input name="isGradable" type="checkbox" defaultChecked={block.isGradable} className="h-4 w-4 rounded border-slate-300" />
                        <span>{locale === "ru" ? "Ставить оценку" : "Create grade"}</span>
                      </label>
                      <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                        <input name="isPracticeOnly" type="checkbox" defaultChecked={block.isPracticeOnly} className="h-4 w-4 rounded border-slate-300" />
                        <span>{locale === "ru" ? "Только практика" : "Practice only"}</span>
                      </label>
                    </div>

                    <details className="rounded-3xl border bg-white/70 p-4">
                      <summary className="cursor-pointer text-sm font-semibold text-slate-900">
                        {locale === "ru" ? "Расширенные поля" : "Advanced fields"}
                      </summary>
                      <div className="mt-4 grid gap-4 xl:grid-cols-3">
                        <div className="space-y-2">
                          <Label>Content JSON</Label>
                          <Textarea name="rawContentJson" defaultValue={prettyJson(block.contentJson)} className="min-h-[180px] font-mono text-xs" />
                        </div>
                        <div className="space-y-2">
                          <Label>Settings JSON</Label>
                          <Textarea name="settingsJson" defaultValue={prettyJson(block.settingsJson)} className="min-h-[180px] font-mono text-xs" />
                        </div>
                        <div className="space-y-2">
                          <Label>Answer key JSON</Label>
                          <Textarea name="rawAnswerKeyJson" defaultValue={prettyJson(block.answerKeyJson)} className="min-h-[180px] font-mono text-xs" />
                        </div>
                      </div>
                    </details>

                    <div className="flex flex-wrap gap-3">
                      <Button type="submit" disabled={busyId === block.id}>
                        {busyId === block.id ? (locale === "ru" ? "Сохранение..." : "Saving...") : locale === "ru" ? "Сохранить блок" : "Save block"}
                      </Button>
                      <Button type="button" variant="danger" disabled={busyId === block.id} onClick={() => deleteBlock(block.id)}>
                        {locale === "ru" ? "Удалить" : "Delete"}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              ) : null}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
