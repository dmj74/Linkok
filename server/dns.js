'use strict';
const dns = require('dns').promises;

/** تشخیص IP عمومی سرور برای راهنمای رکورد A */
async function serverIp() {
  if (process.env.LINKOK_SERVER_IP) return process.env.LINKOK_SERVER_IP;
  try {
    const res = await fetch('https://api.ipify.org', { signal: AbortSignal.timeout(4000) });
    const ip = (await res.text()).trim();
    return /^\d+\.\d+\.\d+\.\d+$/.test(ip) ? ip : null;
  } catch { return null; }
}

/**
 * بررسی رکوردهای DNS دامنه برای تأیید مالکیت.
 * روش‌ها: TXT (توکن یا linkok-verify=TOKEN) | CNAME به دامنه اصلی | A به IP سرور
 */
async function checkDomain(hostname, token, { mainHost = null, serverAddress = null } = {}) {
  const attempts = [hostname, `_linkok.${hostname}`];
  const found = { txt: [], cname: [], a: [] };
  let owned = false;
  let method = null;

  for (const name of attempts) {
    try {
      const records = await dns.resolveTxt(name);
      const values = records.map((chunks) => chunks.join(''));
      found.txt.push(...values.map((v) => `${name}: ${v}`));
      if (values.some((v) => v.includes(token) || v.trim() === `linkok-verify=${token}`)) { owned = true; method = 'txt'; }
    } catch { /* no TXT */ }
    try {
      const cnames = await dns.resolveCname(name);
      found.cname.push(...cnames.map((c) => `${name} → ${c}`));
      if (mainHost && cnames.some((c) => c.replace(/\.$/, '').toLowerCase() === mainHost.toLowerCase())) { owned = true; method = method || 'cname'; }
    } catch { /* no CNAME */ }
    try {
      const addrs = await dns.resolve4(name);
      found.a.push(...addrs.map((a) => `${name} → ${a}`));
      if (serverAddress && addrs.includes(serverAddress)) { owned = true; method = method || 'a'; }
    } catch { /* no A */ }
  }

  return {
    ok: owned, method, records: found,
    message: owned
      ? 'مالکیت دامنه تأیید شد ✅'
      : 'رکورد تأیید پیدا نشد. مطمئن شوید رکورد TXT با مقدار توکن ثبت شده و انتشار DNS انجام شده است (ممکن است چند دقیقه طول بکشد).',
  };
}

module.exports = { checkDomain, serverIp };
