import { clubDates } from '../src/lib/dates';

test('chat and assignment dates cross into Saturday at Malaysia midnight in both languages', () => {
  const before = '2026-11-20T15:59:59Z';
  const after = '2026-11-20T16:00:00Z';
  expect(clubDates.en.dayLabel(before)).toContain('Friday');
  expect(clubDates.en.dueLabel(after)).toContain('Saturday');
  expect(clubDates.zh.dayLabel(before)).toContain('星期五');
  expect(clubDates.zh.dueLabel(after)).toContain('星期六');
  expect(clubDates.en.timeLabel(before)).toMatch(/11:59/);
});
