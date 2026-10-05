// Pure weekly budget recalculation (D4-D7). No Date, no DOM, never mutates input.

const STEP = 5;

function isComplete(day) {
  return !day.noKita && day.actualStart != null && day.actualEnd != null;
}

function isStarted(day) {
  return !day.noKita && day.actualStart != null && day.actualEnd == null;
}

/**
 * @param {{allowanceMinutes:number, openMinutes:number, closeMinutes:number,
 *   days: Array<{date:string, plannedStart:number, actualStart:number|null,
 *   actualEnd:number|null, noKita:boolean}>}} week
 * @returns {{days: Array<{date:string, start:number|null, end:number|null,
 *   kind:'complete'|'started'|'planned'|'noKita'}>,
 *   usedMinutes:number, plannedMinutes:number, unusedMinutes:number, overAllowance:boolean}}
 */
export function planWeek(week) {
  const { allowanceMinutes, closeMinutes, days } = week;

  let usedMinutes = 0;
  for (const day of days) {
    if (isComplete(day)) usedMinutes += day.actualEnd - day.actualStart;
  }

  // Remaining days get the budget in 5-minute steps, one step each in turn from the earliest day,
  // until each is full up to closing time; what does not fit on one day moves to the others.
  const starts = days.map((day) => (isStarted(day) ? day.actualStart : day.plannedStart));
  const remaining = days.flatMap((day, i) => (day.noKita || isComplete(day) ? [] : [i]));
  const room = days.map((day, i) => Math.max(0, Math.floor((closeMinutes - starts[i]) / STEP)));
  const steps = days.map(() => 0);
  let stepsLeft = Math.floor(Math.max(0, allowanceMinutes - usedMinutes) / STEP);
  let open = remaining.filter((i) => room[i] > 0);
  while (stepsLeft > 0 && open.length > 0) {
    for (const i of open) {
      if (stepsLeft === 0) break;
      steps[i] += 1;
      stepsLeft -= 1;
    }
    open = open.filter((i) => steps[i] < room[i]);
  }
  let plannedMinutes = 0;

  const out = days.map((day, i) => {
    if (day.noKita) {
      return { date: day.date, start: null, end: null, kind: 'noKita' };
    }
    if (isComplete(day)) {
      return { date: day.date, start: day.actualStart, end: day.actualEnd, kind: 'complete' };
    }
    const start = starts[i];
    const end = start + steps[i] * STEP;
    plannedMinutes += end - start;
    return { date: day.date, start, end, kind: isStarted(day) ? 'started' : 'planned' };
  });

  return {
    days: out,
    usedMinutes,
    plannedMinutes,
    unusedMinutes: Math.max(0, allowanceMinutes - usedMinutes - plannedMinutes),
    overAllowance: usedMinutes + plannedMinutes > allowanceMinutes,
  };
}
