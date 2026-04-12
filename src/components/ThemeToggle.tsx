import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "./ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

export const ThemeToggle = () => {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const isDark = resolvedTheme === "dark";
  const toggle = () => setTheme(isDark ? "light" : "dark");

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={toggle}
          aria-label={isDark ? "Mudar para tema claro" : "Mudar para tema escuro"}
          className="h-9 w-9 p-0 text-muted-foreground hover:text-foreground"
        >
          {mounted ? (
            isDark
              ? <Sun  className="h-[18px] w-[18px]" />
              : <Moon className="h-[18px] w-[18px]" />
          ) : (
            <Moon className="h-[18px] w-[18px]" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {mounted ? (isDark ? "Tema claro" : "Tema escuro") : "Tema"}
      </TooltipContent>
    </Tooltip>
  );
};
