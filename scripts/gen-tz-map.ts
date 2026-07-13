/**
 * Generates src/features/region/tz-to-country.json used by region detection
 * (docs/05 §6). This SEED covers the v1.0 routing regions plus common zones;
 * deriving the full table from IANA `zone.tab` / CLDR is a follow-up (docs/12 §6
 * schedules a quarterly refresh). Committed output carries a generated marker.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const MAP: Record<string, string> = {
  // Vietnam / East Asia (v1.0 pools)
  'Asia/Ho_Chi_Minh': 'VN',
  'Asia/Bangkok': 'TH',
  'Asia/Tokyo': 'JP',
  'Asia/Seoul': 'KR',
  'Asia/Shanghai': 'CN',
  'Asia/Chongqing': 'CN',
  'Asia/Taipei': 'TW',
  'Asia/Hong_Kong': 'HK',
  'Asia/Macau': 'MO',
  'Asia/Singapore': 'SG',
  'Asia/Kuala_Lumpur': 'MY',
  'Asia/Jakarta': 'ID',
  'Asia/Manila': 'PH',
  // Anglophone (en pool)
  'America/New_York': 'US',
  'America/Chicago': 'US',
  'America/Denver': 'US',
  'America/Los_Angeles': 'US',
  'America/Anchorage': 'US',
  'Pacific/Honolulu': 'US',
  'America/Toronto': 'CA',
  'America/Vancouver': 'CA',
  'Europe/London': 'GB',
  'Europe/Dublin': 'IE',
  'Australia/Sydney': 'AU',
  'Australia/Melbourne': 'AU',
  'Australia/Perth': 'AU',
  'Pacific/Auckland': 'NZ',
  // Europe (later waves — routes to en until pools land)
  'Europe/Paris': 'FR',
  'Europe/Berlin': 'DE',
  'Europe/Madrid': 'ES',
  'Europe/Rome': 'IT',
  'Europe/Lisbon': 'PT',
  'Europe/Amsterdam': 'NL',
  'Europe/Warsaw': 'PL',
  'Europe/Moscow': 'RU',
  // MENA / South Asia (later waves)
  'Asia/Riyadh': 'SA',
  'Asia/Dubai': 'AE',
  'Africa/Cairo': 'EG',
  'Asia/Jerusalem': 'IL',
  'Asia/Tehran': 'IR',
  'Asia/Kolkata': 'IN',
};

const out = {
  _generated: 'scripts/gen-tz-map.ts — seed table; regenerate, do not hand-edit',
  map: MAP,
};

const target = join(process.cwd(), 'src/features/region/tz-to-country.json');
writeFileSync(target, `${JSON.stringify(out, null, 2)}\n`, 'utf8');
console.log(`gen:tzmap — wrote ${Object.keys(MAP).length} zones → ${target}`);
