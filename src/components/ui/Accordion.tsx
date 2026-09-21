"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type AccordionContextValue = {
  openId: string | null;
  setOpenId: (id: string | null) => void;
};

const AccordionContext = React.createContext<AccordionContextValue | null>(null);

export function Accordion({
  children,
  defaultValue,
  type = "single",
  collapsible = true,
  className,
}: {
  children: React.ReactNode;
  defaultValue?: string;
  type?: "single";
  collapsible?: boolean;
  className?: string;
}) {
  const [openId, setOpenId] = React.useState<string | null>(defaultValue ?? null);

  const handleSet = React.useCallback(
    (id: string | null) => {
      if (id === openId && collapsible) setOpenId(null);
      else setOpenId(id);
    },
    [openId, collapsible]
  );

  // type is single only — matches spec (expand-one-at-a-time)
  void type;

  return (
    <AccordionContext.Provider value={{ openId, setOpenId: handleSet }}>
      <div className={cn("divide-y divide-black/5 rounded-xl border border-black/5 bg-white", className)}>
        {children}
      </div>
    </AccordionContext.Provider>
  );
}

export function AccordionItem({
  value,
  children,
  className,
}: {
  value: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("group", className)} data-value={value}>
      {children}
    </div>
  );
}

export function AccordionTrigger({
  value,
  children,
  className,
}: {
  value: string;
  children: React.ReactNode;
  className?: string;
}) {
  const ctx = React.useContext(AccordionContext);
  if (!ctx) throw new Error("AccordionTrigger must be inside Accordion");
  const isOpen = ctx.openId === value;

  return (
    <button
      type="button"
      aria-expanded={isOpen}
      aria-controls={`accordion-content-${value}`}
      id={`accordion-trigger-${value}`}
      onClick={() => ctx.setOpenId(isOpen ? null : value)}
      className={cn(
        "flex w-full items-center justify-between gap-4 px-6 py-5 text-left font-heading text-h4 text-ink transition-colors hover:bg-gray-100/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-burgundy-600",
        className
      )}
    >
      <span className="pr-2">{children}</span>
      <ChevronDown
        className={cn(
          "h-5 w-5 shrink-0 text-gray-500 transition-transform duration-200",
          isOpen && "rotate-180 text-burgundy-600"
        )}
        aria-hidden="true"
      />
    </button>
  );
}

export function AccordionContent({
  value,
  children,
  className,
}: {
  value: string;
  children: React.ReactNode;
  className?: string;
}) {
  const ctx = React.useContext(AccordionContext);
  if (!ctx) throw new Error("AccordionContent must be inside Accordion");
  const isOpen = ctx.openId === value;

  return (
    <div
      id={`accordion-content-${value}`}
      role="region"
      aria-labelledby={`accordion-trigger-${value}`}
      hidden={!isOpen}
      className={cn(
        "grid transition-all",
        isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        className
      )}
    >
      <div className="overflow-hidden">
        <div className="px-6 pb-5 pt-0 text-body text-gray-500">{children}</div>
      </div>
    </div>
  );
}
