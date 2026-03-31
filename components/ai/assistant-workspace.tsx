"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { AlertTriangle, Bot, MessageSquareText, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { AppLocale } from "@/lib/i18n";

type AssistantWorkspaceProps = {
  role: "ADMIN" | "TEACHER" | "PARENT" | "STUDENT";
  locale: AppLocale;
  studentOptions: Array<{ id: string; label: string }>;
  initialStudentId?: string;
};

type AssistantAction = {
  key: string;
  label: string;
  requiresStudent: boolean;
};

type AssistantUiConfig = {
  panelTitle: string;
  panelDescription: string;
  studentLabel: string;
  askLabel: string;
  askPlaceholder: string;
  quickQuestions: string[];
  responseTitle: string;
  emptyResponse: string;
  selectStudentError: string;
  enterQuestionError: string;
  askButton: string;
  thinkingButton: string;
  explainTitle: string;
  explainPlaceholder: string;
  explainButton: string;
  draftTitle: string;
  draftPlaceholder: string;
  draftButton: string;
  noStudentLabel: string;
};

function buildUiByRole(locale: AppLocale): Record<AssistantWorkspaceProps["role"], AssistantUiConfig> {
  const ru = locale === "ru";
  return {
    STUDENT: {
      panelTitle: ru ? "Помощь в учебе" : "Study help",
      panelDescription: ru
        ? "Задавайте вопросы про учебу, риски и следующий шаг. Каждый ответ опирается на реальные школьные данные."
        : "Ask about your work, your risks, or what to do next. Every answer is grounded in your live school data.",
      studentLabel: ru ? "Контекст ученика" : "Student context",
      askLabel: ru ? "Спросить про мой учебный день" : "Ask about my school day",
      askPlaceholder: ru ? "Например: что мне сделать сначала сегодня?" : "Example: What should I do first today?",
      quickQuestions: ru
        ? ["Что мне сделать сначала сегодня?", "Какое домашнее задание самое срочное?", "На какой предмет сделать упор на этой неделе?"]
        : ["What should I do first today?", "Which homework is most urgent?", "What subject should I focus on this week?"],
      responseTitle: ru ? "Ответ AI по реальным данным" : "Grounded AI response",
      emptyResponse: ru
        ? "Выберите действие или задайте вопрос, чтобы получить ответ по вашим реальным школьным данным."
        : "Pick an action or ask a question to generate a grounded response from real school data.",
      selectStudentError: ru ? "Сначала выберите ученика" : "Select a student first",
      enterQuestionError: ru ? "Сначала введите вопрос" : "Enter a question first",
      askButton: ru ? "Спросить помощника" : "Ask assistant",
      thinkingButton: ru ? "Думаю..." : "Thinking...",
      explainTitle: ru ? "Объяснить тему или задание" : "Explain a topic or homework task",
      explainPlaceholder: ru ? "Введите тему, тест или задание" : "Enter a topic, test, or assignment",
      explainButton: ru ? "Объяснить тему" : "Explain topic",
      draftTitle: ru ? "Черновик сообщения" : "Draft a message",
      draftPlaceholder: ru ? "Опишите, какое сообщение вам нужно..." : "Describe the message you need...",
      draftButton: ru ? "Создать черновик" : "Draft reply",
      noStudentLabel: ru ? "Без выбора ученика" : "No student selected",
    },
    PARENT: {
      panelTitle: ru ? "Простая помощь для родителей" : "Simple family help",
      panelDescription: ru
        ? "Короткие и понятные ответы без сложных школьных формулировок. Помощник выделяет только самое важное."
        : "Short, clear answers for parents. The assistant highlights the main things without school jargon.",
      studentLabel: ru ? "Выбор ребенка" : "Child context",
      askLabel: ru ? "Спросить простыми словами" : "Ask in simple words",
      askPlaceholder: ru ? "Например: есть ли что-то срочное у моего ребенка на этой неделе?" : "Example: Is anything urgent for my child this week?",
      quickQuestions: ru
        ? ["Что самое важное на этой неделе?", "Все ли у ребенка в порядке?", "Что нам лучше повторить дома?"]
        : ["What is most important this week?", "Is my child doing okay?", "What should we practice at home?"],
      responseTitle: ru ? "Семейная AI-сводка" : "Family AI response",
      emptyResponse: ru
        ? "Выберите ребенка, нажмите на простое действие или задайте вопрос своими словами. Я покажу только главные школьные факты."
        : "Choose a child, tap a simple action, or ask a question in your own words. I will show only the main school facts that matter.",
      selectStudentError: ru ? "Сначала выберите ребенка" : "Select a student first",
      enterQuestionError: ru ? "Сначала введите вопрос" : "Enter a question first",
      askButton: ru ? "Спросить помощника" : "Ask assistant",
      thinkingButton: ru ? "Думаю..." : "Thinking...",
      explainTitle: ru ? "Объяснить тему или задание" : "Explain a topic or homework task",
      explainPlaceholder: ru ? "Введите тему, тест или домашнее задание" : "Enter a topic, test, or assignment",
      explainButton: ru ? "Объяснить" : "Explain topic",
      draftTitle: ru ? "Черновик сообщения" : "Draft a message",
      draftPlaceholder: ru ? "Опишите, какое сообщение вы хотите отправить..." : "Describe the message you need...",
      draftButton: ru ? "Подготовить черновик" : "Draft reply",
      noStudentLabel: ru ? "Без выбора ребенка" : "No student selected",
    },
    TEACHER: {
      panelTitle: ru ? "AI-помощник учителя" : "Teaching assistant",
      panelDescription: ru
        ? "Используйте AI для обзора классов, поддержки отдельных учеников, планирования уроков и общения с родителями."
        : "Use grounded AI for class overview, student support, study planning, parent communication, and next teaching actions.",
      studentLabel: ru ? "Контекст ученика" : "Student context",
      askLabel: ru ? "Спросить про классы или ученика" : "Ask about my classes or a student",
      askPlaceholder: ru ? "Например: кому нужна дополнительная поддержка на этой неделе?" : "Example: Which students need extra support this week?",
      quickQuestions: ru
        ? ["Кому нужна дополнительная поддержка на этой неделе?", "Какое домашнее задание проверить первым?", "Как чувствует себя выбранный ученик?"]
        : ["Which students need extra support this week?", "What homework should I review first?", "How is this selected student doing?"],
      responseTitle: ru ? "AI-ответ для учителя" : "Teacher AI response",
      emptyResponse: ru
        ? "Выберите ученика при необходимости или задайте вопрос по классу, чтобы получить ответ на основе реальных школьных данных."
        : "Pick an action or ask a question to generate a grounded response from real school data.",
      selectStudentError: ru ? "Сначала выберите ученика" : "Select a student first",
      enterQuestionError: ru ? "Сначала введите вопрос" : "Enter a question first",
      askButton: ru ? "Спросить AI" : "Ask assistant",
      thinkingButton: ru ? "Думаю..." : "Thinking...",
      explainTitle: ru ? "Объяснить тему или задание" : "Explain a topic or homework task",
      explainPlaceholder: ru ? "Введите тему, тест или домашнее задание" : "Enter a topic, test, or assignment",
      explainButton: ru ? "Объяснить тему" : "Explain topic",
      draftTitle: ru ? "Черновик сообщения родителю или ученику" : "Draft a parent or student message",
      draftPlaceholder: ru ? "Опишите, какое сообщение нужно подготовить..." : "Describe the message you need...",
      draftButton: ru ? "Создать черновик" : "Draft reply",
      noStudentLabel: ru ? "Без выбора ученика" : "No student selected",
    },
    ADMIN: {
      panelTitle: ru ? "AI-помощник школы" : "School assistant",
      panelDescription: ru
        ? "Сводки по работе школы, ученикам, посещаемости и академическим рискам на основе реальных данных."
        : "Grounded summaries for school operations, student follow-up, and admin visibility.",
      studentLabel: ru ? "Контекст ученика" : "Student context",
      askLabel: ru ? "Спросить про активность школы" : "Ask about school activity",
      askPlaceholder: ru ? "Например: на что обратить внимание на этой неделе?" : "Example: What should I watch this week?",
      quickQuestions: ru
        ? ["На что обратить внимание на этой неделе?", "Какому ученику нужна помощь?", "Что срочно сегодня?"]
        : ["What should I watch this week?", "Which student needs attention?", "What is urgent today?"],
      responseTitle: ru ? "AI-ответ по данным школы" : "Grounded AI response",
      emptyResponse: ru
        ? "Выберите действие или задайте вопрос, чтобы получить управленческую сводку по реальным данным школы."
        : "Pick an action or ask a question to generate a grounded response from real school data.",
      selectStudentError: ru ? "Сначала выберите ученика" : "Select a student first",
      enterQuestionError: ru ? "Сначала введите вопрос" : "Enter a question first",
      askButton: ru ? "Спросить AI" : "Ask assistant",
      thinkingButton: ru ? "Думаю..." : "Thinking...",
      explainTitle: ru ? "Объяснить тему или задание" : "Explain a topic or homework task",
      explainPlaceholder: ru ? "Введите тему, тест или задание" : "Enter a topic, test, or assignment",
      explainButton: ru ? "Объяснить тему" : "Explain topic",
      draftTitle: ru ? "Черновик сообщения" : "Draft a message",
      draftPlaceholder: ru ? "Опишите, какое сообщение нужно..." : "Describe the message you need...",
      draftButton: ru ? "Подготовить черновик" : "Draft reply",
      noStudentLabel: ru ? "Без выбора ученика" : "No student selected",
    },
  };
}

function buildActionsByRole(locale: AppLocale): Record<AssistantWorkspaceProps["role"], AssistantAction[]> {
  const ru = locale === "ru";
  return {
    STUDENT: [
      { key: "day-summary", label: ru ? "Что мне делать сегодня?" : "What should I do today?", requiresStudent: false },
      { key: "week-summary", label: ru ? "Сводка по неделе" : "Summarize this week", requiresStudent: false },
      { key: "risk-analysis", label: ru ? "Показать риски" : "Show risk indicators", requiresStudent: false },
      { key: "study-plan", label: ru ? "Собрать мой план учебы" : "Build my study plan", requiresStudent: false },
    ],
    PARENT: [
      { key: "day-summary", label: ru ? "Главное на сегодня" : "Main things today", requiresStudent: true },
      { key: "week-summary", label: ru ? "Что важно на этой неделе?" : "What matters this week?", requiresStudent: true },
      { key: "risk-analysis", label: ru ? "Все ли в порядке?" : "Is my child doing okay?", requiresStudent: true },
      { key: "study-plan", label: ru ? "Сделать простой учебный план" : "Build a simple study plan", requiresStudent: true },
    ],
    TEACHER: [
      { key: "teacher-summary", label: ru ? "Сводка по моим классам" : "Summarize my classes", requiresStudent: false },
      { key: "day-summary", label: ru ? "Что сделать этому ученику сегодня?" : "What should this student do today?", requiresStudent: true },
      { key: "week-summary", label: ru ? "Сводка по неделе ученика" : "Summarize this student week", requiresStudent: true },
      { key: "risk-analysis", label: ru ? "Проанализировать риски ученика" : "Analyze this student risk", requiresStudent: true },
      { key: "study-plan", label: ru ? "Построить учебный план для ученика" : "Build a study plan for this student", requiresStudent: true },
    ],
    ADMIN: [
      { key: "day-summary", label: ru ? "Дневная сводка ученика" : "Student day summary", requiresStudent: true },
      { key: "week-summary", label: ru ? "Недельная сводка ученика" : "Student week summary", requiresStudent: true },
      { key: "risk-analysis", label: ru ? "Риски ученика" : "Student risk indicators", requiresStudent: true },
      { key: "study-plan", label: ru ? "Учебный план ученика" : "Student study plan", requiresStudent: true },
    ],
  };
}

export function AssistantWorkspace({
  role,
  locale,
  studentOptions,
  initialStudentId,
}: AssistantWorkspaceProps) {
  const [topic, setTopic] = useState("");
  const [draftPrompt, setDraftPrompt] = useState("");
  const [question, setQuestion] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState(
    role === "PARENT" ? initialStudentId ?? studentOptions[0]?.id ?? "" : "",
  );

  const ui = buildUiByRole(locale)[role];
  const actions = buildActionsByRole(locale)[role];
  const [response, setResponse] = useState<string>(ui.emptyResponse);
  const [responseMeta, setResponseMeta] = useState<{
    source: "openai" | "gemini" | "fallback";
    model: string;
    providerLabel: "OpenAI" | "Gemini" | "Fallback";
    reason?: string;
  } | null>(null);
  const needsStudentContext = role !== "STUDENT" && studentOptions.length > 0;

  const mutation = useMutation({
    mutationFn: async ({
      path,
      body,
    }: {
      path: string;
      body?: Record<string, string>;
    }) => {
      const result = await fetch(`/api/ai/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      const json = await result.json();
      if (!result.ok) throw new Error(json.error || "AI request failed");
      return json.data as {
        title: string;
        content: string;
        meta?: {
          source: "openai" | "gemini" | "fallback";
          model: string;
          providerLabel: "OpenAI" | "Gemini" | "Fallback";
          reason?: string;
        };
      };
    },
    onSuccess: (data) => {
      setResponse(`${data.title}\n\n${data.content}`);
      setResponseMeta(data.meta ?? null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const ensureStudentSelection = (requiresStudent: boolean) => {
    if (requiresStudent && !selectedStudentId) {
      toast.error(ui.selectStudentError);
      return false;
    }
    return true;
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
      <Card>
        <CardHeader>
          <CardTitle>{ui.panelTitle}</CardTitle>
          <p className="text-sm leading-6 text-[var(--muted)]">{ui.panelDescription}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {needsStudentContext ? (
            <div className="space-y-3 rounded-2xl border bg-white/80 p-4 shadow-sm">
              <p className="text-sm font-semibold text-slate-900">{ui.studentLabel}</p>
              <select
                value={selectedStudentId}
                onChange={(event) => setSelectedStudentId(event.target.value)}
                className="flex h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none"
              >
                {role === "TEACHER" || role === "ADMIN" ? (
                  <option value="">{ui.noStudentLabel}</option>
                ) : null}
                {studentOptions.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="space-y-3">
            {actions.map((action) => (
              <Button
                key={action.key}
                variant="outline"
                className="w-full justify-start text-left"
                type="button"
                onClick={() => {
                  if (!ensureStudentSelection(action.requiresStudent)) {
                    return;
                  }

                  mutation.mutate({
                    path: action.key,
                    body: action.requiresStudent ? { studentId: selectedStudentId } : {},
                  });
                }}
              >
                <Sparkles className="h-4 w-4" />
                {action.label}
              </Button>
            ))}
          </div>

          <div className="space-y-3 rounded-2xl border bg-[linear-gradient(180deg,rgba(20,86,194,0.05),rgba(15,23,42,0.02))] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <MessageSquareText className="h-4 w-4 text-[var(--primary)]" />
              {ui.askLabel}
            </div>
            <Textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder={ui.askPlaceholder}
              className="min-h-28"
            />
            <div className="flex flex-wrap gap-2">
              {ui.quickQuestions.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setQuestion(item)}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
                >
                  {item}
                </button>
              ))}
            </div>
            <Button
              type="button"
              className="w-full"
              disabled={mutation.isPending}
              onClick={() => {
                if (!question.trim()) {
                  toast.error(ui.enterQuestionError);
                  return;
                }

                const body: Record<string, string> = { question: question.trim() };
                if (role !== "STUDENT" && selectedStudentId) {
                  body.studentId = selectedStudentId;
                }

                mutation.mutate({ path: "assistant", body });
              }}
            >
              {mutation.isPending ? ui.thinkingButton : ui.askButton}
            </Button>
          </div>

          <div className="space-y-3 rounded-2xl border bg-white/70 p-4">
            <p className="text-sm font-semibold text-slate-900">{ui.explainTitle}</p>
            <Input value={topic} onChange={(event) => setTopic(event.target.value)} placeholder={ui.explainPlaceholder} />
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={() => mutation.mutate({ path: "explain-topic", body: { topic } })}
            >
              {ui.explainButton}
            </Button>
          </div>

          <div className="space-y-3 rounded-2xl border bg-white/70 p-4">
            <p className="text-sm font-semibold text-slate-900">{ui.draftTitle}</p>
            <Textarea value={draftPrompt} onChange={(event) => setDraftPrompt(event.target.value)} placeholder={ui.draftPlaceholder} />
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={() => mutation.mutate({ path: "message-draft", body: { message: draftPrompt } })}
            >
              {ui.draftButton}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-[var(--primary)]" />
            {ui.responseTitle}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {responseMeta ? (
            <div
              className={
                responseMeta.source === "openai"
                  ? "rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4"
                  : "rounded-2xl border border-amber-200 bg-amber-50/80 p-4"
              }
            >
              <div className="flex items-center gap-2">
                {responseMeta.source === "openai" ? (
                  <Badge variant="success">{responseMeta.providerLabel} active</Badge>
                ) : responseMeta.source === "gemini" ? (
                  <Badge variant="success">{responseMeta.providerLabel} active</Badge>
                ) : (
                  <>
                    <AlertTriangle className="h-4 w-4 text-amber-700" />
                    <Badge variant="warning">Fallback mode</Badge>
                  </>
                )}
                <span className="text-xs font-medium text-slate-700">{responseMeta.model}</span>
              </div>
              <p className="mt-2 text-sm text-slate-700">
                {responseMeta.source === "openai" || responseMeta.source === "gemini"
                  ? `This answer came from the live ${responseMeta.providerLabel} provider through the backend.`
                  : `This answer used the grounded fallback. ${responseMeta.reason || "Add OPENAI_API_KEY to enable real LLM output."}`}
              </p>
            </div>
          ) : null}
          <div className="rounded-3xl border bg-[linear-gradient(180deg,rgba(20,86,194,0.06),rgba(15,118,110,0.03))] p-6 shadow-sm">
            <pre className="whitespace-pre-wrap font-sans text-sm leading-7 text-slate-800">{response}</pre>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
