import type { Shift, StaffMember } from '../types/hr.types';
import { toCsv } from './download';

export function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00`);
  return !Number.isNaN(date.getTime()) && dateKey(date) === value;
}

export function addDays(value: string, days: number): string {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + days);
  return dateKey(date);
}

/** Monday of the week containing `value`. */
export function weekStart(value: string): string {
  const day = new Date(`${value}T12:00:00`).getDay();
  return addDays(value, -(day === 0 ? 6 : day - 1));
}

export function dateLabel(value: string): string {
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function weekdayLabel(value: string): string {
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short' });
}

function minutes(value: string): number {
  const [hours, mins] = value.split(':').map(Number);
  return hours * 60 + mins;
}

/** Planned minutes excluding the unpaid break. */
export function shiftMinutes(
  shift: Pick<Shift, 'start' | 'end' | 'overnight' | 'breakMinutes'>
): number {
  return (
    minutes(shift.end) - minutes(shift.start) + (shift.overnight ? 1440 : 0) - shift.breakMinutes
  );
}

/**
 * Instant feedback before saving. The server repeats these checks and also
 * rejects overlapping shifts for the same staff member.
 */
export function shiftFormError(shift: Omit<Shift, 'id'>, today: string): string | null {
  if (!shift.staffId) return 'Choose a staff member.';
  if (!validDate(shift.date)) return 'Choose a valid shift date.';
  const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (!timePattern.test(shift.start) || !timePattern.test(shift.end))
    return 'Enter valid start and end times.';
  const duration = minutes(shift.end) - minutes(shift.start) + (shift.overnight ? 1440 : 0);
  if (duration <= 0 || duration > 1440)
    return 'Shift duration must be more than zero and no longer than 24 hours. Check Ends next day.';
  if (
    !Number.isInteger(shift.breakMinutes) ||
    shift.breakMinutes < 0 ||
    shift.breakMinutes >= duration
  )
    return 'Break must be a whole number shorter than the shift duration.';
  if (shift.notes.length > 500) return 'Notes must be 500 characters or fewer.';
  if (shift.date > today && ['present', 'late', 'absent'].includes(shift.status))
    return 'Attendance cannot be recorded for a future date.';
  return null;
}

export function rosterCSV(shifts: Shift[], staff: StaffMember[]): string {
  const byId = new Map(staff.map((member) => [member.id, member]));
  return toCsv([
    [
      'Date',
      'Staff',
      'Role',
      'Start',
      'End',
      'Ends next day',
      'Break (min)',
      'Planned hours',
      'Attendance',
      'Notes',
    ],
    ...shifts.map((shift) => {
      const person = byId.get(shift.staffId);
      return [
        shift.date,
        person?.name ?? '',
        person?.role ?? '',
        shift.start,
        shift.end,
        shift.overnight ? 'Yes' : 'No',
        shift.breakMinutes,
        (shiftMinutes(shift) / 60).toFixed(2),
        shift.status,
        shift.notes,
      ];
    }),
  ]);
}
