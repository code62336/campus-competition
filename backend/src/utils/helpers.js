exports.toJson = (v) => (v == null ? null : JSON.stringify(v));

exports.fromJson = (v) => {
  if (v == null) return null;
  if (typeof v === 'object') return v;
  try {
    return JSON.parse(v);
  } catch (e) {
    return v;
  }
};

// ISO / Date -> 'YYYY-MM-DD HH:mm:ss'
exports.toDateTime = (s) => {
  if (!s) return null;
  if (s instanceof Date && !isNaN(s.getTime())) {
    const p = (n) => String(n).padStart(2, '0');
    return `${s.getFullYear()}-${p(s.getMonth() + 1)}-${p(s.getDate())} ${p(s.getHours())}:${p(s.getMinutes())}:${p(s.getSeconds())}`;
  }
  const t = String(s).trim();
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?/.test(t)) return t.slice(0, 19);
  const d = new Date(t);
  if (isNaN(d.getTime())) return null;
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};

exports.today = () => new Date().getFullYear();

// 当前时间（'YYYY-MM-DD HH:mm:ss' 字符串，可直接与 dateStrings 结果比较）
exports.nowStr = () => exports.toDateTime(new Date());

// 加天数
exports.addDays = (days) => exports.toDateTime(new Date(Date.now() + days * 24 * 3600 * 1000));
