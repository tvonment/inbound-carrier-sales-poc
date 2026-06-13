import { faCheck, faChevronDown } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import CH from "country-flag-icons/react/3x2/CH";
import DE from "country-flag-icons/react/3x2/DE";
import US from "country-flag-icons/react/3x2/US";
import { useEffect, useRef, useState, type ComponentType } from "react";
import { useTranslation } from "react-i18next";
import { SUPPORTED_LANGS, type Lang } from "../i18n";

// country-flag-icons types its props with a non-standard element type, so we
// annotate with just the props we pass to keep the map strongly typed.
type FlagComponent = ComponentType<{ className?: string; title?: string }>;

// Self-referential names (shown in their own language, per convention) and the
// flag we map each UI language to: English→US, German→DE, Swiss German→CH.
const LANGS: Record<Lang, { flag: FlagComponent; name: string }> = {
  en: { flag: US, name: "English" },
  de: { flag: DE, name: "Deutsch" },
  gsw: { flag: CH, name: "Schwiizerdütsch" },
};

const FLAG = "shrink-0 rounded-[2px] ring-1 ring-black/10 dark:ring-white/15";

export function LanguageMenu() {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const active = ((i18n.resolvedLanguage ?? i18n.language ?? "en").split("-")[0] as Lang) || "en";
  const ActiveFlag = (LANGS[active] ?? LANGS.en).flag;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const choose = (code: Lang) => {
    i18n.changeLanguage(code);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("controls.language")}
        title={t("controls.language")}
        className="flex h-[26px] items-center gap-1.5 rounded-lg border border-slate-200 px-2 text-slate-500 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-700"
      >
        <ActiveFlag className={`h-3 w-[18px] ${FLAG}`} />
        <FontAwesomeIcon
          icon={faChevronDown}
          className={`text-[9px] transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-10 mt-1.5 min-w-[180px] overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-800"
        >
          {SUPPORTED_LANGS.map((code) => {
            const { flag: Flag, name } = LANGS[code];
            const isActive = code === active;
            return (
              <button
                key={code}
                type="button"
                role="menuitemradio"
                aria-checked={isActive}
                onClick={() => choose(code)}
                className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm transition-colors hover:bg-slate-100 dark:hover:bg-slate-700 ${
                  isActive
                    ? "font-semibold text-slate-900 dark:text-slate-100"
                    : "text-slate-600 dark:text-slate-300"
                }`}
              >
                <Flag className={`h-3.5 w-[21px] ${FLAG}`} />
                <span className="flex-1">{name}</span>
                {isActive && (
                  <FontAwesomeIcon icon={faCheck} className="text-xs text-blue-600 dark:text-blue-400" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
