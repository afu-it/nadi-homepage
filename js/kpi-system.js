/* ============================================
   KPI Tracking System
   ============================================ */

const KPI_TABLE = 'kpi_records';

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

  // Get records key
  getKey(siteId, category, sub, yearMonth) {
    return `${siteId}-${category}-${sub}-${yearMonth}`;
  }

  // Load KPI records for a site and month
  async loadForSiteMonth(siteId, yearMonth) {
    try {
      const { data, error } = await supabaseClient
        .from(KPI_TABLE)
        .select('*')
        .eq('site_id', siteId)
        .eq('year_month', yearMonth);

      if (error) throw error;

      // Build records map
      this.records.clear();
      for (const record of data || []) {
        const key = this.getKey(record.site_id, record.kpi_category, record.kpi_sub, record.year_month);
        this.records.set(key, record);
      }

      return data || [];
    } catch (error) {
      console.error('Error loading KPI records:', error);
      return [];
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

  // Render site label (for logged-in user)
  renderSiteLabel() {
    const label = document.getElementById('kpiSiteLabel');
    if (!label) return;

    const siteName = this.manager.currentSiteName || '-';
    label.textContent = siteName;
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

    const { currentSiteId, currentYearMonth } = this.manager;

    let html = '<div class="kpi-categories-grid">';
    for (const [category, info] of Object.entries(kpiCategories)) {
      const progress = this.store.getCategoryProgress(currentSiteId, category, currentYearMonth);
      const isComplete = progress.done === progress.total;

      html += `
        <div class="kpi-category">
          <div class="kpi-category-header">
            <div class="kpi-category-left">
              <div class="kpi-category-color kpi-color-${category}"></div>
              <span class="kpi-category-title">${info.label}</span>
            </div>
            <div class="kpi-category-right">
              <span class="kpi-category-progress ${isComplete ? 'complete' : ''}">${progress.done}/${progress.total}</span>
            </div>
          </div>
          <div class="kpi-category-body">
            ${info.subs.map(sub => {
              const isDone = this.store.isDone(currentSiteId, category, sub, currentYearMonth);
              const formattedLabel = this.formatLabel(category, sub);
              return `
                <label class="kpi-item" style="cursor: pointer;">
                  <input type="checkbox" class="kpi-checkbox kpi-checkbox-${category}"
                    ${isDone ? 'checked' : ''}
                    onchange="kpiManager.toggleKpiItem('${category}', '${sub.replace(/'/g, "\\'")}', this.checked)"
                  >
                  <span class="kpi-item-label">${formattedLabel}</span>
                </label>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }
    html += '</div>';

    container.innerHTML = html;
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
  }

  // Get year-month string (e.g., "2026-01")
  getYearMonthString() {
    return `${this.currentYear}-${String(this.currentMonth).padStart(2, '0')}`;
  }

  // Initialize with logged-in user
  initWithUser(user) {
    if (user && user.site_id) {
      this.currentSiteId = user.site_id;
      this.currentSiteName = user.site_name || '-';
    }
  }

  // Initialize (legacy - called on DOM ready but data loaded on open)
  async init() {
    // Site will be set when panel opens (based on currentLeaveUser)
    this.ui.renderSiteLabel();
  }

  // Load data for current site and month
  async loadData() {
    if (!this.currentSiteId) return;

    this.ui.renderLoading();
    await this.store.loadForSiteMonth(this.currentSiteId, this.currentYearMonth);
    this.ui.renderMonthDisplay();
    this.ui.renderSiteLabel();
    await this.ui.renderCategories();
    this.updateBadge();
  }

  // Open panel
  openPanel() {
    const overlay = document.getElementById('kpiOverlay');
    if (!overlay) return;

    overlay.classList.add('open');
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
    if (!this.currentSiteId || this.isMonthChanging) return;

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
      await this.store.loadForSiteMonth(this.currentSiteId, this.currentYearMonth);
      this.ui.renderMonthDisplay();
      this.ui.renderSiteLabel();
      await this.ui.renderCategories();
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
    if (!this.currentSiteId) return;

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

// Handle escape key
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    const overlay = document.getElementById('kpiOverlay');
    if (overlay && overlay.classList.contains('open')) {
      closeKpiPanel();
    }
  }
});
