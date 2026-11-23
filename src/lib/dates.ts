// All user-facing calendar dates follow the club's Malaysia time zone.
function dateLabels(locale: string) {
  const formatter = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(locale, {
      timeZone: 'Asia/Kuala_Lumpur',
      ...options,
    });
  const day = {
    weekday: 'long',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  } as const;
  const time = { hour: 'numeric', minute: '2-digit', hour12: true } as const;
  const stamp = formatter({ ...day, ...time });
  const date = formatter(day);
  const clock = formatter(time);
  return {
    dueLabel: (value: string) => stamp.format(new Date(value)) + ' MYT',
    dayLabel: (value: string | number) => date.format(new Date(value)),
    timeLabel: (value: string) => clock.format(new Date(value)),
  };
}
export const clubDates = { en: dateLabels('en-MY'), zh: dateLabels('zh-CN') };
