/**
 * ระบบแบบฟอร์มส่งต่อเพื่อการดูแลต่อเนื่อง
 * โรงพยาบาลสมเด็จพระยุพราชสว่างแดนดิน
 *
 * Google Apps Script — ใช้ Google Sheet เป็นฐานข้อมูล
 * วิธีติดตั้ง: เปิด Google Sheet > ส่วนขยาย > Apps Script > วางโค้ดนี้ > Deploy > Web app
 *   Execute as: Me  /  Who has access: Anyone
 */

// ---------- ตั้งค่า ----------
const SHEET_ID = '';          // เว้นว่างได้ถ้าสร้าง Script จากภายใน Google Sheet นั้นโดยตรง
const SHEET_NAME = 'Referrals';
const PASSCODE = '';          // (แนะนำ) ตั้งรหัสผ่านเข้าใช้งาน เช่น 'sdd2569' — เว้นว่าง = ไม่ใช้รหัส
const MAX_LIST = 1000;        // จำนวนรายการล่าสุดสูงสุดที่ส่งกลับในหน้าประวัติ

const HEADERS = [
  'id', 'createdAt', 'updatedAt', 'sendDate', 'patientName', 'hn', 'dept', 'building',
  'referTo', 'timeSlot', 'diagnosis', 'careItems', 'appoint', 'senderName', 'senderPosition',
  'status', 'json'
];

// ---------- Entry points ----------
function doGet() {
  return json_({ ok: true, message: 'Referral API is running' });
}

function doPost(e) {
  let p = {};
  try {
    p = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false, error: 'ข้อมูลที่ส่งมาไม่ถูกต้อง' });
  }
  if (PASSCODE && p.passcode !== PASSCODE) {
    return json_({ ok: false, code: 'AUTH', error: 'รหัสผ่านไม่ถูกต้อง' });
  }

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    switch (p.action) {
      case 'list':         return json_({ ok: true, records: listRecords_() });
      case 'save':         return json_({ ok: true, record: saveRecord_(p.record) });
      case 'delete':       deleteRecord_(p.id); return json_({ ok: true });
      case 'getSettings':  return json_({ ok: true, settings: getSettings_() });
      case 'saveSettings': saveSettings_(p.settings); return json_({ ok: true, settings: getSettings_() });
      default:       return json_({ ok: false, error: 'ไม่รู้จักคำสั่ง: ' + p.action });
    }
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message ? err.message : err) });
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
}

// ---------- Helpers ----------
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function sheet_() {
  const ss = SHEET_ID ? SpreadsheetApp.openById(SHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold').setBackground('#e6f0ed');
    sh.setFrozenRows(1);
    // เก็บเป็นข้อความทั้งหมด กัน HN / วันที่ ถูกแปลงรูปแบบ
    sh.getRange(1, 1, sh.getMaxRows(), HEADERS.length).setNumberFormat('@');
  }
  return sh;
}

function nowISO_() {
  return Utilities.formatDate(new Date(), 'Asia/Bangkok', "yyyy-MM-dd'T'HH:mm:ss");
}

const CARE_LABELS = { med: 'ให้ยาต่อเนื่อง', wound: 'ล้างแผล', open: 'เปิดแผล', suture: 'ตัดไหม', other: 'อื่นๆ' };

function careSummary_(rec) {
  const c = rec.care || {};
  return Object.keys(CARE_LABELS).filter(k => c[k]).map(k => CARE_LABELS[k]).join(', ');
}

function rowFromRecord_(rec) {
  return [
    rec.id, rec.createdAt, rec.updatedAt, rec.sendDate || '', rec.patientName || '', rec.hn || '',
    rec.dept || '', rec.building || '', (rec.referTo || []).join(','), rec.timeSlot || '',
    rec.diagnosis || '', careSummary_(rec), rec.appoint === 'yes' ? ('มีนัด: ' + (rec.appointDetail || '')) : 'ไม่มีนัด',
    rec.senderName || '', rec.senderPosition || '', 'active', JSON.stringify(rec)
  ];
}

function listRecords_() {
  const sh = sheet_();
  const last = sh.getLastRow();
  if (last < 2) return [];
  const values = sh.getRange(2, 1, last - 1, HEADERS.length).getValues();
  const iStatus = HEADERS.indexOf('status');
  const iJson = HEADERS.indexOf('json');
  const out = [];
  values.forEach(function (row) {
    if (row[iStatus] === 'deleted' || !row[iJson]) return;
    try { out.push(JSON.parse(row[iJson])); } catch (e) {}
  });
  out.sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); });
  return out.slice(0, MAX_LIST);
}

function findRow_(sh, id) {
  const last = sh.getLastRow();
  if (last < 2 || !id) return -1;
  const ids = sh.getRange(2, 1, last - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) return i + 2;
  }
  return -1;
}

function saveRecord_(rec) {
  if (!rec) throw new Error('ไม่พบข้อมูลที่จะบันทึก');
  const sh = sheet_();
  const now = nowISO_();
  const rowNo = findRow_(sh, rec.id);

  if (rowNo > 0) {
    rec.updatedAt = now;
    if (!rec.createdAt) rec.createdAt = String(sh.getRange(rowNo, 2).getValue());
    sh.getRange(rowNo, 1, 1, HEADERS.length).setNumberFormat('@').setValues([rowFromRecord_(rec)]);
  } else {
    rec.id = 'R' + Date.now();
    rec.createdAt = now;
    rec.updatedAt = now;
    const next = sh.getLastRow() + 1;
    sh.getRange(next, 1, 1, HEADERS.length).setNumberFormat('@').setValues([rowFromRecord_(rec)]);
  }
  return rec;
}

function deleteRecord_(id) {
  const sh = sheet_();
  const rowNo = findRow_(sh, id);
  if (rowNo < 0) throw new Error('ไม่พบรายการที่ต้องการลบ');
  // ลบแบบ soft delete — ข้อมูลยังอยู่ในชีต (status = deleted)
  sh.getRange(rowNo, HEADERS.indexOf('status') + 1).setValue('deleted');
}


// ---------- การตั้งค่าข้อมูลส่วนกลาง ----------
const SETTINGS_SHEET_NAME = 'ReferralSettings';
const SETTINGS_HEADERS = ['key', 'json', 'updatedAt'];

function settingsSheet_() {
  const ss = SHEET_ID ? SpreadsheetApp.openById(SHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SETTINGS_SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SETTINGS_SHEET_NAME);
    sh.getRange(1, 1, 1, SETTINGS_HEADERS.length)
      .setValues([SETTINGS_HEADERS])
      .setFontWeight('bold')
      .setBackground('#e6f0ed');
    sh.setFrozenRows(1);
    sh.getRange(1, 1, sh.getMaxRows(), SETTINGS_HEADERS.length).setNumberFormat('@');
  }
  return sh;
}

function normalizeSettings_(settings) {
  const source = settings || {};
  const cleanArray = (value, fields) => {
    if (!Array.isArray(value)) return [];
    return value.map(item => {
      const out = {};
      fields.forEach(field => {
        const v = item && item[field] != null ? String(item[field]).trim() : '';
        out[field] = v;
      });
      if (!out.id) out.id = 'q' + Utilities.getUuid().replace(/-/g, '').slice(0, 12);
      return out;
    }).filter(item => fields.some(field => field !== 'id' && item[field]));
  };
  return {
    departments: cleanArray(source.departments, ['id', 'value']),
    buildings: cleanArray(source.buildings, ['id', 'name', 'ext']),
    medicines: cleanArray(source.medicines, ['id', 'value']),
    staff: cleanArray(source.staff, ['id', 'name', 'position'])
  };
}

function getSettings_() {
  const sh = settingsSheet_();
  const last = sh.getLastRow();
  if (last < 2) return normalizeSettings_({});
  const rows = sh.getRange(2, 1, last - 1, SETTINGS_HEADERS.length).getValues();
  for (let i = rows.length - 1; i >= 0; i--) {
    if (String(rows[i][0]) === 'shared') {
      try { return normalizeSettings_(JSON.parse(rows[i][1] || '{}')); }
      catch (err) { throw new Error('ข้อมูลตั้งค่าส่วนกลางเสียหาย: ' + err.message); }
    }
  }
  return normalizeSettings_({});
}

function saveSettings_(settings) {
  if (!settings || typeof settings !== 'object') throw new Error('ไม่พบข้อมูลตั้งค่าที่ต้องการบันทึก');
  const sh = settingsSheet_();
  const normalized = normalizeSettings_(settings);
  const payload = JSON.stringify(normalized);
  const last = sh.getLastRow();
  let rowNo = -1;
  if (last >= 2) {
    const keys = sh.getRange(2, 1, last - 1, 1).getValues();
    for (let i = 0; i < keys.length; i++) {
      if (String(keys[i][0]) === 'shared') { rowNo = i + 2; break; }
    }
  }
  if (rowNo < 0) rowNo = sh.getLastRow() + 1;
  sh.getRange(rowNo, 1, 1, SETTINGS_HEADERS.length)
    .setNumberFormat('@')
    .setValues([['shared', payload, nowISO_()]]);
}
