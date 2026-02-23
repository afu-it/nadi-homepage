/* ============================================
   KPI Tracking System
   ============================================ */

const KPI_TABLE = 'kpi_records';
const KPI_SELECT_COLUMNS = 'id,site_id,kpi_category,kpi_sub,year_month,is_done,completed_at,updated_at';
const KPI_INFO_SETTINGS_ID = 31;
const WELLBEING_BUNDLE_CATEGORY = 'wellbeing';
const WELLBEING_BUNDLE_MAIN_SUB = 'CARE';
const WELLBEING_BUNDLE_SUBS = ['CARE', 'MenWell', 'FlourisHer'];

function sanitizeKpiInfoHtml(html) {
  const raw = typeof html === 'string' ? html : '';

  if (typeof DOMPurify !== 'undefined') {
    const sanitized = DOMPurify.sanitize(raw, {
      ADD_TAGS: ['iframe', 'font'],
      ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'scrolling', 'target', 'style', 'color'],
      FORBID_TAGS: ['script', 'style', 'form']
    });

    if (typeof document === 'undefined') {
      return sanitized;
    }

    const temp = document.createElement('div');
    temp.innerHTML = sanitized;

    if (typeof linkifyPlainTextUrlsInElement === 'function') {
      linkifyPlainTextUrlsInElement(temp);
    }

    temp.querySelectorAll('a').forEach((a) => {
      const href = String(a.getAttribute('href') || '').trim();
      const needsHttps = href && !/^(https?:\/\/|mailto:|tel:|#|\/)/i.test(href);
      if (needsHttps) {
        const nadiHrefMatch = href.match(/^((?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.nadi\.my)(\/[^\s<>"']*)?$/i);
        if (nadiHrefMatch) {
          const host = nadiHrefMatch[1];
          const path = nadiHrefMatch[2] || '/';
          const hostWithWww = /^www\./i.test(host) ? host : `www.${host}`;
          a.setAttribute('href', `https://${hostWithWww}${path}`);
        } else {
          a.setAttribute('href', `https://${href}`);
        }
      }
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer');
    });

    return temp.innerHTML;
  }

  if (typeof sanitizeHTMLWithLinks === 'function') {
    return sanitizeHTMLWithLinks(raw);
  }
  return raw;
}

// KPI Categories and Sub-KPIs
const kpiCategories = {
  entrepreneur: {
    label: 'Entrepreneurship',
    color: '#facc15',
    subs: ['Preneur', 'EmpowHer', 'Kidventure']
  },
  learning: {
    label: 'Lifelong Learning',
    color: '#3b82f6',
    subs: [
      'Nurture x eKelas Keusahawanan (Maxis)',
      'Nurture x DiLea',
      'Nurture x Cybersecurity',
      'eKelas Maxis',
      'NADI Book x TinyTechies',
      'Skillforge x eSport',
      'Skillforge x Mahir'
    ]
  },
  wellbeing: {
    label: 'Wellbeing',
    color: '#10b981',
    subs: ['CARE']
  },
  awareness: {
    label: 'Awareness',
    color: '#8b5cf6',
    subs: ['KIS']
  },
  gov: {
    label: 'Gov Initiative',
    color: '#ef4444',
    subs: ['MyDigital ID']
  }
};

// KPI Store - handles data operations
class KpiStore {
  constructor() {
    this.records = new Map(); // key: "siteId-category-sub-month", value: record
  }

  setRecords(records) {
    this.records.clear();
    for (const record of records || []) {
      const key = this.getKey(record.site_id, record.kpi_category, record.kpi_sub, record.year_month);
      this.records.set(key, record);
    }
  }

  // Get records key
  getKey(siteId, category, sub, yearMonth) {
    return `${siteId}-${category}-${sub}-${yearMonth}`;
  }

  // Load KPI records for a site and month
  async loadForSiteMonth(siteId, yearMonth) {
    try {
      const { data, error } = await supabaseClient
        .from(KPI_TABLE)
        .select(KPI_SELECT_COLUMNS)
        .eq('site_id', siteId)
        .eq('year_month', yearMonth);

      if (error) throw error;

      this.setRecords(data || []);

      return data || [];
    } catch (error) {
      console.error('Error loading KPI records:', error);
      return [];
    }
  }

  async loadForSitesMonth(siteIds, yearMonth) {
    if (!Array.isArray(siteIds) || !siteIds.length) {
      this.records.clear();
      return [];
    }

    try {
      const { data, error } = await supabaseClient
        .from(KPI_TABLE)
        .select(KPI_SELECT_COLUMNS)
        .in('site_id', siteIds)
        .eq('year_month', yearMonth);

      if (error) throw error;

      this.setRecords(data || []);

      return data || [];
    } catch (error) {
      console.error('Error loading KPI records:', error);
      return [];
    }
  }

  async loadKpiInfoSettings() {
    try {
      const { data, error } = await supabaseClient
        .from('site_settings')
        .select('settings')
        .eq('id', KPI_INFO_SETTINGS_ID)
        .maybeSingle();

      if (error) throw error;
      return data?.settings?.kpiInfoByKey || {};
    } catch (error) {
      console.error('Error loading KPI info settings:', error);
      return {};
    }
  }

  async saveKpiInfoSettings(infoByKey) {
    const safeInfoByKey = infoByKey && typeof infoByKey === 'object' ? infoByKey : {};
    try {
      const { data: existing, error: existingError } = await supabaseClient
        .from('site_settings')
        .select('settings')
        .eq('id', KPI_INFO_SETTINGS_ID)
        .maybeSingle();

      if (existingError) throw existingError;

      const nextSettings = {
        ...(existing?.settings || {}),
        kpiInfoByKey: safeInfoByKey,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabaseClient
        .from('site_settings')
        .upsert({
          id: KPI_INFO_SETTINGS_ID,
          settings: nextSettings
        }, { onConflict: 'id' });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error saving KPI info settings:', error);
      throw error;
    }
  }

  // Check if a sub-KPI is done
  isSubRecordDone(siteId, category, sub, yearMonth) {
    const key = this.getKey(siteId, category, sub, yearMonth);
    const record = this.records.get(key);
    return Boolean(record && record.is_done);
  }

  isDone(siteId, category, sub, yearMonth) {
    if (category === WELLBEING_BUNDLE_CATEGORY && sub === WELLBEING_BUNDLE_MAIN_SUB) {
      return WELLBEING_BUNDLE_SUBS.every((bundleSub) => this.isSubRecordDone(siteId, category, bundleSub, yearMonth));
    }
    return this.isSubRecordDone(siteId, category, sub, yearMonth);
  }

  // Toggle KPI done status
  async toggleKpi(siteId, category, sub, yearMonth, isDone) {
    const key = this.getKey(siteId, category, sub, yearMonth);
    const existing = this.records.get(key);

    try {
      if (existing) {
        // Update existing
        const { data, error } = await supabaseClient
          .from(KPI_TABLE)
          .update({
            is_done: isDone,
            completed_at: isDone ? new Date().toISOString() : null,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (error) throw error;
        this.records.set(key, data);
        return data;
      } else {
        // Insert new
        const { data, error } = await supabaseClient
          .from(KPI_TABLE)
          .insert({
            site_id: siteId,
            kpi_category: category,
            kpi_sub: sub,
            year_month: yearMonth,
            is_done: isDone,
            completed_at: isDone ? new Date().toISOString() : null
          })
          .select()
          .single();

        if (error) throw error;
        this.records.set(key, data);
        return data;
      }
    } catch (error) {
      console.error('Error toggling KPI:', error);
      throw error;
    }
  }

  // Get category progress
  getCategoryProgress(siteId, category, yearMonth) {
    const subs = kpiCategories[category].subs;
    let done = 0;
    for (const sub of subs) {
      if (this.isDone(siteId, category, sub, yearMonth)) {
        done++;
      }
    }
    return { done, total: subs.length };
  }
}

// KPI UI - handles rendering
class KpiUI {
  constructor(store, manager) {
    this.store = store;
    this.manager = manager;
    this.openCategories = new Set(['entrepreneur', 'learning', 'wellbeing', 'awareness', 'gov']); // All categories open
  }

  clearMonthTransitionClasses() {
    const display = document.getElementById('kpiMonthDisplay');
    const container = document.getElementById('kpiCategories');

    if (display) {
      display.classList.remove(
        'kpi-month-out-prev',
        'kpi-month-out-next',
        'kpi-month-in-prev',
        'kpi-month-in-next',
        'kpi-month-in-active'
      );
    }

    if (container) {
      container.classList.remove(
        'kpi-categories-out-prev',
        'kpi-categories-out-next',
        'kpi-categories-in-prev',
        'kpi-categories-in-next',
        'kpi-categories-in-active'
      );
    }
  }

  setMonthNavDisabled(disabled) {
    document.querySelectorAll('.kpi-month-btn').forEach((button) => {
      button.disabled = disabled;
      button.setAttribute('aria-disabled', disabled ? 'true' : 'false');
    });
  }

  updateDialogWidth(isWide) {
    const dialog = document.querySelector('#kpiOverlay .kpi-dialog');
    if (!dialog) return;
    const wide = Boolean(isWide);
    const isInfoPanel = this.manager.activePanel === 'info';
    const isTrackingAllPanel = wide
      && !isInfoPanel
      && this.manager.isSupervisor
      && this.manager.viewMode === 'all';

    dialog.classList.toggle('kpi-dialog-wide', wide);
    dialog.classList.toggle('kpi-dialog-info', wide && isInfoPanel);
    dialog.classList.toggle('kpi-dialog-tracking-all', isTrackingAllPanel);
  }

  startMonthTransition(direction) {
    const display = document.getElementById('kpiMonthDisplay');
    const container = document.getElementById('kpiCategories');

    this.clearMonthTransitionClasses();

    if (display) {
      display.classList.add(direction === 'prev' ? 'kpi-month-out-prev' : 'kpi-month-out-next');
    }

    if (container) {
      container.classList.add(direction === 'prev' ? 'kpi-categories-out-prev' : 'kpi-categories-out-next');
    }
  }

  runMonthTransitionIn(direction) {
    const display = document.getElementById('kpiMonthDisplay');
    const container = document.getElementById('kpiCategories');

    if (display) {
      display.classList.remove('kpi-month-out-prev', 'kpi-month-out-next');
      display.classList.add(direction === 'prev' ? 'kpi-month-in-prev' : 'kpi-month-in-next');
    }

    if (container) {
      container.classList.remove('kpi-categories-out-prev', 'kpi-categories-out-next');
      container.classList.add(direction === 'prev' ? 'kpi-categories-in-prev' : 'kpi-categories-in-next');
    }

    requestAnimationFrame(() => {
      if (display) display.classList.add('kpi-month-in-active');
      if (container) container.classList.add('kpi-categories-in-active');
    });

    setTimeout(() => {
      this.clearMonthTransitionClasses();
    }, 300);
  }

  renderTabState() {
    const title = document.getElementById('kpiDialogTitle');
    const switchBtn = document.getElementById('kpiPanelSwitchBtn');
    const saveBtn = document.getElementById('kpiHeaderSaveBtn');
    const controls = document.querySelector('#kpiOverlay .kpi-controls');
    const body = document.querySelector('#kpiOverlay .kpi-dialog-body');

    const isInfo = this.manager.activePanel === 'info';
    const canEditInfo = isInfo && this.manager.isSupervisor;

    if (title) {
      title.textContent = isInfo ? 'KPI Info' : 'KPI Tracking';
    }

    if (switchBtn) {
      switchBtn.innerHTML = isInfo
        ? '<i class="fa-solid fa-list-check"></i><span>KPI Tracking</span>'
        : '<i class="fa-solid fa-circle-info"></i><span>KPI Info</span>';
    }

    if (controls) {
      controls.classList.toggle('kpi-controls-hidden', isInfo);
    }

    if (body) {
      body.classList.toggle('kpi-info-mode', isInfo);
      body.classList.toggle('kpi-staff-tracking-mode', !isInfo && !this.manager.isSupervisor);
      body.classList.toggle('kpi-info-editing', isInfo && this.manager.isInfoEditMode);
    }

    if (saveBtn) {
      saveBtn.classList.toggle('hidden', !canEditInfo);
      if (canEditInfo) {
        saveBtn.innerHTML = this.manager.isInfoEditMode
          ? '<i class="fa-solid fa-floppy-disk"></i><span>Save Info</span>'
          : '<i class="fa-solid fa-pen"></i><span>Edit Mode</span>';
        saveBtn.classList.toggle('kpi-header-edit-mode', !this.manager.isInfoEditMode);
      }
    }
  }

  renderKpiInfoPanel() {
    const container = document.getElementById('kpiCategories');
    if (!container) return;

    const allSubKpis = this.getAllInfoSubKpis();
    const isEditable = this.manager.isInfoEditMode;

    if (!isEditable) {
      const partitionsHtml = Object.entries(kpiCategories).map(([category, info]) => {
        const categorySubs = this.getInfoSubsForCategory(category, info);
        const categoryCount = category === WELLBEING_BUNDLE_CATEGORY ? 1 : categorySubs.length;
        const itemsHtml = categorySubs.map((sub) => {
          const key = this.manager.getKpiInfoKey(category, sub);
          const rawHtml = this.manager.kpiInfoByKey[key] || '';
          const safeHtml = sanitizeKpiInfoHtml(rawHtml);
          return `
            <article class="kpi-info-partition-item" title="${sub}">
              <div class="kpi-info-partition-item-title">${this.getShortSubLabel(sub)}</div>
              <div class="kpi-info-partition-item-body">${safeHtml || '<span class="kpi-info-empty">No information yet.</span>'}</div>
            </article>
          `;
        }).join('');

        return `
          <section class="kpi-info-partition kpi-info-partition-${category}">
            <div class="kpi-info-partition-header">
              <span class="kpi-info-partition-title">${info.label}</span>
              <span class="kpi-info-partition-count">${categoryCount}</span>
            </div>
            <div class="kpi-info-partition-list">
              ${itemsHtml}
            </div>
          </section>
        `;
      }).join('');

      container.innerHTML = `<div class="kpi-info-partition-grid">${partitionsHtml}</div>`;
      return;
    }

    const cardsHtml = allSubKpis.map((item, index) => {
      const key = this.manager.getKpiInfoKey(item.category, item.sub);
      const rawHtml = this.manager.kpiInfoByKey[key] || '';
      const safeHtml = sanitizeKpiInfoHtml(rawHtml);
      const editorId = `kpiInfoEditor-${index}`;

      return `
        <section class="kpi-info-card">
          <div class="kpi-info-header">
            <div class="kpi-info-title-wrap">
              <span class="kpi-info-index">${item.infoNumber}</span>
              <div>
                <div class="kpi-info-title">${this.getShortSubLabel(item.sub)}</div>
                <div class="kpi-info-subtitle">${item.sub}</div>
              </div>
            </div>
            <span class="kpi-info-category kpi-info-category-${item.category}">${kpiCategories[item.category]?.label || item.category}</span>
          </div>
          <div class="kpi-info-toolbar" id="${editorId}-toolbar">
            <button type="button" class="kpi-info-tool" onclick="kpiManager.applyInfoFormat('${editorId}', 'bold')"><i class="fa-solid fa-bold"></i></button>
            <button type="button" class="kpi-info-tool" onclick="kpiManager.applyInfoFormat('${editorId}', 'italic')"><i class="fa-solid fa-italic"></i></button>
            <button type="button" class="kpi-info-tool" onclick="kpiManager.applyInfoFormat('${editorId}', 'underline')"><i class="fa-solid fa-underline"></i></button>
            <button type="button" class="kpi-info-tool" onclick="kpiManager.applyInfoFormat('${editorId}', 'insertUnorderedList')"><i class="fa-solid fa-list-ul"></i></button>
            <button type="button" class="kpi-info-tool" onclick="kpiManager.applyInfoFormat('${editorId}', 'insertOrderedList')"><i class="fa-solid fa-list-ol"></i></button>
            <button type="button" class="kpi-info-tool" onclick="kpiManager.applyInfoLink('${editorId}')"><i class="fa-solid fa-link"></i></button>
            <label class="kpi-info-color-tool" title="Text Color">
              <i class="fa-solid fa-palette"></i>
              <input
                id="${editorId}-color-picker"
                type="color"
                class="kpi-info-color-input"
                value="#1e293b"
                onmousedown="kpiManager.captureInfoSelection('${editorId}')"
                onchange="kpiManager.applyInfoColor('${editorId}', this.value)"
              >
            </label>
            <input
              id="${editorId}-color-hex"
              type="text"
              class="kpi-info-color-hex"
              value="#1E293B"
              maxlength="7"
              spellcheck="false"
              aria-label="Hex color"
              onfocus="kpiManager.captureInfoSelection('${editorId}')"
              onkeydown="if(event.key === 'Enter'){event.preventDefault();kpiManager.applyInfoHexColor('${editorId}');}"
              onblur="kpiManager.applyInfoHexColor('${editorId}', true)"
            >
          </div>
          <div
            id="${editorId}"
            class="kpi-info-editor"
            data-kpi-key="${key}"
            contenteditable="true"
            spellcheck="true"
            onmouseup="setTimeout(function(){ kpiManager.captureInfoSelection('${editorId}'); }, 0)"
            onkeyup="kpiManager.captureInfoSelection('${editorId}')"
            onfocus="kpiManager.captureInfoSelection('${editorId}')"
          >${safeHtml}</div>
        </section>
      `;
    }).join('');

    container.innerHTML = `
      <section class="kpi-info-edit-panel">
        <header class="kpi-info-edit-panel-header">
          <h3 class="kpi-info-edit-panel-title">KPI Info Editor</h3>
          <p class="kpi-info-edit-panel-note">Edit content here, then click Save Info.</p>
        </header>
        <div class="kpi-info-grid">${cardsHtml}</div>
      </section>
    `;
  }

  renderSiteControl() {
    const label = document.getElementById('kpiSiteLabel');
    if (!label) return;

    if (!this.manager.isSupervisor) {
      const siteName = this.manager.currentSiteName || '-';
      label.innerHTML = '';
      label.textContent = siteName;
      label.style.cursor = 'default';
      label.style.padding = '';
      label.style.border = '';
      label.style.background = '';
      return;
    }

    label.innerHTML = '';
    label.textContent = `All Sites (${this.manager.availableSites.length || 18})`;
    label.style.cursor = 'default';
    label.style.padding = '';
    label.style.border = '';
    label.style.background = '';
  }

  // Render month display
  renderMonthDisplay() {
    const display = document.getElementById('kpiMonthDisplay');
    if (!display) return;

    const date = new Date(this.manager.currentYear, this.manager.currentMonth - 1, 1);
    const monthName = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    display.textContent = monthName;
  }

  // Format label - put prefix above main text in Lifelong Learning
  formatLabel(category, sub) {
    if (category === 'learning') {
      // Match patterns like "Nurture x eKelas", "Skillforge x eSport", "NADI Book x TinyTechies"
      const match = sub.match(/^(.+?)\s+x\s+(.+)$/i);
      if (match) {
        return `<div class="kpi-label-stacked">
          <span class="kpi-label-prefix">${match[1]}</span>
          <span class="kpi-label-partner">${match[2]}</span>
        </div>`;
      }
    }
    return sub;
  }

  // Render categories
  async renderCategories() {
    const container = document.getElementById('kpiCategories');
    if (!container) return;
    container.classList.toggle('kpi-supervisor-all-view', this.manager.viewMode === 'all');

    if (this.manager.viewMode === 'all') {
      container.innerHTML = this.renderAllSitesMatrix();
      return;
    }

    if (this.manager.isSupervisor) {
      container.innerHTML = this.renderSingleSiteMatrix();
      return;
    }

    container.innerHTML = this.renderSingleSiteVertical();
  }

  getAllSubKpis() {
    const allSubKpis = [];
    for (const [category, info] of Object.entries(kpiCategories)) {
      for (const sub of info.subs) {
        allSubKpis.push({ category, sub });
      }
    }
    return allSubKpis;
  }

  getInfoSubsForCategory(category, info) {
    const baseSubs = Array.isArray(info?.subs) ? info.subs : [];
    if (category === WELLBEING_BUNDLE_CATEGORY && baseSubs.includes(WELLBEING_BUNDLE_MAIN_SUB)) {
      return WELLBEING_BUNDLE_SUBS;
    }
    return baseSubs;
  }

  getAllInfoSubKpis() {
    const allSubKpis = [];
    let infoNumber = 1;
    for (const [category, info] of Object.entries(kpiCategories)) {
      const categorySubs = this.getInfoSubsForCategory(category, info);

      if (category === WELLBEING_BUNDLE_CATEGORY && categorySubs.length) {
        for (const sub of categorySubs) {
          allSubKpis.push({ category, sub, infoNumber });
        }
        infoNumber++;
        continue;
      }

      for (const sub of categorySubs) {
        allSubKpis.push({ category, sub, infoNumber });
        infoNumber++;
      }
    }
    return allSubKpis;
  }

  getShortSubLabel(sub) {
    const shortLabels = {
      'Nurture x eKelas Keusahawanan (Maxis)': 'eKelas Keusahawanan',
      'Nurture x DiLea': 'DiLea',
      'Nurture x Cybersecurity': 'Cybersecurity',
      'eKelas Maxis': 'eKelas Maxis',
      'NADI Book x TinyTechies': 'Tinytechies',
      'Skillforge x eSport': 'eSport',
      'Skillforge x Mahir': 'Mahir',
      'MyDigital ID': 'MyDigital ID'
    };
    return shortLabels[sub] || sub;
  }

  getSupervisorMatrixLayout() {
    const matrixColumns = [];
    const categoryGroups = [];
    let labelNumber = 1;

    for (const [category, info] of Object.entries(kpiCategories)) {
      if (category === WELLBEING_BUNDLE_CATEGORY) {
        for (const wellbeingSub of WELLBEING_BUNDLE_SUBS) {
          matrixColumns.push({ category, sub: wellbeingSub, number: labelNumber });
        }
        categoryGroups.push({
          key: category,
          label: info.label,
          count: WELLBEING_BUNDLE_SUBS.length
        });
        labelNumber++;
        continue;
      }

      for (const sub of info.subs) {
        matrixColumns.push({ category, sub, number: labelNumber });
        labelNumber++;
      }
      categoryGroups.push({ key: category, label: info.label, count: info.subs.length });
    }

    return {
      matrixColumns,
      categoryGroups,
      totalKpiCount: labelNumber - 1
    };
  }

  renderAllSitesMatrix() {
    const { matrixColumns, categoryGroups, totalKpiCount } = this.getSupervisorMatrixLayout();
    const { availableSites, currentYearMonth } = this.manager;

    if (!availableSites.length) {
      return `
        <div class="kpi-empty">
          <i class="fa-solid fa-folder-open"></i>
          <p>No sites found</p>
        </div>
      `;
    }

    let html = `
      <div class="kpi-matrix-wrap">
        <table class="kpi-matrix-table">
          <thead>
            <tr>
              <th rowspan="2">Site</th>
              ${categoryGroups.map((group) => `<th class="kpi-matrix-group kpi-matrix-group-${group.key}" colspan="${group.count}">${group.label}</th>`).join('')}
              <th rowspan="2">Total</th>
            </tr>
            <tr>
              ${matrixColumns.map((item) => `<th class="kpi-matrix-col-${item.category}" title="${item.sub}"><div class="kpi-matrix-head"><span class="kpi-matrix-head-num">${item.number}</span><span class="kpi-matrix-head-text">${this.getShortSubLabel(item.sub)}</span></div></th>`).join('')}
            </tr>
          </thead>
          <tbody>
    `;

    for (const site of availableSites) {
      const rowCells = matrixColumns.map((item) => {
        const done = item.category === WELLBEING_BUNDLE_CATEGORY
          ? this.store.isSubRecordDone(site.site_id, item.category, item.sub, currentYearMonth)
          : this.store.isDone(site.site_id, item.category, item.sub, currentYearMonth);
        return `<td class="kpi-matrix-col-${item.category}"><span class="kpi-matrix-dot ${done ? 'done' : ''}" title="${done ? 'Done' : 'Pending'}"></span></td>`;
      }).join('');

      let doneCount = 0;
      for (const category of Object.keys(kpiCategories)) {
        const progress = this.store.getCategoryProgress(site.site_id, category, currentYearMonth);
        doneCount += progress.done;
      }
      const totalStatusClass = doneCount === totalKpiCount ? 'kpi-total-complete' : 'kpi-total-incomplete';
      const siteStatusClass = doneCount === totalKpiCount ? 'kpi-site-complete' : 'kpi-site-incomplete';

      html += `
        <tr>
          <td class="kpi-matrix-site ${siteStatusClass}">${site.site_name}</td>
          ${rowCells}
          <td class="kpi-matrix-total ${totalStatusClass}">${doneCount}/${totalKpiCount}</td>
        </tr>
      `;
    }

    html += `
          </tbody>
        </table>
      </div>
    `;

    return html;
  }

  renderSingleSiteMatrix() {
    const { currentSiteId, currentSiteName, currentYearMonth } = this.manager;
    if (!currentSiteId) {
      return `
        <div class="kpi-empty">
          <i class="fa-solid fa-folder-open"></i>
          <p>No site selected</p>
        </div>
      `;
    }

    const { matrixColumns, categoryGroups, totalKpiCount } = this.getSupervisorMatrixLayout();
    const rowCells = matrixColumns.map((item) => {
      const done = item.category === WELLBEING_BUNDLE_CATEGORY
        ? this.store.isSubRecordDone(currentSiteId, item.category, item.sub, currentYearMonth)
        : this.store.isDone(currentSiteId, item.category, item.sub, currentYearMonth);
      return `
        <td class="kpi-matrix-col-${item.category}">
          <label title="${done ? 'Done' : 'Pending'}">
            <input
              type="checkbox"
              class="kpi-checkbox kpi-checkbox-${item.category} kpi-matrix-checkbox"
              ${done ? 'checked' : ''}
              onchange="kpiManager.toggleKpiItem('${item.category}', '${item.sub.replace(/'/g, "\\'")}', this.checked)"
            >
          </label>
        </td>
      `;
    }).join('');

    let doneCount = 0;
    for (const category of Object.keys(kpiCategories)) {
      const progress = this.store.getCategoryProgress(currentSiteId, category, currentYearMonth);
      doneCount += progress.done;
    }
    const totalStatusClass = doneCount === totalKpiCount ? 'kpi-total-complete' : 'kpi-total-incomplete';
    const siteStatusClass = doneCount === totalKpiCount ? 'kpi-site-complete' : 'kpi-site-incomplete';

    return `
      <div class="kpi-matrix-wrap">
        <table class="kpi-matrix-table">
          <thead>
            <tr>
              <th rowspan="2">Site</th>
              ${categoryGroups.map((group) => `<th class="kpi-matrix-group kpi-matrix-group-${group.key}" colspan="${group.count}">${group.label}</th>`).join('')}
              <th rowspan="2">Total</th>
            </tr>
            <tr>
              ${matrixColumns.map((item) => `<th class="kpi-matrix-col-${item.category}" title="${item.sub}"><div class="kpi-matrix-head"><span class="kpi-matrix-head-num">${item.number}</span><span class="kpi-matrix-head-text">${this.getShortSubLabel(item.sub)}</span></div></th>`).join('')}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="kpi-matrix-site ${siteStatusClass}">${currentSiteName || '-'}</td>
              ${rowCells}
              <td class="kpi-matrix-total ${totalStatusClass}">${doneCount}/${totalKpiCount}</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
  }

  renderSingleSiteVertical() {
    const { currentSiteId, currentSiteName, currentYearMonth } = this.manager;
    if (!currentSiteId) {
      return `
        <div class="kpi-empty">
          <i class="fa-solid fa-folder-open"></i>
          <p>No site selected</p>
        </div>
      `;
    }

    const totalKpis = this.getAllSubKpis().length;
    let totalDone = 0;

    const staffCategoryOrder = ['entrepreneur', 'awareness', 'learning', 'wellbeing', 'gov'];
    const orderedCategories = staffCategoryOrder
      .map((key) => [key, kpiCategories[key]])
      .filter(([, info]) => Boolean(info));

    const categoriesHtml = orderedCategories.map(([category, info]) => {
      const progress = this.store.getCategoryProgress(currentSiteId, category, currentYearMonth);
      totalDone += progress.done;
      const isOpen = this.openCategories.has(category);

      const renderSubItem = (sub) => {
        if (category === WELLBEING_BUNDLE_CATEGORY && sub === WELLBEING_BUNDLE_MAIN_SUB) {
          const wellbeingChecksHtml = WELLBEING_BUNDLE_SUBS.map((bundleSub) => {
            const checked = this.store.isSubRecordDone(currentSiteId, category, bundleSub, currentYearMonth);
            return `
              <label class="kpi-item kpi-item-wellbeing-sub" title="${bundleSub} (${checked ? 'Done' : 'Pending'})">
                <input
                  type="checkbox"
                  class="kpi-checkbox kpi-checkbox-${category}"
                  ${checked ? 'checked' : ''}
                  onchange="kpiManager.toggleKpiItem('${category}', '${bundleSub}', this.checked)"
                >
                <div class="kpi-item-label">${bundleSub}</div>
              </label>
            `;
          }).join('');

          return `<div class="kpi-wellbeing-bundle">${wellbeingChecksHtml}</div>`;
        }

        const done = this.store.isDone(currentSiteId, category, sub, currentYearMonth);
        const shortLabel = this.getShortSubLabel(sub);
        return `
          <label class="kpi-item" title="${sub} (${done ? 'Done' : 'Pending'})">
            <input
              type="checkbox"
              class="kpi-checkbox kpi-checkbox-${category}"
              ${done ? 'checked' : ''}
              onchange="kpiManager.toggleKpiItem('${category}', '${sub.replace(/'/g, "\\'")}', this.checked)"
            >
            <div class="kpi-item-label">${shortLabel}</div>
          </label>
        `;
      };

      let subItemsHtml = '';
      if (category === 'learning') {
        const firstColumn = info.subs.slice(0, 4).map((sub) => renderSubItem(sub)).join('');
        const secondColumn = info.subs.slice(4).map((sub) => renderSubItem(sub)).join('');
        subItemsHtml = `
          <div class="kpi-learning-split">
            <div class="kpi-learning-column">${firstColumn}</div>
            <div class="kpi-learning-column">${secondColumn}</div>
          </div>
        `;
      } else {
        subItemsHtml = info.subs.map((sub) => renderSubItem(sub)).join('');
      }

      return `
        <section class="kpi-category kpi-category-card kpi-category-card-${category} ${isOpen ? 'open' : ''}">
          <button
            type="button"
            class="kpi-category-header"
            onclick="kpiManager.toggleCategory('${category}')"
            aria-expanded="${isOpen ? 'true' : 'false'}"
          >
            <span class="kpi-category-left">
              <span class="kpi-category-color kpi-color-${category}"></span>
              <span class="kpi-category-title">${info.label}</span>
            </span>
            <span class="kpi-category-right">
              <span class="kpi-category-progress ${progress.done === progress.total ? 'complete' : ''}">
                ${progress.done}/${progress.total}
              </span>
              <i class="fa-solid fa-chevron-down kpi-category-chevron" aria-hidden="true"></i>
            </span>
          </button>
          <div class="kpi-category-body" ${isOpen ? '' : 'style="display: none;"'}>
            ${subItemsHtml}
          </div>
        </section>
      `;
    }).join('');
    const totalStatusClass = totalDone === totalKpis ? 'kpi-total-complete' : 'kpi-total-incomplete';

    return `
      <div class="kpi-staff-compact">
        <section class="kpi-staff-summary">
          <div>
            <div class="kpi-staff-summary-label">Site</div>
            <div class="kpi-staff-summary-value">${currentSiteName || '-'}</div>
          </div>
          <div class="kpi-staff-total-wrap">
            <div class="kpi-staff-summary-label">Total</div>
            <div class="kpi-staff-total-value ${totalStatusClass}">${totalDone}/${totalKpis}</div>
          </div>
        </section>
        <div class="kpi-staff-categories">
          ${categoriesHtml}
        </div>
      </div>
    `;
  }

  // Render loading state
  renderLoading() {
    const container = document.getElementById('kpiCategories');
    if (!container) return;
    container.innerHTML = '<div class="kpi-loading"><div class="kpi-spinner"></div></div>';
  }

  // Render empty state
  renderEmpty() {
    const container = document.getElementById('kpiCategories');
    if (!container) return;
    container.innerHTML = `
      <div class="kpi-empty">
        <i class="fa-solid fa-folder-open"></i>
        <p>No KPI records found</p>
      </div>
    `;
  }
}

// KPI Manager - controls the panel
class KpiManager {
  constructor() {
    this.store = new KpiStore();
    this.ui = new KpiUI(this.store, this);

    // Get current month from global calendar or use current date
    this.currentSiteId = null;
    this.currentSiteName = null;
    this.currentMonth = new Date().getMonth() + 1;
    this.currentYear = new Date().getFullYear();
    this.currentYearMonth = this.getYearMonthString();
    this.isMonthChanging = false;
    this.isSupervisor = false;
    this.availableSites = [];
    this.viewMode = 'single';
    this.activePanel = 'tracking';
    this.isInfoEditMode = false;
    this.kpiInfoByKey = {};
    this.isKpiInfoLoaded = false;
    this.infoSelections = new Map();
  }

  // Get year-month string (e.g., "2026-01")
  getYearMonthString() {
    return `${this.currentYear}-${String(this.currentMonth).padStart(2, '0')}`;
  }

  shouldUseWideDialog() {
    if (this.activePanel === 'info') return true;
    return this.isSupervisor;
  }

  // Initialize with logged-in user
  initWithUser(user) {
    this.isSupervisor = user?.role === 'Supervisor';

    if (this.isSupervisor) {
      this.currentSiteId = null;
      this.currentSiteName = 'All Sites';
      this.viewMode = 'all';
      return;
    }

    this.viewMode = 'single';
    this.activePanel = 'tracking';
    this.isInfoEditMode = false;
    if (user && user.site_id) {
      this.currentSiteId = user.site_id;
      this.currentSiteName = user.site_name || '-';
    }
  }

  // Initialize (legacy - called on DOM ready but data loaded on open)
  async init() {
    // Site will be set when panel opens (based on currentLeaveUser)
    this.ui.renderSiteControl();
    this.ui.renderTabState();
  }

  async loadSites() {
    const { data, error } = await supabaseClient
      .from('sites')
      .select('site_id, site_name')
      .order('site_name');

    if (error) throw error;

    this.availableSites = data || [];
  }

  // Load data for current site and month
  async loadData() {
    if (!this.currentSiteId && this.viewMode !== 'all') return;

    this.ui.renderLoading();

    try {
      if (this.isSupervisor) {
        if (!this.availableSites.length) {
          await this.loadSites();
        }

        if (this.viewMode === 'all') {
          const siteIds = this.availableSites.map((site) => site.site_id);
          await this.store.loadForSitesMonth(siteIds, this.currentYearMonth);
        } else {
          await this.store.loadForSiteMonth(this.currentSiteId, this.currentYearMonth);
        }
      } else {
        await this.store.loadForSiteMonth(this.currentSiteId, this.currentYearMonth);
      }
    } catch (error) {
      console.error('Error loading KPI data:', error);
      this.ui.renderEmpty();
      return;
    }

    this.ui.renderMonthDisplay();
    this.ui.renderSiteControl();
    this.ui.renderTabState();
    this.ui.updateDialogWidth(this.shouldUseWideDialog());
    await this.renderActivePanel();
    this.updateBadge();
  }

  async renderActivePanel() {
    if (this.activePanel === 'info') {
      await this.ensureKpiInfoLoaded();
      this.ui.renderKpiInfoPanel();
      return;
    }
    await this.ui.renderCategories();
  }

  async ensureKpiInfoLoaded(force = false) {
    if (this.isKpiInfoLoaded && !force) return;
    this.kpiInfoByKey = await this.store.loadKpiInfoSettings();
    this.isKpiInfoLoaded = true;
  }

  // Open panel
  openPanel() {
    const overlay = document.getElementById('kpiOverlay');
    if (!overlay) return;

    overlay.classList.add('open');
    this.ui.updateDialogWidth(this.shouldUseWideDialog());
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  // Close panel
  closePanel() {
    const overlay = document.getElementById('kpiOverlay');
    if (!overlay) return;

    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  // Toggle panel
  togglePanel() {
    const overlay = document.getElementById('kpiOverlay');
    if (!overlay) return;

    if (overlay.classList.contains('open')) {
      this.closePanel();
    } else {
      this.openPanel();
    }
  }

  // Change month
  async changeMonth(direction) {
    if ((!this.currentSiteId && this.viewMode !== 'all') || this.isMonthChanging) return;

    const navDirection = direction === 'prev' ? 'prev' : 'next';
    this.isMonthChanging = true;
    this.ui.setMonthNavDisabled(true);
    this.ui.startMonthTransition(navDirection);

    if (direction === 'prev') {
      if (this.currentMonth === 1) {
        this.currentMonth = 12;
        this.currentYear--;
      } else {
        this.currentMonth--;
      }
    } else {
      if (this.currentMonth === 12) {
        this.currentMonth = 1;
        this.currentYear++;
      } else {
        this.currentMonth++;
      }
    }

    this.currentYearMonth = this.getYearMonthString();

    try {
      if (this.viewMode === 'all') {
        const siteIds = this.availableSites.map((site) => site.site_id);
        await this.store.loadForSitesMonth(siteIds, this.currentYearMonth);
      } else {
        await this.store.loadForSiteMonth(this.currentSiteId, this.currentYearMonth);
      }
      this.ui.renderMonthDisplay();
      this.ui.renderSiteControl();
      await this.renderActivePanel();
      this.ui.runMonthTransitionIn(navDirection);
      this.updateBadge();
    } finally {
      this.ui.setMonthNavDisabled(false);
      this.isMonthChanging = false;
    }
  }

  // Toggle category accordion
  toggleCategory(category) {
    if (this.ui.openCategories.has(category)) {
      this.ui.openCategories.delete(category);
    } else {
      this.ui.openCategories.add(category);
    }
    this.ui.renderCategories();
  }

  // Toggle KPI item
  async toggleKpiItem(category, sub, isDone) {
    if (!this.currentSiteId || this.viewMode === 'all') return;

    try {
      await this.store.toggleKpi(this.currentSiteId, category, sub, this.currentYearMonth, isDone);
      await this.ui.renderCategories(); // Re-render to update progress
      this.updateBadge();
    } catch (error) {
      console.error('Error toggling KPI:', error);
      // Re-render to revert checkbox state
      await this.ui.renderCategories();
    }
  }

  // Update badge count - shows remaining KPIs to complete
  updateBadge() {
    const badge = document.getElementById('kpiBadge');
    if (!badge) return;

    if (!this.currentSiteId || this.viewMode === 'all') {
      badge.classList.add('hidden');
      return;
    }

    let totalDone = 0;
    for (const category of Object.keys(kpiCategories)) {
      const progress = this.store.getCategoryProgress(this.currentSiteId, category, this.currentYearMonth);
      totalDone += progress.done;
    }

    const totalKPIs = Object.values(kpiCategories).reduce((sum, cat) => sum + cat.subs.length, 0);
    const remaining = totalKPIs - totalDone;

    // Show remaining count (default 13, subtract done)
    // When 0 remaining (all done), hide badge or show check
    if (remaining > 0) {
      badge.textContent = remaining;
      badge.classList.remove('hidden');
    } else {
      // All 13 done - show 13 with different style (optional: hide or show check)
      badge.textContent = totalKPIs;
      badge.classList.remove('hidden');
    }
  }

  getKpiInfoKey(category, sub) {
    return `${category}::${sub}`;
  }

  async setActivePanel(panel) {
    this.activePanel = panel === 'info' ? 'info' : 'tracking';
    if (this.activePanel !== 'info') {
      this.isInfoEditMode = false;
      this.infoSelections.clear();
    }
    this.ui.updateDialogWidth(this.shouldUseWideDialog());
    this.ui.renderTabState();
    await this.renderActivePanel();
  }

  normalizeInfoColor(color) {
    const value = typeof color === 'string' ? color.trim() : '';
    if (!value) return '';

    const withHash = value.startsWith('#') ? value : `#${value}`;
    const match = withHash.match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
    if (!match) return '';

    let hex = match[1];
    if (hex.length === 3) {
      hex = hex.split('').map((ch) => ch + ch).join('');
    }

    return `#${hex.toUpperCase()}`;
  }

  getInfoColorPickerValue(editorId) {
    const picker = document.getElementById(`${editorId}-color-picker`);
    const pickerColor = this.normalizeInfoColor(picker?.value || '');
    return pickerColor || '#1E293B';
  }

  syncInfoColorInputs(editorId, color) {
    const normalized = this.normalizeInfoColor(color);
    if (!normalized) return;

    const picker = document.getElementById(`${editorId}-color-picker`);
    const hexInput = document.getElementById(`${editorId}-color-hex`);
    if (picker) picker.value = normalized.toLowerCase();
    if (hexInput) hexInput.value = normalized;
  }

  captureInfoSelection(editorId) {
    const editor = document.getElementById(editorId);
    if (!editor || this.activePanel !== 'info' || !this.isInfoEditMode || typeof window.getSelection !== 'function') {
      return;
    }

    const selection = window.getSelection();
    if (!selection || selection.rangeCount < 1) return;

    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer;
    if (!editor.contains(container) && container !== editor) return;

    this.infoSelections.set(editorId, range.cloneRange());
  }

  restoreInfoSelection(editorId) {
    const editor = document.getElementById(editorId);
    if (!editor || typeof window.getSelection !== 'function') return false;

    const selection = window.getSelection();
    if (!selection) return false;

    const savedRange = this.infoSelections.get(editorId);
    if (savedRange) {
      const container = savedRange.commonAncestorContainer;
      if (editor.contains(container) || container === editor) {
        selection.removeAllRanges();
        selection.addRange(savedRange);
        return true;
      }
    }

    const fallbackRange = document.createRange();
    fallbackRange.selectNodeContents(editor);
    fallbackRange.collapse(false);
    selection.removeAllRanges();
    selection.addRange(fallbackRange);
    return true;
  }

  applyInfoFormat(editorId, command) {
    const editor = document.getElementById(editorId);
    if (!editor || this.activePanel !== 'info' || !this.isInfoEditMode) return;
    editor.focus();
    this.restoreInfoSelection(editorId);
    document.execCommand(command, false, null);
    this.captureInfoSelection(editorId);
  }

  applyInfoLink(editorId) {
    const editor = document.getElementById(editorId);
    if (!editor || this.activePanel !== 'info' || !this.isInfoEditMode) return;
    editor.focus();
    this.restoreInfoSelection(editorId);
    const value = window.prompt('Enter URL (https://...)');
    if (!value) return;
    const url = value.trim();
    if (!url) return;
    editor.focus();
    this.restoreInfoSelection(editorId);
    document.execCommand('createLink', false, url);
    this.captureInfoSelection(editorId);
  }

  applyInfoColor(editorId, color) {
    const editor = document.getElementById(editorId);
    if (!editor || this.activePanel !== 'info' || !this.isInfoEditMode) return;
    const selectedColor = this.normalizeInfoColor(color);
    if (!selectedColor) return;
    editor.focus();
    this.restoreInfoSelection(editorId);
    document.execCommand('foreColor', false, selectedColor);
    this.syncInfoColorInputs(editorId, selectedColor);
    this.captureInfoSelection(editorId);
  }

  applyInfoHexColor(editorId, silent = false) {
    const input = document.getElementById(`${editorId}-color-hex`);
    if (!input || this.activePanel !== 'info' || !this.isInfoEditMode) return;

    const normalized = this.normalizeInfoColor(input.value);
    if (!normalized) {
      input.value = this.getInfoColorPickerValue(editorId);
      if (!silent && typeof showToast === 'function') {
        showToast('Use a valid hex color like #2563EB', 'error');
      }
      return;
    }

    this.applyInfoColor(editorId, normalized);
  }

  toggleInfoCardEdit(editorId, buttonElement) {
    if (!this.isInfoEditMode) return;
    const editor = document.getElementById(editorId);
    const toolbar = document.getElementById(`${editorId}-toolbar`);
    if (!editor) return;

    const isEditing = editor.getAttribute('contenteditable') === 'true';
    const nextEditing = !isEditing;
    editor.setAttribute('contenteditable', nextEditing ? 'true' : 'false');

    if (toolbar) {
      toolbar.classList.toggle('hidden', !nextEditing);
    }

    if (buttonElement) {
      buttonElement.innerHTML = nextEditing
        ? '<i class="fa-solid fa-check"></i><span>Done</span>'
        : '<i class="fa-solid fa-pen"></i><span>Edit</span>';
      buttonElement.classList.toggle('active', nextEditing);
    }

    if (nextEditing) {
      editor.focus();
    }
  }

  async saveInfoContent() {
    if (this.activePanel !== 'info' || !this.isSupervisor) return;

    if (!this.isInfoEditMode) {
      this.isInfoEditMode = true;
      this.ui.renderTabState();
      this.ui.renderKpiInfoPanel();
      return;
    }

    const editors = Array.from(document.querySelectorAll('.kpi-info-editor[data-kpi-key]'));
    const nextInfoByKey = {};

    for (const editor of editors) {
      const key = editor.getAttribute('data-kpi-key');
      if (!key) continue;
      const raw = editor.innerHTML || '';
      const safe = sanitizeKpiInfoHtml(raw);
      const plain = safe.replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').trim();
      if (plain) {
        nextInfoByKey[key] = safe;
      }
    }

    try {
      await this.store.saveKpiInfoSettings(nextInfoByKey);
      this.kpiInfoByKey = nextInfoByKey;
      this.isKpiInfoLoaded = true;
      this.isInfoEditMode = false;
      this.ui.renderTabState();
      this.ui.renderKpiInfoPanel();
      if (typeof showToast === 'function') {
        showToast('KPI information saved', 'success');
      }
    } catch (error) {
      if (typeof showToast === 'function') {
        showToast('Failed to save KPI information', 'error');
      }
    }
  }
}

// Global instance
let kpiManager;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
  kpiManager = new KpiManager();
  await kpiManager.init();

  // Check if user is already logged in (from previous session)
  // and load KPI data to show badge
  if (typeof currentLeaveUser !== 'undefined' && currentLeaveUser && currentLeaveUser.site_id) {
    kpiManager.initWithUser(currentLeaveUser);
    await kpiManager.loadData();
  }
});

// Handle KPI button click - check login first
function handleKpiButtonClick() {
  // Check if user is logged in (currentLeaveUser is defined in leave-integrated.js)
  if (typeof currentLeaveUser === 'undefined' || !currentLeaveUser) {
    // Show login modal first
    if (typeof showLeaveLogin === 'function') {
      showLeaveLogin();
    }
    return;
  }

  // Set the site from logged-in user
  kpiManager.initWithUser(currentLeaveUser);

  // Load data and open panel
  kpiManager.loadData().then(() => {
    kpiManager.openPanel();
  });
}

// Global functions for onclick handlers
function toggleKpiPanel() {
  if (kpiManager) {
    kpiManager.togglePanel();
  }
}

function closeKpiPanel() {
  if (kpiManager) {
    kpiManager.closePanel();
  }
}

function changeKpiMonth(direction) {
  if (kpiManager) {
    kpiManager.changeMonth(direction);
  }
}

function switchKpiPanelTab(panel) {
  if (!kpiManager) return;

  const nextPanel = panel || (kpiManager.activePanel === 'info' ? 'tracking' : 'info');
  kpiManager.setActivePanel(nextPanel);
}

function saveKpiInfoContent() {
  if (kpiManager) {
    kpiManager.saveInfoContent();
  }
}

// Handle escape key
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    const overlay = document.getElementById('kpiOverlay');
    if (overlay && overlay.classList.contains('open')) {
      closeKpiPanel();
    }
  }
});
