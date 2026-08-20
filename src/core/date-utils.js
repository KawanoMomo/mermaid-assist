'use strict';
window.MA = window.MA || {};
window.MA.dateUtils = (function() {
  // Only `YYYY-MM-DD` that names a day that actually exists.
  //
  // `new Date(x)` is far too forgiving for this codebase: `new Date(null)` is the
  // epoch, so addDays(null, 3) used to return "1970-01-04" — a real-looking date
  // built out of nothing. A gantt task with an `after` dependency has
  // startDate === null, so dragging its bar moved the task to 1970 and dropped
  // the dependency at the same time, with no error anywhere.
  //
  // `undefined`, `''`, `'10d'` and `'9999-99-99'` went the other way and threw
  // RangeError out of toISOString, taking the caller down.
  //
  // Both failures are invisible to the caller. Returning null makes "I could not
  // work this out" something it has to handle.
  var DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

  function parseDate(s) {
    if (typeof s !== 'string') return null;
    var m = s.match(DATE_RE);
    if (!m) return null;
    var y = +m[1], mo = +m[2], d = +m[3];
    var dt = new Date(Date.UTC(y, mo - 1, d));
    // Rejects 2026-02-30 and 9999-99-99: the Date rolls over, so the parts come
    // back different from what was asked for.
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) {
      return null;
    }
    return dt;
  }

  function daysBetween(dateStr1, dateStr2) {
    var d1 = parseDate(dateStr1);
    var d2 = parseDate(dateStr2);
    if (!d1 || !d2) return null;
    return Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
  }

  function addDays(dateStr, days) {
    var d = parseDate(dateStr);
    if (!d) return null;
    if (typeof days !== 'number' || !isFinite(days)) return null;
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().substring(0, 10);
  }

  return { daysBetween: daysBetween, addDays: addDays, parseDate: parseDate };
})();
