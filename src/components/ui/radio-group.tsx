"use client";

import * as React from "react";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";

import { cn } from "@/lib/utils";

function RadioGroup({ className, ...props }: React.ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return (
    <RadioGroupPrimitive.Root
      data-slot="radio-group"
      className={cn("flex flex-wrap gap-1.5", className)}
      {...props}
    />
  );
}

/** A radio item rendered as a pill/chip rather than the default dot —
 * used for the translation-engine selector. */
function RadioGroupPillItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Item>) {
  return (
    <RadioGroupPrimitive.Item
      data-slot="radio-group-pill-item"
      className={cn(
        "inline-flex items-center rounded-full border border-input bg-secondary px-3.5 py-1.5 text-xs font-semibold text-muted-foreground whitespace-nowrap transition-colors cursor-pointer",
        "hover:border-primary hover:text-foreground",
        "data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=checked]:border-primary",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
      {...props}
    >
      {children}
    </RadioGroupPrimitive.Item>
  );
}

export { RadioGroup, RadioGroupPillItem };
