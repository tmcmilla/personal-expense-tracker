"use client";

import { useRouter } from "next/navigation";
import { Select, SelectItem } from "@heroui/react";

type PeriodSelectProps = {
  year: number;
  month: number;
};

const MONTH_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function recentMonthOptions(): { value: string; label: string }[] {
  const now = new Date();
  const options = [];
  for (let i = 0; i < 12; i++) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    options.push({
      value: monthKey(date.getUTCFullYear(), date.getUTCMonth() + 1),
      label: MONTH_FORMATTER.format(date),
    });
  }
  return options;
}

export default function PeriodSelect({ year, month }: PeriodSelectProps) {
  const router = useRouter();
  const options = recentMonthOptions();
  const selectedValue = monthKey(year, month);

  return (
    <Select
      aria-label="Select month"
      className="w-full sm:w-48"
      selectedKeys={[selectedValue]}
      disallowEmptySelection
      onSelectionChange={(keys) => {
        const [key] = Array.from(keys as Set<string>);
        if (key) router.push(`/?period=${key}`);
      }}
    >
      {options.map((option) => (
        <SelectItem key={option.value}>{option.label}</SelectItem>
      ))}
    </Select>
  );
}
