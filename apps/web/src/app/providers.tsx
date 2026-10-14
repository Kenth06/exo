import { Toasty, TooltipProvider } from "@cloudflare/kumo";
import type { ReactNode } from "react";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";

export const Providers = ({ children }: { children: ReactNode }) => (
  <ThemeProvider>
    <TooltipProvider>
      <Toasty>
        <AuthProvider>{children}</AuthProvider>
      </Toasty>
    </TooltipProvider>
  </ThemeProvider>
);
