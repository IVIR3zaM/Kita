// Pure string tables and lookup. No DOM, no storage.
export const LANGS = ['de', 'en'];
export const DEFAULT_LANG = 'de';

export const STRINGS = {
  de: {
    appTitle: 'Kita-Stundenplaner',
    language: 'Sprache',
    settingsTitle: 'Einstellungen',
    allowance: 'Wochenkontingent (Minuten)',
    openTime: 'Kita öffnet',
    closeTime: 'Kita schließt',
    normalStart: 'Übliche Bringzeit',
    usedOfAllowance: '{used} von {allowance} h genutzt',
    overLimit: 'Wochenkontingent um {over} überschritten',
    afterClosing: 'Abholung nach Kita-Schluss ({time})',
    dropOffNow: 'Jetzt gebracht',
    pickUpNow: 'Jetzt abgeholt',
    noKita: 'Keine Kita',
    clear: 'Leeren',
    prevWeek: 'Vorige Woche',
    nextWeek: 'Nächste Woche',
    weekLabel: 'KW {week} · {year}',
    legendUnused: 'Nicht genutzt',
    legendNoKita: 'Keine Kita',
    legendActual: 'Tatsächlich',
    legendPlanned: 'Geplant',
    weekdayMon: 'Montag',
    weekdayTue: 'Dienstag',
    weekdayWed: 'Mittwoch',
    weekdayThu: 'Donnerstag',
    weekdayFri: 'Freitag',
  },
  en: {
    appTitle: 'Kita Hours Tracker',
    language: 'Language',
    settingsTitle: 'Settings',
    allowance: 'Weekly allowance (minutes)',
    openTime: 'Kita opens',
    closeTime: 'Kita closes',
    normalStart: 'Usual drop-off time',
    usedOfAllowance: '{used} of {allowance} h used',
    overLimit: 'Weekly allowance exceeded by {over}',
    afterClosing: 'Pick-up after closing time ({time})',
    dropOffNow: 'Drop-off now',
    pickUpNow: 'Pick-up now',
    noKita: 'No Kita',
    clear: 'Clear',
    prevWeek: 'Previous week',
    nextWeek: 'Next week',
    weekLabel: 'Week {week} · {year}',
    legendUnused: 'Unused',
    legendNoKita: 'No Kita',
    legendActual: 'Actual',
    legendPlanned: 'Planned',
    weekdayMon: 'Monday',
    weekdayTue: 'Tuesday',
    weekdayWed: 'Wednesday',
    weekdayThu: 'Thursday',
    weekdayFri: 'Friday',
  },
};

export function t(lang, key, params = {}) {
  const table = STRINGS[lang] || STRINGS[DEFAULT_LANG];
  const template = key in table ? table[key] : STRINGS[DEFAULT_LANG][key];
  if (template === undefined) return key;
  return template.replace(/\{(\w+)\}/g, (m, name) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : m);
}
