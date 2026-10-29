"use client";

// The site's motion pieces, built on the libraries.dev packages (MIT):
// border-beam for glowing edges, thinking-orbs for loading, liquid-gooey for switches.

import { BorderBeam } from "border-beam";
import { Liquid } from "liquid-gooey";
import { useTheme } from "next-themes";
import { ThinkingOrb } from "thinking-orbs";
import { useLayoutEffect, useRef, useState, useSyncExternalStore, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const noop = () => () => {};

/** False on the server and during hydration, true once running in the browser. */
function useMounted() {
  return useSyncExternalStore(noop, () => true, () => false);
}

/**
 * The beam's palette follows the site theme (it defaults to dark-only). The theme is only
 * known in the browser, so the beam joins after hydration; until then the child shows plain.
 */
export function Beam({ children, ...props }: Omit<ComponentProps<typeof BorderBeam>, "theme"> & { children: ReactNode }) {
  const { resolvedTheme } = useTheme();
  if (!useMounted()) return <>{children}</>;
  return (
    <BorderBeam theme={resolvedTheme === "light" ? "light" : "dark"} {...props}>
      {children}
    </BorderBeam>
  );
}

/** A small dotted orb for "working on it" moments. Static under reduced motion. */
export function Orb({ label, size = 20, state = "searching" }: { label: string; size?: 20 | 64; state?: ComponentProps<typeof ThinkingOrb>["state"] }) {
  return <ThinkingOrb state={state} size={size} aria-label={label} />;
}

type Rect = { left: number; top: number; width: number; height: number };

/**
 * A pill switch whose selection is a liquid drop that slides between options.
 * Buttons stay real buttons (aria-pressed); the liquid is decoration behind them.
 */
export function LiquidSwitch<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: {
  label: string;
  options: { value: T; label: ReactNode }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  const buttons = useRef(new Map<T, HTMLButtonElement>());
  const [rect, setRect] = useState<Rect | null>(null);

  useLayoutEffect(() => {
    const measure = () => {
      const el = buttons.current.get(value);
      if (el) setRect({ left: el.offsetLeft, top: el.offsetTop, width: el.offsetWidth, height: el.offsetHeight });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [value]);

  return (
    <div role="group" aria-label={label} className={cn("relative inline-flex w-fit max-w-full flex-wrap gap-0.5 rounded-full bg-muted p-1", className)}>
      {rect && (
        // Liquid sets its own position: relative, so a separate layer pins it behind the buttons.
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <Liquid
          className="size-full"
          fill="var(--pill)"
          shadow="0 1px 2px rgba(0,0,0,.18), inset 0 0 0 1px rgba(127,127,127,.18)"
          blur={6}
          contrast={18}
        >
          <Liquid.Item effect="move" move={{ springiness: 0.55, trail: 0.5 }}>
            <div
              className="absolute top-0 left-0 rounded-full transition-[transform,width,height] duration-300 ease-out motion-reduce:transition-none"
              style={{ width: rect.width, height: rect.height, transform: `translate(${rect.left}px, ${rect.top}px)` }}
            />
          </Liquid.Item>
        </Liquid>
        </div>
      )}
      {options.map((option) => (
        <button
          key={option.value}
          ref={(el) => {
            if (el) buttons.current.set(option.value, el);
            else buttons.current.delete(option.value);
          }}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "relative z-10 min-h-11 rounded-full px-3.5 text-sm font-medium text-muted-foreground transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:min-h-9",
            value === option.value && "text-foreground",
            // Before the first measurement (server render), mark the choice plainly.
            value === option.value && !rect && "bg-[var(--pill)] shadow-sm",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
