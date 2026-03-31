import type { ComponentType } from "react";
import {
  BellRing,
  BookCheck,
  Bot,
  CalendarDays,
  ChartColumnBig,
  ClipboardList,
  GraduationCap,
  LayoutDashboard,
  MessageSquareText,
  NotebookPen,
  School,
  Settings,
  Shield,
  Users,
} from "lucide-react";
import { Role } from "@prisma/client";

export type NavItem = {
  href: string;
  labelKey: string;
  icon: ComponentType<{ className?: string }>;
  roles: Role[];
  group: "main" | "admin" | "system";
};

export const navigationItems: NavItem[] = [
  { href: "/dashboard", labelKey: "nav.dashboard", icon: LayoutDashboard, roles: [Role.ADMIN, Role.TEACHER, Role.PARENT, Role.STUDENT], group: "main" },
  { href: "/schedule", labelKey: "nav.schedule", icon: CalendarDays, roles: [Role.ADMIN, Role.TEACHER, Role.PARENT, Role.STUDENT], group: "main" },
  { href: "/board", labelKey: "nav.board", icon: School, roles: [Role.ADMIN, Role.TEACHER], group: "main" },
  { href: "/lesson-studio", labelKey: "nav.lessonStudio", icon: Bot, roles: [Role.ADMIN, Role.TEACHER], group: "main" },
  { href: "/planning", labelKey: "nav.planning", icon: ClipboardList, roles: [Role.ADMIN, Role.TEACHER], group: "main" },
  { href: "/homework", labelKey: "nav.homework", icon: NotebookPen, roles: [Role.ADMIN, Role.TEACHER, Role.PARENT, Role.STUDENT], group: "main" },
  { href: "/grades", labelKey: "nav.grades", icon: GraduationCap, roles: [Role.ADMIN, Role.TEACHER, Role.PARENT, Role.STUDENT], group: "main" },
  { href: "/attendance", labelKey: "nav.attendance", icon: BookCheck, roles: [Role.ADMIN, Role.TEACHER, Role.PARENT, Role.STUDENT], group: "main" },
  { href: "/messages", labelKey: "nav.messages", icon: MessageSquareText, roles: [Role.ADMIN, Role.TEACHER, Role.PARENT, Role.STUDENT], group: "main" },
  { href: "/calendar", labelKey: "nav.calendar", icon: CalendarDays, roles: [Role.ADMIN, Role.TEACHER, Role.PARENT, Role.STUDENT], group: "main" },
  { href: "/announcements", labelKey: "nav.announcements", icon: BellRing, roles: [Role.ADMIN, Role.TEACHER, Role.PARENT, Role.STUDENT], group: "main" },
  { href: "/ai", labelKey: "nav.ai", icon: Bot, roles: [Role.ADMIN, Role.TEACHER, Role.PARENT, Role.STUDENT], group: "main" },
  { href: "/reports", labelKey: "nav.reports", icon: ClipboardList, roles: [Role.ADMIN, Role.TEACHER, Role.PARENT, Role.STUDENT], group: "main" },
  { href: "/users", labelKey: "nav.users", icon: Users, roles: [Role.ADMIN], group: "admin" },
  { href: "/students", labelKey: "nav.students", icon: School, roles: [Role.ADMIN], group: "admin" },
  { href: "/parents", labelKey: "nav.parents", icon: Users, roles: [Role.ADMIN], group: "admin" },
  { href: "/teachers", labelKey: "nav.teachers", icon: Users, roles: [Role.ADMIN], group: "admin" },
  { href: "/classes", labelKey: "nav.classes", icon: School, roles: [Role.ADMIN], group: "admin" },
  { href: "/subjects", labelKey: "nav.subjects", icon: GraduationCap, roles: [Role.ADMIN], group: "admin" },
  { href: "/timetable", labelKey: "nav.timetable", icon: CalendarDays, roles: [Role.ADMIN], group: "admin" },
  { href: "/analytics", labelKey: "nav.analytics", icon: ChartColumnBig, roles: [Role.ADMIN], group: "admin" },
  { href: "/settings", labelKey: "nav.settings", icon: Settings, roles: [Role.ADMIN, Role.TEACHER, Role.PARENT, Role.STUDENT], group: "system" },
  { href: "/system-settings", labelKey: "nav.systemSettings", icon: Shield, roles: [Role.ADMIN], group: "system" },
];
