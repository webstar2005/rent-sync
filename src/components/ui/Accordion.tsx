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
  headingLevel,
}: {
  value: string;
  children: React.ReactNode;
  className?: string;
  /**
   * Wraps the trigger in a heading. An accordion trigger that is only a <button> is invisible to a
   * document outline, and Google requires a FAQ question to be a heading for FAQPage markup to be
   * valid. Defaults to 3; the standalone /faqs page passes 2 because it has no section h2 of its own.
   */
  headingLevel?: 2 | 3;
}) {
  const ctx = React.useContext(AccordionContext);
  if (!ctx) throw new Error("AccordionTrigger must be inside Accordion");
  const isOpen = ctx.openId === value;

  const button = (
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

  const Heading = `h${headingLevel ?? 3}` as "h2" | "h3";
  return (
    <Heading className="m-0">
      {button}
    </Heading>
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
      // Keeping the answer in the HTML is what we want for crawlers, but a collapsed panel is still
      // in the accessibility tree and its links are still tabbable, so a keyboard user would tab
      // into something they cannot see. `inert` takes it back out of the tab order and the a11y tree
      // without removing it from the document, which is the part crawlers and no-JS readers need.
      inert={!isOpen}
      // No `hidden` attribute while collapsed. It used to be here, and it meant a closed answer was
      // absent from the served HTML: a crawler that never expanded the accordion saw six questions
      // and no answers, and FAQPage markup describing that text would have been invalid. The grid
      // rows below collapse the panel to zero height, so the answer stays in the document while
      // looking closed.
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
