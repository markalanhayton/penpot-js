export function now() {
  return new Date();
}

export function isInst(o) {
  return o instanceof Date;
}

export function inst(s) {
  if (s == null) return s;
  if (isInst(s)) return s;
  if (typeof s === 'number') return new Date(s);
  if (typeof s === 'string') return new Date(s);
  throw new Error('invalid parameters for inst');
}

export function instMs(d) {
  if (d == null) return 0;
  const date = isInst(d) ? d : inst(d);
  return date.getTime();
}

export function isAfter(da, db) {
  return da > db;
}

export function isBefore(da, db) {
  return da < db;
}

export function isAfterOrEqual(da, db) {
  return da >= db;
}

export function isBeforeOrEqual(da, db) {
  return da <= db;
}

export function seconds(d) {
  return Math.floor(instMs(d) / 1000);
}

export function formatInst(v, fmt = 'iso') {
  if (v == null) return null;
  const date = isInst(v) ? v : inst(v);

  switch (fmt) {
    case 'iso':
    case 'iso8601':
      return date.toISOString();

    case 'iso-date':
      return date.toISOString().slice(0, 10);

    case 'rfc1123':
    case 'http':
      return date.toUTCString();

    case 'time-24-simple':
      return date.toTimeString().slice(0, 5);

    default:
      if (typeof fmt === 'string') {
        return formatDateCustom(date, fmt);
      }
      throw new Error(`unexpected format: ${fmt}`);
  }
}

export function plus(d, duration) {
  const date = isInst(d) ? d : inst(d);
  const ms = durationToMs(duration);
  return new Date(date.getTime() + ms);
}

export function minus(d, duration) {
  const date = isInst(d) ? d : inst(d);
  const ms = durationToMs(duration);
  return new Date(date.getTime() - ms);
}

export function diffMs(t1, t2) {
  const d1 = isInst(t1) ? t1 : inst(t1);
  const d2 = isInst(t2) ? t2 : inst(t2);
  return d2.getTime() - d1.getTime();
}

export function inFuture(duration) {
  return plus(now(), duration);
}

export function inPast(duration) {
  return minus(now(), duration);
}

export function tpointMs() {
  const p1 = performance.now();
  return () => performance.now() - p1;
}

function durationToMs(d) {
  if (typeof d === 'number') return d;
  if (typeof d === 'string') return parseDurationString(d);
  if (typeof d === 'object' && d !== null) {
    let ms = 0;
    if (d.milliseconds != null || d.milli != null) ms += (d.milliseconds || d.milli);
    if (d.seconds != null || d.second != null) ms += (d.seconds || d.second) * 1000;
    if (d.minutes != null || d.minute != null) ms += (d.minutes || d.minute) * 60000;
    if (d.hours != null || d.hour != null) ms += (d.hours || d.hour) * 3600000;
    if (d.days != null || d.day != null) ms += (d.days || d.day) * 86400000;
    return ms;
  }
  throw new Error('invalid duration');
}

function parseDurationString(s) {
  const m = s.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/);
  if (!m) throw new Error(`invalid duration string: ${s}`);
  let ms = 0;
  if (m[1]) ms += parseInt(m[1]) * 3600000;
  if (m[2]) ms += parseInt(m[2]) * 60000;
  if (m[3]) ms += parseFloat(m[3]) * 1000;
  return ms;
}

function formatDateCustom(date, fmt) {
  const pad = (n, len = 2) => String(n).padStart(len, '0');
  const tokens = {
    'yyyy': date.getFullYear(),
    'MM': pad(date.getMonth() + 1),
    'dd': pad(date.getDate()),
    'HH': pad(date.getHours()),
    'mm': pad(date.getMinutes()),
    'ss': pad(date.getSeconds()),
    'SSS': pad(date.getMilliseconds(), 3),
  };

  let result = fmt;
  for (const [token, value] of Object.entries(tokens)) {
    result = result.replace(token, value);
  }
  return result;
}