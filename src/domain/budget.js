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
 *   kind:'complete'|'started'|'planned'|'noKita', capped:boolean}>,
 *   usedMinutes:number, plannedMinutes:number, overAllowance:boolean, overClosing:boolean}}
 */
export function planWeek(week) {
  const { allowanceMinutes, closeMinutes, days } = week;

  let usedMinutes = 0;
  let remainingCount = 0;
  for (const day of days) {
    if (isComplete(day)) usedMinutes += day.actualEnd - day.actualStart;
    else if (!day.noKita) remainingCount += 1;
  }

  const budget = Math.max(0, allowanceMinutes - usedMinutes);
  const steps = Math.floor(budget / STEP);
  const baseSteps = remainingCount > 0 ? Math.floor(steps / remainingCount) : 0;
  let extraSteps = remainingCount > 0 ? steps % remainingCount : 0;

  let plannedMinutes = 0;
  let overClosing = false;

  const out = days.map((day) => {
    if (day.noKita) {
      return { date: day.date, start: null, end: null, kind: 'noKita', capped: false };
    }
    if (isComplete(day)) {
      if (day.actualEnd > closeMinutes) overClosing = true;
      return { date: day.date, start: day.actualStart, end: day.actualEnd, kind: 'complete', capped: false };
    }
    let share = baseSteps * STEP;
    if (extraSteps > 0) {
      share += STEP;
      extraSteps -= 1;
    }
    const started = isStarted(day);
    const start = started ? day.actualStart : day.plannedStart;
    let end = start + share;
    let capped = false;
    if (end > closeMinutes) {
      end = Math.max(start, closeMinutes);
      capped = true;
      overClosing = true;
    }
    plannedMinutes += end - start;
    return { date: day.date, start, end, kind: started ? 'started' : 'planned', capped };
  });

  return {
    days: out,
    usedMinutes,
    plannedMinutes,
    overAllowance: usedMinutes + plannedMinutes > allowanceMinutes,
    overClosing,
  };
}
