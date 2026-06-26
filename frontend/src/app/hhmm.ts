import { ValidatorFn } from '@angular/forms';

export function parseHhmm(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = value.match(/^(\d+):([0-5]\d)$/);
  return match ? parseInt(match[1]) * 60 + parseInt(match[2]) : null;
}

export function formatHhmm(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function hhmmFormatValidator(): ValidatorFn {
  return (control) => {
    if (!control.value) return null;
    return /^\d+:[0-5]\d$/.test(control.value) ? null : { hhmm: true };
  };
}

export function hhmmMinValidator(minExclusive: number): ValidatorFn {
  return (control) => {
    const minutes = parseHhmm(control.value);
    if (minutes === null) return null;
    return minutes > minExclusive ? null : { min: true };
  };
}

export function hhmmMaxValidator(max: number): ValidatorFn {
  return (control) => {
    const minutes = parseHhmm(control.value);
    if (minutes === null) return null;
    return minutes <= max ? null : { max: true };
  };
}
