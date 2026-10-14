import { Tabs } from "@cloudflare/kumo";
import { type ThemePreference, useTheme } from "@/contexts/ThemeContext";

export const ThemeSwitcher = () => {
  const { preference, setPreference } = useTheme();
  return (
    <Tabs
      size="sm"
      value={preference}
      onValueChange={(v) => setPreference(v as ThemePreference)}
      tabs={[
        { value: "light", label: "Light" },
        { value: "dark", label: "Dark" },
        { value: "system", label: "System" },
      ]}
    />
  );
};
