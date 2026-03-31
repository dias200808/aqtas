export const LOCALE_COOKIE = "school_locale";

export type AppLocale = "ru" | "en";

type DictionaryValue = string | { [key: string]: DictionaryValue };

const dictionaries = {
  ru: {
    nav: {
      dashboard: "Панель",
      schedule: "Расписание",
      homework: "Домашние задания",
      grades: "Оценки",
      attendance: "Посещаемость",
      messages: "Сообщения",
      calendar: "Календарь",
      announcements: "Объявления",
      ai: "AI-помощник",
      reports: "Отчеты",
      board: "Интерактивная доска",
      lessonStudio: "AI-уроки",
      planning: "Планирование",
      users: "Пользователи",
      students: "Ученики",
      parents: "Родители",
      teachers: "Учителя",
      classes: "Классы",
      subjects: "Предметы",
      timetable: "Учебный план",
      analytics: "Аналитика",
      settings: "Настройки",
      systemSettings: "Системные настройки",
    },
    groups: {
      main: "Рабочая зона",
      admin: "Администрирование",
      system: "Аккаунт",
    },
    sidebar: {
      productSubtitle: "AI-платформа школы",
      expand: "Развернуть",
      collapse: "Свернуть",
      groundedTitle: "Проверенный AI",
      groundedBody: "Сводки, риски и черновики формируются только на основе живых школьных данных.",
      logout: "Выйти",
      noStudent: "Без ученика",
    },
    topbar: {
      platformLabel: "Школьная платформа",
      searchPlaceholder: "Поиск по ученикам, заданиям, классам...",
      settings: "Настройки",
    },
    settings: {
      title: "Настройки",
      description: "Параметры аккаунта, языка интерфейса и рабочей среды.",
      profile: "Профиль",
      languageTitle: "Язык системы",
      languageDescription: "Русский язык включен по умолчанию. Вы можете переключить интерфейс на английский в любой момент.",
      name: "Имя",
      email: "Email",
      role: "Роль",
      session: "Сессия",
      sessionDescription: "JWT cookie с серверной проверкой ролей и прав доступа.",
      russian: "Русский",
      english: "English",
      active: "Активно",
      saveSuccess: "Язык интерфейса обновлен",
      saveError: "Не удалось обновить язык",
    },
    analytics: {
      title: "Аналитика",
      description: "Краткая управленческая аналитика по активности, планированию и цифровому обучению.",
      userMix: "Состав пользователей",
      activitySignals: "Сигналы активности",
      teachingOps: "Цифровое обучение",
    },
    board: {
      title: "Интерактивная доска",
      description: "Запускайте уроки в полноэкранном режиме, управляйте слайдами и сохраняйте прогресс урока.",
      liveSession: "Живая сессия",
      noSession: "Активной сессии пока нет",
      startLesson: "Запустить урок",
      pauseLesson: "Пауза",
      resumeLesson: "Продолжить",
      completeLesson: "Завершить",
      previous: "Назад",
      next: "Далее",
      revealHint: "Показать подсказку",
      structure: "Структура урока",
      controls: "Управление учителя",
      teacherNotes: "Заметки учителя",
      recentLessons: "Недавние уроки",
    },
    lessonStudio: {
      title: "AI-конструктор уроков",
      description: "Введите тему, класс и параметры урока, чтобы получить слайды, задания, квиз, рабочий лист и домашнее задание.",
      create: "Создать урок",
      draft: "Черновик урока",
      generatedLessons: "Сгенерированные уроки",
      publish: "Опубликовать на доске",
    },
    planning: {
      title: "Академическое планирование",
      description: "Годовые, четвертные и недельные планы по предметам и классам с контролем выполнения.",
      create: "Создать план",
      progress: "Выполнение",
      checkpoints: "Контрольные точки",
      outcomes: "Ожидаемые результаты",
    },
  },
  en: {
    nav: {
      dashboard: "Dashboard",
      schedule: "Schedule",
      homework: "Homework",
      grades: "Grades",
      attendance: "Attendance",
      messages: "Messages",
      calendar: "Calendar",
      announcements: "Announcements",
      ai: "AI Assistant",
      reports: "Reports",
      board: "Interactive Board",
      lessonStudio: "Lesson Studio",
      planning: "Planning",
      users: "Users",
      students: "Students",
      parents: "Parents",
      teachers: "Teachers",
      classes: "Classes",
      subjects: "Subjects",
      timetable: "Timetable",
      analytics: "Analytics",
      settings: "Settings",
      systemSettings: "System Settings",
    },
    groups: {
      main: "Workspace",
      admin: "Administration",
      system: "Account",
    },
    sidebar: {
      productSubtitle: "AI-first school OS",
      expand: "Expand",
      collapse: "Collapse",
      groundedTitle: "Grounded AI",
      groundedBody: "Summaries, risks, and drafts are generated only from live school data.",
      logout: "Logout",
      noStudent: "No student selected",
    },
    topbar: {
      platformLabel: "School platform",
      searchPlaceholder: "Search people, homework, classes...",
      settings: "Settings",
    },
    settings: {
      title: "Settings",
      description: "Account, language, and workspace preferences.",
      profile: "Profile",
      languageTitle: "System language",
      languageDescription: "Russian is the default language. You can switch the interface to English at any time.",
      name: "Name",
      email: "Email",
      role: "Role",
      session: "Session",
      sessionDescription: "JWT cookie session with backend RBAC checks.",
      russian: "Russian",
      english: "English",
      active: "Active",
      saveSuccess: "Interface language updated",
      saveError: "Unable to update language",
    },
    analytics: {
      title: "Analytics",
      description: "Executive analytics for activity, planning, and digital teaching operations.",
      userMix: "User mix",
      activitySignals: "Activity signals",
      teachingOps: "Digital teaching",
    },
    board: {
      title: "Interactive Board",
      description: "Launch lessons in full-screen mode, guide slides, and save classroom session progress.",
      liveSession: "Live session",
      noSession: "No active session yet",
      startLesson: "Start lesson",
      pauseLesson: "Pause",
      resumeLesson: "Resume",
      completeLesson: "Complete",
      previous: "Previous",
      next: "Next",
      revealHint: "Reveal hint",
      structure: "Lesson structure",
      controls: "Teacher controls",
      teacherNotes: "Teacher notes",
      recentLessons: "Recent lessons",
    },
    lessonStudio: {
      title: "AI Lesson Studio",
      description: "Enter a topic, class, and teaching preferences to generate slides, tasks, quiz, worksheet, and homework.",
      create: "Create lesson",
      draft: "Lesson draft",
      generatedLessons: "Generated lessons",
      publish: "Publish to board",
    },
    planning: {
      title: "Academic Planning",
      description: "Annual, quarterly, and weekly plans by class and subject with progress tracking.",
      create: "Create plan",
      progress: "Progress",
      checkpoints: "Checkpoints",
      outcomes: "Expected outcomes",
    },
  },
} satisfies Record<AppLocale, Record<string, DictionaryValue>>;

export function resolveLocale(value: string | null | undefined): AppLocale {
  return value === "en" ? "en" : "ru";
}

export function translate(locale: AppLocale, key: string) {
  const parts = key.split(".");
  let current: DictionaryValue | undefined = dictionaries[locale];

  for (const part of parts) {
    if (!current || typeof current === "string") {
      return key;
    }
    current = current[part];
  }

  return typeof current === "string" ? current : key;
}
