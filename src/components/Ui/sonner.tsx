"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner, ToasterProps } from "sonner";
import * as React from "react";

const Toaster: React.FC<ToasterProps> = (props) => {
  const { theme = "system" } = useTheme();
  const validTheme = ["dark", "light", "system"] as const;
  const fallbackTheme: "dark" | "light" | "system" = validTheme.includes(theme as any)
  ? (theme as "dark" | "light" | "system")
  : "system";
  return (
    <Sonner
      theme={fallbackTheme}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
