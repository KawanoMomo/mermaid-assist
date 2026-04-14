'use strict';
window.MA = window.MA || {};
window.MA.dateUtils = (function() {
  function daysBetween(dateStr1, dateStr2) {
    var d1 = new Date(dateStr1), d2 = new Date(dateStr2);
    return Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
  }

  function addDays(dateStr, days) {
    var d = new Date(dateStr);
    d.setDate(d.getDate() + days);
    return d.toISOString().substring(0, 10);
  }

  return { daysBetween: daysBetween, addDays: addDays };
})();
