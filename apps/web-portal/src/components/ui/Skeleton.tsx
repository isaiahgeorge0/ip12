type SkeletonProps = {
  className?: string;
};

export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      className={[
        "animate-pulse rounded-md bg-admin-surface-muted/80",
        className,
      ].join(" ")}
    />
  );
}

