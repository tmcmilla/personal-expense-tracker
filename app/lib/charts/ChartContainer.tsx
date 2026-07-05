export function ChartContainer({
  children,
  "aria-label": ariaLabel,
}: {
  children: React.ReactNode;
  "aria-label": string;
}) {
  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className="relative h-64 w-full sm:h-72 lg:h-80"
    >
      {children}
    </div>
  );
}
