import { type ReactNode } from "react";

type CardProps = {
  children: ReactNode;
  className?: string;
};

export function Card({ children, className = "" }: CardProps) {
  return (
    <div
      className={`rounded-lg border border-zinc-200 bg-white p-4 ${className}`}
    >
      {children}
    </div>
  );
}
