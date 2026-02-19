/**
 * NADI Reminder System
 * Panel-based reminder UI
 */

const REMINDER_TABLE = 'reminders';

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function linkifyText(value) {
  const escaped = escapeHtml(value);
  return escaped.replace(
    /(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
  );
}

function getSupabaseClient() {
  if (typeof window.supabaseClient !== 'undefined') {
    return window.supabaseClient;
  }
  return null;
}

// ============================================
// Data Management
// ============================================

class ReminderStore {
  constructor() {
    this.storageKey = 'nadi_reminders';
    this.data = this.loadLocal();
  }

  loadLocal() {
    try {
      const stored = window.safeStorage.getItem(this.storageKey);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Error loading reminders:', error);
    }
    return { weekly: [], monthly: [], quarterly: [] };
  }

  saveLocal() {
    try {
      window.safeStorage.setItem(this.storageKey, JSON.stringify(this.data));
    } catch (error) {
      console.error('Error saving reminders:', error);
    }
  }

  mapRowToReminder(row) {
    const base = {
      id: row.id,
      title: row.title,
      description: row.description || '',
      createdAt: row.created_at
    };

    if (row.type === 'weekly') {
      return { ...base, type: 'weekly', day: row.day_of_week ?? 0 };
    }

    if (row.type === 'monthly') {
      return { ...base, type: 'monthly' };
    }

    return { ...base, type: 'quarterly', month: row.quarter_month ?? 3 };
  }

  async syncFromSupabase() {
    const client = getSupabaseClient();
    if (!client) return;

    try {
      const { data, error } = await client
        .from(REMINDER_TABLE)
        .select('id,type,title,description,day_of_week,quarter_month,created_at')
        .order('created_at', { ascending: true });

      if (error) throw error;

      this.data = { weekly: [], monthly: [], quarterly: [] };

      (data || []).forEach((row) => {
        const mapped = this.mapRowToReminder(row);
        if (mapped.type === 'weekly') {
          this.data.weekly.push(mapped);
        } else if (mapped.type === 'monthly') {
          this.data.monthly.push(mapped);
        } else {
          this.data.quarterly.push(mapped);
        }
      });

      this.saveLocal();
    } catch (error) {
      console.error('Error loading reminders:', error);
      if (typeof showToast === 'function') {
        showToast('Unable to load reminders', 'error');
      }
    }
  }

  async add(type, reminder) {
    const client = getSupabaseClient();
    if (!client) {
      reminder.id = Date.now().toString();
      reminder.createdAt = new Date().toISOString();
      this.data[type].push(reminder);
      this.saveLocal();
      return reminder;
    }

    try {
      const payload = {
        type,
        title: reminder.title,
        description: reminder.description || null,
        day_of_week: type === 'weekly' ? Number(reminder.day) : null,
        quarter_month: type === 'quarterly' ? Number(reminder.month) : null
      };

      const { data, error } = await client
        .from(REMINDER_TABLE)
        .insert(payload)
        .select('id,type,title,description,day_of_week,quarter_month,created_at')
        .single();

      if (error) throw error;

      const stored = this.mapRowToReminder(data);
      if (stored.type === 'weekly') {
        this.data.weekly.push(stored);
      } else if (stored.type === 'monthly') {
        this.data.monthly.push(stored);
      } else {
        this.data.quarterly.push(stored);
      }

      this.saveLocal();
      return stored;
    } catch (error) {
      console.error('Error saving reminder:', error);
      if (typeof showToast === 'function') {
        showToast('Unable to save reminder', 'error');
      }
      return null;
    }
  }

  async remove(type, id) {
    const client = getSupabaseClient();
    if (!client) {
      this.data[type] = this.data[type].filter(r => r.id !== id);
      this.saveLocal();
      return true;
    }

    try {
      const { error } = await client
        .from(REMINDER_TABLE)
        .delete()
        .eq('id', id);

      if (error) throw error;

      this.data[type] = this.data[type].filter(r => r.id !== id);
      this.saveLocal();
      return true;
    } catch (error) {
      console.error('Error deleting reminder:', error);
      if (typeof showToast === 'function') {
        showToast('Unable to delete reminder', 'error');
      }
      return false;
    }
  }

  getAll(type) {
    return this.data[type] || [];
  }

  find(type, id) {
    return (this.data[type] || []).find((reminder) => reminder.id === id);
  }

  async update(type, id, updates) {
    const existing = this.find(type, id);
    if (!existing) return null;

    const client = getSupabaseClient();
    if (!client) {
      Object.assign(existing, updates);
      this.saveLocal();
      return existing;
    }

    try {
      const payload = {
        title: updates.title,
        description: updates.description || null,
        day_of_week: type === 'weekly' ? Number(updates.day) : null,
        quarter_month: type === 'quarterly' ? Number(updates.month) : null
      };

      const { data, error } = await client
        .from(REMINDER_TABLE)
        .update(payload)
        .eq('id', id)
        .select('id,type,title,description,day_of_week,quarter_month,created_at');

      if (error) throw error;

      let updatedRow = Array.isArray(data) ? data[0] : data;
      if (!updatedRow) {
        throw new Error('Update blocked or no matching reminder row. Check Supabase UPDATE policy.');
      }

      const mapped = this.mapRowToReminder(updatedRow);
      Object.assign(existing, mapped);
      this.saveLocal();
      return existing;
    } catch (error) {
      console.error('Error updating reminder:', error);
      if (typeof showToast === 'function') {
        const message = String(error && error.message ? error.message : '');
        if (message.includes('Update blocked')) {
          showToast('Supabase update is blocked. Add UPDATE policy for reminders.', 'error');
        } else {
          showToast('Unable to update reminder', 'error');
        }
      }
      return null;
    }
  }

  getAllReminders() {
    return [
      ...this.data.weekly.map(r => ({ ...r, type: 'weekly' })),
      ...this.data.monthly.map(r => ({ ...r, type: 'monthly' })),
      ...this.data.quarterly.map(r => ({ ...r, type: 'quarterly' }))
    ];
  }
}

// ============================================
// Date Utilities
// ============================================

class DateUtils {
  static getNextWeeklyOccurrence(dayOfWeek) {
    const now = new Date();
    const currentDay = now.getDay();
    const targetDay = parseInt(dayOfWeek);
    
    let daysUntil = targetDay - currentDay;
    if (daysUntil < 0) {
      daysUntil += 7;
    }
    
    const nextDate = new Date(now);
    nextDate.setDate(now.getDate() + daysUntil);
    nextDate.setHours(0, 0, 0, 0);
    
    return nextDate;
  }

  static getNextMonthlyOccurrence() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const lastDay = new Date(year, month + 1, 0).getDate();
    const nextDate = new Date(year, month, lastDay);
    nextDate.setHours(0, 0, 0, 0);
    
    if (nextDate < now) {
      const nextMonth = new Date(year, month + 1, 0).getDate();
      return new Date(year, month + 1, nextMonth);
    }
    
    return nextDate;
  }

  static getNextQuarterlyOccurrence(quarterMonth) {
    const now = new Date();
    const year = now.getFullYear();
    const month = parseInt(quarterMonth) - 1;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const nextDate = new Date(year, month, lastDay);
    nextDate.setHours(0, 0, 0, 0);
    
    if (nextDate < now) {
      const nextYear = month === 11 ? year + 1 : year;
      const nextQuarterMonth = month === 11 ? 0 : month;
      const nextLastDay = new Date(nextYear, nextQuarterMonth + 1, 0).getDate();
      return new Date(nextYear, nextQuarterMonth, nextLastDay);
    }
    
    return nextDate;
  }

  static calculateCountdown(targetDate) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    
    const target = new Date(targetDate);
    target.setHours(0, 0, 0, 0);
    
    const diff = target - now;
    
    if (diff < 0) {
      return { text: 'Overdue', isDue: true, days: 0 };
    }
    
    if (diff === 0) {
      return { text: 'Due Today', isDue: true, days: 0 };
    }
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days < 7) {
      return { text: `${days}d`, isDue: false, days };
    }
    
    const weeks = Math.floor(days / 7);
    const remainingDays = days % 7;
    
    if (remainingDays === 0) {
      return { text: `${weeks}w`, isDue: false, days };
    }
    
    return { text: `${weeks}w ${remainingDays}d`, isDue: false, days };
  }

  static getDayName(dayNum) {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[dayNum];
  }

  static getQuarterName(month) {
    const quarters = { 3: 'Q1', 6: 'Q2', 9: 'Q3', 12: 'Q4' };
    return quarters[month];
  }

  static formatDate(date) {
    return new Date(date).toLocaleDateString('en-MY', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }
}

// ============================================
// UI Rendering
// ============================================

class ReminderUI {
  constructor(store) {
    this.store = store;
  }

  getTypeLabel(type) {
    if (type === 'weekly') return 'Weekly';
    if (type === 'monthly') return 'Monthly';
    return 'Quarterly';
  }

  getReminderMeta(reminder) {
    if (reminder.type === 'weekly') {
      const nextDate = DateUtils.getNextWeeklyOccurrence(reminder.day);
      return {
        nextDate,
        countdown: DateUtils.calculateCountdown(nextDate),
        scheduleLabel: DateUtils.getDayName(reminder.day),
        chipClass: 'reminder-chip-weekly',
        iconClass: 'fa-calendar-week'
      };
    }

    if (reminder.type === 'monthly') {
      const nextDate = DateUtils.getNextMonthlyOccurrence();
      return {
        nextDate,
        countdown: DateUtils.calculateCountdown(nextDate),
        scheduleLabel: 'Month End',
        chipClass: 'reminder-chip-monthly',
        iconClass: 'fa-calendar-day'
      };
    }

    const nextDate = DateUtils.getNextQuarterlyOccurrence(reminder.month);
    return {
      nextDate,
      countdown: DateUtils.calculateCountdown(nextDate),
      scheduleLabel: DateUtils.getQuarterName(reminder.month),
      chipClass: 'reminder-chip-quarterly',
      iconClass: 'fa-calendar'
    };
  }

  init() {
    this.renderAllSections();
    this.updateMarquee();
    this.updateBadge();
    this.updateSummary();
    this.startCountdownUpdates();
  }

  renderAllSections() {
    this.renderDueToday();
    this.renderWeekly();
    this.renderMonthly();
    this.renderQuarterly();
    this.updateSummary();
  }

  renderDueToday() {
    const container = document.getElementById('dueRemindersList');
    const emptyState = document.getElementById('noDueReminders');
    if (!container || !emptyState) return;

    const dueReminders = this.getDueReminders();

    if (dueReminders.length === 0) {
      container.innerHTML = '';
      emptyState.classList.remove('hidden');
      return;
    }

    emptyState.classList.add('hidden');
    container.innerHTML = dueReminders.map((reminder) => {
      const meta = this.getReminderMeta(reminder);
      const title = escapeHtml(reminder.title);
      const description = reminder.description
        ? linkifyText(reminder.description).replace(/\n/g, '<br>')
        : '';
      const typeLabel = this.getTypeLabel(reminder.type);

      return `
        <article class="reminder-item reminder-item-due">
          <div class="reminder-item-actions">
            <button
              onclick="editReminder('${reminder.type}', '${reminder.id}')"
              class="reminder-action reminder-action-edit"
              title="Edit reminder"
            >
              <i class="fa-solid fa-pen"></i>
            </button>
            <button
              onclick="reminderManager.deleteReminder('${reminder.type}', '${reminder.id}')"
              class="reminder-action"
              title="Delete reminder"
            >
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
          <div class="reminder-item-date">${DateUtils.formatDate(meta.nextDate)}</div>
          <div class="reminder-item-title">${title}</div>
          ${description ? `<div class="reminder-item-description">${description}</div>` : ''}
          <div class="reminder-item-meta">
            <span class="reminder-chip ${meta.chipClass}">
              <i class="fa-solid ${meta.iconClass}"></i>
              ${meta.scheduleLabel}
            </span>
            <span class="reminder-chip">
              <i class="fa-solid fa-layer-group"></i>
              ${typeLabel}
            </span>
            <span class="reminder-countdown reminder-countdown-due">
              <i class="fa-solid fa-clock"></i>
              ${meta.countdown.text}
            </span>
          </div>
        </article>
      `;
    }).join('');
  }

  renderWeekly() {
    const container = document.getElementById('weeklyRemindersList');
    const emptyState = document.getElementById('noWeeklyReminders');
    const reminders = this.store.getAll('weekly');
    
    if (reminders.length === 0) {
      container.innerHTML = '';
      emptyState.classList.remove('hidden');
      return;
    }
    
    emptyState.classList.add('hidden');
    container.innerHTML = reminders.map(reminder => {
      const meta = this.getReminderMeta({ ...reminder, type: 'weekly' });
      const title = escapeHtml(reminder.title);
      const description = reminder.description
        ? linkifyText(reminder.description).replace(/\n/g, '<br>')
        : '';

      return `
        <article class="reminder-item reminder-item-weekly ${meta.countdown.isDue ? 'reminder-item-due' : ''}">
          <div class="reminder-item-actions">
            <button
              onclick="editReminder('weekly', '${reminder.id}')"
              class="reminder-action reminder-action-edit"
              title="Edit reminder"
            >
              <i class="fa-solid fa-pen"></i>
            </button>
            <button
              onclick="reminderManager.deleteReminder('weekly', '${reminder.id}')"
              class="reminder-action"
              title="Delete reminder"
            >
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
          <div class="reminder-item-date">${DateUtils.formatDate(meta.nextDate)}</div>
          <div class="reminder-item-title">${title}</div>
          ${description ? `<div class="reminder-item-description">${description}</div>` : ''}
          <div class="reminder-item-meta">
            <span class="reminder-chip ${meta.chipClass}">
              <i class="fa-solid ${meta.iconClass}"></i>
              ${meta.scheduleLabel}
            </span>
            <span class="reminder-countdown ${meta.countdown.isDue ? 'reminder-countdown-due' : ''}">
              <i class="fa-solid fa-clock"></i>
              ${meta.countdown.text}
            </span>
          </div>
        </article>
      `;
    }).join('');
  }

  renderMonthly() {
    const container = document.getElementById('monthlyRemindersList');
    const emptyState = document.getElementById('noMonthlyReminders');
    const reminders = this.store.getAll('monthly');
    
    if (reminders.length === 0) {
      container.innerHTML = '';
      emptyState.classList.remove('hidden');
      return;
    }
    
    emptyState.classList.add('hidden');
    container.innerHTML = reminders.map(reminder => {
      const meta = this.getReminderMeta({ ...reminder, type: 'monthly' });
      const title = escapeHtml(reminder.title);
      const description = reminder.description
        ? linkifyText(reminder.description).replace(/\n/g, '<br>')
        : '';

      return `
        <article class="reminder-item reminder-item-monthly ${meta.countdown.isDue ? 'reminder-item-due' : ''}">
          <div class="reminder-item-actions">
            <button
              onclick="editReminder('monthly', '${reminder.id}')"
              class="reminder-action reminder-action-edit"
              title="Edit reminder"
            >
              <i class="fa-solid fa-pen"></i>
            </button>
            <button
              onclick="reminderManager.deleteReminder('monthly', '${reminder.id}')"
              class="reminder-action"
              title="Delete reminder"
            >
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
          <div class="reminder-item-date">${DateUtils.formatDate(meta.nextDate)}</div>
          <div class="reminder-item-title">${title}</div>
          ${description ? `<div class="reminder-item-description">${description}</div>` : ''}
          <div class="reminder-item-meta">
            <span class="reminder-chip ${meta.chipClass}">
              <i class="fa-solid ${meta.iconClass}"></i>
              ${meta.scheduleLabel}
            </span>
            <span class="reminder-countdown ${meta.countdown.isDue ? 'reminder-countdown-due' : ''}">
              <i class="fa-solid fa-clock"></i>
              ${meta.countdown.text}
            </span>
          </div>
        </article>
      `;
    }).join('');
  }

  renderQuarterly() {
    const container = document.getElementById('quarterlyRemindersList');
    const emptyState = document.getElementById('noQuarterlyReminders');
    const reminders = this.store.getAll('quarterly');
    
    if (reminders.length === 0) {
      container.innerHTML = '';
      emptyState.classList.remove('hidden');
      return;
    }
    
    emptyState.classList.add('hidden');
    container.innerHTML = reminders.map(reminder => {
      const meta = this.getReminderMeta({ ...reminder, type: 'quarterly' });
      const title = escapeHtml(reminder.title);
      const description = reminder.description
        ? linkifyText(reminder.description).replace(/\n/g, '<br>')
        : '';

      return `
        <article class="reminder-item reminder-item-quarterly ${meta.countdown.isDue ? 'reminder-item-due' : ''}">
          <div class="reminder-item-actions">
            <button
              onclick="editReminder('quarterly', '${reminder.id}')"
              class="reminder-action reminder-action-edit"
              title="Edit reminder"
            >
              <i class="fa-solid fa-pen"></i>
            </button>
            <button
              onclick="reminderManager.deleteReminder('quarterly', '${reminder.id}')"
              class="reminder-action"
              title="Delete reminder"
            >
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
          <div class="reminder-item-date">${DateUtils.formatDate(meta.nextDate)}</div>
          <div class="reminder-item-title">${title}</div>
          ${description ? `<div class="reminder-item-description">${description}</div>` : ''}
          <div class="reminder-item-meta">
            <span class="reminder-chip ${meta.chipClass}">
              <i class="fa-solid ${meta.iconClass}"></i>
              ${meta.scheduleLabel}
            </span>
            <span class="reminder-countdown ${meta.countdown.isDue ? 'reminder-countdown-due' : ''}">
              <i class="fa-solid fa-clock"></i>
              ${meta.countdown.text}
            </span>
          </div>
        </article>
      `;
    }).join('');
  }

  getDueReminders() {
    const allReminders = this.store.getAllReminders();
    return allReminders.filter(reminder => {
      return this.getReminderMeta(reminder).countdown.isDue;
    });
  }

  updateMarquee() {
    const marquee = document.getElementById('reminderMarquee');
    const content = document.getElementById('reminderMarqueeContent');
    const windowEl = marquee ? marquee.querySelector('.reminder-marquee-window') : null;
    if (!marquee || !content) return;

    const dueReminders = this.getDueReminders();

    if (dueReminders.length === 0) {
      marquee.classList.add('hidden');
      return;
    }

    const items = dueReminders.map(reminder => {
      return `<span class="reminder-marquee-item">${escapeHtml(reminder.title)}</span>`;
    });
    const baseRow = items.join('<span class="reminder-marquee-sep">•</span>');
    content.style.setProperty('--marquee-distance', '0px');
    content.style.setProperty('--marquee-start', '0px');
    content.style.setProperty('--marquee-duration', '12s');
    content.innerHTML = `<span class="reminder-marquee-track-inner">${baseRow}</span>`;

    requestAnimationFrame(() => {
      const seq = content.querySelector('.reminder-marquee-track-inner');
      if (!seq || !windowEl) return;

      const windowWidth = windowEl.getBoundingClientRect().width;
      const baseWidth = seq.getBoundingClientRect().width;
      const speedPxPerSec = 60;

      if (dueReminders.length === 1) {
        const distance = windowWidth + baseWidth;
        const duration = Math.max(distance / speedPxPerSec, 8);
        content.innerHTML = `<span class="reminder-marquee-track-inner">${baseRow}</span>`;
        content.style.setProperty('--marquee-start', `${windowWidth}px`);
        content.style.setProperty('--marquee-distance', `${distance}px`);
        content.style.setProperty('--marquee-duration', `${duration}s`);
        return;
      }

      let row = baseRow;
      if (baseWidth < windowWidth) {
        const repeatTimes = Math.ceil(windowWidth / Math.max(baseWidth, 1));
        row = Array(repeatTimes).fill(baseRow).join('<span class="reminder-marquee-sep">•</span>');
      }

      content.innerHTML = `<span class="reminder-marquee-track-inner">${row}</span><span class="reminder-marquee-track-inner" aria-hidden="true">${row}</span>`;

      const trackWidth = content.querySelector('.reminder-marquee-track-inner').getBoundingClientRect().width;
      const duration = Math.max(trackWidth / speedPxPerSec, 8);
      content.style.setProperty('--marquee-start', '0px');
      content.style.setProperty('--marquee-distance', `${trackWidth}px`);
      content.style.setProperty('--marquee-duration', `${duration}s`);
    });

    marquee.classList.remove('hidden');
  }

  updateSummary() {
    const weeklyCount = document.getElementById('reminderCountWeekly');
    const monthlyCount = document.getElementById('reminderCountMonthly');
    const quarterlyCount = document.getElementById('reminderCountQuarterly');
    const dueCount = document.getElementById('reminderCountDue');

    if (weeklyCount) weeklyCount.textContent = this.store.getAll('weekly').length;
    if (monthlyCount) monthlyCount.textContent = this.store.getAll('monthly').length;
    if (quarterlyCount) quarterlyCount.textContent = this.store.getAll('quarterly').length;
    if (dueCount) dueCount.textContent = this.getDueReminders().length;
  }

  updateBadge() {
    const badge = document.getElementById('reminderBadge');
    if (!badge) return;

    const dueReminders = this.getDueReminders();
    const lastReadTime = localStorage.getItem('nadi_reminders_last_read');
    let unreadCount = 0;

    dueReminders.forEach(reminder => {
      const reminderTime = new Date(reminder.nextDate + 'T00:00:00').getTime();
      if (!lastReadTime || reminderTime > parseInt(lastReadTime)) {
        unreadCount++;
      }
    });

    if (unreadCount > 0) {
      badge.textContent = unreadCount;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }

  startCountdownUpdates() {
    setInterval(() => {
      this.renderAllSections();
      this.updateMarquee();
      this.updateBadge();
    }, 60000); // Update every minute
  }
}

// ============================================
// Reminder Manager
// ============================================

class ReminderManager {
  constructor() {
    this.store = new ReminderStore();
    this.ui = new ReminderUI(this.store);
    this.editing = { weekly: null, monthly: null, quarterly: null };
    this.currentView = 'due';
  }

  async init() {
    await this.store.syncFromSupabase();
    this.ui.init();
    this.switchView('due');
  }

  getTypeLabel(type) {
    return type;
  }

  getViewDomId(view) {
    if (view === 'due') return 'reminderViewDue';
    if (view === 'weekly') return 'reminderViewWeekly';
    if (view === 'monthly') return 'reminderViewMonthly';
    return 'reminderViewQuarterly';
  }

  getMenuDomId(view) {
    if (view === 'due') return 'reminderMenuDue';
    if (view === 'weekly') return 'reminderMenuWeekly';
    if (view === 'monthly') return 'reminderMenuMonthly';
    return 'reminderMenuQuarterly';
  }

  switchView(view) {
    const views = ['due', 'weekly', 'monthly', 'quarterly'];
    views.forEach((key) => {
      const viewEl = document.getElementById(this.getViewDomId(key));
      const menuEl = document.getElementById(this.getMenuDomId(key));

      if (viewEl) {
        if (key === view) {
          viewEl.classList.remove('hidden');
        } else {
          viewEl.classList.add('hidden');
        }
      }

      if (menuEl) {
        if (key === view) {
          menuEl.classList.add('reminder-menu-btn-active');
        } else {
          menuEl.classList.remove('reminder-menu-btn-active');
        }
      }
    });

    this.currentView = view;
  }

  setToggleButtonToAdd(type) {
    const button = document.getElementById(`show${type.charAt(0).toUpperCase() + type.slice(1)}FormBtn`);
    if (!button) return;
    const label = this.getTypeLabel(type);
    button.innerHTML = `<i class="fa-solid fa-plus"></i><span>Add ${label}</span>`;
  }

  setToggleButtonToHide(type) {
    const button = document.getElementById(`show${type.charAt(0).toUpperCase() + type.slice(1)}FormBtn`);
    if (!button) return;
    button.innerHTML = `<i class="fa-solid fa-minus"></i><span>Hide form</span>`;
  }

  setToggleButtonToCancelEdit(type) {
    const button = document.getElementById(`show${type.charAt(0).toUpperCase() + type.slice(1)}FormBtn`);
    if (!button) return;
    button.innerHTML = `<i class="fa-solid fa-xmark"></i><span>Cancel edit</span>`;
  }

  setSubmitButtonText(type, isEditing) {
    const button = document.getElementById(`${type}SubmitBtn`);
    if (!button) return;
    const label = this.getTypeLabel(type);
    if (isEditing) {
      button.innerHTML = `<i class="fa-solid fa-pen"></i>Update ${label} reminder`;
    } else {
      button.innerHTML = `<i class="fa-solid fa-check"></i>Save ${label} reminder`;
    }
  }

  clearEditing(type) {
    this.editing[type] = null;
    this.setSubmitButtonText(type, false);
  }

  toggleForm(type) {
    if (this.currentView !== type) {
      this.switchView(type);
    }

    const formContainer = document.getElementById(`${type}FormContainer`);
    const button = document.getElementById(`show${type.charAt(0).toUpperCase() + type.slice(1)}FormBtn`);

    const label = type === 'weekly' ? 'weekly' : type === 'monthly' ? 'monthly' : 'quarterly';

    if (formContainer.classList.contains('hidden')) {
      formContainer.classList.remove('hidden');
      if (this.editing[type]) {
        this.setToggleButtonToCancelEdit(type);
      } else {
        this.setToggleButtonToHide(type);
      }
    } else {
      formContainer.classList.add('hidden');
      if (this.editing[type]) {
        this.clearEditing(type);
      }
      button.innerHTML = `<i class="fa-solid fa-plus"></i><span>Add ${label}</span>`;
      this.clearForm(type);
    }
  }

  clearForm(type) {
    document.getElementById(`${type}Title`).value = '';
    document.getElementById(`${type}Description`).value = '';
    this.setSubmitButtonText(type, false);
    if (type === 'weekly') {
      document.getElementById('weeklyDay').value = '1';
    } else if (type === 'quarterly') {
      document.getElementById('quarterlyMonth').value = '3';
    }
  }

  startEdit(type, id) {
    const reminder = this.store.find(type, id);
    if (!reminder) return;
    this.switchView(type);

    const formContainer = document.getElementById(`${type}FormContainer`);
    if (formContainer) {
      formContainer.classList.remove('hidden');
    }

    document.getElementById(`${type}Title`).value = reminder.title || '';
    document.getElementById(`${type}Description`).value = reminder.description || '';

    if (type === 'weekly') {
      document.getElementById('weeklyDay').value = String(reminder.day ?? 1);
    } else if (type === 'quarterly') {
      document.getElementById('quarterlyMonth').value = String(reminder.month ?? 3);
    }

    this.editing[type] = id;
    this.setSubmitButtonText(type, true);
    this.setToggleButtonToCancelEdit(type);
  }

  async addWeekly() {
    const title = document.getElementById('weeklyTitle').value.trim();
    const description = document.getElementById('weeklyDescription').value.trim();
    const day = document.getElementById('weeklyDay').value;
    
    if (!title) {
      alert('Please enter a title');
      return;
    }
    
    if (this.editing.weekly) {
      const updated = await this.store.update('weekly', this.editing.weekly, { title, description, day });
      if (!updated) return;
      this.clearEditing('weekly');
    } else {
      const saved = await this.store.add('weekly', { title, description, day });
      if (!saved) return;
    }
    this.ui.renderAllSections();
    this.ui.updateMarquee();
    this.ui.updateBadge();
    this.ui.updateSummary();
    this.toggleForm('weekly');
  }

  async addMonthly() {
    const title = document.getElementById('monthlyTitle').value.trim();
    const description = document.getElementById('monthlyDescription').value.trim();
    
    if (!title) {
      alert('Please enter a title');
      return;
    }
    
    if (this.editing.monthly) {
      const updated = await this.store.update('monthly', this.editing.monthly, { title, description });
      if (!updated) return;
      this.clearEditing('monthly');
    } else {
      const saved = await this.store.add('monthly', { title, description });
      if (!saved) return;
    }
    this.ui.renderAllSections();
    this.ui.updateMarquee();
    this.ui.updateBadge();
    this.ui.updateSummary();
    this.toggleForm('monthly');
  }

  async addQuarterly() {
    const title = document.getElementById('quarterlyTitle').value.trim();
    const description = document.getElementById('quarterlyDescription').value.trim();
    const month = document.getElementById('quarterlyMonth').value;
    
    if (!title) {
      alert('Please enter a title');
      return;
    }
    
    if (this.editing.quarterly) {
      const updated = await this.store.update('quarterly', this.editing.quarterly, { title, description, month });
      if (!updated) return;
      this.clearEditing('quarterly');
    } else {
      const saved = await this.store.add('quarterly', { title, description, month });
      if (!saved) return;
    }
    this.ui.renderAllSections();
    this.ui.updateMarquee();
    this.ui.updateBadge();
    this.ui.updateSummary();
    this.toggleForm('quarterly');
  }

  async deleteReminder(type, id) {
    if (!confirm('Are you sure you want to delete this reminder?')) {
      return;
    }
    
    const removed = await this.store.remove(type, id);
    if (!removed) return;

    this.ui.renderAllSections();
    this.ui.updateMarquee();
    this.ui.updateBadge();
    this.ui.updateSummary();
  }

  openModal() {
    const overlay = document.getElementById('reminderOverlay');
    const button = document.getElementById('reminderBtn');
    if (overlay) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          overlay.classList.add('open');
        });
      });
      overlay.setAttribute('aria-hidden', 'false');
      if ('inert' in overlay) {
        overlay.inert = false;
      }
    }
    this.switchView('due');
    document.body.classList.add('reminder-overlay-open');
    if (button) button.setAttribute('aria-expanded', 'true');

    localStorage.setItem('nadi_reminders_last_read', Date.now().toString());
    this.ui.updateBadge();
  }

  closeModal() {
    const overlay = document.getElementById('reminderOverlay');
    const button = document.getElementById('reminderBtn');
    if (overlay) {
      if (overlay.contains(document.activeElement)) {
        document.activeElement.blur();
      }
      overlay.classList.remove('open');
      overlay.setAttribute('aria-hidden', 'true');
      if ('inert' in overlay) {
        overlay.inert = true;
      }
    }
    document.body.classList.remove('reminder-overlay-open');
    if (button) button.setAttribute('aria-expanded', 'false');
    this.ui.updateBadge();
  }

  togglePanel() {
    const overlay = document.getElementById('reminderOverlay');
    if (overlay && overlay.classList.contains('open')) {
      this.closeModal();
    } else {
      this.openModal();
    }
  }
}

// ============================================
// Global Instance & Functions
// ============================================

let reminderManager;

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  reminderManager = new ReminderManager();
  reminderManager.init().catch((error) => {
    console.error('Error initializing reminders:', error);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      reminderManager.closeModal();
    }
  });

  const reminderTitle = document.getElementById('reminderDialogTitle');
  if (reminderTitle) {
    let clickCount = 0;
    let clickTimer;

    reminderTitle.addEventListener('click', () => {
      clickCount += 1;
      clearTimeout(clickTimer);
      clickTimer = setTimeout(() => {
        if (clickCount >= 3) {
          document.body.classList.toggle('reminder-actions-visible');
        }
        clickCount = 0;
      }, 350);
    });
  }
});

// Global functions for onclick handlers
function openReminderPanel() {
  reminderManager.openModal();
}

function toggleReminderPanel() {
  reminderManager.togglePanel();
}

function closeReminderPanel() {
  reminderManager.closeModal();
}

function switchReminderView(view) {
  reminderManager.switchView(view);
}


function toggleAddWeeklyForm() {
  reminderManager.toggleForm('weekly');
}

function toggleAddMonthlyForm() {
  reminderManager.toggleForm('monthly');
}

function toggleAddQuarterlyForm() {
  reminderManager.toggleForm('quarterly');
}

function addWeeklyReminder() {
  reminderManager.addWeekly();
}

function addMonthlyReminder() {
  reminderManager.addMonthly();
}

function addQuarterlyReminder() {
  reminderManager.addQuarterly();
}

function editReminder(type, id) {
  reminderManager.startEdit(type, id);
}
