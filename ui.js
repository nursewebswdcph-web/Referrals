'use strict';
(function () {
  const KEY = 'referral_quick_settings_v1';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const empty = () => ({ departments: [], buildings: [], medicines: [], staff: [] });
  function read() { try { return Object.assign(empty(), JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (_) { return empty(); } }
  let data = read();
  function save() { localStorage.setItem(KEY, JSON.stringify(data)); renderSettings(); renderSuggestions(); }
  function id() { return 'q' + Date.now().toString(36) + Math.random().toString(36).slice(2,7); }
  function row(title, sub, key, itemId) {
    return '<div class="setting-row"><div class="setting-row-main"><div class="setting-row-title">' + esc(title) + '</div>' +
      (sub ? '<div class="setting-row-sub">' + esc(sub) + '</div>' : '') + '</div><div class="setting-row-actions">' +
      '<button type="button" data-edit="' + esc(key) + '" data-id="' + esc(itemId) + '">แก้ไข</button>' +
      '<button type="button" class="remove" data-remove="' + esc(key) + '" data-id="' + esc(itemId) + '">ลบ</button></div></div>';
  }
  function renderSettings() {
    $('#deptSettingList').innerHTML = data.departments.map(x => row(x.value, '', 'departments', x.id)).join('') || '<div class="muted small">ยังไม่มีรายการแผนก</div>';
    $('#buildingSettingList').innerHTML = data.buildings.map(x => row(x.name, x.ext ? 'โทร. ต่อ ' + x.ext : '', 'buildings', x.id)).join('') || '<div class="muted small">ยังไม่มีรายการตึก</div>';
    $('#medSettingList').innerHTML = data.medicines.map(x => row(x.value, '', 'medicines', x.id)).join('') || '<div class="muted small">ยังไม่มีรายการยา</div>';
    $('#staffSettingList').innerHTML = data.staff.map(x => row(x.name, x.position, 'staff', x.id)).join('') || '<div class="muted small">ยังไม่มีรายชื่อเจ้าหน้าที่</div>';
  }
  function fillList(selector, values) {
    $(selector).innerHTML = values.map(v => '<option value="' + esc(v) + '"></option>').join('');
  }
  function renderSuggestions() {
    fillList('#deptSuggestions', data.departments.map(x => x.value));
    fillList('#buildingSuggestions', data.buildings.map(x => x.name));
    fillList('#extSuggestions', data.buildings.map(x => x.ext).filter(Boolean));
    fillList('#medSuggestions', data.medicines.map(x => x.value));
    fillList('#staffSuggestions', data.staff.map(x => x.name));
    fillList('#positionSuggestions', data.staff.map(x => x.position).filter(Boolean));
    const med = $('#medName');
    if (med) med.setAttribute('list', 'medSuggestions');
  }
  function showView(name) {
    $('#viewForm').hidden = name !== 'form';
    $('#viewHistory').hidden = name !== 'history';
    $('#viewSettings').hidden = name !== 'settings';
    $$('.side-link').forEach(b => b.classList.toggle('active', b.dataset.view === name));
    window.scrollTo(0, 0);
  }
  function setDefaults() {
    const d = read();
    const fields = [
      ['dept', d.departments[0] && d.departments[0].value],
      ['building', d.buildings[0] && d.buildings[0].name],
      ['ext', d.buildings[0] && d.buildings[0].ext],
      ['senderName', d.staff[0] && d.staff[0].name],
      ['senderPosition', d.staff[0] && d.staff[0].position]
    ];
    fields.forEach(([key, value]) => { const el = $('#' + key); if (el && !el.value && value) el.value = value; });
  }
  function bindForms() {
    $('#deptSettingForm').addEventListener('submit', e => {
      e.preventDefault(); const value = $('#deptSettingInput').value.trim(); if (!value) return;
      if (!data.departments.some(x => x.value.toLowerCase() === value.toLowerCase())) data.departments.push({id:id(),value});
      $('#deptSettingInput').value = ''; save();
    });
    $('#buildingSettingForm').addEventListener('submit', e => {
      e.preventDefault(); const name = $('#buildingSettingName').value.trim(), ext = $('#buildingSettingExt').value.trim(); if (!name) return;
      const old = data.buildings.find(x => x.name.toLowerCase() === name.toLowerCase());
      if (old) { old.ext = ext; } else data.buildings.push({id:id(),name,ext});
      $('#buildingSettingName').value = ''; $('#buildingSettingExt').value = ''; save();
    });
    $('#medSettingForm').addEventListener('submit', e => {
      e.preventDefault(); const value = $('#medSettingInput').value.trim(); if (!value) return;
      data.medicines.push({id:id(),value}); $('#medSettingInput').value = ''; save();
    });
    $('#staffSettingForm').addEventListener('submit', e => {
      e.preventDefault(); const name = $('#staffSettingName').value.trim(), position = $('#staffSettingPosition').value.trim(); if (!name) return;
      const old = data.staff.find(x => x.name.toLowerCase() === name.toLowerCase());
      if (old) old.position = position; else data.staff.push({id:id(),name,position});
      $('#staffSettingName').value = ''; $('#staffSettingPosition').value = ''; save();
    });
    $('#viewSettings').addEventListener('click', e => {
      const btn = e.target.closest('[data-edit],[data-remove]'); if (!btn) return;
      const key = btn.dataset.edit || btn.dataset.remove, item = data[key].find(x => x.id === btn.dataset.id); if (!item) return;
      if (btn.dataset.remove) {
        if (confirm('ต้องการลบรายการนี้ใช่หรือไม่?')) { data[key] = data[key].filter(x => x.id !== item.id); save(); }
        return;
      }
      if (key === 'departments') { const v = prompt('แก้ไขชื่อแผนก', item.value); if (v && v.trim()) item.value = v.trim(); }
      if (key === 'buildings') { const v = prompt('แก้ไขชื่อตึก / หอผู้ป่วย', item.name); if (v && v.trim()) item.name = v.trim(); const p = prompt('แก้ไขเบอร์โทรศัพท์ภายใน', item.ext || ''); if (p !== null) item.ext = p.trim(); }
      if (key === 'medicines') { const v = prompt('แก้ไขชื่อยาและวิธีที่ให้', item.value); if (v && v.trim()) item.value = v.trim(); }
      if (key === 'staff') { const v = prompt('แก้ไขชื่อเจ้าหน้าที่', item.name); if (v && v.trim()) item.name = v.trim(); const p = prompt('แก้ไขตำแหน่ง', item.position || ''); if (p !== null) item.position = p.trim(); }
      save();
    });
  }
  function bindFormSuggestions() {
    $('#building').addEventListener('change', () => {
      const found = data.buildings.find(x => x.name.toLowerCase() === $('#building').value.trim().toLowerCase());
      if (found) $('#ext').value = found.ext || '';
    });
    $('#senderName').addEventListener('change', () => {
      const found = data.staff.find(x => x.name.toLowerCase() === $('#senderName').value.trim().toLowerCase());
      if (found) $('#senderPosition').value = found.position || '';
    });
    $('#medName').addEventListener('change', () => {
      // ใช้เป็นข้อความตั้งต้นเท่านั้น ผู้ใช้ยังแก้ไขข้อความในช่องได้
      const found = data.medicines.find(x => x.value.toLowerCase() === $('#medName').value.trim().toLowerCase());
      if (found) $('#medName').value = found.value;
    });
    $('#btnAdd').addEventListener('click', () => setTimeout(setDefaults, 0));
  }
  document.addEventListener('DOMContentLoaded', () => {
    renderSettings(); renderSuggestions(); bindForms(); bindFormSuggestions();
    $$('.side-link').forEach(b => b.addEventListener('click', () => {
      const v = b.dataset.view;
      if (v === 'form') { showView('form'); if (!$('#patientName').value && !$('#hn').value) setDefaults(); }
      else showView(v);
    }));
    // ให้หน้าแรกเป็นแบบฟอร์มบันทึกทันที ไม่ต้องผ่านหน้าประวัติ
    if (typeof showForm === 'function' && typeof blankRecord === 'function') showForm(blankRecord(), 'บันทึกส่งต่อเพื่อการดูแลต่อเนื่อง');
    showView('form');
    setDefaults();
  });
})();
