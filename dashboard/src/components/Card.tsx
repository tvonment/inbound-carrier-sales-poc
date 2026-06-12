import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { ReactNode } from "react";

export function Card({
  title,
  icon,
  className = "",
  children,
}: {
  title?: string;
  icon?: IconDefinition;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}>
      {title && (
        <h2 className="mb-2.5 flex items-center gap-2 text-sm font-semibold text-slate-600">
          {icon && <FontAwesomeIcon icon={icon} className="text-slate-400" />}
          {title}
        </h2>
      )}
      {children}
    </section>
  );
}

export function EmptyState({
  icon,
  children,
}: {
  icon: IconDefinition;
  children: ReactNode;
}) {
  return (
    <p className="flex items-center gap-2 text-sm text-slate-500">
      <FontAwesomeIcon icon={icon} className="text-slate-400" />
      {children}
    </p>
  );
}
