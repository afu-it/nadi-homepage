const fs = require('fs');
let code = fs.readFileSync('js/app.js', 'utf8');

// 1. ADD getUserNadi4uSiteId() helper with the site map
const mapCode = `
const NADI_SITE_NAME_TO_ID = {
  "Air Putih": "951", "NADI Air Putih": "951",
  "Kebun Bunga": "952", "NADI Kebun Bunga": "952",
  "Pulau Tikus": "953", "NADI Pulau Tikus": "953",
  "Tanjong Bunga": "954", "NADI Tanjong Bunga": "954",
  "Komtar": "955", "NADI Komtar": "955",
  "Padang Kota": "956", "NADI Padang Kota": "956",
  "Pengkalan Kota": "957", "NADI Pengkalan Kota": "957",
  "Batu Lancang": "958", "NADI Batu Lancang": "958",
  "Datok Keramat": "959", "NADI Datok Keramat": "959",
  "Sungai Pinang": "960", "NADI Sungai Pinang": "960",
  "Air Itam": "961", "NADI Air Itam": "961",
  "Paya Terubong": "962", "NADI Paya Terubong": "962",
  "Seri Delima": "963", "NADI Seri Delima": "963",
  "Batu Uban": "964", "NADI Batu Uban": "964",
  "Batu Maung": "965", "NADI Batu Maung": "965",
  "Pantai Jerejak": "966", "NADI Pantai Jerejak": "966",
  "Bayan Lepas": "967", "NADI Bayan Lepas": "967",
  "Pulau Betong": "968", "NADI Pulau Betong": "968"
};

function resolveNumericSiteId(siteNameOrId) {
  if (!siteNameOrId) return '';
  const trimmed = String(siteNameOrId).trim();
  if (/^\d{3,4}$/.test(trimmed)) return trimmed;
  return NADI_SITE_NAME_TO_ID[trimmed] || '';
}

function getUserNadi4uSiteId() {
  try {
    const raw = localStorage.getItem('leave_user');
    if (raw) {
      const leaveUser = JSON.parse(raw);
      const mappedId = resolveNumericSiteId(leaveUser?.site_name) || resolveNumericSiteId(leaveUser?.site_id);
      if (mappedId) return mappedId;
    }
  } catch (_) {}

  const settings = parseNadi4uSettingsFromStorage();
  const mappedId = resolveNumericSiteId(settings?.templateSiteName) || resolveNumericSiteId(settings?.templateSiteId);
  if (mappedId) return mappedId;

  return '';
}

function buildNadi4uRegistrationUrl`;

code = code.replace('function buildNadi4uRegistrationUrl', mapCode);

// 2. Use userSiteId in buildNadi4uDisplayEvents
const eventLoopOld = `
  metaById.forEach((eventMeta, sourceEventId) => {
`;
const eventLoopNew = `
  const userSiteId = getUserNadi4uSiteId();
  metaById.forEach((eventMeta, sourceEventId) => {
`;
code = code.replace(eventLoopOld, eventLoopNew);

const registrationUrlOld = `const nadi4uRegistrationUrl = buildNadi4uRegistrationUrl(sourceEventId, eventMeta?.site_id);`;
const registrationUrlNew = `const nadi4uRegistrationUrl = buildNadi4uRegistrationUrl(sourceEventId, userSiteId || eventMeta?.site_id);`;
code = code.replace(registrationUrlOld, registrationUrlNew);

// 3. Update autoLoginAndSyncNadi4uOnLoad
const autoLoginOld = `mergedSettings.userEmail = NADI4U_AUTO_LOGIN_EMAIL;
      persistNadi4uSettings(mergedSettings);`;
const autoLoginNew = `mergedSettings.userEmail = NADI4U_AUTO_LOGIN_EMAIL;
      try {
        const raw = localStorage.getItem('leave_user');
        if (raw) {
          const leaveUser = JSON.parse(raw);
          const mappedId = resolveNumericSiteId(leaveUser?.site_name) || resolveNumericSiteId(leaveUser?.site_id);
          if (mappedId) mergedSettings.templateSiteId = mappedId;
        }
      } catch (_) {}
      persistNadi4uSettings(mergedSettings);`;
code = code.replace(autoLoginOld, autoLoginNew);

fs.writeFileSync('js/app.js', code);
console.log('Patch complete!');
