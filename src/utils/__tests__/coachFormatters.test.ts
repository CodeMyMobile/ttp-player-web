import { describe, expect, it } from 'vitest';
import {
  AVAILABILITY_FALLBACK,
  formatCoachAvailability,
  formatCoachLocations,
} from '../coachFormatters';

describe('formatCoachAvailability', () => {
  it('returns fallback when no availability is provided', () => {
    expect(formatCoachAvailability(undefined)).toBe(AVAILABILITY_FALLBACK);
  });

  it('returns normalized string for textual summaries', () => {
    expect(formatCoachAvailability('Weekdays 7-10 AM')).toBe('Weekdays 7-10 AM');
  });

  it('groups slots sharing the same hours', () => {
    const input = [
      { day: 'Monday', start: '07:00', end: '10:00' },
      { day: 'Tuesday', start: '07:00', end: '10:00' },
      { day: 'Wednesday', start: '07:00', end: '10:00' },
      { day: 'Saturday', start: '09:00', end: '13:00' },
    ];

    const result = formatCoachAvailability(input);

    expect(result).toContain('Mon–Wed');
    expect(result).toContain('7am–10am');
    expect(result).toContain('Sat');
    expect(result).toContain('9am–1pm');
  });
});

describe('formatCoachLocations', () => {
  it('formats name and city/state combinations', () => {
    const result = formatCoachLocations([
      { name: 'Bay Club San Mateo', city: 'San Mateo', state: 'CA', postalCode: '94403' },
      { venue: 'South SF Tennis Center', address: { city: 'South San Francisco', stateCode: 'CA', postalCode: '94080' } },
      'Cupertino Courts — Cupertino, CA 95014',
    ]);

    expect(result.visible[0]).toBe('Bay Club San Mateo — San Mateo, CA');
    expect(result.all[0]).not.toMatch(/\d{5}/);
    expect(result.all[1]).toBe('South SF Tennis Center — South San Francisco, CA');
    expect(result.all[2]).toBe('Cupertino Courts — Cupertino, CA');
  });

  it('calculates hidden count based on visibility limit', () => {
    const result = formatCoachLocations(
      [
        { name: 'Venue A', city: 'San Jose', state: 'CA' },
        { name: 'Venue B', city: 'Oakland', state: 'CA' },
        { name: 'Venue C', city: 'Berkeley', state: 'CA' },
      ],
      2,
    );

    expect(result.visible).toHaveLength(2);
    expect(result.hiddenCount).toBe(1);
  });
});
