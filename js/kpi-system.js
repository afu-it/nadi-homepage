/* ============================================
   KPI Tracking System
   ============================================ */

const KPI_TABLE = 'kpi_records';
const KPI_SELECT_COLUMNS = 'id,site_id,kpi_category,kpi_sub,year_month,is_done,completed_at,updated_at';
const KPI_INFO_SETTINGS_ID = 31;

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
  isDone(siteId, category, sub, yearMonth) {
    const key = this.getKey(siteId, category, sub, yearMonth);
    const record = this.records.get(key);
    return record && record.is_done;
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
    dialog.classList.toggle('kpi-dialog-wide', Boolean(isWide));
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
    }

    if (saveBtn) {
      saveBtn.classList.toggle('hidden', !isInfo);
      if (isInfo) {
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

    const allSubKpis = this.getAllSubKpis();
    const isEditable = this.manager.isInfoEditMode;

    const cardsHtml = allSubKpis.map((item, index) => {
      const key = this.manager.getKpiInfoKey(item.category, item.sub);
      const rawHtml = this.manager.kpiInfoByKey[key] || '';
      const safeHtml = typeof sanitizeHTMLWithLinks === 'function' ? sanitizeHTMLWithLinks(rawHtml) : rawHtml;
      const editorId = `kpiInfoEditor-${index}`;

      if (isEditable) {
        return `
          <section class="kpi-info-card">
            <div class="kpi-info-header">
              <div class="kpi-info-title-wrap">
                <span class="kpi-info-index">${index + 1}</span>
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
            </div>
            <div
              id="${editorId}"
              class="kpi-info-editor"
              data-kpi-key="${key}"
              contenteditable="true"
              spellcheck="true"
            >${safeHtml}</div>
          </section>
        `;
      }

      return `
        <section class="kpi-info-card">
          <div class="kpi-info-header">
            <div class="kpi-info-title-wrap">
              <span class="kpi-info-index">${index + 1}</span>
              <div>
                <div class="kpi-info-title">${this.getShortSubLabel(item.sub)}</div>
                <div class="kpi-info-subtitle">${item.sub}</div>
              </div>
            </div>
            <span class="kpi-info-category kpi-info-category-${item.category}">${kpiCategories[item.category]?.label || item.category}</span>
          </div>
          <div class="kpi-info-view">${safeHtml || '<span class="kpi-info-empty">No information yet.</span>'}</div>
        </section>
      `;
    }).join('');

    container.innerHTML = `<div class="kpi-info-grid">${cardsHtml}</div>`;
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

    if (this.manager.viewMode === 'all') {
      container.innerHTML = this.renderAllSitesMatrix();
      return;
    }

    container.innerHTML = this.renderSingleSiteMatrix();
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

  renderAllSitesMatrix() {
    const allSubKpis = this.getAllSubKpis();
    const { availableSites, currentYearMonth } = this.manager;
    const categoryGroups = Object.entries(kpiCategories).map(([key, info]) => ({
      key,
      label: info.label,
      count: info.subs.length
    }));

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
              ${allSubKpis.map((item, index) => `<th class="kpi-matrix-col-${item.category}" title="${item.sub}"><div class="kpi-matrix-head"><span class="kpi-matrix-head-num">${index + 1}</span><span class="kpi-matrix-head-text">${this.getShortSubLabel(item.sub)}</span></div></th>`).join('')}
            </tr>
          </thead>
          <tbody>
    `;

    for (const site of availableSites) {
      let doneCount = 0;
      const rowCells = allSubKpis.map((item) => {
        const done = this.store.isDone(site.site_id, item.category, item.sub, currentYearMonth);
        if (done) doneCount++;
        return `<td class="kpi-matrix-col-${item.category}"><span class="kpi-matrix-dot ${done ? 'done' : ''}" title="${done ? 'Done' : 'Pending'}"></span></td>`;
      }).join('');

      html += `
        <tr>
          <td class="kpi-matrix-site">${site.site_name}</td>
          ${rowCells}
          <td class="kpi-matrix-total">${doneCount}/13</td>
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

    const allSubKpis = this.getAllSubKpis();
    const categoryGroups = Object.entries(kpiCategories).map(([key, info]) => ({
      key,
      label: info.label,
      count: info.subs.length
    }));

    let doneCount = 0;
    const rowCells = allSubKpis.map((item) => {
      const done = this.store.isDone(currentSiteId, item.category, item.sub, currentYearMonth);
      if (done) doneCount++;
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
              ${allSubKpis.map((item, index) => `<th class="kpi-matrix-col-${item.category}" title="${item.sub}"><div class="kpi-matrix-head"><span class="kpi-matrix-head-num">${index + 1}</span><span class="kpi-matrix-head-text">${this.getShortSubLabel(item.sub)}</span></div></th>`).join('')}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="kpi-matrix-site">${currentSiteName || '-'}</td>
              ${rowCells}
              <td class="kpi-matrix-total">${doneCount}/13</td>
            </tr>
          </tbody>
        </table>
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
  }

  // Get year-month string (e.g., "2026-01")
  getYearMonthString() {
    return `${this.currentYear}-${String(this.currentMonth).padStart(2, '0')}`;
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
    this.ui.updateDialogWidth(true);
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
    this.ui.updateDialogWidth(true);
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
    }
    this.ui.renderTabState();
    await this.renderActivePanel();
  }

  applyInfoFormat(editorId, command) {
    const editor = document.getElementById(editorId);
    if (!editor || this.activePanel !== 'info' || !this.isInfoEditMode) return;
    editor.focus();
    document.execCommand(command, false, null);
  }

  applyInfoLink(editorId) {
    const editor = document.getElementById(editorId);
    if (!editor || this.activePanel !== 'info' || !this.isInfoEditMode) return;
    const value = window.prompt('Enter URL (https://...)');
    if (!value) return;
    const url = value.trim();
    if (!url) return;
    editor.focus();
    document.execCommand('createLink', false, url);
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
    if (this.activePanel !== 'info') return;

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
      const safe = typeof sanitizeHTMLWithLinks === 'function' ? sanitizeHTMLWithLinks(raw) : raw;
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
