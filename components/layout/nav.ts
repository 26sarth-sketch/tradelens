import {
  BarChart3,
  BookOpen,
  Bot,
  CalendarDays,
  GraduationCap,
  LayoutDashboard,
  type LucideIcon,
  NotebookPen,
  Settings,
  Table2,
  Target,
  TrendingUp,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/journal", label: "Daily Journal", icon: CalendarDays },
  { href: "/trades", label: "Trade Log", icon: Table2 },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/strategies", label: "Strategies", icon: Target },
  { href: "/notebook", label: "Notebook", icon: NotebookPen },
  { href: "/coach", label: "AI Coach", icon: Bot },
  { href: "/progress", label: "Progress", icon: TrendingUp },
  { href: "/settings", label: "Settings", icon: Settings },
];

export const SECONDARY_NAV: NavItem[] = [
  { href: "/learn", label: "Learn", icon: GraduationCap },
  { href: "/", label: "About", icon: BookOpen },
];
