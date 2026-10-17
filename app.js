'use strict';

/* =====================================================
   ตั้งค่า — วาง URL ของ Google Apps Script Web App ที่นี่
   (เว้นว่าง = โหมดทดลอง เก็บข้อมูลในเบราว์เซอร์เครื่องนี้)
   ===================================================== */
const CONFIG = {
  API_URL: 'https://script.google.com/macros/s/AKfycbwexuhehn3JIEoGAooQ2SM8rzrQxKTrTUlTf4GvvZS0V1ozer8Qz8y1kR4uIbkL1v6Y/exec',   // เช่น 'https://script.google.com/macros/s/AKfycb.../exec'
  MAX_DAYS: 60   // จำนวนวันสูงสุดของการให้ยาต่อเนื่อง
};

const REFER_OPTIONS = [
  { key: 'woundroom', label: 'ห้องล้างแผลในเวลาราชการ' },
  { key: 'injection', label: 'ห้องฉีดยา' },
  { key: 'rpst', label: 'รพ.สต.' },
  { key: 'rph', label: 'รพช.' }
];

const TIME_OPTIONS = ['08.00 - 12.00 น.', '12.00 - 16.00 น.', '08.00 - 16.00 น.'];

const CARE_ITEMS = [
  { key: 'med', label: 'ให้ยาต่อเนื่อง' },
  { key: 'wound', label: 'ล้างแผล', ph: 'ระบุรายละเอียดการล้างแผล เช่น ล้างแผลทุกวัน ด้วย NSS' },
  { key: 'open', label: 'เปิดแผล', ph: 'ระบุรายละเอียดการเปิดแผล' },
  { key: 'suture', label: 'ตัดไหม', ph: 'ระบุตำแหน่ง / วันที่ครบกำหนดตัดไหม' },
  { key: 'other', label: 'อื่นๆ', ph: 'ระบุรายละเอียด' }
];

const MONTHS_FULL = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const MONTHS_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

/* ---------- Utilities ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const z2 = n => String(n).padStart(2, '0');

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nl = s => esc(s).replace(/\n/g, '<br>');

function parseISO(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split('-').map(Number);
  return { y, m, d };
}

function thaiDate(iso, short) {
  const p = parseISO(iso);
  if (!p) return '';
  const by = p.y + 543;
  return short
    ? `${p.d} ${MONTHS_SHORT[p.m - 1]} ${String(by).slice(-2)}`
    : `${p.d} ${MONTHS_FULL[p.m - 1]} ${by}`;
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${z2(d.getMonth() + 1)}-${z2(d.getDate())}`;
}

/** รายการวันที่ตั้งแต่ start ถึง end (รวมทั้งสองวัน) */
function dayList(start, end) {
  const a = parseISO(start), b = parseISO(end);
  if (!a || !b) return [];
  let t = Date.UTC(a.y, a.m - 1, a.d);
  const e = Date.UTC(b.y, b.m - 1, b.d);
  const out = [];
  while (t <= e && out.length <= CONFIG.MAX_DAYS) {
    const d = new Date(t);
    out.push(`${d.getUTCFullYear()}-${z2(d.getUTCMonth() + 1)}-${z2(d.getUTCDate())}`);
    t += 86400000;
  }
  return out;
}

/** ตารางบันทึกการให้ยา: วันละ 1 เข็ม แบ่งเป็น 2 ฝั่งซ้าย/ขวา ตามแบบฟอร์ม */
function medTableHTML(start, end) {
  const days = dayList(start, end);
  if (!days.length || days.length > CONFIG.MAX_DAYS) return '';
  const rows = Math.ceil(days.length / 2);
  const cell = k => k < days.length
    ? `<td class="c">${k + 1}</td><td class="c">${thaiDate(days[k], true)}</td><td></td>`
    : '<td></td><td></td><td></td>';
  let h = '<table class="medtbl"><thead><tr>' +
    '<th style="width:9%">เข็มที่</th><th style="width:15%">วันที่</th><th>ผู้ให้ยา</th>' +
    '<th style="width:9%">เข็มที่</th><th style="width:15%">วันที่</th><th>ผู้ให้ยา</th>' +
    '</tr></thead><tbody>';
  for (let i = 0; i < rows; i++) h += '<tr>' + cell(i) + cell(i + rows) + '</tr>';
  return h + '</tbody></table>';
}

/* ---------- Toast / Loading ---------- */
let toastTimer;
function toast(msg, isErr) {
  const el = $('#toast');
  el.textContent = msg;
  el.className = 'toast' + (isErr ? ' err' : '');
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, isErr ? 5000 : 2500);
}
const setLoading = on => { $('#loading').hidden = !on; };

/* =====================================================
   API (Google Apps Script) + โหมดทดลอง (localStorage)
   ===================================================== */
async function api(action, payload = {}) {
  if (!CONFIG.API_URL) return localApi(action, payload);

  const res = await fetch(CONFIG.API_URL, {
    method: 'POST',
    // ใช้ text/plain เพื่อเลี่ยง CORS preflight ของ Apps Script
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(Object.assign({ action, passcode: sessionStorage.getItem('pc') || '' }, payload))
  });
  const data = await res.json();

  if (!data.ok && data.code === 'AUTH') {
    const pc = prompt('กรุณากรอกรหัสผ่านเข้าใช้งานระบบ');
    if (pc) {
      sessionStorage.setItem('pc', pc);
      return api(action, payload);
    }
  }
  if (!data.ok) throw new Error(data.error || 'เกิดข้อผิดพลาด');
  return data;
}

function localApi(action, p) {
  const KEY = 'referrals_demo';
  const all = JSON.parse(localStorage.getItem(KEY) || '[]');
  const save = () => localStorage.setItem(KEY, JSON.stringify(all));
  const now = new Date().toISOString();

  if (action === 'list') {
    return Promise.resolve({ ok: true, records: all.slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))) });
  }
  if (action === 'save') {
    const rec = p.record;
    const i = all.findIndex(r => r.id === rec.id);
    if (i >= 0) { rec.updatedAt = now; all[i] = rec; }
    else { rec.id = 'L' + Date.now(); rec.createdAt = now; rec.updatedAt = now; all.push(rec); }
    save();
    return Promise.resolve({ ok: true, record: rec });
  }
  if (action === 'delete') {
    const i = all.findIndex(r => r.id === p.id);
    if (i >= 0) all.splice(i, 1);
    save();
    return Promise.resolve({ ok: true });
  }
  return Promise.reject(new Error('unknown action'));
}

/* =====================================================
   State
   ===================================================== */
const state = { records: [], editingId: '', editingCreated: '' };

/* =====================================================
   Render ตัวเลือกในฟอร์ม
   ===================================================== */
function renderOptions() {
  $('#referOptions').innerHTML = REFER_OPTIONS.map(o =>
    `<label class="chk"><input type="checkbox" name="referTo" value="${o.key}"> ${esc(o.label)}</label>`).join('');

  $('#timeOptions').innerHTML = TIME_OPTIONS.map(t =>
    `<label class="chk"><input type="radio" name="timeSlot" value="${esc(t)}"> ${esc(t)}</label>`).join('');

  $('#careList').innerHTML = CARE_ITEMS.map(c => {
    let panel;
    if (c.key === 'med') {
      panel = `
        <div class="care-panel" hidden>
          <label class="field"><span>ชื่อยา และวิธีที่ให้ <b class="req">*</b></span>
            <input id="medName" type="text" placeholder="เช่น Rabies vaccine ฉีดเข้าในผิวหนัง (ID)"></label>
          <div class="grid g2">
            <label class="field"><span>วันที่เริ่มต้น <b class="req">*</b> <em class="hint">(กดเลือกจากปฏิทิน)</em></span>
              <input id="medStart" type="date" class="lock-date"></label>
            <label class="field"><span>วันที่สิ้นสุด <b class="req">*</b> <em class="hint">(กดเลือกจากปฏิทิน)</em></span>
              <input id="medEnd" type="date" class="lock-date"></label>
          </div>
          <div id="medPreview" class="med-preview"></div>
        </div>`;
    } else {
      panel = `
        <div class="care-panel" hidden>
          <textarea id="text_${c.key}" rows="2" placeholder="${esc(c.ph)}"></textarea>
        </div>`;
    }
    return `<div class="care-item" data-key="${c.key}">
      <label class="chk"><input type="checkbox" name="care" value="${c.key}"> ${esc(c.label)}</label>
      ${panel}
    </div>`;
  }).join('');

  // ปฏิทิน: บังคับเลือกจากปฏิทินเท่านั้น (พิมพ์/วางไม่ได้)
  $$('.lock-date').forEach(el => {
    el.addEventListener('keydown', e => { if (e.key !== 'Tab') e.preventDefault(); });
    el.addEventListener('paste', e => e.preventDefault());
    el.addEventListener('drop', e => e.preventDefault());
    el.addEventListener('click', () => { try { el.showPicker(); } catch (x) { /* บางเบราว์เซอร์ไม่รองรับ */ } });
  });

  $$('input[name=care]').forEach(cb => cb.addEventListener('change', () => syncCarePanels()));
  $('#medStart').addEventListener('change', onMedDates);
  $('#medEnd').addEventListener('change', onMedDates);
  $$('input[name=appoint]').forEach(r => r.addEventListener('change', syncAppoint));
}

function syncCarePanels() {
  $$('.care-item').forEach(item => {
    const on = $('input[name=care]', item).checked;
    item.classList.toggle('on', on);
    $('.care-panel', item).hidden = !on;
  });
  if ($('input[name=care][value=med]').checked) updateMedPreview();
}

function syncAppoint() {
  const yes = ($('input[name=appoint]:checked') || {}).value === 'yes';
  $('#appointWrap').hidden = !yes;
}

function onMedDates() {
  const s = $('#medStart').value;
  const e = $('#medEnd');
  e.min = s || '';
  if (s && e.value && e.value < s) e.value = '';
  updateMedPreview();
}

function updateMedPreview() {
  const s = $('#medStart').value, e = $('#medEnd').value;
  const box = $('#medPreview');
  if (!s || !e) { box.innerHTML = ''; return; }
  const n = dayList(s, e).length;
  if (n > CONFIG.MAX_DAYS) {
    box.innerHTML = `<div class="note" style="color:var(--danger)">ระยะเวลาเกิน ${CONFIG.MAX_DAYS} วัน กรุณาตรวจสอบวันที่</div>`;
    return;
  }
  box.innerHTML = `<div class="note">ตัวอย่างตารางบันทึกการให้ยา (${n} เข็ม — วันละ 1 เข็ม)</div>` + medTableHTML(s, e);
}

/* =====================================================
   ฟอร์ม: เก็บค่า / ใส่ค่า / ตรวจสอบ
   ===================================================== */
const REMEMBER_KEYS = ['dept', 'building', 'ext', 'senderName', 'senderPosition'];

function blankRecord() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem('referral_defaults') || '{}'); } catch (x) { /* ignore */ }
  return {
    id: '', createdAt: '', sendDate: todayISO(),
    dept: saved.dept || '', building: saved.building || '', ext: saved.ext || '',
    referTo: [], referOther: '', timeSlot: '',
    patientName: '', address: '', hn: '', diagnosis: '', problem: '',
    care: {}, medName: '', medStart: '', medEnd: '',
    careText: { wound: '', open: '', suture: '', other: '' },
    appoint: 'none', appointDetail: '',
    senderName: saved.senderName || '', senderPosition: saved.senderPosition || ''
  };
}

function fillForm(r) {
  state.editingId = r.id || '';
  state.editingCreated = r.createdAt || '';

  ['dept', 'building', 'ext', 'referOther', 'patientName', 'address', 'hn', 'diagnosis', 'problem',
    'appointDetail', 'senderName', 'senderPosition', 'medName'].forEach(id => { $('#' + id).value = r[id] || ''; });

  $$('input[name=referTo]').forEach(c => { c.checked = (r.referTo || []).includes(c.value); });
  $$('input[name=timeSlot]').forEach(c => { c.checked = c.value === r.timeSlot; });
  $$('input[name=care]').forEach(c => { c.checked = !!(r.care || {})[c.value]; });
  ['wound', 'open', 'suture', 'other'].forEach(k => { $('#text_' + k).value = (r.careText || {})[k] || ''; });

  $('#medStart').value = r.medStart || '';
  $('#medEnd').min = r.medStart || '';
  $('#medEnd').value = r.medEnd || '';

  $$('input[name=appoint]').forEach(c => { c.checked = c.value === (r.appoint || 'none'); });

  $('#sendDate').value = r.sendDate || todayISO();
  $('#sendDateText').value = thaiDate($('#sendDate').value);

  syncCarePanels();
  syncAppoint();
  $$('.invalid').forEach(el => el.classList.remove('invalid'));
}

function collectForm() {
  const g = id => $('#' + id).value.trim();
  const care = {};
  $$('input[name=care]').forEach(c => { care[c.value] = c.checked; });
  const careText = {};
  ['wound', 'open', 'suture', 'other'].forEach(k => { careText[k] = g('text_' + k); });

  return {
    id: state.editingId, createdAt: state.editingCreated,
    sendDate: $('#sendDate').value,
    dept: g('dept'), building: g('building'), ext: g('ext'),
    referTo: $$('input[name=referTo]:checked').map(c => c.value),
    referOther: g('referOther'),
    timeSlot: ($('input[name=timeSlot]:checked') || {}).value || '',
    patientName: g('patientName'), address: g('address'), hn: g('hn'),
    diagnosis: g('diagnosis'), problem: g('problem'),
    care,
    medName: g('medName'), medStart: $('#medStart').value, medEnd: $('#medEnd').value,
    careText,
    appoint: ($('input[name=appoint]:checked') || {}).value || 'none',
    appointDetail: g('appointDetail'),
    senderName: g('senderName'), senderPosition: g('senderPosition')
  };
}

function validate(r) {
  $$('.invalid').forEach(el => el.classList.remove('invalid'));
  const bad = (id, msg) => { const el = $('#' + id); el.classList.add('invalid'); el.focus(); return msg; };

  if (!r.patientName) return bad('patientName', 'กรุณากรอกชื่อผู้รับบริการ');
  if (!r.hn) return bad('hn', 'กรุณากรอก HN');
  if (!r.diagnosis) return bad('diagnosis', 'กรุณากรอกการวินิจฉัย');
  if (r.care.med) {
    if (!r.medName) return bad('medName', 'กรุณากรอกชื่อยา และวิธีที่ให้');
    if (!r.medStart) return bad('medStart', 'กรุณาเลือกวันที่เริ่มต้นจากปฏิทิน');
    if (!r.medEnd) return bad('medEnd', 'กรุณาเลือกวันที่สิ้นสุดจากปฏิทิน');
    if (r.medEnd < r.medStart) return bad('medEnd', 'วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่มต้น');
    if (dayList(r.medStart, r.medEnd).length > CONFIG.MAX_DAYS) return bad('medEnd', `ระยะเวลาให้ยาเกิน ${CONFIG.MAX_DAYS} วัน`);
  }
  if (r.appoint === 'yes' && !r.appointDetail) return bad('appointDetail', 'กรุณาระบุรายละเอียดการนัด');
  if (!r.senderName) return bad('senderName', 'กรุณากรอกชื่อผู้ส่ง');
  return '';
}

function rememberDefaults(r) {
  const d = {};
  REMEMBER_KEYS.forEach(k => { d[k] = r[k]; });
  try { localStorage.setItem('referral_defaults', JSON.stringify(d)); } catch (x) { /* ignore */ }
}

/* =====================================================
   พิมพ์เอกสาร (ตามแบบฟอร์มที่แนบ)
   ===================================================== */
function buildPrintHTML(r) {
  const cb = on => `<span class="cb${on ? ' on' : ''}"></span>`;
  const fill = (v, cls) => `<span class="fill ${cls || ''}">${esc(v) || '&nbsp;'}</span>`;
  const blank = cls => `<span class="fill ${cls || ''}">&nbsp;</span>`;
  const care = r.care || {};
  const ct = r.careText || {};

  const referOpts = REFER_OPTIONS.map(o =>
    `<span class="opt">${cb((r.referTo || []).includes(o.key))}${esc(o.label)}</span>`).join('');
  const timeOpts = TIME_OPTIONS.map(t =>
    `<span class="opt">${cb(r.timeSlot === t)}${esc(t)}</span>`).join('');

  // ---- การดูแลต่อเนื่อง ----
  // พิมพ์เฉพาะรายการที่เลือก
  let careHTML = '';
  CARE_ITEMS.filter(c => !!care[c.key]).forEach(c => {
    const on = true;
    if (c.key === 'med') {
      careHTML += `<div class="care"><span class="opt">${cb(on)}ให้ยาต่อเนื่อง</span>` +
        (on ? ` &nbsp;ตั้งแต่วันที่ <b>${esc(thaiDate(r.medStart))}</b> ถึงวันที่ <b>${esc(thaiDate(r.medEnd))}</b>` : '') +
        (on ? `<div class="sub">ชื่อยา และวิธีที่ให้ : <b>${nl(r.medName)}</b></div>` : '') + `</div>`;
    } else {
      careHTML += `<div class="care"><span class="opt">${cb(on)}${esc(c.label)}</span>` +
        (on && ct[c.key] ? ` : <b>${nl(ct[c.key])}</b>` : '') + `</div>`;
    }
  });

  if (!careHTML) careHTML = '<div class="care">-</div>';

  const medSection = care.med
    ? `<div class="sec">บันทึกเวลาการให้ยา (กรณีส่งต่อเพื่อให้ยาต่อเนื่อง)</div>${medTableHTML(r.medStart, r.medEnd)}`
    : '';

  const appointHTML = `<div class="sec">ส่งพบแพทย์ตามนัด</div>
    <div class="ln"><span class="opt">${cb(r.appoint !== 'yes')}ไม่มี</span>
      <span class="opt">${cb(r.appoint === 'yes')}มี</span><span>ระบุ :</span>
      ${r.appoint === 'yes' ? `<span class="fill" style="border-bottom:0">${nl(r.appointDetail)}</span>` : blank()}</div>`;

  return `<div class="doc">
    <h1>แบบฟอร์มส่งต่อเพื่อการดูแลต่อเนื่อง</h1>
    <h2>โรงพยาบาลสมเด็จพระยุพราชสว่างแดนดิน</h2>

    <div class="ln"><span>จากแผนก :</span>${fill(r.dept, 'md')}<span>ตึก</span>${fill(r.building)}
      <span>โทรศัพท์ 042-721-111 ต่อ</span>${fill(r.ext, 'sm')}</div>

    <div class="ln"><span>ส่งต่อ :</span><div class="opts">${referOpts}</div></div>
    <div class="ln"><span>ระบุ :</span>${fill(r.referOther)}</div>
    <div class="ln"><span>เวลา :</span><div class="opts">${timeOpts}</div></div>

    <div class="ln"><span>ชื่อผู้รับบริการ :</span>${fill(r.patientName)}<span>เลขที่ทั่วไป (HN) :</span>${fill(r.hn, 'md')}</div>
    <div class="ln"><span>ที่อยู่ :</span>${fill(r.address)}</div>
    <div class="ln"><span>การวินิจฉัย :</span>${fill(r.diagnosis)}</div>
    <div class="block"><span>ประเด็นปัญหาที่พบในผู้ป่วยรายนี้ :</span>
      <span class="fill">${r.problem ? nl(r.problem) : '&nbsp;'}</span></div>

    <div class="sec">ส่งต่อเพื่อการดูแลต่อเนื่อง <span style="font-weight:400">(ระบุกรณีต้องการให้ดูแลพิเศษเฉพาะเรื่อง)</span></div>
    ${careHTML}
    ${medSection}
    ${appointHTML}

    <div class="ln sign-ln" style="margin-top:.6em">
      <span>ลงชื่อผู้ส่ง</span>${fill(r.senderName)}
      <span>ตำแหน่ง</span>${fill(r.senderPosition)}
      <span>วันที่</span>${fill(thaiDate(r.sendDate), 'md')}
    </div>

    <div class="footer-sec">
      <div class="title">บันทึกข้อมูลจากสถานพยาบาลใกล้บ้าน ที่ผู้ป่วยไปรับบริการก่อนการรับตรวจตามนัด</div>
      <div class="ln"><span>ข้อมูลจาก รพช.</span>${blank()}<span>/ รพ.สต.</span>${blank()}</div>
      <div class="ln"><span>1. มีแผลเย็บที่</span>${blank()}<span class="opt">${cb(false)}ตัดไหม</span><span>วันที่</span>${blank('md')}<span class="opt">${cb(false)}ยังไม่ตัดไหม</span></div>
      <div class="ln"><span class="opt">${cb(false)}แผลเย็บดี</span><span class="opt">${cb(false)}แผลแยก</span>${blank()}<span class="opt">${cb(false)}แผลเย็บซึม ลักษณะ</span>${blank()}</div>
      <div class="ln"><span>แผลอื่นบริเวณ</span>${blank()}<span>ลักษณะ</span><span class="opt">${cb(false)}ปกติ</span><span class="opt">${cb(false)}มีหนองซึม</span>${blank()}</div>
      <div class="block"><span>2. สิ่งผิดปกติอื่นที่ตรวจพบ (เช่น จ้ำเลือด บวม มีไข้ ไอ หอบ เป็นต้น)</span>${blank()}${blank()}</div>
      <div class="block"><span>3. อื่นๆ (ถ้ามี)</span>${blank()}${blank()}</div>
    </div>
  </div>`;
}

/**
 * ลดขนาดตัวอักษรของเอกสารอัตโนมัติ ให้เนื้อหาทั้งหมดพอดี 1 หน้า A4
 * (วัดจริงบนพื้นที่เนื้อหา 186 × 277 มม. ตามค่า @page ใน style.css)
 */
const PRINT_FIT = { START_PT: 10, MIN_PT: 7, STEP_PT: 0.25, WIDTH_MM: 186, HEIGHT_MM: 277, SAFETY: 0.96 };

function fitToOnePage() {
  const area = $('#printArea');
  const doc = $('.doc', area);
  if (!doc) return;

  // แสดงนอกจอชั่วคราว ด้วยความกว้างเท่าพื้นที่พิมพ์ เพื่อวัดความสูงจริง
  area.style.cssText = `display:block;position:absolute;left:-10000px;top:0;visibility:hidden;width:${PRINT_FIT.WIDTH_MM}mm`;
  const maxH = PRINT_FIT.HEIGHT_MM / 25.4 * 96 * PRINT_FIT.SAFETY;

  let fs = PRINT_FIT.START_PT;
  doc.style.setProperty('--fs', fs + 'pt');
  const tooBig = () => doc.scrollHeight > maxH || doc.scrollWidth > doc.clientWidth + 1;
  while (tooBig() && fs > PRINT_FIT.MIN_PT) {
    fs -= PRINT_FIT.STEP_PT;
    doc.style.setProperty('--fs', fs + 'pt');
  }
  area.removeAttribute('style');
  return fs;
}

function printRecord(r) {
  $('#printArea').innerHTML = buildPrintHTML(r);
  // รอให้ฟอนต์พร้อม → ปรับขนาดให้พอดี 1 หน้า → เปิดหน้าต่างพิมพ์
  const go = () => { fitToOnePage(); setTimeout(() => window.print(), 150); };
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(go); else go();
}

/* =====================================================
   หน้าประวัติ
   ===================================================== */
function referSummary(r) {
  const parts = (r.referTo || []).map(k => (REFER_OPTIONS.find(o => o.key === k) || {}).label).filter(Boolean);
  if (r.referOther) parts.push(r.referOther);
  return parts;
}

function careSummary(r) {
  return CARE_ITEMS.filter(c => (r.care || {})[c.key]).map(c => c.label);
}

function renderHistory() {
  const q = $('#searchBox').value.trim().toLowerCase();
  const fd = $('#filterDate').value;

  const rows = state.records.filter(r => {
    if (fd && r.sendDate !== fd) return false;
    if (!q) return true;
    return [r.patientName, r.hn, r.diagnosis, r.senderName, r.dept, r.building]
      .some(v => String(v || '').toLowerCase().includes(q));
  });

  $('#historyBody').innerHTML = rows.map(r => `
    <tr data-id="${esc(r.id)}">
      <td class="nowrap">${esc(thaiDate(r.sendDate, true))}</td>
      <td class="nm">${esc(r.patientName)}</td>
      <td>${esc(r.hn)}</td>
      <td>${referSummary(r).map(t => `<span class="tag">${esc(t)}</span>`).join('') || '-'}</td>
      <td>${esc(r.diagnosis)}</td>
      <td>${careSummary(r).map(t => `<span class="tag">${esc(t)}</span>`).join('') || '-'}</td>
      <td>${esc(r.senderName)}</td>
      <td class="actions">
        <button class="btn sm primary" data-act="print">พิมพ์</button>
        <button class="btn sm" data-act="edit">แก้ไข</button>
        <button class="btn sm danger" data-act="del">ลบ</button>
      </td>
    </tr>`).join('');

  $('#historyTable').hidden = !rows.length;
  $('#emptyState').hidden = !!rows.length;
  $('#emptyState').textContent = state.records.length
    ? 'ไม่พบรายการที่ตรงกับเงื่อนไขการค้นหา'
    : 'ยังไม่มีรายการ — กด “+ เพิ่มรายการ” เพื่อเริ่มบันทึก';
  $('#countInfo').textContent = state.records.length ? `แสดง ${rows.length} จาก ${state.records.length} รายการ` : '';
}

async function loadList() {
  setLoading(true);
  try {
    const res = await api('list');
    state.records = res.records || [];
    renderHistory();
  } catch (e) {
    toast('โหลดข้อมูลไม่สำเร็จ: ' + e.message, true);
  } finally {
    setLoading(false);
  }
}

/* =====================================================
   การสลับหน้า / เหตุการณ์
   ===================================================== */
function showHistory() {
  $('#viewForm').hidden = true;
  $('#viewHistory').hidden = false;
  window.scrollTo(0, 0);
}

function showForm(rec, title) {
  fillForm(rec);
  $('#formTitle').textContent = title;
  $('#viewHistory').hidden = true;
  $('#viewForm').hidden = false;
  window.scrollTo(0, 0);
}

async function onSave(printAfter) {
  const rec = collectForm();
  const err = validate(rec);
  if (err) { toast(err, true); return; }

  setLoading(true);
  try {
    const res = await api('save', { record: rec });
    rememberDefaults(rec);
    toast('บันทึกเรียบร้อยแล้ว');
    await loadList();
    showHistory();
    if (printAfter) printRecord(res.record || rec);
  } catch (e) {
    toast('บันทึกไม่สำเร็จ: ' + e.message, true);
  } finally {
    setLoading(false);
  }
}

function init() {
  if (!CONFIG.API_URL) $('#modeBadge').hidden = false;
  renderOptions();

  $('#btnAdd').addEventListener('click', () => showForm(blankRecord(), 'เพิ่มรายการส่งต่อ'));
  $$('[data-action=cancel]').forEach(b => b.addEventListener('click', () => {
    if (confirm('ยกเลิกการกรอกข้อมูลและกลับหน้าประวัติ?')) showHistory();
  }));

  $('#referForm').addEventListener('submit', e => { e.preventDefault(); onSave(false); });
  $('#btnSavePrint').addEventListener('click', () => onSave(true));
  $('#btnPreview').addEventListener('click', () => {
    const rec = collectForm();
    rec.sendDate = rec.sendDate || todayISO();
    printRecord(rec);
  });

  $('#searchBox').addEventListener('input', renderHistory);
  $('#filterDate').addEventListener('change', renderHistory);
  $('#btnClearFilter').addEventListener('click', () => {
    $('#searchBox').value = '';
    $('#filterDate').value = '';
    renderHistory();
  });

  $('#historyBody').addEventListener('click', async e => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const id = btn.closest('tr').dataset.id;
    const rec = state.records.find(r => r.id === id);
    if (!rec) return;

    if (btn.dataset.act === 'print') printRecord(rec);
    if (btn.dataset.act === 'edit') showForm(rec, 'แก้ไขรายการส่งต่อ');
    if (btn.dataset.act === 'del') {
      if (!confirm(`ลบรายการของ “${rec.patientName}” (HN ${rec.hn}) ?`)) return;
      setLoading(true);
      try {
        await api('delete', { id });
        toast('ลบรายการแล้ว');
        await loadList();
      } catch (err) {
        toast('ลบไม่สำเร็จ: ' + err.message, true);
      } finally {
        setLoading(false);
      }
    }
  });

  window.addEventListener('afterprint', () => { $('#printArea').innerHTML = ''; });

  loadList();
}

document.addEventListener('DOMContentLoaded', init);
