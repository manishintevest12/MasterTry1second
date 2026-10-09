import React, { useState, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  X,
  Check,
  Clock,
  Zap,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';

export interface JourneyDatePickerProps {
  isOpen: boolean;
  onClose: () => void;
  // Selected value e.g. '09 Oct, 2026' or '09 Oct – 16 Oct, 2026'
  value?: string;
  onSelectDate: (formattedDate: string, departureDate?: Date, returnDate?: Date) => void;
  title?: string;
  isRange?: boolean; // For return flight or hotel check-in/out
  accentColor?: 'orange' | 'red' | 'blue' | 'emerald' | 'amber';
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const WEEKDAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const JourneyDatePickerModal: React.FC<JourneyDatePickerProps> = ({
  isOpen,
  onClose,
  value,
  onSelectDate,
  title = 'Date of Journey',
  isRange = false,
  accentColor = 'orange',
}) => {
  // Always anchor to current real date (or October 2026 as reference)
  const today = useMemo(() => {
    const now = new Date();
    // Normalize to midnight
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);

  // Calendar view navigation (Year and Month)
  const [viewYear, setViewYear] = useState<number>(today.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(today.getMonth());

  // Selected single date or departure date
  const [selectedDeparture, setSelectedDeparture] = useState<Date>(today);
  // Selected return date (if range mode)
  const [selectedReturn, setSelectedReturn] = useState<Date | null>(() => {
    if (isRange) {
      const ret = new Date(today);
      ret.setDate(ret.getDate() + 3);
      return ret;
    }
    return null;
  });

  const [selectingStep, setSelectingStep] = useState<'departure' | 'return'>('departure');

  // Prevent navigating to past months before current month/year
  const canGoPreviousMonth = useMemo(() => {
    if (viewYear > today.getFullYear()) return true;
    if (viewYear === today.getFullYear()) return viewMonth > today.getMonth();
    return false;
  }, [viewYear, viewMonth, today]);

  const handlePrevMonth = () => {
    if (!canGoPreviousMonth) return;
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((prev) => prev - 1);
    } else {
      setViewMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((prev) => prev + 1);
    } else {
      setViewMonth((prev) => prev + 1);
    }
  };

  // Days calculations for the current viewMonth
  const daysInMonth = useMemo(() => {
    return new Date(viewYear, viewMonth + 1, 0).getDate();
  }, [viewYear, viewMonth]);

  // First day of month (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
  // Convert so Monday = 0, Sunday = 6
  const startDayOffset = useMemo(() => {
    const day = new Date(viewYear, viewMonth, 1).getDay();
    return (day + 6) % 7;
  }, [viewYear, viewMonth]);

  // Check if date is today
  const isDateToday = (d: Date) => {
    return (
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear()
    );
  };

  // Check if date is strictly in the past (before today)
  const isDateInPast = (d: Date) => {
    return d.getTime() < today.getTime();
  };

  // Check if date is selected departure
  const isDepartureDate = (d: Date) => {
    return (
      d.getDate() === selectedDeparture.getDate() &&
      d.getMonth() === selectedDeparture.getMonth() &&
      d.getFullYear() === selectedDeparture.getFullYear()
    );
  };

  // Check if date is selected return
  const isReturnDate = (d: Date) => {
    if (!selectedReturn) return false;
    return (
      d.getDate() === selectedReturn.getDate() &&
      d.getMonth() === selectedReturn.getMonth() &&
      d.getFullYear() === selectedReturn.getFullYear()
    );
  };

  // Check if date falls inside departure-return range
  const isDateInRange = (d: Date) => {
    if (!isRange || !selectedReturn) return false;
    return d.getTime() > selectedDeparture.getTime() && d.getTime() < selectedReturn.getTime();
  };

  const handleDayClick = (dayNum: number) => {
    const clickedDate = new Date(viewYear, viewMonth, dayNum);

    // Reject past dates strictly
    if (isDateInPast(clickedDate)) return;

    if (!isRange) {
      setSelectedDeparture(clickedDate);
      return;
    }

    // Range Mode (Flights Return / Hotels Check-in & Out)
    if (selectingStep === 'departure') {
      setSelectedDeparture(clickedDate);
      // If previous return date is before new departure, push return date forward by 2 days
      if (selectedReturn && selectedReturn.getTime() <= clickedDate.getTime()) {
        const nextDay = new Date(clickedDate);
        nextDay.setDate(nextDay.getDate() + 2);
        setSelectedReturn(nextDay);
      }
      setSelectingStep('return');
    } else {
      // Selecting return date
      if (clickedDate.getTime() <= selectedDeparture.getTime()) {
        // If clicked on or before departure, reset departure to clickedDate
        setSelectedDeparture(clickedDate);
        setSelectingStep('return');
      } else {
        setSelectedReturn(clickedDate);
        setSelectingStep('departure');
      }
    }
  };

  const formatDateLabel = (d: Date, withDayName: boolean = true) => {
    const dayStr = String(d.getDate()).padStart(2, '0');
    const monthShort = MONTH_NAMES[d.getMonth()].slice(0, 3);
    const yearStr = d.getFullYear();
    const dayName = WEEKDAY_NAMES[(d.getDay() + 6) % 7];
    if (withDayName) {
      return `${dayName} ${dayStr} ${monthShort}, ${yearStr}`;
    }
    return `${dayStr} ${monthShort}, ${yearStr}`;
  };

  // Quick Preset Actions
  const handleSelectToday = () => {
    setSelectedDeparture(new Date(today));
    if (isRange) {
      const ret = new Date(today);
      ret.setDate(ret.getDate() + 3);
      setSelectedReturn(ret);
    }
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
  };

  const handleSelectTomorrow = () => {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    setSelectedDeparture(tomorrow);
    if (isRange) {
      const ret = new Date(tomorrow);
      ret.setDate(ret.getDate() + 3);
      setSelectedReturn(ret);
    }
    setViewYear(tomorrow.getFullYear());
    setViewMonth(tomorrow.getMonth());
  };

  const handleSelectWeekend = () => {
    const d = new Date(today);
    // Find next Saturday
    const daysUntilSat = (6 - d.getDay() + 7) % 7 || 7;
    d.setDate(d.getDate() + daysUntilSat);
    setSelectedDeparture(new Date(d));
    if (isRange) {
      const sun = new Date(d);
      sun.setDate(sun.getDate() + 2);
      setSelectedReturn(sun);
    }
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  };

  const handleConfirm = () => {
    if (!isRange) {
      const isTod = isDateToday(selectedDeparture);
      const formatted = `${formatDateLabel(selectedDeparture, false)}${isTod ? ' (Today)' : ''}`;
      onSelectDate(formatted, selectedDeparture);
    } else {
      const ret = selectedReturn || new Date(selectedDeparture.getTime() + 86400000 * 3);
      const nights = Math.max(1, Math.round((ret.getTime() - selectedDeparture.getTime()) / (1000 * 60 * 60 * 24)));
      const formatted = `${formatDateLabel(selectedDeparture, true)} – ${formatDateLabel(ret, true)} (${nights} Night${nights > 1 ? 's' : ''})`;
      onSelectDate(formatted, selectedDeparture, ret);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden text-slate-900 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ================= 1. HEADER (EXACT TO SCREENSHOT) ================= */}
        <div className="p-4 sm:p-5 pb-3 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-900 border border-slate-200 shrink-0">
              <CalendarIcon className="w-5 h-5 text-slate-800" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                {title}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-base sm:text-lg font-black text-slate-900 font-mono tracking-tight">
                  {formatDateLabel(selectedDeparture, false)}
                </span>
                {isDateToday(selectedDeparture) && (
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    (Today)
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ================= 2. QUICK PRESET PILLS ================= */}
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center gap-2 overflow-x-auto text-xs scrollbar-none">
          <button
            type="button"
            onClick={handleSelectToday}
            className="px-3 py-1 rounded-xl font-bold bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 shadow-2xs whitespace-nowrap cursor-pointer flex items-center gap-1"
          >
            <Zap className="w-3 h-3 text-amber-500 fill-amber-500" />
            <span>Today (09 Oct)</span>
          </button>

          <button
            type="button"
            onClick={handleSelectTomorrow}
            className="px-3 py-1 rounded-xl font-bold bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 shadow-2xs whitespace-nowrap cursor-pointer"
          >
            Tomorrow (+1D)
          </button>

          <button
            type="button"
            onClick={handleSelectWeekend}
            className="px-3 py-1 rounded-xl font-bold bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 shadow-2xs whitespace-nowrap cursor-pointer"
          >
            This Weekend
          </button>
        </div>

        {/* Range Step Indicator (If Return/Hotel Range active) */}
        {isRange && (
          <div className="px-4 py-2 bg-blue-50/80 border-b border-blue-100 flex items-center justify-between text-xs">
            <span className="font-semibold text-blue-900">
              {selectingStep === 'departure' ? 'Step 1: Select Departure / Check-in' : 'Step 2: Select Return / Check-out'}
            </span>
            {selectedReturn && (
              <span className="font-mono font-bold text-blue-700 text-[11px]">
                Return: {formatDateLabel(selectedReturn, false)}
              </span>
            )}
          </div>
        )}

        {/* ================= 3. MONTH NAVIGATOR (← October 2026 →) ================= */}
        <div className="p-4 sm:p-5 pb-2">
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={handlePrevMonth}
              disabled={!canGoPreviousMonth}
              className={`p-2 rounded-xl transition-colors ${
                canGoPreviousMonth
                  ? 'hover:bg-slate-100 text-slate-700 cursor-pointer'
                  : 'text-slate-300 cursor-not-allowed pointer-events-none'
              }`}
              title="Previous Month"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <span className="text-base font-black text-slate-900 tracking-tight">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </span>

            <button
              type="button"
              onClick={handleNextMonth}
              className="p-2 rounded-xl hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer"
              title="Next Month"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* ================= 4. WEEKDAYS ROW (Mon Tue Wed Thu Fri Sat Sun) ================= */}
          <div className="grid grid-cols-7 text-center mb-2">
            {WEEKDAY_NAMES.map((wName) => (
              <span
                key={wName}
                className="text-xs font-semibold text-slate-400 uppercase tracking-wider py-1"
              >
                {wName}
              </span>
            ))}
          </div>

          {/* ================= 5. DAYS GRID ================= */}
          <div className="grid grid-cols-7 gap-y-1 text-center">
            {/* Blank offset placeholders */}
            {Array.from({ length: startDayOffset }).map((_, i) => (
              <div key={`blank-${i}`} className="h-10" />
            ))}

            {/* Actual Days 1 to 31 */}
            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const dayNum = idx + 1;
              const dateObj = new Date(viewYear, viewMonth, dayNum);
              const inPast = isDateInPast(dateObj);
              const isToday = isDateToday(dateObj);
              const isDep = isDepartureDate(dateObj);
              const isRet = isReturnDate(dateObj);
              const inRange = isDateInRange(dateObj);

              if (inPast) {
                return (
                  <div
                    key={`day-${dayNum}`}
                    className="h-10 flex items-center justify-center text-slate-300 font-normal cursor-not-allowed select-none text-sm"
                  >
                    {dayNum}
                  </div>
                );
              }

              // Selected styling
              if (isDep || isRet) {
                return (
                  <div key={`day-${dayNum}`} className="h-10 flex items-center justify-center relative">
                    <button
                      type="button"
                      onClick={() => handleDayClick(dayNum)}
                      className={`w-9 h-9 rounded-full font-black text-sm flex items-center justify-center shadow-md transition-transform scale-105 cursor-pointer z-10 ${
                        accentColor === 'orange'
                          ? 'bg-orange-600 text-white'
                          : accentColor === 'red'
                          ? 'bg-red-600 text-white'
                          : accentColor === 'blue'
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-900 text-white'
                      }`}
                    >
                      {dayNum}
                    </button>
                  </div>
                );
              }

              // Today styling when not selected as departure
              if (isToday) {
                return (
                  <div key={`day-${dayNum}`} className="h-10 flex items-center justify-center relative">
                    <button
                      type="button"
                      onClick={() => handleDayClick(dayNum)}
                      className="w-9 h-9 rounded-full bg-slate-900 text-white font-black text-sm flex items-center justify-center shadow-md ring-2 ring-slate-900/10 cursor-pointer"
                    >
                      {dayNum}
                    </button>
                  </div>
                );
              }

              return (
                <div
                  key={`day-${dayNum}`}
                  className={`h-10 flex items-center justify-center relative ${
                    inRange ? 'bg-orange-50 text-orange-950' : ''
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => handleDayClick(dayNum)}
                    className="w-9 h-9 rounded-full text-slate-800 hover:bg-slate-100 font-bold text-sm flex items-center justify-center transition-colors cursor-pointer"
                  >
                    {dayNum}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="pt-3 border-t border-slate-100 mt-4 flex items-center justify-between text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-900 inline-block" />
              <span>Today highlighted</span>
            </span>
            <span className="text-slate-400 font-medium">Past dates locked</span>
          </div>
        </div>

        {/* ================= 6. CONFIRMATION FOOTER ================= */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
          <div className="text-xs">
            <span className="text-[10px] text-slate-400 font-bold uppercase block">Confirmed Choice</span>
            <span className="font-extrabold text-slate-900 font-mono">
              {formatDateLabel(selectedDeparture, false)}
              {isRange && selectedReturn && ` → ${formatDateLabel(selectedReturn, false)}`}
            </span>
          </div>

          <button
            type="button"
            onClick={handleConfirm}
            className={`px-5 py-2.5 rounded-xl font-black text-xs text-white shadow-md transition-all flex items-center gap-1.5 cursor-pointer hover:scale-105 active:scale-95 ${
              accentColor === 'orange'
                ? 'bg-orange-600 hover:bg-orange-500 shadow-orange-500/20'
                : accentColor === 'red'
                ? 'bg-red-600 hover:bg-red-500 shadow-red-500/20'
                : accentColor === 'blue'
                ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-500/20'
                : 'bg-slate-900 hover:bg-slate-800'
            }`}
          >
            <Check className="w-4 h-4" />
            <span>Apply Selected Date</span>
          </button>
        </div>
      </div>
    </div>
  );
};
