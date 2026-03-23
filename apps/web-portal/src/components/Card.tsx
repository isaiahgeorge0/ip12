import { type ReactNode } from "react";

type CardProps = {
  children: ReactNode;
  className?: string;
};

export function Card({ children, className = "" }: CardProps) {
  return (
    <div
      className={`rounded-lg border border-admin-border bg-admin-surface p-4 shadow-sm shadow-black/8 transition-shadow ${className}`}
    >
      {children}
    </div>
  );
}
