import { faDesktop, faMoon, faSun } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useTranslation } from "react-i18next";
import { type Theme, useTheme } from "../theme/ThemeProvider";
import { LanguageMenu } from "./LanguageMenu";

const THEME_ICON: Record<Theme, typeof faDesktop> = {
  system: faDesktop,
  light: faSun,
  dark: faMoon,
};
const THEME_ORDER: Theme[] = ["system", "light", "dark"];

export function HeaderControls() {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
  const cycleTheme = () =>
    setTheme(THEME_ORDER[(THEME_ORDER.indexOf(theme) + 1) % THEME_ORDER.length]);

  return (
    <div className="flex items-center gap-2">
      <LanguageMenu />
      <button
        type="button"
        onClick={cycleTheme}
        title={`${t("controls.theme.label")}: ${t(`controls.theme.${theme}`)}`}
        aria-label={`${t("controls.theme.label")}: ${t(`controls.theme.${theme}`)}`}
        className="flex size-[26px] items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-700"
      >
        <FontAwesomeIcon icon={THEME_ICON[theme]} className="text-xs" />
      </button>
    </div>
  );
}
