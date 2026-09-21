"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type TabsContextValue = {
  active: string;
  setActive: (v: string) => void;
};

const TabsContext = React.createContext<TabsContextValue | null>(null);

export function Tabs({
  defaultValue,
  value,
  onValueChange,
  children,
  className,
}: {
  defaultValue?: string;
  value?: string;
  onValueChange?: (v: string) => void;
  children: React.ReactNode;
  className?: string;
}) {
  const [internal, setInternal] = React.useState(defaultValue ?? "");
  const active = value ?? internal;
  const setActive = React.useCallback(
    (v: string) => {
      if (value === undefined) setInternal(v);
      onValueChange?.(v);
    },
    [value, onValueChange]
  );

  return (
    <TabsContext.Provider value={{ active, setActive }}>
      <div className={cn("w-full", className)}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabsList({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft" && e.key !== "Home" && e.key !== "End") return;
    const tabs = Array.from(
      e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')
    );
    const active = tabs.findIndex((t) => t.getAttribute("aria-selected") === "true");
    if (active === -1) return;
    e.preventDefault();
    let next = active;
    if (e.key === "ArrowRight") next = (active + 1) % tabs.length;
    if (e.key === "ArrowLeft") next = (active - 1 + tabs.length) % tabs.length;
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = tabs.length - 1;
    tabs[next]?.focus();
    tabs[next]?.click();
  };

  return (
    <div
      role="tablist"
      onKeyDown={onKeyDown}
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-gray-100 p-1",
        className
      )}
      {...props}
    />
  );
}

export function TabsTrigger({
  value,
  children,
  className,
}: {
  value: string;
  children: React.ReactNode;
  className?: string;
}) {
  const ctx = React.useContext(TabsContext);
  if (!ctx) throw new Error("TabsTrigger must be inside Tabs");
  const isActive = ctx.active === value;

  return (
    <button
      role="tab"
      aria-selected={isActive}
      tabIndex={isActive ? 0 : -1}
      onClick={() => ctx.setActive(value)}
      onKeyDown={(e) => {
        // Basic keyboard nav — arrow keys handled by Tabs container if needed
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          ctx.setActive(value);
        }
      }}
      className={cn(
        "rounded-full px-5 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-burgundy-600 focus-visible:ring-offset-2",
        isActive ? "bg-ink text-white shadow-sm" : "text-gray-500 hover:text-ink",
        className
      )}
    >
      {children}
    </button>
  );
}

export function TabsContent({
  value,
  children,
  className,
}: {
  value: string;
  children: React.ReactNode;
  className?: string;
}) {
  const ctx = React.useContext(TabsContext);
  if (!ctx) throw new Error("TabsContent must be inside Tabs");
  if (ctx.active !== value) return null;
  return (
    <div
      role="tabpanel"
      tabIndex={0}
      className={cn("mt-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-burgundy-600 rounded-xl", className)}
    >
      {children}
    </div>
  );
}
