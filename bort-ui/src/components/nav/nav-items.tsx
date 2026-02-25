import {
  LayoutDashboard,
  Activity,
  ListTodo,
  Newspaper,
  Sparkles,
  FileText,
} from "lucide-react"

export type NavItem = {
  title: string
  to: string
  icon: React.ComponentType<{ className?: string }>
}

export const NAV_ITEMS: NavItem[] = [
  { title: "Overview", to: "/", icon: LayoutDashboard },
  { title: "Services", to: "/services", icon: Activity },
  { title: "Queue", to: "/queue", icon: ListTodo },
  { title: "Results", to: "/results", icon: Newspaper },
  { title: "Digest", to: "/digest", icon: Sparkles },
  { title: "Logs", to: "/logs", icon: FileText },
]
