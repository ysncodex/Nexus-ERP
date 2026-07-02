import { useMemo, useCallback, useState } from 'react';
import { Wallet, ChevronLeft, ChevronRight } from 'lucide-react';
import { ComingSoon } from '@/shared/components/ui/ComingSoon';

interface SelectedMonth {
  year: number;
  month: number;
}

function MonthNavigator({
  label,
  onPrev,
  onNext,
  disableNext,
}: {
  label: string;
  onPrev: () => void;
  onNext: () => void;
  disableNext: boolean;
}) {
  return (
    <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl px-2 py-1.5 shadow-sm">
      <button
        type="button"
        onClick={onPrev}
        aria-label="Previous month"
        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
      >
        <ChevronLeft size={15} />
      </button>
      <span className="text-sm font-bold text-slate-700 min-w-[130px] text-center select-none px-1">
        {label}
      </span>
      <button
        type="button"
        onClick={onNext}
        disabled={disableNext}
        aria-label="Next month"
        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <ChevronRight size={15} />
      </button>
    </div>
  );
}

export default function FundManagement() {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState<SelectedMonth>({
    year: now.getFullYear(),
    month: now.getMonth(),
  });

  const isCurrentMonth =
    selectedMonth.year === now.getFullYear() && selectedMonth.month === now.getMonth();

  const monthLabel = useMemo(
    () =>
      new Date(selectedMonth.year, selectedMonth.month, 1).toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      }),
    [selectedMonth]
  );

  const goToPrevMonth = useCallback(
    () =>
      setSelectedMonth((prev) =>
        prev.month === 0
          ? { year: prev.year - 1, month: 11 }
          : { year: prev.year, month: prev.month - 1 }
      ),
    [setSelectedMonth]
  );

  const goToNextMonth = useCallback(
    () =>
      setSelectedMonth((prev) =>
        prev.month === 11
          ? { year: prev.year + 1, month: 0 }
          : { year: prev.year, month: prev.month + 1 }
      ),
    [setSelectedMonth]
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <MonthNavigator
          label={monthLabel}
          onPrev={goToPrevMonth}
          onNext={goToNextMonth}
          disableNext={isCurrentMonth}
        />
      </div>
      <ComingSoon
        icon={Wallet}
        title="Fund Management"
        description={`Track reserve fund transfers, owner investments, and liquidity movements for ${monthLabel} in one place.`}
        accentColor="indigo"
      />
    </div>
  );
}
