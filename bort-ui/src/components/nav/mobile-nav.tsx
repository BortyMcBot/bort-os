import * as React from "react"
import { NavLink } from "react-router-dom"
import { NAV_ITEMS } from "@/components/nav/nav-items"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

export function MobileNav({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-80 p-0">
        <SheetHeader className="border-b px-4 py-3">
          <SheetTitle>Navigation</SheetTitle>
        </SheetHeader>
        <div className="p-2">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                onClick={() => onOpenChange(false)}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground",
                    "hover:bg-accent/40 hover:text-foreground",
                    isActive && "bg-accent/50 text-foreground",
                  )
                }
              >
                <Icon className="h-4 w-4" />
                {item.title}
              </NavLink>
            )
          })}
        </div>
      </SheetContent>
    </Sheet>
  )
}
