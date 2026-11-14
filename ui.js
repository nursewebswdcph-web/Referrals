'use strict';
(function () {
  const KEY = 'referral_quick_settings_v1';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const empty = () => ({ departments: [], buildings: [], medicines: [], staff: [] });
  const clone = value => JSON.parse(JSON.stringify(value));
  function readLocal() {
    try { return Object.assign(empty(), JSON.parse(localStorage.getItem(KEY) || '{}')); }
    catch (_) { return empty(); }
  }
  let data = empty();
  let settingsReady = false;
  let saving = false;

  function cacheLocal() {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (_) {}
  }
  function hasItems(value) {
    return ['departments', 'buildings', 'medicines', 'staff'].some(k => Array.isArray(value[k]) && value[k].length);
  }
  function notify(message, isError) {
    if (typeof toast === 'function') toast(message, !!isError);
  }
  async function persistSettings() {
    if (saving) return;
    saving = true;
    cacheLocal();
    renderSettings();
    renderSuggestions();
    try {
      await api('saveSettings', { settings: data });
      notify('บันทึกการตั้งค่าลงฐานข้อมูลกลางแล้ว');
    } catch (err) {
      notify('บันทึกค่าตั้งค่าไม่สำเร็จ: ' + err.message, true);
      throw err;
    } finally {
      saving = false;
    }
  }
  async function loadSettings() {
    try {
      const response = await api('getSettings');
      const remote = Object.assign(empty(), response.settings || {});
      const local = readLocal();
      if (!hasItems(remote) && hasItems(local)) {
        // ย้ายค่าตั้งค่าที่เคยเก็บในเครื่องนี้ขึ้นฐานข้อมูลกลางครั้งแรก
        data = local;
        await api('saveSettings', { settings: data });
      } else {
        data = remote;
      }
      cacheLocal();
      settingsReady = true;
    } catch (err) {
      data = readLocal();
      settingsReady = false;
      notify('โหลดค่าตั้งค่ากลางไม่สำเร็จ: ' + err.message, true);
    }
    renderSettings();
    renderSuggestions();
    setDefaults();
  }

  function id() { return 'q' + Date.now().toString(36) + Math.random().toString(36).slice(2,7); }
  function row(title, sub, key, itemId) {
    return '<div class="setting-row"><div class="setting-row-main"><div class="setting-row-title">' + esc(title) + '</div>' +
      (sub ? '<div class="setting-row-sub">' + esc(sub) + '</div>' : '') + '</div><div class="setting-row-actions">' +
      '<button type="button" data-edit="' + esc(key) + '" data-id="' + esc(itemId) + '">แก้ไข</button>' +
      '<button type="button" class="remove" data-remove="' + esc(key) + '" data-id="' + esc(itemId) + '">ลบ</button></div></div>';
  }
  function renderSettings() {
    const targets = {
      departments: '#deptSettingList', buildings: '#buildingSettingList',
      medicines: '#medSettingList', staff: '#staffSettingList'
    };
    const html = {
      departments: data.departments.map(x => row(x.value, '', 'departments', x.id)).join(''),
      buildings: data.buildings.map(x => row(x.name, x.ext ? 'โทร. ต่อ ' + x.ext : '', 'buildings', x.id)).join(''),
      medicines: data.medicines.map(x => row(x.value, '', 'medicines', x.id)).join(''),
      staff: data.staff.map(x => row(x.name, x.position, 'staff', x.id)).join('')
    };
    Object.keys(targets).forEach(k => {
      const el = $(targets[k]);
      if (el) el.innerHTML = html[k] || '<div class="muted small">ยังไม่มีรายการ</div>';
    });
  }
  function fillList(selector, values) {
    const el = $(selector);
    if (el) el.innerHTML = values.map(v => '<option value="' + esc(v) + '"></option>').join('');
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
    const fields = [
      ['dept', data.departments[0] && data.departments[0].value],
      ['building', data.buildings[0] && data.buildings[0].name],
      ['ext', data.buildings[0] && data.buildings[0].ext],
      ['senderName', data.staff[0] && data.staff[0].name],
      ['senderPosition', data.staff[0] && data.staff[0].position]
    ];
    fields.forEach(([key, value]) => { const el = $('#' + key); if (el && !el.value && value) el.value = value; });
  }
  function bindForms() {
    $('#deptSettingForm').addEventListener('submit', async e => {
      e.preventDefault();
      const value = $('#deptSettingInput').value.trim();
      if (!value) return;
      if (!data.departments.some(x => x.value.toLowerCase() === value.toLowerCase())) data.departments.push({id:id(),value});
      $('#deptSettingInput').value = '';
      await persistSettings();
    });
    $('#buildingSettingForm').addEventListener('submit', async e => {
      e.preventDefault();
      const name = $('#buildingSettingName').value.trim(), ext = $('#buildingSettingExt').value.trim();
      if (!name) return;
      const old = data.buildings.find(x => x.name.toLowerCase() === name.toLowerCase());
      if (old) old.ext = ext; else data.buildings.push({id:id(),name,ext});
      $('#buildingSettingName').value = ''; $('#buildingSettingExt').value = '';
      await persistSettings();
    });
    $('#medSettingForm').addEventListener('submit', async e => {
      e.preventDefault();
      const value = $('#medSettingInput').value.trim();
      if (!value) return;
      const old = data.medicines.find(x => x.value.toLowerCase() === value.toLowerCase());
      if (old) old.value = value; else data.medicines.push({id:id(),value});
      $('#medSettingInput').value = '';
      await persistSettings();
    });
    $('#staffSettingForm').addEventListener('submit', async e => {
      e.preventDefault();
      const name = $('#staffSettingName').value.trim(), position = $('#staffSettingPosition').value.trim();
      if (!name) return;
      const old = data.staff.find(x => x.name.toLowerCase() === name.toLowerCase());
      if (old) old.position = position; else data.staff.push({id:id(),name,position});
      $('#staffSettingName').value = ''; $('#staffSettingPosition').value = '';
      await persistSettings();
    });
    $('#viewSettings').addEventListener('click', async e => {
      const btn = e.target.closest('[data-edit],[data-remove]');
      if (!btn) return;
      const key = btn.dataset.edit || btn.dataset.remove;
      const item = data[key].find(x => x.id === btn.dataset.id);
      if (!item) return;
      if (btn.dataset.remove) {
        if (confirm('ต้องการลบรายการนี้ใช่หรือไม่?')) {
          data[key] = data[key].filter(x => x.id !== item.id);
          await persistSettings();
        }
        return;
      }
      if (key === 'departments') { const v = prompt('แก้ไขชื่อแผนก', item.value); if (v && v.trim()) item.value = v.trim(); }
      if (key === 'buildings') {
        const v = prompt('แก้ไขชื่อตึก / หอผู้ป่วย', item.name);
        if (v && v.trim()) item.name = v.trim();
        const p = prompt('แก้ไขเบอร์โทรศัพท์ภายใน', item.ext || '');
        if (p !== null) item.ext = p.trim();
      }
      if (key === 'medicines') { const v = prompt('แก้ไขชื่อยาและวิธีที่ให้', item.value); if (v && v.trim()) item.value = v.trim(); }
      if (key === 'staff') {
        const v = prompt('แก้ไขชื่อเจ้าหน้าที่', item.name);
        if (v && v.trim()) item.name = v.trim();
        const p = prompt('แก้ไขตำแหน่ง', item.position || '');
        if (p !== null) item.position = p.trim();
      }
      await persistSettings();
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
      const found = data.medicines.find(x => x.value.toLowerCase() === $('#medName').value.trim().toLowerCase());
      if (found) $('#medName').value = found.value;
    });
    $('#btnAdd').addEventListener('click', () => setTimeout(setDefaults, 0));
  }

  document.addEventListener('DOMContentLoaded', async () => {
    renderSettings();
    bindForms();
    bindFormSuggestions();
    $$('.side-link').forEach(b => b.addEventListener('click', () => {
      const v = b.dataset.view;
      if (v === 'form') {
        showView('form');
        if (!$('#patientName').value && !$('#hn').value) setDefaults();
      } else showView(v);
    }));
    if (typeof showForm === 'function' && typeof blankRecord === 'function') showForm(blankRecord(), 'บันทึกส่งต่อเพื่อการดูแลต่อเนื่อง');
    showView('form');
    await loadSettings();
    setDefaults();
  });
})();