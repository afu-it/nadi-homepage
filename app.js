const schoolHolidays = {};
window.DEBUG_MODE = false;

function toLocalISOString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addRange(name, startStr, endStr) {
  let curr = new Date(startStr);
  const last = new Date(endStr);
  while (curr <= last) {
    const dateKey = toLocalISOString(curr);
    const isStart = dateKey === startStr;
    const isEnd = dateKey === endStr;
    schoolHolidays[dateKey] = { name: name, showLabel: isStart || isEnd };
    curr.setDate(curr.getDate() + 1);
  }
}

addRange("Cuti Akhir Tahun", "2025-12-20", "2026-01-11");
addRange("Cuti Penggal 1", "2026-03-20", "2026-03-28");
addRange("Cuti Pertengahan Tahun", "2026-05-22", "2026-06-06");
addRange("Cuti Penggal 2", "2026-08-28", "2026-09-05");
addRange("Cuti Akhir Tahun", "2026-12-04", "2026-12-31");

function sanitizeHTML(html) {
  if (typeof DOMPurify !== "undefined") {
    return DOMPurify.sanitize(html, {
      ADD_TAGS: ["iframe"],
      ADD_ATTR: ["allow", "allowfullscreen", "frameborder", "scrolling", "target"],
      FORBID_TAGS: ["script", "style", "form"],
    });
  }
  const temp = document.createElement("div");
  temp.textContent = html;
  return temp.innerHTML;
}

function sanitizeHTMLWithLinks(html) {
  let sanitized = sanitizeHTML(html);
  if (typeof document !== "undefined") {
    const temp = document.createElement("div");
    temp.innerHTML = sanitized;
    temp.querySelectorAll("a").forEach((a) => {
      a.setAttribute("target", "_blank");
      a.setAttribute("rel", "noopener noreferrer");
    });
    return temp.innerHTML;
  }
  return sanitized.replace(/<a\s+/gi, '<a target="_blank" rel="noopener noreferrer" ');
}

function isInIframe() {
  try {
    return window.top !== window.self;
  } catch (error) {
    return true;
  }
}

const safeStorage = window.safeStorage || (() => {
  const shouldDisableIframeStorage = window.DISABLE_IFRAME_STORAGE !== false;
  const storageBlocked = shouldDisableIframeStorage && isInIframe();
  const storageMemory = new Map();

  return {
    getItem(key) {
      if (storageBlocked) return storageMemory.get(key) ?? null;
      try {
        return localStorage.getItem(key);
      } catch (error) {
        return storageMemory.get(key) ?? null;
      }
    },
    setItem(key, value) {
      if (storageBlocked) {
        storageMemory.set(key, value);
        return;
      }
      try {
        localStorage.setItem(key, value);
      } catch (error) {
        storageMemory.set(key, value);
      }
    },
    removeItem(key) {
      if (storageBlocked) {
        storageMemory.delete(key);
        return;
      }
      try {
        localStorage.removeItem(key);
      } catch (error) {
        storageMemory.delete(key);
      }
    }
  };
})();

window.safeStorage = safeStorage;

function formatDate(dateStr, options = { weekday: "short", day: "numeric", month: "short", year: "numeric" }) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-GB", options);
}

function showModal(modalId, panelId, focusId = null) {
  const modal = document.getElementById(modalId);
  const panel = document.getElementById(panelId);
  if (!modal || !panel) return;

  modal.classList.remove("hidden");

  setTimeout(() => {
    panel.style.transform = "scale(1)";
    panel.style.opacity = "1";
  }, 10);

  if (focusId) {
    setTimeout(() => {
      const focusEl = document.getElementById(focusId);
      if (focusEl) focusEl.focus();
    }, 100);
  }
}

function hideModal(modalId, panelId, callback = null) {
  const modal = document.getElementById(modalId);
  const panel = document.getElementById(panelId);
  if (!modal || !panel) return;

  panel.style.transform = "scale(0.95)";
  panel.style.opacity = "0";

  setTimeout(() => {
    modal.classList.add("hidden");
    if (callback) callback();
  }, 200);
}

function toggleChevron(icon, isOpen) {
  if (!icon) return;
  icon.classList.toggle("fa-chevron-up", isOpen);
  icon.classList.toggle("fa-chevron-down", !isOpen);
}

function isMissingColumnError(error) {
  if (!error) return false;
  if (error.code === "42703") return true;
  const message = typeof error.message === "string" ? error.message : "";
  return /column .* does not exist/i.test(message);
}

let today = new Date();
let currentMonth = today.getMonth();
let currentYear = today.getFullYear();
window.selectedFilterDate = toLocalISOString(today);
let rangeFilter = { start: null, end: null };

let events = [];

// Ensure events is always an array
function ensureEventsArray() {
  if (!Array.isArray(events)) {
    if (window.DEBUG_MODE) console.warn("Events is not an array, resetting to empty array");
    events = [];
  }
}

let siteSettings = {
  title: "NADI SCSB",
  subtitle: "PULAU PINANG",
  sections: [],
  managerOffdays: [],
  assistantManagerOffdays: [],
  managerReplacements: [],
  assistantManagerReplacements: [],
  publicHolidays: {},
  schoolHolidays: {},
  calendarFilters: {
    showCategories: true,
    showHolidays: true,
    showSchoolHolidays: true,
    showOffdays: true,
  },
};

// Backup for data protection
let siteSettingsBackup = null;

// =====================================================
// OPTIMIZATION: Caching variables
// =====================================================
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds
let eventsCache = {
  data: null,
  timestamp: null,
  monthKey: null  // Store which month this cache is for
};

// =====================================================
// OPTIMIZATION: Load events for specific month
// =====================================================
  async function loadEventsForMonth(year, month) {
    const firstDay = new Date(year, month, 1).toISOString().split('T')[0];
    const lastDay = new Date(year, month + 1, 0).toISOString().split('T')[0];
    const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
  
  // Check cache first
  if (eventsCache.monthKey === monthKey && 
      eventsCache.data && 
      eventsCache.timestamp && 
      (Date.now() - eventsCache.timestamp) < CACHE_DURATION) {
    if (window.DEBUG_MODE) console.log('✅ Using cached events for', monthKey);
    return eventsCache.data;
  }
  
  if (window.DEBUG_MODE) console.log('📥 Loading events for', monthKey, '...');

    const queryEventsForMonth = (columns) => supabaseClient
      .from('events')
      .select(columns)
      .or(`start.lte.${lastDay},end.gte.${firstDay}`)
      .order('start', { ascending: true });

    let { data, error } = await queryEventsForMonth('id, title, start, end, category, subcategory, location, notes');

    if (error && isMissingColumnError(error)) {
      if (window.DEBUG_MODE) console.warn('⚠️ Missing columns in events table, falling back to select("*"):', error.message);
      ({ data, error } = await queryEventsForMonth('*'));
    }

    if (error) {
      console.error('❌ Error loading events for month:', error);
      return [];
    }
  
  const eventsArray = data || [];
  
  // Update cache
  eventsCache = {
    data: eventsArray,
    timestamp: Date.now(),
    monthKey: monthKey
  };
  
  // Also save to localStorage for persistence across sessions
  try {
    safeStorage.setItem('events_cache', JSON.stringify({
      data: eventsArray,
      timestamp: Date.now(),
      monthKey: monthKey
    }));
  } catch (e) {
    if (window.DEBUG_MODE) console.warn('Could not save events to localStorage cache:', e);
  }
  
  if (window.DEBUG_MODE) console.log(`✅ Loaded ${eventsArray.length} events for ${monthKey}`);
  return eventsArray;
}

// =====================================================
// OPTIMIZATION: Force refresh events from Supabase
// =====================================================
async function forceRefreshEvents() {
  if (window.DEBUG_MODE) console.log('🔄 Force refreshing events from Supabase...');
  
  // Clear cache
  eventsCache = {
    data: null,
    timestamp: null,
    monthKey: null
  };
  safeStorage.removeItem('events_cache');
  
  // Load events for current month
  const monthEvents = await loadEventsForMonth(currentYear, currentMonth);
  events = monthEvents;
  
  renderCalendar();
  renderEventList();
  
  if (window.DEBUG_MODE) console.log('✅ Events force refreshed!');
}

// =====================================================
// OPTIMIZATION: Load from cache or Supabase
// =====================================================
async function loadEventsWithCache() {
  // Try to load from localStorage cache first
  try {
    const cached = safeStorage.getItem('events_cache');
    if (cached) {
      const cache = JSON.parse(cached);
      const cacheAge = Date.now() - (cache.timestamp || 0);
      
      // Check if cache is for current month and less than 5 minutes old
      const currentMonthKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
      
      if (cacheAge < CACHE_DURATION && 
          cache.monthKey === currentMonthKey && 
          Array.isArray(cache.data)) {
        if (window.DEBUG_MODE) console.log('✅ Using cached events (age:', Math.round(cacheAge/1000), 'seconds)');
        events = cache.data;
        
        // Update in-memory cache
        eventsCache = {
          data: cache.data,
          timestamp: cache.timestamp,
          monthKey: cache.monthKey
        };
        
        renderCalendar();
        renderEventList();
        return; // Skip Supabase loading
      }
    }
  } catch (e) {
    if (window.DEBUG_MODE) console.warn('Could not read events cache:', e);
  }
  
  // Load from Supabase if no valid cache
  const monthEvents = await loadEventsForMonth(currentYear, currentMonth);
  events = monthEvents;
  renderCalendar();
  renderEventList();
}

async function backupSiteSettings() {
  siteSettingsBackup = JSON.parse(JSON.stringify(siteSettings));
  // Also save to localStorage as secondary backup
  try {
    safeStorage.setItem("nadi_siteSettings_backup", JSON.stringify(siteSettings));
  } catch (e) {
    if (window.DEBUG_MODE) console.warn("Could not save backup to localStorage:", e);
  }
  // Save backup to Supabase as tertiary backup - use ID 2 for backup
  try {
    await supabaseClient.from('site_settings').upsert({
      id: 2,
      settings: siteSettingsBackup
    }, { onConflict: 'id' }).catch(() => {
      // Backup might fail, ignore
    });
  } catch (e) {
    // Ignore Supabase backup errors
  }
}

async function restoreSiteSettings() {
  // Try Supabase backup first - use ID 2 for backup
  try {
    const { data: backupData, error } = await supabaseClient
      .from('site_settings')
      .select('settings')
      .eq('id', 2)
      .single();
    
    if (!error && backupData?.settings && (backupData.settings.sections?.length > 0 || backupData.settings.managerOffdays?.length > 0)) {
      siteSettings = backupData.settings;
      siteSettingsBackup = backupData.settings;
      try {
        safeStorage.setItem("nadi_siteSettings_backup", JSON.stringify(backupData.settings));
      } catch (e) {}
      renderCustomLinks();
      renderCalendar();
      updateSectionCountBadge();
      await saveToSupabase();
      return true;
    }
  } catch (e) {
    if (window.DEBUG_MODE) console.warn("Could not restore from Supabase:", e);
  }
  
  // Try memory backup first
  if (siteSettingsBackup && (siteSettingsBackup.sections?.length > 0 || siteSettingsBackup.managerOffdays?.length > 0)) {
    siteSettings = JSON.parse(JSON.stringify(siteSettingsBackup));
    renderCustomLinks();
    renderCalendar();
    updateSectionCountBadge();
    await saveToSupabase();
    return true;
  }
  // Try localStorage backup
  try {
    const localBackup = safeStorage.getItem("nadi_siteSettings_backup");
    if (localBackup) {
      const parsed = JSON.parse(localBackup);
      if (parsed.sections?.length > 0 || parsed.managerOffdays?.length > 0) {
        siteSettings = parsed;
        siteSettingsBackup = parsed;
        renderCustomLinks();
        renderCalendar();
        updateSectionCountBadge();
        await saveToSupabase();
        return true;
      }
    }
  } catch (e) {
    if (window.DEBUG_MODE) console.warn("Could not restore from localStorage:", e);
  }
  return false;
}

// Backup will be created after data loads from Supabase

// Make restoreData available globally
window.restoreData = function() {
  if (window.DEBUG_MODE) console.log("Attempting to restore data from backup...");
  if (restoreSiteSettings()) {
    if (window.DEBUG_MODE) console.log("✓ Data restored successfully!");
    return true;
  } else {
    if (window.DEBUG_MODE) console.log("⚠ No backup available to restore");
    return false;
  }
};

let announcements = [];
let programInfoContent = "";
let currentSort = "startTime";
let deleteEventId = null;
let deleteSectionIdx = null;
let savedSelectionRange = null;
let tempPublicHolidays = {};
let tempSchoolHolidays = {};
let supabaseClientLoaded = false;
let isDataLoaded = false;
let showEditDeleteButtons = false;
let programsListClicks = 0;
let programsListTimer = null;

// =====================================================
// Specialized Save Functions (Split Structure)
// =====================================================

async function saveBasicConfig() {
  const { error } = await supabaseClient.from('site_settings').upsert({
    id: 1,
    settings: {
      title: siteSettings.title,
      subtitle: siteSettings.subtitle,
      calendarFilters: siteSettings.calendarFilters
    }
  }, { onConflict: 'id' });
  
  if (error) {
    console.error('❌ Failed to save basic config (ID 1):', error);
    throw error;
  }
  if (window.DEBUG_MODE) console.log('✅ Saved basic config to ID 1');
}

async function saveManagerOffdays() {
  const { error } = await supabaseClient.from('site_settings').upsert({
    id: 10,
    settings: { managerOffdays: siteSettings.managerOffdays }
  }, { onConflict: 'id' });
  
  if (error) {
    console.error('❌ Failed to save manager offdays (ID 10):', error);
    throw error;
  }
  if (window.DEBUG_MODE) console.log('✅ Saved manager offdays to ID 10');
  
  await updateFullBackup();
}

async function saveAssistantManagerOffdays() {
  const { error } = await supabaseClient.from('site_settings').upsert({
    id: 11,
    settings: { assistantManagerOffdays: siteSettings.assistantManagerOffdays }
  }, { onConflict: 'id' });
  
  if (error) {
    console.error('❌ Failed to save assistant manager offdays (ID 11):', error);
    throw error;
  }
  if (window.DEBUG_MODE) console.log('✅ Saved assistant manager offdays to ID 11');
  
  await updateFullBackup();
}

async function saveManagerReplacements() {
  const { error } = await supabaseClient.from('site_settings').upsert({
    id: 12,
    settings: { managerReplacements: siteSettings.managerReplacements }
  }, { onConflict: 'id' });
  
  if (error) {
    console.error('❌ Failed to save manager replacements (ID 12):', error);
    throw error;
  }
  if (window.DEBUG_MODE) console.log('✅ Saved manager replacements to ID 12');
  
  await updateFullBackup();
}

async function saveAssistantManagerReplacements() {
  const { error } = await supabaseClient.from('site_settings').upsert({
    id: 13,
    settings: { assistantManagerReplacements: siteSettings.assistantManagerReplacements }
  }, { onConflict: 'id' });
  
  if (error) {
    console.error('❌ Failed to save assistant manager replacements (ID 13):', error);
    throw error;
  }
  if (window.DEBUG_MODE) console.log('✅ Saved assistant manager replacements to ID 13');
  
  await updateFullBackup();
}

async function savePublicHolidays() {
  const { error } = await supabaseClient.from('site_settings').upsert({
    id: 20,
    settings: { publicHolidays: siteSettings.publicHolidays }
  }, { onConflict: 'id' });
  
  if (error) {
    console.error('❌ Failed to save public holidays (ID 20):', error);
    throw error;
  }
  if (window.DEBUG_MODE) console.log('✅ Saved public holidays to ID 20');
  
  await updateFullBackup();
  
  // Dispatch event to notify other components (e.g., leave calendar)
  document.dispatchEvent(new CustomEvent('holidaysUpdated'));
}

async function saveSchoolHolidays() {
  const { error } = await supabaseClient.from('site_settings').upsert({
    id: 21,
    settings: { schoolHolidays: siteSettings.schoolHolidays }
  }, { onConflict: 'id' });
  
  if (error) {
    console.error('❌ Failed to save school holidays (ID 21):', error);
    throw error;
  }
  if (window.DEBUG_MODE) console.log('✅ Saved school holidays to ID 21');
  
  await updateFullBackup();
  
  // Dispatch event to notify other components (e.g., leave calendar)
  document.dispatchEvent(new CustomEvent('holidaysUpdated'));
}

async function saveCustomSections() {
  const { error } = await supabaseClient.from('site_settings').upsert({
    id: 30,
    settings: { sections: siteSettings.sections }
  }, { onConflict: 'id' });
  
  if (error) {
    console.error('❌ Failed to save custom sections (ID 30):', error);
    throw error;
  }
  if (window.DEBUG_MODE) console.log('✅ Saved custom sections to ID 30');
  
  await updateFullBackup();
}

async function updateFullBackup() {
  const { error } = await supabaseClient.from('site_settings').upsert({
    id: 99,
    settings: siteSettings
  }, { onConflict: 'id' });
  
  if (error) {
    console.error('❌ Failed to save backup (ID 99):', error);
    throw error;
  }
  if (window.DEBUG_MODE) console.log('✅ Saved backup to ID 99');
}

// Fallback: Save all settings at once
async function saveAllSettings() {
  if (!isDataLoaded) {
    if (window.DEBUG_MODE) console.warn("saveAllSettings called but data not loaded yet");
    return Promise.reject(new Error("Data not loaded yet"));
  }

  if (window.DEBUG_MODE) console.log("💾 Saving all settings to Supabase...");
  
  try {
    // Save events to separate events table
    if (events && events.length > 0) {
      const { error: deleteError } = await supabaseClient.from('events').delete().neq('id', 0);
      if (deleteError && window.DEBUG_MODE) console.warn("Warning deleting events:", deleteError);
      const { error: insertError } = await supabaseClient.from('events').insert(events);
      if (insertError) throw insertError;
    } else {
      await supabaseClient.from('events').delete().neq('id', 0);
    }

    // Save announcements to separate announcements table
    if (announcements && announcements.length > 0) {
      const { error: deleteAnnError } = await supabaseClient.from('announcements').delete().neq('id', 0);
      if (deleteAnnError && window.DEBUG_MODE) console.warn("Warning deleting announcements:", deleteAnnError);
      const { error: insertAnnError } = await supabaseClient.from('announcements').insert(announcements);
      if (insertAnnError) throw insertAnnError;
    } else {
      await supabaseClient.from('announcements').delete().neq('id', 0);
    }

    // Save all settings using specialized functions
    await saveBasicConfig();
    await saveManagerOffdays();
    await saveAssistantManagerOffdays();
    await saveManagerReplacements();
    await saveAssistantManagerReplacements();
    await savePublicHolidays();
    await saveSchoolHolidays();
    await saveCustomSections();

    if (window.DEBUG_MODE) console.log("✅ All settings saved successfully");
    await backupSiteSettings();
    return true;
  } catch (err) {
    console.error("❌ Failed to save to Supabase:", err.message);
    alert("Unable to save changes. Please check your connection and try again.");
    throw err;
  }
}

// Keep old function name as alias for backward compatibility
const saveToSupabase = saveAllSettings;

async function refreshEventsFromSupabase() {
  try {
    // CRITICAL FIX: Refresh from separate events table
    const { data: eventsData, error } = await supabaseClient
      .from('events')
      .select('*');
    
    if (error) throw error;

    const newEvents = eventsData || [];
    if (JSON.stringify(events) !== JSON.stringify(newEvents)) {
      events = newEvents;
      if (window.DEBUG_MODE) console.log("✓ Refreshed events from Supabase:", events.length, "events");
      renderCalendar();
      renderEventList();
    }
    return events;
  } catch (error) {
    console.error("Error refreshing events:", error);
    throw error;
  }
}

async function loadFromSupabase() {
  if (window.DEBUG_MODE) console.log("🔄 Loading data from Supabase...");
  
  try {
    // OPTIMIZATION: Batch load all site_settings in ONE query (was 7 queries)
    const { data: allSettings, error: settingsError } = await supabaseClient
      .from('site_settings')
      .select('id, settings')
      .in('id', [1, 10, 11, 12, 13, 20, 21, 30]);

    if (settingsError) throw settingsError;

    // Map results by ID for easy access
    const settingsMap = {};
    (allSettings || []).forEach(item => {
      settingsMap[item.id] = item.settings;
    });

    // Build siteSettings object from batched results
    siteSettings = {
      // ID 1: Basic config
      title: settingsMap[1]?.title || 'NADI SCSB',
      subtitle: settingsMap[1]?.subtitle || 'PULAU PINANG',
      calendarFilters: settingsMap[1]?.calendarFilters || {
        showCategories: true,
        showHolidays: true,
        showSchoolHolidays: true,
        showOffdays: true,
      },
      // ID 10: Manager offdays
      managerOffdays: settingsMap[10]?.managerOffdays || [],
      // ID 11: Assistant Manager offdays
      assistantManagerOffdays: settingsMap[11]?.assistantManagerOffdays || [],
      // ID 12: Manager replacements
      managerReplacements: settingsMap[12]?.managerReplacements || [],
      // ID 13: Assistant Manager replacements
      assistantManagerReplacements: settingsMap[13]?.assistantManagerReplacements || [],
      // ID 20: Public holidays
      publicHolidays: settingsMap[20]?.publicHolidays || {},
      // ID 21: School holidays
      schoolHolidays: settingsMap[21]?.schoolHolidays || {},
      // ID 30: Custom sections
      sections: settingsMap[30]?.sections || []
    };

    if (window.DEBUG_MODE) console.log('✅ Loaded all settings in 1 batched query (was 7)');

    // =====================================================
    // OPTIMIZATION: Load events for CURRENT MONTH only (with caching)
    // =====================================================
    if (window.DEBUG_MODE) console.log("📥 Loading events for current month (with cache)...");
    
    // Load events and assign to global events variable
    events = await loadEventsForMonth(currentYear, currentMonth);
    // Render events immediately
    renderCalendar();
    renderEventList();
    
    // =====================================================
    // OPTIMIZATION: Load announcements AFTER events are displayed
    // =====================================================
    
    // Load announcements asynchronously (doesn't block UI)
    supabaseClient
      .from('announcements')
      .select('id, title, content, category, created_at')
      .then(async ({ data: announcementsData, error: announcementsError }) => {
        if (announcementsError && isMissingColumnError(announcementsError)) {
          if (window.DEBUG_MODE) console.warn('⚠️ Missing columns in announcements table, falling back to select("*"):', announcementsError.message);
          const fallback = await supabaseClient.from('announcements').select('*');
          announcementsData = fallback.data;
          announcementsError = fallback.error;
        }

        if (announcementsError) {
          console.error("Error loading announcements:", announcementsError);
          announcements = [];
        } else {
          announcements = announcementsData || [];
          if (!Array.isArray(announcements)) {
            announcements = [];
          }
        }
        if (window.DEBUG_MODE) console.log(`✅ Loaded ${announcements.length} announcements`);
        
        // Update announcements UI if on announcements page
        if (typeof renderAnnouncementList === 'function') {
          renderAnnouncementList();
        }
        
        // Check for new announcements
        checkNewAnnouncements();
      });
    
    // Update backup with loaded data
    await backupSiteSettings();
    
    // Render UI
    updateUIFromSettings();
    loadCalendarFilters();
    renderCustomLinks();
    renderCalendar();
    renderEventList();
    checkNewAnnouncements();

    // Mark data as loaded
    isDataLoaded = true;
    supabaseLoaded = true;
    
  } catch (error) {
    console.error("❌ Error loading data:", error.message);
    alert("Unable to load data. Please refresh the page to try again.");
    
    // Render with defaults
    events = [];
    updateUIFromSettings();
    loadCalendarFilters();
    renderCustomLinks();
    renderCalendar();
    renderEventList();
    
    isDataLoaded = true;
    supabaseLoaded = true;
  }
}

function updateUIFromSettings() {
  document.getElementById("siteTitle").textContent = siteSettings.title;
  document.getElementById("siteSubtitle").textContent = siteSettings.subtitle;
}

function checkNewAnnouncements() {
  const lastReadAnnouncement = safeStorage.getItem("lastReadAnnouncementId");
  const currentAnnouncements = announcements || [];
  
  if (currentAnnouncements.length === 0) {
    const dot = document.getElementById("newAnnouncementDot");
    if (dot) dot.classList.add("hidden");
    return;
  }
  
  const latestAnnouncement = currentAnnouncements.reduce((latest, ann) => {
    const annDate = new Date(ann.createdAt || ann.created_at || 0);
    const latestDate = latest ? new Date(latest.createdAt || latest.created_at || 0) : new Date(0);
    return annDate > latestDate ? ann : latest;
  }, null);
  
  if (!latestAnnouncement) {
    const dot = document.getElementById("newAnnouncementDot");
    if (dot) dot.classList.add("hidden");
    return;
  }
  
  const dot = document.getElementById("newAnnouncementDot");
  if (dot) {
    if (lastReadAnnouncement !== latestAnnouncement.id) {
      dot.classList.remove("hidden");
    } else {
      dot.classList.add("hidden");
    }
  }
}

function markAnnouncementsAsRead() {
  const currentAnnouncements = announcements || [];
  if (currentAnnouncements.length > 0) {
    const latestAnnouncement = currentAnnouncements.reduce((latest, ann) => {
      const annDate = new Date(ann.createdAt || ann.created_at || 0);
      const latestDate = latest ? new Date(latest.createdAt || latest.created_at || 0) : new Date(0);
      return annDate > latestDate ? ann : latest;
    }, null);
    if (latestAnnouncement) {
      safeStorage.setItem("lastReadAnnouncementId", latestAnnouncement.id);
      const dot = document.getElementById("newAnnouncementDot");
      if (dot) dot.classList.add("hidden");
    }
  }
}

(function init() {
  const dateHeader = document.getElementById("current-date-header");
  if (dateHeader) {
    const dayName = today.toLocaleDateString("en-MY", { weekday: "long" });
    const dateFull = today.toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" });
    dateHeader.innerHTML = `
      <span class="text-[9px] font-bold text-white/70 uppercase tracking-wide leading-none mb-0.5">${dayName}</span>
      <span class="text-xs font-bold text-white leading-none">${dateFull}</span>
    `;
  }

  const hourSelect = document.getElementById("timeHour");
  const endHourSelect = document.getElementById("endTimeHour");
  const time2HourSelect = document.getElementById("time2Hour");
  const endTime2HourSelect = document.getElementById("endTime2Hour");
    for (let i = 1; i <= 12; i++) {
      const val = i.toString().padStart(2, "0");
      const opt = document.createElement("option");
      opt.value = val;
      opt.text = val;
      if (val === "09") opt.selected = true;
      hourSelect.appendChild(opt);
      const opt2 = document.createElement("option");
      opt2.value = val;
      opt2.text = val;
      if (val === "06") opt2.selected = true;
      endHourSelect.appendChild(opt2);
      const opt3 = document.createElement("option");
      opt3.value = val;
      opt3.text = val;
      time2HourSelect.appendChild(opt3);
      const opt4 = document.createElement("option");
      opt4.value = val;
      opt4.text = val;
      endTime2HourSelect.appendChild(opt4);
    }

    loadFromSupabase()
      .then(() => {
        if (window.DEBUG_MODE) console.log("✓ All data loaded successfully");
      })
      .catch((error) => {
        console.error("✗ Failed to load data:", error);
      });

  document.getElementById("prevMonth").addEventListener("click", async () => {
    currentMonth--;
    if (currentMonth < 0) {
      currentMonth = 11;
      currentYear--;
    }
    
    // Load events for the new month
    const monthEvents = await loadEventsForMonth(currentYear, currentMonth);
    events = monthEvents;
    
    renderCalendar();
    renderCategoryCounts();
    renderEventList();
  });

  document.getElementById("nextMonth").addEventListener("click", async () => {
    currentMonth++;
    if (currentMonth > 11) {
      currentMonth = 0;
      currentYear++;
    }
    
    // Load events for the new month
    const monthEvents = await loadEventsForMonth(currentYear, currentMonth);
    events = monthEvents;
    
    renderCalendar();
    renderCategoryCounts();
    renderEventList();
  });

  document.getElementById("modalBackdrop").addEventListener("click", closeModal);

  let headerClicks = 0;
  let headerTimer;
  const editableHeader = document.getElementById("editableHeader");
  if (editableHeader) {
    editableHeader.addEventListener("click", () => {
      headerClicks++;
      clearTimeout(headerTimer);
      headerTimer = setTimeout(() => (headerClicks = 0), 500);
      if (headerClicks === 3) {
        openSettings();
        headerClicks = 0;
      }
    });
  } else {
    console.error("editableHeader element not found!");
  }

  document.getElementById("startDate").addEventListener("change", function () {
    const startDate = this.value;
    const endDateInput = document.getElementById("endDate");
    endDateInput.value = startDate;
    endDateInput.min = startDate;
  });

  document.querySelectorAll('input[name="category"]').forEach((radio) => {
    radio.addEventListener("change", function () {
      updateSubcategories(this.value);
      // Hide category error when a category is selected
      hideCategoryError();
    });
  });

  document.getElementById("announcementBtn").addEventListener("click", markAnnouncementsAsRead);

  document.getElementById("programsListHeader").addEventListener("click", () => {
    programsListClicks++;
    clearTimeout(programsListTimer);
    programsListTimer = setTimeout(() => (programsListClicks = 0), 500);
    if (programsListClicks === 3) {
      showEditDeleteButtons = !showEditDeleteButtons;
      programsListClicks = 0;
      renderEventList();
    }
  });
})();

function showView(viewId) {
  const views = [
    "settingsMenuView",
    "headerSettingsView",
    "sectionsListView",
    "sectionEditorView",
    "offdaySettingsView",
    "holidaySettingsView",
    "schoolHolidaySettingsView",
  ];
  const panel = document.getElementById("settingsModalPanel");

  views.forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      if (id === viewId) {
        el.classList.remove("hidden");
        el.classList.add("flex");
      } else {
        el.classList.add("hidden");
        el.classList.remove("flex");
      }
    }
  });

  if (viewId === "sectionsListView" || viewId === "sectionEditorView") {
    panel.style.maxWidth = "700px";
  } else {
    panel.style.maxWidth = "28rem";
  }
}

function openSettings() {
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => openSettings());
    return;
  }
  
  const settingsModal = document.getElementById("settingsModal");
  if (!settingsModal) {
    console.error("settingsModal element not found!");
    return;
  }
  settingsModal.classList.remove("hidden");
  showView("settingsMenuView");
}

function closeSettings() {
  document.getElementById("settingsModal").classList.add("hidden");
  setTimeout(() => showView("settingsMenuView"), 300);
}

function backToMenu() {
  showView("settingsMenuView");
}

function openHeaderSettings() {
  document.getElementById("settingSiteTitle").value = siteSettings.title;
  document.getElementById("settingSiteSubtitle").value = siteSettings.subtitle;
  showView("headerSettingsView");
}

function saveHeaderSettings() {
  siteSettings.title = document.getElementById("settingSiteTitle").value;
  siteSettings.subtitle = document.getElementById("settingSiteSubtitle").value;
  updateUIFromSettings();
  saveBasicConfig().then(() => {
    backToMenu();
  }).catch(err => {
    alert("Failed to save header settings. Please try again.");
  });
}

function openOffdaySettings() {
  offdayCalendarMonth = new Date().getMonth();
  offdayCalendarYear = new Date().getFullYear();
  renderOffdayCalendars();
  showView("offdaySettingsView");
}

let offdayCalendarMonth = new Date().getMonth();
let offdayCalendarYear = new Date().getFullYear();

function changeOffdayMonth(delta) {
  offdayCalendarMonth += delta;
  if (offdayCalendarMonth > 11) {
    offdayCalendarMonth = 0;
    offdayCalendarYear++;
  } else if (offdayCalendarMonth < 0) {
    offdayCalendarMonth = 11;
    offdayCalendarYear--;
  }
  renderOffdayCalendars();
}

function renderOffdayCalendars() {
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  document.getElementById("offdayMonthLabel").textContent = `${monthNames[offdayCalendarMonth]} ${offdayCalendarYear}`;

  const daysInMonth = new Date(offdayCalendarYear, offdayCalendarMonth + 1, 0).getDate();
  const firstDay = new Date(offdayCalendarYear, offdayCalendarMonth, 1).getDay();

  const mOffdays = siteSettings.managerOffdays || [];
  const amOffdays = siteSettings.assistantManagerOffdays || [];
  const mReplacements = siteSettings.managerReplacements || [];
  const amReplacements = siteSettings.assistantManagerReplacements || [];

  document.getElementById("managerOffdayCount").textContent = `${mOffdays.length} dates`;
  document.getElementById("amOffdayCount").textContent = `${amOffdays.length} dates`;
  document.getElementById("managerReplacementCount").textContent = `${mReplacements.length} dates`;
  document.getElementById("amReplacementCount").textContent = `${amReplacements.length} dates`;

  const renderCalendar = (containerId, type, array, color) => {
    const container = document.getElementById(containerId);
    container.innerHTML = "";

    const dayHeaders = ["S", "M", "T", "W", "T", "F", "S"];
    dayHeaders.forEach(day => {
      const dayHeader = document.createElement("div");
      dayHeader.className = "text-[8px] font-bold text-slate-400 uppercase py-1";
      dayHeader.textContent = day;
      container.appendChild(dayHeader);
    });

    for (let i = 0; i < firstDay; i++) {
      const emptyCell = document.createElement("div");
      container.appendChild(emptyCell);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(offdayCalendarYear, offdayCalendarMonth, day);
      const dateStr = toLocalISOString(date);

      const isSelected = array.includes(dateStr);

      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "h-7 rounded text-[10px] font-medium transition-colors relative hover:bg-slate-100 text-slate-700";
      cell.textContent = day;

      if (isSelected) {
        cell.classList.add("text-white");
        cell.classList.remove("hover:bg-slate-100", "text-slate-700");
        cell.style.backgroundColor = color;
      }

      if (type === "replacement") {
        cell.style.boxShadow = `0 0 3px ${color}`;
        if (!isSelected) {
          cell.style.border = `2px solid ${color}`;
          cell.style.padding = "2px";
        }
      }

      if (type === "manager-offday") {
        cell.onclick = () => toggleOffdayDate("manager", dateStr);
      } else if (type === "am-offday") {
        cell.onclick = () => toggleOffdayDate("am", dateStr);
      } else if (type === "manager-replacement") {
        cell.onclick = () => toggleReplacementDate("manager", dateStr);
      } else if (type === "am-replacement") {
        cell.onclick = () => toggleReplacementDate("am", dateStr);
      }

      container.appendChild(cell);
    }
  };

  renderCalendar("offdayManagerCalendar", "manager-offday", mOffdays, "#00aff0");
  renderCalendar("offdayAMCalendar", "am-offday", amOffdays, "#90cf53");
  renderCalendar("offdayManagerReplacementCalendar", "manager-replacement", mReplacements, "#00aff0");
  renderCalendar("offdayAMReplacementCalendar", "am-replacement", amReplacements, "#90cf53");
}

function toggleOffdayDate(type, dateStr) {
  const date = new Date(dateStr);
  const nextDate = new Date(date);
  nextDate.setDate(date.getDate() + 1);
  const nextDateStr = toLocalISOString(nextDate);

  if (type === "manager") {
    const arr = siteSettings.managerOffdays;
    const index = arr.indexOf(dateStr);
    const nextIndex = arr.indexOf(nextDateStr);
    
    if (index > -1) {
      arr.splice(index, 1);
    } else {
      arr.push(dateStr);
    }
    
    if (nextIndex > -1) {
      arr.splice(nextIndex, 1);
    } else if (index === -1) {
      arr.push(nextDateStr);
    }
  } else {
    const arr = siteSettings.assistantManagerOffdays;
    const index = arr.indexOf(dateStr);
    const nextIndex = arr.indexOf(nextDateStr);
    
    if (index > -1) {
      arr.splice(index, 1);
    } else {
      arr.push(dateStr);
    }
    
    if (nextIndex > -1) {
      arr.splice(nextIndex, 1);
    } else if (index === -1) {
      arr.push(nextDateStr);
    }
  }
  renderOffdayCalendars();
}

function toggleReplacementDate(type, dateStr) {
  if (type === "manager") {
    const arr = siteSettings.managerReplacements;
    const index = arr.indexOf(dateStr);
    if (index > -1) {
      arr.splice(index, 1);
    } else {
      arr.push(dateStr);
    }
  } else {
    const arr = siteSettings.assistantManagerReplacements;
    const index = arr.indexOf(dateStr);
    if (index > -1) {
      arr.splice(index, 1);
    } else {
      arr.push(dateStr);
    }
  }
  renderOffdayCalendars();
}

function renderOffdayLists() {
  const managerList = document.getElementById("managerOffdayList");
  const managerCount = document.getElementById("managerOffdayCount");
  managerList.innerHTML = "";
  const mOffdays = siteSettings.managerOffdays || [];
  managerCount.textContent = `${mOffdays.length} date${mOffdays.length !== 1 ? "s" : ""}`;

  mOffdays.sort().forEach((date, idx) => {
    const div = document.createElement("div");
    div.className = "flex items-center justify-between bg-slate-50 px-2 py-1 rounded border border-slate-200";
    div.innerHTML = `
      <span class="text-[10px] font-semibold text-slate-600">${formatDate(date)}</span>
      <button onclick="removeOffday('manager', ${idx})" class="text-red-400 hover:text-red-600 transition-colors">
        <i class="fa-solid fa-times text-[10px]"></i>
      </button>
    `;
    managerList.appendChild(div);
  });

  const amList = document.getElementById("amOffdayList");
  const amCount = document.getElementById("amOffdayCount");
  amList.innerHTML = "";
  const amOffdays = siteSettings.assistantManagerOffdays || [];
  amCount.textContent = `${amOffdays.length} date${amOffdays.length !== 1 ? "s" : ""}`;

  amOffdays.sort().forEach((date, idx) => {
    const div = document.createElement("div");
    div.className = "flex items-center justify-between bg-slate-50 px-2 py-1 rounded border border-slate-200";
    div.innerHTML = `
      <span class="text-[10px] font-semibold text-slate-600">${formatDate(date)}</span>
      <button onclick="removeOffday('am', ${idx})" class="text-red-400 hover:text-red-600 transition-colors">
        <i class="fa-solid fa-times text-[10px]"></i>
      </button>
    `;
    amList.appendChild(div);
  });
}

function autoSetOffdayEnd(type) {
  let startId, endId;

  if (type === "manager") {
    startId = "managerOffdayStart";
    endId = "managerOffdayEnd";
  } else if (type === "am") {
    startId = "amOffdayStart";
    endId = "amOffdayEnd";
  }

  const startDate = document.getElementById(startId).value;
  if (!startDate) return;

  const nextDay = new Date(startDate);
  nextDay.setDate(nextDay.getDate() + 1);

  const y = nextDay.getFullYear();
  const m = String(nextDay.getMonth() + 1).padStart(2, "0");
  const d = String(nextDay.getDate()).padStart(2, "0");

  document.getElementById(endId).value = `${y}-${m}-${d}`;
}

function addOffdayRange(type) {
  const startId = type === "manager" ? "managerOffdayStart" : "amOffdayStart";
  const endId = type === "manager" ? "managerOffdayEnd" : "amOffdayEnd";

  const startDate = document.getElementById(startId).value;
  const endDate = document.getElementById(endId).value;

  if (!startDate) {
    alert("Please select a start date.");
    return;
  }

  const end = endDate || startDate;
  let current = new Date(startDate);
  const last = new Date(end);

  if (current > last) {
    alert("End date cannot be before start date.");
    return;
  }

  const dates = type === "manager" ? siteSettings.managerOffdays : siteSettings.assistantManagerOffdays;
  if (!dates) {
    siteSettings[type === "manager" ? "managerOffdays" : "assistantManagerOffdays"] = [];
  }

  while (current <= last) {
    const dateStr = toLocalISOString(current);
    const arr = type === "manager" ? siteSettings.managerOffdays : siteSettings.assistantManagerOffdays;
    if (!arr.includes(dateStr)) {
      arr.push(dateStr);
    }
    current.setDate(current.getDate() + 1);
  }

  document.getElementById(startId).value = "";
  document.getElementById(endId).value = "";

  renderOffdayLists();
}

function removeOffday(type, idx) {
  if (type === "manager") {
    siteSettings.managerOffdays.splice(idx, 1);
  } else {
    siteSettings.assistantManagerOffdays.splice(idx, 1);
  }
  renderOffdayLists();
}

function renderReplacementLists() {
  const managerReplacementList = document.getElementById("managerReplacementList");
  const managerReplacementCount = document.getElementById("managerReplacementCount");
  if (managerReplacementList && managerReplacementCount) {
    managerReplacementList.innerHTML = "";
    const mReplacement = siteSettings.managerReplacements || [];
    managerReplacementCount.textContent = `${mReplacement.length} date${mReplacement.length !== 1 ? "s" : ""}`;

    mReplacement.sort().forEach((date) => {
      const div = document.createElement("div");
      div.className = "flex items-center justify-between bg-slate-50 px-2 py-1 rounded border border-slate-200";
      div.innerHTML = `
        <span class="text-[10px] font-semibold text-slate-600">${formatDate(date)}</span>
        <button onclick="removeReplacementDate('manager', '${date}')" class="text-red-400 hover:text-red-600 transition-colors">
          <i class="fa-solid fa-times text-[10px]"></i>
        </button>
      `;
      managerReplacementList.appendChild(div);
    });
  }

  const amReplacementList = document.getElementById("amReplacementList");
  const amReplacementCount = document.getElementById("amReplacementCount");
  if (amReplacementList && amReplacementCount) {
    amReplacementList.innerHTML = "";
    const amReplacement = siteSettings.assistantManagerReplacements || [];
    amReplacementCount.textContent = `${amReplacement.length} date${amReplacement.length !== 1 ? "s" : ""}`;

    amReplacement.sort().forEach((date) => {
      const div = document.createElement("div");
      div.className = "flex items-center justify-between bg-slate-50 px-2 py-1 rounded border border-slate-200";
      div.innerHTML = `
        <span class="text-[10px] font-semibold text-slate-600">${formatDate(date)}</span>
        <button onclick="removeReplacementDate('am', '${date}')" class="text-red-400 hover:text-red-600 transition-colors">
          <i class="fa-solid fa-times text-[10px]"></i>
        </button>
      `;
      amReplacementList.appendChild(div);
    });
  }
}

function addReplacementDate(type) {
  const startId = type === "manager" ? "managerReplacementStart" : "amReplacementStart";
  const startDate = document.getElementById(startId).value;

  if (!startDate) {
    alert("Please select a date.");
    return;
  }

  if (type === "manager") {
    if (!siteSettings.managerReplacements) siteSettings.managerReplacements = [];
    if (!siteSettings.managerReplacements.includes(startDate)) {
      siteSettings.managerReplacements.push(startDate);
    }
  } else {
    if (!siteSettings.assistantManagerReplacements) siteSettings.assistantManagerReplacements = [];
    if (!siteSettings.assistantManagerReplacements.includes(startDate)) {
      siteSettings.assistantManagerReplacements.push(startDate);
    }
  }

  document.getElementById(startId).value = "";

  renderReplacementLists();
}

function removeReplacementDate(type, dateStr) {
  if (type === "manager") {
    siteSettings.managerReplacements = siteSettings.managerReplacements.filter((d) => d !== dateStr);
  } else {
    siteSettings.assistantManagerReplacements = siteSettings.assistantManagerReplacements.filter((d) => d !== dateStr);
  }
  renderReplacementLists();
}

function saveOffdaySettings() {
  saveManagerOffdays()
    .then(() => saveAssistantManagerOffdays())
    .then(() => saveManagerReplacements())
    .then(() => saveAssistantManagerReplacements())
    .then(() => {
      backToMenu();
      renderCalendar();
      // Notify leave management system that offdays were updated
      document.dispatchEvent(new CustomEvent('offdaysUpdated'));
    })
    .catch(err => {
      console.error("Failed to save offday settings:", err);
      alert("Failed to save offday settings. Please try again.");
    });
}

function openSectionList() {
  renderSettingsSectionList();
  updateSectionCountBadge();
  showView("sectionsListView");
}

function updateSectionCountBadge() {
  const badge = document.getElementById("sectionCountBadge");
  if (!badge) return;

  const count = siteSettings.sections ? siteSettings.sections.length : 0;
  if (count > 0) {
    badge.textContent = count;
    badge.classList.remove("hidden");
  } else {
    badge.classList.add("hidden");
  }
}

function backToSectionList() {
  showView("sectionsListView");
}

function openSectionEditor(idx = -1) {
  editingSectionIndex = idx;
  document.getElementById("editSectionId").value = idx;

  if (idx === -1) {
    document.getElementById("sectionEditorTitle").textContent = "New Section";
    document.getElementById("editSectionHeader").value = "";
    document.getElementById("editSectionCols").value = "2";
    document.getElementById("btnDeleteSection").classList.add("hidden");
    renderColumnEditors();
  } else {
    const sec = siteSettings.sections[idx];
    document.getElementById("sectionEditorTitle").textContent = "Edit Section";
    document.getElementById("editSectionHeader").value = sec.header || "";
    document.getElementById("editSectionCols").value = sec.cols || "2";
    document.getElementById("btnDeleteSection").classList.remove("hidden");
    renderColumnEditors();

    if (sec.buttons) {
      sec.buttons.forEach((btn) => {
        const colContainer = document.getElementById(`col-${btn.col}-buttons`);
        if (colContainer) {
          const btnDiv = document.createElement("div");
          btnDiv.className = "bg-white border border-slate-200 rounded p-2 space-y-1";
          btnDiv.innerHTML = `
            <input type="text" placeholder="Label" value="${btn.label}" class="btn-label w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-[10px]" data-col="${btn.col}">
            <input type="text" placeholder="URL" value="${btn.url}" class="btn-url w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-[10px]" data-col="${btn.col}">
            <button onclick="this.parentElement.remove()" class="text-red-500 text-[9px] font-bold">× Remove</button>
          `;
          colContainer.insertBefore(btnDiv, colContainer.lastElementChild);
        }
      });
    }

    if (sec.columnHeaders) {
      sec.columnHeaders.forEach((header, i) => {
        const input = document.querySelector(`.col-header[data-col="${i + 1}"]`);
        if (input) input.value = header;
      });
    }
  }

  showView("sectionEditorView");
}

function renderColumnEditors() {
  const cols = parseInt(document.getElementById("editSectionCols").value);
  const container = document.getElementById("columnEditorsContainer");
  container.innerHTML = "";
  container.style.gridTemplateColumns = cols === 1 ? "1fr" : `repeat(${cols}, minmax(0, 1fr))`;

  for (let c = 1; c <= cols; c++) {
    const colDiv = document.createElement("div");
    colDiv.className = "bg-slate-50 border border-slate-200 rounded-lg p-3";
    colDiv.innerHTML = `
      <div class="mb-3">
        <label class="text-[10px] font-bold text-slate-600 uppercase block mb-1">Column ${c} Header</label>
        <input type="text" placeholder="Optional" class="col-header w-full px-2 py-1.5 bg-white border border-slate-200 rounded text-xs font-semibold outline-none focus:border-blue-400" data-col="${c}">
      </div>
      <div class="space-y-2" id="col-${c}-buttons">
        <button onclick="addButtonToColumn(${c})" class="w-full py-1.5 text-[10px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200">
          <i class="fa-solid fa-plus text-[8px] mr-1"></i> Add Button
        </button>
      </div>
    `;
    container.appendChild(colDiv);
  }
}

function addButtonToColumn(col) {
  const container = document.getElementById(`col-${col}-buttons`);
  const btnDiv = document.createElement("div");
  btnDiv.className = "bg-white border border-slate-200 rounded p-2 space-y-1.5";
  btnDiv.innerHTML = `
    <input type="text" placeholder="Button Label" class="btn-label w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs font-semibold outline-none focus:border-blue-400" data-col="${col}">
    <input type="text" placeholder="https://example.com" class="btn-url w-full px-2 py-1.5 bg-blue-50 border border-blue-200 rounded text-xs outline-none focus:border-blue-400" data-col="${col}">
    <button onclick="this.parentElement.remove()" class="w-full text-[9px] font-bold text-red-600 hover:text-red-700 py-1">
      <i class="fa-solid fa-trash text-[8px] mr-1"></i> Remove
    </button>
  `;
  container.insertBefore(btnDiv, container.lastElementChild);
}

function saveSectionLocal() {
  const header = document.getElementById("editSectionHeader").value;
  const idx = parseInt(document.getElementById("editSectionId").value);

  if (!header.trim()) {
    alert("Please enter a section title");
    return;
  }

  const cols = parseInt(document.getElementById("editSectionCols").value);

  const columnHeaders = [];
  for (let c = 1; c <= cols; c++) {
    const input = document.querySelector(`.col-header[data-col="${c}"]`);
    columnHeaders.push(input ? input.value.trim() : "");
  }

  const buttons = [];
  for (let c = 1; c <= cols; c++) {
    const colButtons = document.querySelectorAll(`#col-${c}-buttons .btn-label`);
    let rowIndex = 1;
    colButtons.forEach((labelInput) => {
      const urlInput = labelInput.nextElementSibling;
      const label = labelInput.value.trim();
      const url = urlInput.value.trim();
      if (label && url) {
        buttons.push({ label, url, row: rowIndex, col: c });
        rowIndex++;
      }
    });
  }

  const newSection = {
    header: header,
    type: "buttons",
    cols: cols,
    maxRows: 10,
    columnHeaders: columnHeaders,
    rowTitles: [],
    buttons: buttons,
  };

  if (!siteSettings.sections) siteSettings.sections = [];

  if (idx === -1) {
    siteSettings.sections.push(newSection);
  } else {
    siteSettings.sections[idx] = newSection;
  }

  // Show saving indicator
  const saveBtn = document.querySelector('#sectionEditorView button[onclick="saveSectionLocal()"]');
  const originalText = saveBtn.innerHTML;
  saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> Saving...';
  saveBtn.disabled = true;

  // Save to Supabase with verification
  saveCustomSections()
    .then(async () => {
      // Verify by reading back from ID 30
      const { data: settingsData, error } = await supabaseClient
        .from('site_settings')
        .select('settings')
        .eq('id', 30)
        .single();

      if (error) throw error;

      const savedSections = settingsData?.settings?.sections;

      if (savedSections && savedSections.length === siteSettings.sections.length) {
        renderCustomLinks();
        updateSectionCountBadge();
        openSectionList();
        showSectionSaveSuccess();
      } else {
        throw new Error("Verification failed: Section count mismatch");
      }
    })
    .catch(err => {
      console.error("✗ Failed to save sections:", err);
      saveBtn.innerHTML = originalText;
      saveBtn.disabled = false;
      alert("Failed to save section. Please try again. Error: " + err.message);
    });
}

function showSectionSaveSuccess() {
  const saveBtn = document.querySelector('#sectionEditorView button[onclick="saveSectionLocal()"]');
  const originalText = saveBtn.innerHTML;
  saveBtn.innerHTML = '<i class="fa-solid fa-check mr-1"></i> Saved!';
  saveBtn.classList.remove('bg-slate-800', 'hover:bg-slate-700');
  saveBtn.classList.add('bg-green-600', 'hover:bg-green-700');

  setTimeout(() => {
    saveBtn.innerHTML = originalText;
    saveBtn.classList.remove('bg-green-600', 'hover:bg-green-700');
    saveBtn.classList.add('bg-slate-800', 'hover:bg-slate-700');
  }, 2000);
}

function renderSettingsSectionList() {
  const container = document.getElementById("settingsSectionList");
  container.innerHTML = "";

  if (!siteSettings.sections || siteSettings.sections.length === 0) {
    container.innerHTML =
      '<div class="p-8 text-center text-xs text-slate-400 italic border-2 border-dashed border-slate-200 rounded-lg bg-slate-50">No sections yet. Click + Add to create.</div>';
    return;
  }

  siteSettings.sections.forEach((sec, idx) => {
    const div = document.createElement("div");
    div.className = "flex justify-between items-center p-3 bg-white border-2 border-slate-200 rounded-lg hover:border-slate-300 hover:shadow-sm transition-all";

    let typeLabel = sec.type === "divider" ? "Divider" : "Button Section";
    let detailsText = sec.type === "divider" ? "Horizontal line" : `${sec.cols || 2} Cols × ${sec.buttons ? sec.buttons.length : 0} Buttons`;

    div.innerHTML = `
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-400 to-blue-600 text-white flex items-center justify-center shadow-sm">
          <i class="fa-solid fa-link"></i>
        </div>
        <div>
          <div class="text-sm font-bold text-slate-800">${sec.header || "Untitled"}</div>
          <div class="text-[10px] text-slate-500 font-semibold">${typeLabel} · ${detailsText}</div>
        </div>
      </div>
      <button onclick="openSectionEditor(${idx})" class="text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 w-8 h-8 rounded-lg flex items-center justify-center transition-colors">
        <i class="fa-solid fa-pen text-xs"></i>
      </button>
    `;
    container.appendChild(div);
  });

  // Log section count for verification
}

function deleteSection() {
  const idx = parseInt(document.getElementById("editSectionId").value);
  if (idx === -1) return;

  deleteSectionIdx = idx;
  const modal = document.getElementById("deleteModal");
  const panel = document.getElementById("deleteModalPanel");

  document.querySelector("#deleteModal h3").textContent = "Delete Section?";
  document.querySelector("#deleteModal p").textContent = "All buttons in this section will be removed.";

  modal.classList.remove("hidden");

  setTimeout(() => {
    panel.style.transform = "scale(1)";
    panel.style.opacity = "1";
  }, 10);
}

async function syncSectionsFromSupabase() {
  if (window.DEBUG_MODE) console.log("🔄 Syncing sections from Supabase...");

  try {
    const { data: settingsData, error } = await supabaseClient
      .from('site_settings')
      .select('settings')
      .eq('id', 1)
      .single();

    if (error) throw error;

    const sections = settingsData?.settings?.sections;

    if (sections && Array.isArray(sections) && sections.length > 0) {
      // Verify sections have valid data
      const validSections = sections.filter(sec =>
        sec && typeof sec === 'object' && sec.header && sec.buttons
      );

      if (validSections.length > 0) {
        siteSettings.sections = validSections;
        // Update backup after syncing
        await backupSiteSettings();
        renderCustomLinks();
        renderSettingsSectionList();
        updateSectionCountBadge();
      } else {
        if (window.DEBUG_MODE) console.log("⚠ No valid sections found in Supabase (empty or malformed data)");
      }
    } else {
      if (window.DEBUG_MODE) console.log("⚠ No sections found in Supabase - data might have been lost");
      if (siteSettingsBackup && siteSettingsBackup.sections && siteSettingsBackup.sections.length > 0) {
        // Restore from backup
        siteSettings.sections = siteSettingsBackup.sections;
        // Push backup to Supabase
        const { error: updateError } = await supabaseClient
          .from('site_settings')
          .upsert({
            id: 1,
            settings: siteSettings
          }, { onConflict: 'id' });

        if (updateError) throw updateError;

        if (window.DEBUG_MODE) console.log("✓ Restored", siteSettings.sections.length, "sections from backup to Supabase");
        renderCustomLinks();
        renderSettingsSectionList();
        updateSectionCountBadge();
      } else {
        if (window.DEBUG_MODE) console.log("⚠ No backup available to restore");
      }
    }
  } catch (error) {
    console.error("✗ Error syncing sections:", error);
    alert("Failed to sync sections. Please check your connection.");
  }
}

async function syncEventsFromSupabase() {
  if (window.DEBUG_MODE) console.log("🔄 Syncing events from Supabase...");
  try {
    await refreshEventsFromSupabase();
  } catch (error) {
    console.error("✗ Error syncing events:", error);
    alert("Failed to sync events. Please check your connection.");
  }
}

async function verifySectionsInSupabase() {
  try {
    const { data: settingsData, error } = await supabaseClient
      .from('site_settings')
      .select('settings')
      .eq('id', 1)
      .single();

    if (error) throw error;

    const sections = settingsData?.settings?.sections;
    if (sections && sections.length > 0) {
      if (window.DEBUG_MODE) console.log("✓ Supabase verification:", sections.length, "sections stored");
      sections.forEach((sec, i) => {
        if (window.DEBUG_MODE) console.log(`  Section ${i + 1}:`, sec.header, `(${sec.buttons ? sec.buttons.length : 0} buttons)`);
      });
    } else {
      if (window.DEBUG_MODE) console.log("⚠ Supabase verification: No sections stored yet");
    }
  } catch (error) {
    if (window.DEBUG_MODE) console.error("Error verifying sections:", error);
  }
}

async function verifyEventsInSupabase() {
  try {
    const { data: settingsData, error } = await supabaseClient
      .from('site_settings')
      .select('settings')
      .eq('id', 1)
      .single();
      
    if (error) throw error;

    const events = settingsData?.settings?.events || [];
    if (Array.isArray(events) && events.length > 0) {
      if (window.DEBUG_MODE) console.log("✓ Supabase verification:", events.length, "events stored");
      events.forEach((ev, i) => {
        const isValid = ev.id && ev.title && ev.start && ev.end;
        if (window.DEBUG_MODE) console.log(`  Event ${i + 1}:`, ev.title, `(${ev.start} - ${ev.end}) ${isValid ? '✓' : '✗ INVALID'}`);
      });
    } else {
      if (window.DEBUG_MODE) console.log("⚠ Supabase verification: No events stored yet");
    }
  } catch (error) {
    if (window.DEBUG_MODE) console.error("Error verifying events:", error);
  }
}

// Recovery function for sections
window.recoverSections = async function() {
  // Restore from backup
  if (siteSettingsBackup && siteSettingsBackup.sections && siteSettingsBackup.sections.length > 0) {
    siteSettings.sections = siteSettingsBackup.sections;

    // Save backup to Supabase
    try {
      const { error } = await supabaseClient
        .from('site_settings')
        .upsert({
          id: 1,
          settings: siteSettings
        }, { onConflict: 'id' });

      if (error) throw error;

      renderCustomLinks();
      renderSettingsSectionList();
      updateSectionCountBadge();
      alert(`Recovered ${siteSettings.sections.length} sections from backup!`);
    } catch (err) {
      console.error("Failed to save recovered sections:", err);
      alert("Failed to save recovered sections. Check console for details.");
    }
    return true;
  }

  alert("No backup found. Cannot recover sections.");
  return false;
};

// Status check function
window.sectionsStatus = function() {
  // Check Supabase - use ID 1 for main settings
  supabaseClient
    .from('site_settings')
    .select('settings')
    .eq('id', 1)
    .single()
    .then(({ data: settingsData, error }) => {
      if (error) {
        if (window.DEBUG_MODE) console.log("3. Supabase sections: error -", error.message);
      } else {
        const sections = settingsData?.settings?.sections;
        if (window.DEBUG_MODE) console.log("3. Supabase sections:", sections ? sections.length : 0);
      }
    });
};

// Force backup function
window.forceBackup = function() {
  backupSiteSettings();
};

// Check all backups
window.checkAllBackups = function() {
  // Memory backup
  const memBackup = siteSettingsBackup ? "exists" : "none";
  
  // localStorage backup
  let localBackup = "none";
  try {
    const local = safeStorage.getItem("nadi_siteSettings_backup");
    if (local) {
      localBackup = "exists";
    }
  } catch (e) {
    localBackup = "error";
  }
  
  // Supabase backup - use ID 2 for backup
  supabaseClient
    .from('site_settings')
    .select('settings')
    .eq('id', 2)
    .single()
    .then(({ data: backupData, error }) => {
      if (error) {
        // Supabase backup check complete
      }
    });
};

function diagnoseEventIssues() {
  // Diagnostic function - kept for debugging but silent by default
}

setTimeout(() => {
  // Silent initialization
}, 2000);

async function confirmDelete() {
  if (deleteEventId) {
    // Remove from local array
    events = events.filter((e) => e.id !== deleteEventId);
    
    try {
      // CRITICAL FIX: Delete directly from separate events table
      const { error: deleteError } = await supabaseClient
        .from('events')
        .delete()
        .eq('id', deleteEventId);
      
      if (deleteError) {
        console.error("Failed to delete event from database:", deleteError);
        // Fall back to re-saving all events
        await saveAllSettings();
      }
      
      renderEventList();
      renderCalendar();
      closeDeleteModal();
    } catch (err) {
      console.error("Failed to delete event:", err);
      alert("Failed to delete event. Please try again.");
    }
  } else if (deleteSectionIdx !== null) {
    siteSettings.sections.splice(deleteSectionIdx, 1);

    try {
      await saveCustomSections();
      
      renderCustomLinks();
      updateSectionCountBadge();
      openSectionList();
      closeDeleteModal();

      setTimeout(() => {
        document.querySelector("#deleteModal h3").textContent = "Delete Program?";
        document.querySelector("#deleteModal p").textContent = "This action cannot be undone.";
      }, 300);

      deleteSectionIdx = null;
    } catch (err) {
      console.error("✗ Failed to delete section:", err);
      alert("Failed to delete section. Please try again.");
    }
  } else {
    closeDeleteModal();
  }
}

function closeDeleteModal() {
  const modal = document.getElementById("deleteModal");
  const panel = document.getElementById("deleteModalPanel");

  panel.style.transform = "scale(0.95)";
  panel.style.opacity = "0";

  setTimeout(() => {
    modal.classList.add("hidden");
    deleteEventId = null;
    deleteSectionIdx = null;
  }, 200);
}

function renderCustomLinks() {
  const container = document.getElementById("customLinksWrapper");
  container.innerHTML = "";

  if (!siteSettings.sections || siteSettings.sections.length === 0) return;

  siteSettings.sections.forEach((sec) => {
    const sectionDiv = document.createElement("div");

    if (sec.type === "divider") {
      sectionDiv.className = "my-10 relative";
      sectionDiv.innerHTML = `
        <div class="relative flex justify-center">
          <div class="absolute inset-0 flex items-center" aria-hidden="true">
            <div class="w-full h-0.5 bg-gradient-to-r from-transparent via-slate-300 to-transparent shadow-sm"></div>
          </div>
          <div class="relative bg-slate-50 px-4 py-1">
            <span class="text-xs font-semibold text-slate-600 uppercase tracking-widest">${sec.header}</span>
          </div>
        </div>
        <div class="h-1 bg-gradient-to-b from-slate-200/40 to-transparent"></div>
      `;
    } else {
      sectionDiv.className = "pt-8 mb-8";

      const headerWrapper = document.createElement("div");
      headerWrapper.className = "relative flex justify-center mb-8";
      headerWrapper.innerHTML = `
        <div class="absolute inset-0 flex items-center" aria-hidden="true">
          <div class="w-full h-px bg-gradient-to-r from-transparent via-slate-300 to-transparent"></div>
        </div>
        <div class="relative">
          <div class="bg-gradient-to-b from-white to-slate-50 border border-slate-300 rounded-md px-6 py-2">
            <span class="text-xs font-bold text-slate-700 uppercase tracking-widest">${sec.header}</span>
          </div>
          <div class="absolute -bottom-0.5 left-0 right-0 h-0.5 bg-gradient-to-b from-slate-200/60 to-transparent"></div>
        </div>
      `;
      sectionDiv.appendChild(headerWrapper);

      const gridWrapper = document.createElement("div");
      const cols = sec.cols || 2;

      if (sec.columnHeaders && sec.columnHeaders.some((h) => h.trim())) {
        const headerRow = document.createElement("div");
        headerRow.className = "grid gap-4 mb-3";
        headerRow.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;

        sec.columnHeaders.forEach((headerText, i) => {
          if (i < cols) {
            const colHeader = document.createElement("div");
            colHeader.className = "text-center text-xs font-bold text-slate-600 uppercase tracking-wide py-2 border-b-2 border-slate-300";
            colHeader.textContent = headerText || `Col ${i + 1}`;
            headerRow.appendChild(colHeader);
          }
        });
        gridWrapper.appendChild(headerRow);
      }

      const mainGrid = document.createElement("div");
      mainGrid.className = "grid gap-4";
      mainGrid.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;

      for (let c = 1; c <= cols; c++) {
        const columnDiv = document.createElement("div");
        columnDiv.className = "flex flex-col gap-3";

        const colButtons = sec.buttons
          ? sec.buttons.filter((b) => b.col === c).sort((a, b) => a.row - b.row)
          : [];

        if (colButtons.length > 0) {
          colButtons.forEach((btnData) => {
            const a = document.createElement("a");
            a.href = btnData.url;
            a.target = "_blank";
            a.rel = "noopener noreferrer";
            a.className =
              "flex items-center justify-center gap-1.5 bg-white border border-slate-200 hover:border-nadi hover:text-nadi hover:shadow text-slate-700 font-semibold text-xs py-2 px-3 rounded-lg transition-all";
            a.innerHTML = `<span>${btnData.label}</span><i class="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>`;
            columnDiv.appendChild(a);
          });
        }

        mainGrid.appendChild(columnDiv);
      }

      gridWrapper.appendChild(mainGrid);
      sectionDiv.appendChild(gridWrapper);
    }

    container.appendChild(sectionDiv);
  });
}

function toggleFilter() {
  const fs = document.getElementById("filterSection");
  fs.classList.toggle("filter-hidden");
}

function toggleSort() {
  const ss = document.getElementById("sortSection");
  ss.classList.toggle("filter-hidden");
}

function loadCalendarFilters() {
  if (siteSettings.calendarFilters) {
    siteSettings.calendarFilters = siteSettings.calendarFilters || {
      showCategories: true,
      showHolidays: true,
      showSchoolHolidays: true,
      showOffdays: true,
    };
  }
  if (document.getElementById("filterShowCategories")) {
    document.getElementById("filterShowCategories").checked = siteSettings.calendarFilters.showCategories;
  }
  if (document.getElementById("filterShowHolidays")) {
    document.getElementById("filterShowHolidays").checked = siteSettings.calendarFilters.showHolidays;
  }
  if (document.getElementById("filterShowSchoolHolidays")) {
    document.getElementById("filterShowSchoolHolidays").checked = siteSettings.calendarFilters.showSchoolHolidays;
  }
  if (document.getElementById("filterShowOffdays")) {
    document.getElementById("filterShowOffdays").checked = siteSettings.calendarFilters.showOffdays;
  }
}

function saveCalendarFilters() {
  siteSettings.calendarFilters = siteSettings.calendarFilters || {};
  siteSettings.calendarFilters.showCategories = document.getElementById("filterShowCategories").checked;
  siteSettings.calendarFilters.showHolidays = document.getElementById("filterShowHolidays").checked;
  siteSettings.calendarFilters.showSchoolHolidays = document.getElementById("filterShowSchoolHolidays").checked;
  siteSettings.calendarFilters.showOffdays = document.getElementById("filterShowOffdays").checked;
  saveBasicConfig();
  renderCalendar();
}

function resetCalendarFilters() {
  siteSettings.calendarFilters = {
    showCategories: true,
    showHolidays: true,
    showSchoolHolidays: true,
    showOffdays: true,
  };
  saveCalendarFilters();
}

function toggleCalendarFilter() {
  const panel = document.getElementById("calendarFilterPanel");
  panel.classList.toggle("filter-hidden");
}

document.addEventListener("click", (e) => {
  const panel = document.getElementById("calendarFilterPanel");
  const btn = document.getElementById("calendarFilterBtn");
  if (!panel.classList.contains("filter-hidden") && !panel.contains(e.target) && !btn.contains(e.target)) {
    panel.classList.add("filter-hidden");
  }
});

function applySorting() {
  currentSort = document.getElementById("sortSelect").value;
  renderEventList();
}

function renderCalendar() {
  const grid = document.getElementById("calendarGrid");
  const monthLabel = document.getElementById("calendarMonthLabel");
  const yearLabel = document.getElementById("calendarYearLabel");
  grid.innerHTML = "";

  const date = new Date(currentYear, currentMonth, 1);
  monthLabel.textContent = date.toLocaleDateString("en-US", { month: "long" });
  yearLabel.textContent = currentYear;

  const firstDayIndex = date.getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  for (let i = 0; i < firstDayIndex; i++) {
    grid.appendChild(document.createElement("div"));
  }

  for (let i = 1; i <= daysInMonth; i++) {
    const dayDate = new Date(currentYear, currentMonth, i);
    const dateStr = toLocalISOString(dayDate);
    const isToday = dateStr === toLocalISOString(today);
    const isSelected = window.selectedFilterDate === dateStr;
    const userHolidayObj = siteSettings.publicHolidays && siteSettings.publicHolidays[dateStr];
    const userHoliday = userHolidayObj !== undefined ? userHolidayObj : "";
    const defaultHoliday = defaultHolidays[dateStr] || "";
    const isHoliday = (userHoliday !== "" && userHoliday) || defaultHoliday || "";

    let sHoliday = null;
    let isSchoolHoliday = false;
    let isSchoolHolidayStart = false;
    let isSchoolHolidayEnd = false;

    const allSchoolHolidays = {};
    const userSchoolHolidays = siteSettings.schoolHolidays || {};

    const deletedDefaultKeys = new Set();
    const modifiedDefaultKeys = new Set();

    Object.keys(userSchoolHolidays).forEach((key) => {
      const holiday = userSchoolHolidays[key];
      if (holiday?._deleted) {
        deletedDefaultKeys.add(key);
      } else if (defaultSchoolHolidays[key]) {
        modifiedDefaultKeys.add(key);
        if (holiday?.name && holiday.name !== "") {
          allSchoolHolidays[holiday.start] = { name: holiday.name, start: holiday.start, end: holiday.end };
        }
      } else {
        if (holiday?.name && holiday.name !== "") {
          allSchoolHolidays[holiday.start] = { name: holiday.name, start: holiday.start, end: holiday.end };
        }
      }
    });

    Object.keys(defaultSchoolHolidays).forEach((key) => {
      if (!deletedDefaultKeys.has(key) && !modifiedDefaultKeys.has(key)) {
        const holiday = defaultSchoolHolidays[key];
        allSchoolHolidays[holiday.start] = { name: holiday.name, start: holiday.start, end: holiday.end };
      }
    });

    Object.keys(allSchoolHolidays).forEach((startKey) => {
      const holiday = allSchoolHolidays[startKey];
      if (dateStr >= holiday.start && dateStr <= holiday.end) {
        sHoliday = holiday;
        isSchoolHoliday = true;
        if (dateStr === holiday.start) isSchoolHolidayStart = true;
        if (dateStr === holiday.end) isSchoolHolidayEnd = true;
      }
    });

    const isManagerOffday = siteSettings.managerOffdays && siteSettings.managerOffdays.includes(dateStr);
    const isAMOffday = siteSettings.assistantManagerOffdays && siteSettings.assistantManagerOffdays.includes(dateStr);
    const isManagerReplacement = siteSettings.managerReplacements && siteSettings.managerReplacements.includes(dateStr);
    const isAMReplacement = siteSettings.assistantManagerReplacements && siteSettings.assistantManagerReplacements.includes(dateStr);

    const daysEvents = events.filter((e) => dateStr >= e.start && dateStr <= e.end);

    const cell = document.createElement("button");
    cell.className = `min-h-[36px] w-full rounded-lg flex flex-col items-center justify-center transition-all relative group py-1 ${isSelected ? "bg-white text-blue-600 ring-2 ring-blue-600 z-10" : "hover:bg-slate-50 text-slate-600"}`;

    const numWrapper = document.createElement("div");
    numWrapper.className = "flex items-center justify-center relative w-6 h-6";

    const numSpan = document.createElement("span");
    numSpan.textContent = i;
    numSpan.className = "relative z-20 text-xs font-medium text-slate-800";
    numSpan.style.textShadow = "0 0 2px white";

    if (isToday) {
      numSpan.className += " w-6 h-6 flex items-center justify-center bg-blue-100 text-blue-700 rounded-full font-bold z-[5]";
    }

    if (siteSettings.calendarFilters.showHolidays && isHoliday && siteSettings.calendarFilters.showSchoolHolidays && isSchoolHoliday) {
      const circle = document.createElement("span");
      circle.className = "absolute inset-0 rounded-full border-2 border-slate-300 bg-[#fff59c] z-0";
      numWrapper.appendChild(circle);
    } else if (siteSettings.calendarFilters.showHolidays && isHoliday) {
      const circle = document.createElement("span");
      circle.className = "absolute inset-0 rounded-full bg-slate-300 z-0";
      numWrapper.appendChild(circle);
    } else if (siteSettings.calendarFilters.showSchoolHolidays && isSchoolHoliday) {
      const circle = document.createElement("span");
      circle.className = "absolute inset-0 rounded-full bg-[#fff59c] z-0";
      numWrapper.appendChild(circle);
    }

    numWrapper.appendChild(numSpan);
    if (siteSettings.calendarFilters.showOffdays && isManagerOffday) {
      const existingLines = numWrapper.querySelectorAll(".offday-line-m");
      if (existingLines.length === 0) {
        const line = document.createElement("span");
        line.className = "offday-line-m z-10";
        numWrapper.appendChild(line);
      }
    }
    if (siteSettings.calendarFilters.showOffdays && isAMOffday) {
      const existingLines = numWrapper.querySelectorAll(".offday-line-am");
      if (existingLines.length === 0) {
        const line = document.createElement("span");
        line.className = "offday-line-am z-10";
        numWrapper.appendChild(line);
      }
    }
    if (siteSettings.calendarFilters.showOffdays && isManagerReplacement) {
      const line1 = document.createElement("span");
      line1.className = "absolute rounded-sm z-10";
      line1.style.cssText = "bottom: 2px; left: 4px; width: calc(50% - 6px); height: 2px; background-color: #00aff0; box-shadow: 0 0 3px #00aff0;";
      numWrapper.appendChild(line1);
      const line2 = document.createElement("span");
      line2.className = "absolute rounded-sm z-10";
      line2.style.cssText = "bottom: 2px; right: 4px; width: calc(50% - 6px); height: 2px; background-color: #00aff0; box-shadow: 0 0 3px #00aff0;";
      numWrapper.appendChild(line2);
    }
    if (siteSettings.calendarFilters.showOffdays && isAMReplacement) {
      const line1 = document.createElement("span");
      line1.className = "absolute rounded-sm z-10";
      line1.style.cssText = "bottom: 2px; left: 4px; width: calc(50% - 6px); height: 2px; background-color: #90cf53; box-shadow: 0 0 3px #90cf53;";
      numWrapper.appendChild(line1);
      const line2 = document.createElement("span");
      line2.className = "absolute rounded-sm z-10";
      line2.style.cssText = "bottom: 2px; right: 4px; width: calc(50% - 6px); height: 2px; background-color: #90cf53; box-shadow: 0 0 3px #90cf53;";
      numWrapper.appendChild(line2);
    }

    cell.appendChild(numWrapper);

    if (siteSettings.calendarFilters.showHolidays && isHoliday) {
      const hText = document.createElement("span");
      hText.className = "text-[6px] leading-tight text-center text-slate-500 font-bold mt-0.5 px-0.5 line-clamp-1 w-full";
      hText.textContent = isHoliday;
      cell.appendChild(hText);
    } else if (siteSettings.calendarFilters.showSchoolHolidays && sHoliday && (isSchoolHolidayStart || isSchoolHolidayEnd)) {
      const sText = document.createElement("span");
      sText.className = "text-[6px] leading-tight text-center text-yellow-600 font-bold mt-0.5 px-0.5 line-clamp-1 w-full";
      sText.textContent = sHoliday.name;
      cell.appendChild(sText);
    }

    if (siteSettings.calendarFilters.showCategories && daysEvents.length > 0) {
      const dotsDiv = document.createElement("div");
      dotsDiv.className = "flex gap-0.5 mt-0.5";

      daysEvents.slice(0, 3).forEach((ev) => {
        const dot = document.createElement("span");
        const dotColor = categories[ev.category].dot;
        dot.className = `w-1 h-1 rounded-full ${dotColor}`;
        dotsDiv.appendChild(dot);
      });
      cell.appendChild(dotsDiv);
    }

    cell.onclick = () => {
      clearRangeFilter(false);
      if (window.selectedFilterDate === dateStr) {
        window.selectedFilterDate = null;
        refreshEventsFromSupabase().then(() => {
          renderEventList();
        });
      } else {
        window.selectedFilterDate = dateStr;
        refreshEventsFromSupabase().then(() => {
          renderEventList();
        });
      }
      renderCalendar();
    };

    grid.appendChild(cell);
  }
}

function applyRangeFilter() {
  const start = document.getElementById("filterStart").value;
  const end = document.getElementById("filterEnd").value;

  if (start && end) {
    rangeFilter = { start, end };
    window.selectedFilterDate = null;
    renderCalendar();
    renderEventList();
    document.getElementById("clearRangeBtn").classList.remove("hidden");
  }
}

function openModalWithSelectedDate() {
  openModal(null, window.selectedFilterDate || "");
}

function clearRangeFilter(shouldRender = true) {
  document.getElementById("filterStart").value = "";
  document.getElementById("filterEnd").value = "";
  rangeFilter = { start: null, end: null };
  document.getElementById("clearRangeBtn").classList.add("hidden");
  if (shouldRender) renderEventList();
}

function renderCategoryCounts() {
  const container = document.getElementById("categoryCounts");
  if (!container) return;

  if (!window.selectedFilterDate) {
    container.innerHTML = "";
    return;
  }

  const counts = {
    entrepreneur: 0,
    learning: 0,
    wellbeing: 0,
    awareness: 0,
    gov: 0,
  };

  events.forEach((event) => {
    const start = new Date(event.start);
    const end = new Date(event.end || event.start);
    const selected = new Date(window.selectedFilterDate);

    if (selected >= start && selected <= end) {
      if (counts.hasOwnProperty(event.category)) {
        counts[event.category]++;
      }
    }
  });

  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  if (total === 0) {
    container.innerHTML =
      '<div class="bg-white rounded-lg border border-slate-200 p-3 shadow-sm"><div class="text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-1">Total Programs</div><div class="text-xs text-slate-400 italic text-center py-2">No programs found.</div></div>';
    return;
  }

  let html = '<div class="bg-white rounded-lg border border-slate-200 p-3 shadow-sm">';
  html += '<div class="text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-2">Total Programs</div>';
  html += '<div class="flex flex-wrap gap-2">';

  if (counts.entrepreneur > 0) {
    html += `<div class="flex items-center gap-1.5 px-2 py-1 bg-yellow-100 border border-yellow-200 rounded-md">
      <span class="w-2 h-2 rounded-full bg-yellow-400"></span>
      <span class="text-[8px] font-bold text-yellow-700">USAHAWAN: ${counts.entrepreneur}</span>
    </div>`;
  }

  if (counts.learning > 0) {
    html += `<div class="flex items-center gap-1.5 px-2 py-1 bg-blue-100 border border-blue-200 rounded-md">
      <span class="w-2 h-2 rounded-full bg-blue-500"></span>
      <span class="text-[8px] font-bold text-blue-700">PEMBELAJARAN: ${counts.learning}</span>
    </div>`;
  }

  if (counts.wellbeing > 0) {
    html += `<div class="flex items-center gap-1.5 px-2 py-1 bg-emerald-100 border border-emerald-200 rounded-md">
      <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
      <span class="text-[8px] font-bold text-emerald-700">KESEJAHTERAAN: ${counts.wellbeing}</span>
    </div>`;
  }

  if (counts.awareness > 0) {
    html += `<div class="flex items-center gap-1.5 px-2 py-1 bg-violet-100 border border-violet-200 rounded-md">
      <span class="w-2 h-2 rounded-full bg-violet-500"></span>
      <span class="text-[8px] font-bold text-violet-700">KESEDARAN: ${counts.awareness}</span>
    </div>`;
  }

  if (counts.gov > 0) {
    html += `<div class="flex items-center gap-1.5 px-2 py-1 bg-red-100 border border-red-200 rounded-md">
      <span class="w-2 h-2 rounded-full bg-red-500"></span>
      <span class="text-[8px] font-bold text-red-700">INISIATIF KERAJAAN: ${counts.gov}</span>
    </div>`;
  }

  html += "</div></div>";
  container.innerHTML = html;
}

function renderEventList() {
  renderCategoryCounts();

  // Ensure events is an array
  ensureEventsArray();

  const container = document.getElementById("eventListContainer");
  if (!container) {
    console.error("eventListContainer not found!");
    return;
  }
  container.innerHTML = "";

  let displayEvents = [];

  if (window.selectedFilterDate) {
    displayEvents = events.filter((e) => {
      const isValid = window.selectedFilterDate >= e.start && window.selectedFilterDate <= e.end;
      return isValid;
    });
  } else if (rangeFilter.start && rangeFilter.end) {
    displayEvents = events.filter((e) => e.start <= rangeFilter.end && e.end >= rangeFilter.start);
  } else {
    const todayStr = toLocalISOString(today);
    displayEvents = events.filter((e) => e.end >= todayStr);
  }

  if (currentSort === "category") {
    displayEvents.sort((a, b) => {
      if (a.category !== b.category) return a.start.localeCompare(b.start);
      return a.category.localeCompare(b.category);
    });
  } else if (currentSort === "startTime") {
    displayEvents.sort((a, b) => {
      const dateCompare = a.start.localeCompare(b.start);
      if (dateCompare !== 0) return dateCompare;
      if (a.time && b.time) {
        const timeA = a.time.split(" - ")[0];
        const timeB = b.time.split(" - ")[0];
        const convertTo24 = (time12) => {
          const match = time12.match(/(\d+):(\d+)\s*(AM|PM)/i);
          if (!match) return "0000";
          let hour = parseInt(match[1]);
          const min = match[2];
          const ampm = match[3].toUpperCase();
          if (ampm === "PM" && hour !== 12) hour += 12;
          if (ampm === "AM" && hour === 12) hour = 0;
          return hour.toString().padStart(2, "0") + min;
        };
        return convertTo24(timeA).localeCompare(convertTo24(timeB));
      }
      return 0;
    });
  }

  // =====================================================
  // OPTIMIZATION: Pagination (20 events per page)
  // =====================================================
  const EVENTS_PER_PAGE = 20;
  let currentPage = 0;
  
  // Store pagination state globally
  window.eventListCurrentPage = window.eventListCurrentPage || 0;
  currentPage = window.eventListCurrentPage;
  
  const totalPages = Math.ceil(displayEvents.length / EVENTS_PER_PAGE);
  const paginatedEvents = displayEvents.slice(
    currentPage * EVENTS_PER_PAGE, 
    (currentPage + 1) * EVENTS_PER_PAGE
  );

  if (displayEvents.length === 0) {
    container.innerHTML = `
      <div class="text-center p-6 bg-slate-50 rounded-lg border border-dashed border-slate-300 text-slate-500 text-xs mt-2">
        <i class="fa-regular fa-calendar-xmark text-2xl text-slate-300 mb-2"></i>
        <p class="font-medium">No programs found</p>
        <p class="text-[10px] text-slate-400 mt-1">Select a date to add a program or click "Add" to create one</p>
      </div>
    `;
    
    // Remove pagination if no events
    const existingPagination = container.parentNode.querySelector('.pagination-controls');
    if (existingPagination) existingPagination.remove();
    
    return;
  }

  // Render pagination controls
  let paginationHtml = '';
  if (totalPages > 1) {
    paginationHtml = `
      <div class="pagination-controls flex justify-center items-center gap-4 mt-4 pt-4 border-t border-slate-100">
        <button 
          onclick="changeEventPage(-1)" 
          class="px-4 py-2 text-xs font-bold rounded bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors ${currentPage === 0 ? 'opacity-50 cursor-not-allowed' : ''}"
          ${currentPage === 0 ? 'disabled' : ''}
        >
          <i class="fa-solid fa-chevron-left mr-1"></i> Previous
        </button>
        <span class="text-xs text-slate-500 font-medium">
          Page ${currentPage + 1} of ${totalPages}
        </span>
        <button 
          onclick="changeEventPage(1)" 
          class="px-4 py-2 text-xs font-bold rounded bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors ${currentPage >= totalPages - 1 ? 'opacity-50 cursor-not-allowed' : ''}"
          ${currentPage >= totalPages - 1 ? 'disabled' : ''}
        >
          Next <i class="fa-solid fa-chevron-right ml-1"></i>
        </button>
      </div>
    `;
  }

  // Render events
  let eventsHtml = '';
  
  paginatedEvents.forEach((ev) => {
    // Validate event data
    if (!ev || !ev.id || !ev.start || !ev.end) {
      if (window.DEBUG_MODE) console.warn("Invalid event data:", ev);
      return;
    }

    const cat = categories[ev.category];
    if (!cat) {
      if (window.DEBUG_MODE) console.warn("Invalid category for event:", ev.category, ev);
      return;
    }

    const card = document.createElement("div");
    card.className = "event-card group bg-white rounded-lg border border-slate-200 p-2 shadow-sm relative";

    const startParts = ev.start.split("-");
    const endParts = ev.end.split("-");

    // Validate date parts
    if (startParts.length !== 3 || endParts.length !== 3) {
      if (window.DEBUG_MODE) console.warn("Invalid date format for event:", ev.id, ev.start, ev.end);
      return;
    }

    const d1 = new Date(startParts[0], startParts[1] - 1, startParts[2]);
    const d2 = new Date(endParts[0], endParts[1] - 1, endParts[2]);

    if (isNaN(d1.getTime()) || isNaN(d2.getTime())) {
      if (window.DEBUG_MODE) console.warn("Invalid date for event:", ev.id, d1, d2);
      return;
    }

    let dateDisplay = d1.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    if (ev.start !== ev.end) {
      dateDisplay += " - " + d2.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    }

    let linksHtml = "";
    if (Array.isArray(ev.links) && ev.links.length > 0) {
      linksHtml = '<div class="mt-2 flex flex-col gap-1">';
      ev.links.forEach((l) => {
        if (l.url) {
          linksHtml += `
            <div class="flex items-center gap-2 text-[10px] bg-slate-50 px-2 py-1 rounded border border-slate-100 relative overflow-hidden">
              <span class="font-bold text-slate-600 w-12 truncate shrink-0">${l.platform}</span>
              <a href="${l.url}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline truncate flex-1 block">${l.url}</a>
            </div>`;
        }
      });
      linksHtml += "</div>";
    }

    // Add Registration and Submit Link buttons
    let actionLinksHtml = "";
    const hasRegistrationLinks = ev.registrationLinks && ev.registrationLinks.length > 0;
    const hasSubmitLinks = ev.submitLinks && ev.submitLinks.length > 0;
    
    if (hasRegistrationLinks || hasSubmitLinks) {
      actionLinksHtml = '<div class="mt-2 space-y-2">';
      
      // Add all registration links
      if (hasRegistrationLinks) {
        actionLinksHtml += '<div class="flex flex-col gap-1">';
        actionLinksHtml += '<label class="text-[8px] font-bold text-slate-400 uppercase tracking-wide">Registration Link</label>';
        ev.registrationLinks.forEach((link) => {
          if (link.url) {
            actionLinksHtml += `
            <div class="flex items-center gap-2 text-[9px] bg-slate-50 px-2 py-1 rounded border border-slate-100 relative overflow-hidden">
              <span class="font-bold text-slate-600 w-12 truncate shrink-0">${link.platform || 'NES'}</span>
              <a href="${link.url}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline truncate flex-1 block">${link.url}</a>
            </div>`;
          }
        });
        actionLinksHtml += '</div>';
      }
      
      // Add all submit links
      if (hasSubmitLinks) {
        actionLinksHtml += '<div class="flex flex-col gap-1">';
        actionLinksHtml += '<label class="text-[8px] font-bold text-slate-400 uppercase tracking-wide">Submit Link</label>';
        ev.submitLinks.forEach((link) => {
          if (link.url) {
            actionLinksHtml += `
            <div class="flex items-center gap-2 text-[9px] bg-slate-50 px-2 py-1 rounded border border-slate-100 relative overflow-hidden">
              <span class="font-bold text-slate-600 w-12 truncate shrink-0">${link.platform || 'Jotform'}</span>
              <a href="${link.url}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline truncate flex-1 block">${link.url}</a>
            </div>`;
          }
        });
        actionLinksHtml += '</div>';
      }
      
      actionLinksHtml += "</div>";
    }


    card.innerHTML = `
      <div class="flex flex-col gap-1 relative">
        <div class="flex justify-between items-start">
          <div class="flex-1">
            <span class="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">${dateDisplay}</span>
            <h4 class="text-xs font-bold text-slate-800 leading-tight mt-0.5">${ev.title}</h4>
          </div>
          <div class="flex flex-col items-end w-auto text-right gap-1">
            <div class="flex flex-col items-end justify-center px-2 py-1 rounded border ${cat.color} min-w-[80px]">
              <span class="text-[9px] font-bold uppercase whitespace-nowrap leading-none">${cat.label}</span>
              <span class="text-[8px] opacity-80 whitespace-nowrap leading-none mt-0.5">${cat.sub}</span>
            </div>
            ${ev.subcategory ? `<span class="text-[9px] font-semibold ${cat.color.split(" ")[1]} ${cat.color.split(" ")[2]}">${ev.subcategory}</span>` : ""}
          </div>
        </div>
        ${ev.time || ev.secondTime ? `<div class="text-[10px] text-slate-500 font-medium"><i class="fa-regular fa-clock mr-1"></i>${ev.time || ""}${ev.secondTime ? `<br><i class="fa-regular fa-clock mr-1"></i>${ev.secondTime}` : ""}</div>` : ""}
        ${ev.info ? `
          <div class="mt-1 flex justify-end">
            <button type="button" onclick="toggleEventInfo('${ev.id}')" class="text-[8px] text-slate-500 hover:text-slate-700 flex items-center gap-1 transition-colors cursor-pointer">
              <span class="font-semibold" style="color: #cb233b;">Program Info</span>
              <i id="info-icon-${ev.id}" class="fa-solid fa-chevron-down text-[7px]" style="color: #cb233b;"></i>
            </button>
          </div>
          <div id="event-info-${ev.id}" class="hidden text-[9.5px] text-slate-600 mt-1 bg-slate-50 p-2 rounded leading-relaxed whitespace-pre-line event-info-content overflow-hidden">${sanitizeHTMLWithLinks(ev.info)}</div>
        ` : ""}
        ${linksHtml}
        ${actionLinksHtml}
        <div class="absolute top-0 right-0 flex gap-2 ${showEditDeleteButtons ? "opacity-100" : "opacity-0"} transition-opacity bg-white/80 backdrop-blur pl-2 pb-1 rounded-bl-lg">
          <button onclick="openModal('${ev.id}')" class="text-slate-400 hover:text-blue-600 transition-colors" title="Edit">
            <i class="fa-solid fa-pen text-xs"></i>
          </button>
          <button onclick="deleteEvent('${ev.id}')" class="text-slate-400 hover:text-red-500 transition-colors" title="Delete">
            <i class="fa-solid fa-trash text-xs"></i>
          </button>
        </div>
      </div>
    `;

    container.appendChild(card);
  });
  
  // Add pagination controls at the bottom
  const paginationContainer = container.parentNode.querySelector('.pagination-controls');
  if (paginationContainer) {
    paginationContainer.remove();
  }
  container.insertAdjacentHTML('afterend', paginationHtml || '');
}

// =====================================================
// OPTIMIZATION: Change event page
// =====================================================
function changeEventPage(direction) {
  // Recalculate total
  let displayEvents = events;
  const todayStr = toLocalISOString(today);
  
  if (window.selectedFilterDate) {
    displayEvents = events.filter((e) => window.selectedFilterDate >= e.start && window.selectedFilterDate <= e.end);
  } else if (rangeFilter.start && rangeFilter.end) {
    displayEvents = events.filter((e) => e.start <= rangeFilter.end && e.end >= rangeFilter.start);
  } else {
    displayEvents = events.filter((e) => e.end >= todayStr);
  }
  
  const EVENTS_PER_PAGE = 20;
  const totalPages = Math.ceil(displayEvents.length / EVENTS_PER_PAGE);
  
  window.eventListCurrentPage = Math.max(0, Math.min(totalPages - 1, window.eventListCurrentPage + direction));
  
  renderEventList();
}

function addLinkRow(platform = "NES", url = "") {
  // Legacy function - no longer used since we use registrationLinks and submitLinks
  // Keeping for backward compatibility but does nothing
}


function addRegistrationLink(platform = "Gform", url = "") {
  const container = document.getElementById("registrationLinksContainer");
  const id = Date.now() + Math.random();
  const div = document.createElement("div");
  div.className = "flex gap-2 items-center";
  div.id = `reglink-${id}`;

  const options = platformOptions.map((opt) => `<option value="${opt}" ${platform === opt ? "selected" : ""}>${opt}</option>`).join("");

  div.innerHTML = `
    <select class="w-1/3 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-[10px] outline-none reg-link-platform cursor-pointer">${options}</select>
    <input type="text" placeholder="URL" value="${url}" onchange="fixLinkUrl(this)" class="w-2/3 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-[10px] outline-none reg-link-url">
    <button type="button" onclick="removeRegistrationLink('${id}')" class="text-slate-400 hover:text-red-500"><i class="fa-solid fa-xmark text-xs"></i></button>
  `;
  container.appendChild(div);
}

function addSubmitLink(platform = "Gform", url = "") {
  const container = document.getElementById("submitLinksContainer");
  const id = Date.now() + Math.random();
  const div = document.createElement("div");
  div.className = "flex gap-2 items-center";
  div.id = `sublink-${id}`;

  const options = platformOptions.map((opt) => `<option value="${opt}" ${platform === opt ? "selected" : ""}>${opt}</option>`).join("");

  div.innerHTML = `
    <select class="w-1/3 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-[10px] outline-none sub-link-platform cursor-pointer">${options}</select>
    <input type="text" placeholder="URL" value="${url}" onchange="fixLinkUrl(this)" class="w-2/3 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-[10px] outline-none sub-link-url">
    <button type="button" onclick="removeSubmitLink('${id}')" class="text-slate-400 hover:text-red-500"><i class="fa-solid fa-xmark text-xs"></i></button>
  `;
  container.appendChild(div);
}


function fixLinkUrl(input) {
  let url = input.value.trim();
  if (url && !url.match(/^https?:\/\//i)) {
    input.value = "https://" + url;
  }
}

function removeLinkRow(id) {
  document.getElementById(`link-${id}`).remove();
}

function removeRegistrationLink(id) {
  document.getElementById(`reglink-${id}`).remove();
}

function removeSubmitLink(id) {
  document.getElementById(`sublink-${id}`).remove();
}


function openModal(id = null, dateHint = null) {
  showModal("eventModal", "modalPanel", "eventTitle");

  if (id) {
    // Editing existing event
    const ev = events.find((e) => e.id === id);
    if (!ev) return;

    // Clear all link containers
    const regContainer = document.getElementById("registrationLinksContainer");
    const subContainer = document.getElementById("submitLinksContainer");
    if (regContainer) regContainer.innerHTML = "";
    if (subContainer) subContainer.innerHTML = "";
    
    document.getElementById("modalTitle").textContent = "Edit Program";
    document.getElementById("eventId").value = ev.id;
    document.getElementById("eventTitle").value = ev.title;
    document.getElementById("startDate").value = ev.start;
    document.getElementById("endDate").value = ev.end;



    programInfoContent = ev.info || "";
    updateProgramInfoPreview();
    const hasInfo = !!ev.info;
    const infoContainer = document.getElementById("programInfoContainer");

    if (hasInfo) {
      infoContainer.classList.remove("hidden");
    } else {
      infoContainer.classList.add("hidden");
    }

    const catRadio = document.querySelector(`input[name="category"][value="${ev.category}"]`);
    if (catRadio) {
      catRadio.checked = true;
      updateSubcategories(ev.category);
    }

    if (ev.subcategory) {
      setTimeout(() => {
        document.getElementById("subcategory").value = ev.subcategory;
      }, 50);
    }

    if (ev.time) {
      const parts = ev.time.split(" - ");
      const startPart = parts[0];
      const endPart = parts.length > 1 ? parts[1] : null;

      if (startPart) {
        const timeMatch = startPart.match(/(\d+):(\d+)\s*(AM|PM)/i);
        if (timeMatch) {
          document.getElementById("timeHour").value = timeMatch[1].padStart(2, "0");
          document.getElementById("timeMinute").value = timeMatch[2];
          document.getElementById("timeAMPM").value = timeMatch[3].toUpperCase();
        }
      }

      if (endPart) {
        const timeMatch = endPart.match(/(\d+):(\d+)\s*(AM|PM)/i);
        if (timeMatch) {
          document.getElementById("endTimeHour").value = timeMatch[1].padStart(2, "0");
          document.getElementById("endTimeMinute").value = timeMatch[2];
          document.getElementById("endTimeAMPM").value = timeMatch[3].toUpperCase();
        }
      } else {
        document.getElementById("endTimeHour").value = "";
        document.getElementById("endTimeMinute").value = "00";
        document.getElementById("endTimeAMPM").value = "";
      }
    } else {
      document.getElementById("timeHour").value = "09";
      document.getElementById("timeMinute").value = "00";
      document.getElementById("timeAMPM").value = "AM";
      document.getElementById("endTimeHour").value = "06";
      document.getElementById("endTimeMinute").value = "00";
      document.getElementById("endTimeAMPM").value = "PM";
    }

    if (ev.secondTime) {
      document.getElementById("hasSecondSession").checked = true;
      document.getElementById("secondSessionContainer").classList.remove("hidden");

      const parts = ev.secondTime.split(" - ");
      const startPart = parts[0];
      const endPart = parts.length > 1 ? parts[1] : null;

      if (startPart) {
        const timeMatch = startPart.match(/(\d+):(\d+)\s*(AM|PM)/i);
        if (timeMatch) {
          document.getElementById("time2Hour").value = timeMatch[1].padStart(2, "0");
          document.getElementById("time2Minute").value = timeMatch[2];
          document.getElementById("time2AMPM").value = timeMatch[3].toUpperCase();
        }
      }

      if (endPart) {
        const timeMatch = endPart.match(/(\d+):(\d+)\s*(AM|PM)/i);
        if (timeMatch) {
          document.getElementById("endTime2Hour").value = timeMatch[1].padStart(2, "0");
          document.getElementById("endTime2Minute").value = timeMatch[2];
          document.getElementById("endTime2AMPM").value = timeMatch[3].toUpperCase();
        }
      }
    } else {
    document.getElementById("hasSecondSession").checked = false;
    document.getElementById("secondSessionContainer").classList.add("hidden");
    document.getElementById("time2Hour").value = "";
    document.getElementById("time2Minute").value = "00";
    document.getElementById("time2AMPM").value = "AM";
    document.getElementById("endTime2Hour").value = "";
    document.getElementById("endTime2Minute").value = "00";
    document.getElementById("endTime2AMPM").value = "AM";
  }


    // Populate Registration Links (array)
    if (ev.registrationLinks && ev.registrationLinks.length > 0) {
      ev.registrationLinks.forEach((link) => {
        addRegistrationLink(link.platform || "NES", link.url || "");
      });
    } else {
      // Default: add 1 empty registration link
      addRegistrationLink("NES", "");
    }


    // Populate Submit Links (array)
    if (ev.submitLinks && ev.submitLinks.length > 0) {
      ev.submitLinks.forEach((link) => {
        addSubmitLink(link.platform || "Gform", link.url || "");
      });
    } else {
      // Default: add 1 empty submit link
      addSubmitLink("Gform", "");
    }
  } else {
    // New Program - set defaults
    document.getElementById("eventId").value = "";
    document.getElementById("eventTitle").value = "";
    document.getElementById("programInfoContainer").classList.remove("hidden");
    document.getElementById("subcategorySection").classList.add("hidden");

    programInfoContent = "";
    updateProgramInfoPreview();

    // Set date to today or clicked date
    let dateToUse = dateHint || window.selectedFilterDate;
    if (!dateToUse) {
      dateToUse = toLocalISOString(today);
    }
    
    document.getElementById("modalTitle").textContent = "New Program";
    document.getElementById("startDate").value = dateToUse;
    document.getElementById("endDate").value = dateToUse;
    
    document.getElementById("timeHour").value = "09";
    document.getElementById("timeMinute").value = "00";
    document.getElementById("timeAMPM").value = "AM";
    document.getElementById("endTimeHour").value = "06";
    document.getElementById("endTimeMinute").value = "00";
    document.getElementById("endTimeAMPM").value = "PM";

    document.getElementById("hasSecondSession").checked = false;
    document.getElementById("secondSessionContainer").classList.add("hidden");
    document.getElementById("time2Hour").value = "";
    document.getElementById("time2Minute").value = "00";
    document.getElementById("time2AMPM").value = "AM";
    document.getElementById("endTime2Hour").value = "";
    document.getElementById("endTime2Minute").value = "00";
    document.getElementById("endTime2AMPM").value = "AM";

    // Clear and auto-add default links
    const regContainer = document.getElementById("registrationLinksContainer");
    const subContainer = document.getElementById("submitLinksContainer");
    
    if (regContainer) regContainer.innerHTML = "";
    if (subContainer) subContainer.innerHTML = "";
    
    // Auto-add 1 Registration Link (NES) and 1 Submit Link (Gform)
    addRegistrationLink("NES", "");
    addSubmitLink("Gform", "");
  }
}



function updateEndTime() {
  const startHour = parseInt(document.getElementById("timeHour").value) || 9;
  const startMinute = document.getElementById("timeMinute").value || "00";
  const startAMPM = document.getElementById("timeAMPM").value;

  let endHour = startHour + 1;
  let endAMPM = startAMPM;

  if (endHour > 12) {
    endHour = endHour - 12;
    endAMPM = startAMPM === "AM" ? "PM" : "AM";
  }

  document.getElementById("endTimeHour").value = endHour.toString().padStart(2, "0");
  document.getElementById("endTimeMinute").value = startMinute;
  document.getElementById("endTimeAMPM").value = endAMPM;
}

function updateEndTime2() {
  const startHour = parseInt(document.getElementById("time2Hour").value);
  const startMinute = document.getElementById("time2Minute").value || "00";
  const startAMPM = document.getElementById("time2AMPM").value;

  if (!startHour || !startAMPM) return;

  let endHour = startHour + 1;
  let endAMPM = startAMPM;

  if (endHour > 12) {
    endHour = 1;
    endAMPM = startAMPM === "AM" ? "PM" : "AM";
  }

  document.getElementById("endTime2Hour").value = endHour.toString().padStart(2, "0");
  document.getElementById("endTime2Minute").value = startMinute;
  document.getElementById("endTime2AMPM").value = endAMPM;
}

function toggleProgramInfo() {
  const container = document.getElementById("programInfoContainer");
  const icon = document.getElementById("infoToggleIcon");
  const isOpen = !container.classList.contains("hidden");

  if (isOpen) {
    container.classList.add("hidden");
  } else {
    container.classList.remove("hidden");
  }
  toggleChevron(icon, !isOpen);
}

function openRichTextEditor() {
  const modal = document.getElementById("richTextModal");
  const panel = document.getElementById("richTextPanel");
  const editor = document.getElementById("richTextEditor");

  editor.innerHTML = programInfoContent || "";

  editor.onpaste = function (e) {
    setTimeout(() => {
      autoConvertUrlsToLinks(editor);
    }, 0);
  };

  showModal("richTextModal", "richTextPanel", "richTextEditor");
}

function autoConvertUrlsToLinks(editor) {
  const content = editor.innerHTML;

  const wwwPattern = /\bwww\.[^\s<"\]]+\b/gi;
  const httpPattern = /https?:\/\/[^\s<"\]]+/gi;

  const wwwMatches = content.match(wwwPattern) || [];
  const httpMatches = content.match(httpPattern) || [];
  const allMatches = [...wwwMatches, ...httpMatches];

  if (allMatches.length > 0) {
    const uniqueUrls = [...new Set(allMatches)];

    let newContent = editor.innerHTML;

    uniqueUrls.forEach((url) => {
      const cleanUrl = url.replace(/[.,;:)\]]+$/, "");

      if (newContent.includes(`href="${cleanUrl}"`) || newContent.includes(`href="https://${cleanUrl}"`) || newContent.includes(`href="http://${cleanUrl}"`)) {
        return;
      }

      const fullUrl = url.startsWith("www.") ? `https://${cleanUrl}` : cleanUrl;

      const linkHtml = `<a href="${fullUrl}" target="_blank" style="color: #2563eb; text-decoration: underline;">${cleanUrl}</a>`;

      const escapedUrl = cleanUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

      const urlRegex = new RegExp(escapedUrl, "g");
      newContent = newContent.replace(urlRegex, linkHtml);
    });

    editor.innerHTML = newContent;

    setTimeout(() => {
      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(editor);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }, 0);
  }
}

function closeRichTextModal() {
  hideModal("richTextModal", "richTextPanel");
}

function execFormat(command) {
  document.execCommand(command, false, null);
  document.getElementById("richTextEditor").focus();
}

function changeFontSize(size) {
  if (size) {
    const selectedSize = size + "px";

    document.execCommand("fontSize", false, "7");

    setTimeout(() => {
      const editor = document.getElementById("richTextEditor");
      const fontTags = editor.querySelectorAll('font[size="7"]');
      fontTags.forEach((fontTag) => {
        fontTag.style.fontSize = selectedSize;
        fontTag.removeAttribute("size");
      });
    }, 10);

    document.getElementById("richTextEditor").focus();
  }
  const select = document.querySelector('#richTextModal select[onchange*="changeFontSize"]');
  if (select) select.value = "";
}

function insertLink() {
  const editor = document.getElementById("richTextEditor");
  const selection = window.getSelection();
  const selectedText = selection.toString().trim();

  if (selection.rangeCount > 0) {
    savedSelectionRange = selection.getRangeAt(0).cloneRange();
  }

  const modal = document.getElementById("urlInputModal");
  const panel = document.getElementById("urlInputPanel");
  const urlInput = document.getElementById("urlInputField");
  const textInput = document.getElementById("linkTextField");

  urlInput.value = "https://";
  textInput.value = "";

  if (selectedText) {
    textInput.value = selectedText;
  }

  modal.classList.remove("hidden");

  setTimeout(() => {
    panel.style.transform = "scale(1)";
    panel.style.opacity = "1";
    urlInput.focus();
    urlInput.select();
  }, 10);
}

function confirmInsertLink() {
  const urlInput = document.getElementById("urlInputField");
  const textInput = document.getElementById("linkTextField");
  const url = urlInput.value.trim();
  const displayText = textInput.value.trim();

  if (url) {
    const editor = document.getElementById("richTextEditor");

    if (savedSelectionRange) {
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(savedSelectionRange);
    }

    if (displayText) {
      document.execCommand("insertHTML", false, `<a href="${url}" target="_blank" style="color: #2563eb; text-decoration: underline;">${displayText}</a>`);
    } else {
      document.execCommand("insertHTML", false, `<a href="${url}" target="_blank" style="color: #2563eb; text-decoration: underline;">${url}</a>`);
    }

    editor.focus();
  }

  savedSelectionRange = null;
  closeUrlInputModal();
}

function closeUrlInputModal() {
  hideModal("urlInputModal", "urlInputPanel");
}

function clearFormatting() {
  document.execCommand("removeFormat", false, null);
  document.getElementById("richTextEditor").focus();
}

function confirmRemoveInfo() {
  const modal = document.getElementById("confirmModal");
  const panel = document.getElementById("confirmModalPanel");
  document.querySelector("#confirmModal h3").textContent = "Remove Program Info?";
  document.querySelector("#confirmModal p").textContent = "This will delete all program information.";
  modal.classList.remove("hidden");

  setTimeout(() => {
    panel.style.transform = "scale(1)";
    panel.style.opacity = "1";
  }, 10);
}

function removeInfoConfirmed() {
  programInfoContent = "";
  updateProgramInfoPreview();
  closeConfirmModal();
  closeRichTextModal();
}

function saveRichText() {
  const editor = document.getElementById("richTextEditor");
  programInfoContent = editor.innerHTML.trim();
  updateProgramInfoPreview();
  closeRichTextModal();
}

function updateProgramInfoPreview() {
  const preview = document.getElementById("programInfoPreview");
  preview.textContent = "Click to edit details";
}

function closeConfirmModal() {
  hideModal("confirmModal", "confirmModalPanel");
}

function updateSubcategories(categoryValue) {
  const subcategorySection = document.getElementById("subcategorySection");
  const subcategorySelect = document.getElementById("subcategory");

  if (!categoryValue || !subcategories[categoryValue] || subcategories[categoryValue].length === 0) {
    subcategorySection.classList.add("hidden");
    subcategorySelect.innerHTML = '<option value="">-- Select Sub-Category --</option>';
    return;
  }

  subcategorySection.classList.remove("hidden");
  subcategorySelect.innerHTML = '<option value="">-- Select Sub-Category --</option>';

  subcategories[categoryValue].forEach((sub) => {
    const option = document.createElement("option");
    option.value = sub;
    option.textContent = sub;
    subcategorySelect.appendChild(option);
  });
}

function toggleEventInfo(eventId) {
  const container = document.getElementById("event-info-" + eventId);
  const icon = document.getElementById("info-icon-" + eventId);
  const isOpen = !container.classList.contains("hidden");

  if (isOpen) {
    container.classList.add("hidden");
  } else {
    container.classList.remove("hidden");
  }
  toggleChevron(icon, !isOpen);
}

function toggleSecondSession() {
  const checkbox = document.getElementById("hasSecondSession");
  const container = document.getElementById("secondSessionContainer");
  if (checkbox.checked) {
    container.classList.remove("hidden");
  } else {
    container.classList.add("hidden");
    document.getElementById("time2Hour").value = "";
    document.getElementById("time2Minute").value = "00";
    document.getElementById("time2AMPM").value = "AM";
    document.getElementById("endTime2Hour").value = "";
    document.getElementById("endTime2Minute").value = "00";
    document.getElementById("endTime2AMPM").value = "AM";
  }
}

function closeModal() {
  hideModal("eventModal", "modalPanel");
}

// Show category validation error with red blinking outline
function showCategoryError() {
  const categoryGrid = document.getElementById('categoryGrid');
  const errorText = document.getElementById('categoryErrorText');
  
  if (categoryGrid) {
    // Add blinking red outline class
    categoryGrid.classList.add('category-error');
    
    // Scroll to category section smoothly
    categoryGrid.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    // Remove animation class after it completes (0.8s for 2 blinks)
    setTimeout(() => {
      categoryGrid.classList.remove('category-error');
    }, 800);
  }
  
  if (errorText) {
    // Show error text
    errorText.classList.remove('hidden');
    
    // Hide error text after 5 seconds
    setTimeout(() => {
      errorText.classList.add('hidden');
    }, 5000);
  }
}

// Hide category error
function hideCategoryError() {
  const categoryGrid = document.getElementById('categoryGrid');
  const errorText = document.getElementById('categoryErrorText');
  
  if (categoryGrid) {
    categoryGrid.classList.remove('category-error');
  }
  
  if (errorText) {
    errorText.classList.add('hidden');
  }
}

async function saveEvent() {
  const subcategoryVal = document.getElementById("subcategory").value;
  const programInfoVal = programInfoContent;
  const id = document.getElementById("eventId").value;
  const start = document.getElementById("startDate").value;
  const end = document.getElementById("endDate").value;
  const title = document.getElementById("eventTitle").value;

  const radios = document.getElementsByName("category");
  let category = null;
  for (const r of radios) {
    if (r.checked) category = r.value;
  }

  const timeHour = document.getElementById("timeHour").value;
  const timeMin = document.getElementById("timeMinute").value;
  const timeAMPM = document.getElementById("timeAMPM").value;
  const endTimeHour = document.getElementById("endTimeHour").value;
  const endTimeMin = document.getElementById("endTimeMinute").value;
  const endTimeAMPM = document.getElementById("endTimeAMPM").value;

  const hasSecondSession = document.getElementById("hasSecondSession").checked;
  const time2Hour = document.getElementById("time2Hour").value;
  const time2Min = document.getElementById("time2Minute").value;
  const time2AMPM = document.getElementById("time2AMPM").value;
  const endTime2Hour = document.getElementById("endTime2Hour").value;
  const endTime2Min = document.getElementById("endTime2Minute").value;
  const endTime2AMPM = document.getElementById("endTime2AMPM").value;

  let timeStr = "";
  let secondTimeStr = "";

  if (timeHour && timeMin) {
    timeStr = `${timeHour}:${timeMin} ${timeAMPM}`;
    if (endTimeHour && endTimeMin && endTimeAMPM) {
      timeStr += ` - ${endTimeHour}:${endTimeMin} ${endTimeAMPM}`;
    }
  }

  if (hasSecondSession && time2Hour && time2Min) {
    secondTimeStr = `${time2Hour}:${time2Min} ${time2AMPM}`;
    if (endTime2Hour && endTime2Min && endTime2AMPM) {
      secondTimeStr += ` - ${endTime2Hour}:${endTime2Min} ${endTime2AMPM}`;
    }
  }

  // Old links container no longer used - keeping empty array for backward compatibility
  const links = [];

  // Get Registration Links (multiple)

  const registrationLinkRows = document.querySelectorAll("#registrationLinksContainer > div");
  const registrationLinks = [];
  registrationLinkRows.forEach((row) => {
    const p = row.querySelector(".reg-link-platform").value.trim();
    let u = row.querySelector(".reg-link-url").value.trim();
    if (u && !u.match(/^https?:\/\//i)) {
      u = "https://" + u;
    }
    if (u) {
      registrationLinks.push({ platform: p || "Gform", url: u });
    }
  });

  // Get Submit Links (multiple)
  const submitLinkRows = document.querySelectorAll("#submitLinksContainer > div");
  const submitLinks = [];
  submitLinkRows.forEach((row) => {
    const p = row.querySelector(".sub-link-platform").value.trim();
    let u = row.querySelector(".sub-link-url").value.trim();
    if (u && !u.match(/^https?:\/\//i)) {
      u = "https://" + u;
    }
    if (u) {
      submitLinks.push({ platform: p || "Gform", url: u });
    }
  });


  // Validation with visual feedback
  if (!start || !title) {
    alert("Start Date and Title are required.");
    return;
  }
  
  if (!category) {
    showCategoryError();
    return;
  }
  
  if (end < start) {
    alert("End Date cannot be before Start Date.");
    return;
  }

  // Hide any previous category errors
  hideCategoryError();

  const eventData = {
    id: id || Date.now().toString(),
    title: title,
    category: category,
    subcategory: subcategoryVal || "",
    info: programInfoVal || "",
    start: start,
    end: end || start,
    time: timeStr,
    secondTime: secondTimeStr,
    links: links,
    registrationLinks: registrationLinks,
    submitLinks: submitLinks,
  };


  if (id) {
    // Update existing event - update directly in events table
    const { error: updateError } = await supabaseClient
      .from('events')
      .update(eventData)
      .eq('id', id);
    
    if (updateError) {
      console.error("Error updating event:", updateError);
      alert("Failed to update event. Please try again.");
      return;
    }
    
    // Update local array
    const index = events.findIndex((e) => e.id === id);
    if (index !== -1) events[index] = eventData;
  } else {
    // Add new event - insert directly into events table
    const { error: insertError } = await supabaseClient
      .from('events')
      .insert([eventData]);
    
    if (insertError) {
      console.error("Error inserting event:", insertError);
      alert("Failed to add event. Please try again.");
      return;
    }
    
    // Add to local array
    events.push(eventData);
  }

  closeModal();
  renderCalendar();
  renderEventList();
}

function deleteEvent(id) {
  deleteEventId = id;
  const modal = document.getElementById("deleteModal");
  const panel = document.getElementById("deleteModalPanel");
  modal.classList.remove("hidden");

  setTimeout(() => {
    panel.style.transform = "scale(1)";
    panel.style.opacity = "1";
  }, 10);
}

function openHolidaySettings() {
  tempPublicHolidays = JSON.parse(JSON.stringify(siteSettings.publicHolidays || {}));
  renderHolidayList();
  showView("holidaySettingsView");
}

function renderHolidayList() {
  const listContainer = document.getElementById("holidayList");
  const noMessage = document.getElementById("noHolidayMessage");
  const countSpan = document.getElementById("holidayCount");

  const allHolidays = {};

  Object.keys(defaultHolidays).forEach((date) => {
    allHolidays[date] = { name: defaultHolidays[date], isDefault: true };
  });

  Object.keys(tempPublicHolidays).forEach((date) => {
    allHolidays[date] = { name: tempPublicHolidays[date], isDefault: false };
  });

  const holidayDates = Object.keys(allHolidays).sort();

  countSpan.textContent = `${holidayDates.length} holiday${holidayDates.length !== 1 ? "s" : ""}`;

  if (holidayDates.length === 0) {
    listContainer.innerHTML = "";
    noMessage.style.display = "block";
    return;
  }

  noMessage.style.display = "none";
  listContainer.innerHTML = "";

  holidayDates.forEach((date) => {
    const holidayData = allHolidays[date];
    const holiday = holidayData.name;
    const isDefault = holidayData.isDefault;

    const div = document.createElement("div");
    div.className = "flex items-center justify-between px-2 py-1.5 rounded border border-slate-100";
    div.style.backgroundColor = isDefault ? "#f8fafc" : "#f0fdf4";
    div.id = `holiday-${date}`;

    const dateObj = new Date(date);
    const dateDisplay = dateObj.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

    const badge = isDefault
      ? '<span class="text-[8px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded ml-2">Default</span>'
      : '<span class="text-[8px] bg-green-200 text-green-700 px-1.5 py-0.5 rounded ml-2">Custom</span>';

    div.innerHTML = `
      <div class="flex-1">
        <span class="text-[10px] font-bold text-slate-800">${holiday}</span>
        ${badge}
        <span class="text-[9px] text-slate-500 ml-2">${dateDisplay}</span>
      </div>
      <button onclick="deletePublicHoliday('${date}')" class="text-slate-400 hover:text-red-500 transition-colors" title="Delete">
        <i class="fa-solid fa-trash text-xs"></i>
      </button>
    `;
    listContainer.appendChild(div);
  });
}

function addPublicHoliday() {
  const name = document.getElementById("holidayName").value.trim();
  const date = document.getElementById("holidayDate").value;

  if (!name) return alert("Please enter a holiday name.");
  if (!date) return alert("Please select a date.");

  tempPublicHolidays[date] = name;

  document.getElementById("holidayName").value = "";
  document.getElementById("holidayDate").value = "";

  renderHolidayList();
}

function deletePublicHoliday(date) {
  if (defaultHolidays[date]) {
    tempPublicHolidays[date] = "";
  } else {
    delete tempPublicHolidays[date];
  }
  renderHolidayList();
}

function saveHolidaySettings() {
  siteSettings.publicHolidays = JSON.parse(JSON.stringify(tempPublicHolidays));
  savePublicHolidays();
  closeSettings();
  renderCalendar();
}

function openSchoolHolidaySettings() {
  tempSchoolHolidays = JSON.parse(JSON.stringify(siteSettings.schoolHolidays || {}));
  renderSchoolHolidayList();
  showView("schoolHolidaySettingsView");
}

function renderSchoolHolidayList() {
  const listContainer = document.getElementById("schoolHolidayList");
  const noMessage = document.getElementById("noSchoolHolidayMessage");
  const countSpan = document.getElementById("schoolHolidayCount");

  const allSchoolHolidays = {};

  Object.keys(defaultSchoolHolidays).forEach((key) => {
    const holiday = defaultSchoolHolidays[key];
    const keyDate = holiday.start;
    allSchoolHolidays[keyDate] = {
      name: holiday.name,
      start: holiday.start,
      end: holiday.end,
      isDefault: true,
      originalKey: key,
    };
  });

  Object.keys(tempSchoolHolidays).forEach((key) => {
    const holiday = tempSchoolHolidays[key];

    if (holiday?._deleted) {
      return;
    }

    const keyDate = holiday?.start || key;
    const isHidden = holiday?.name === "";

    allSchoolHolidays[keyDate] = {
      name: holiday?.name || defaultSchoolHolidays[key]?.name || "Unknown",
      start: holiday?.start || key,
      end: holiday?.end || key,
      isDefault: false,
      isHidden: isHidden,
      originalKey: key,
    };
  });

  const holidayKeys = Object.keys(allSchoolHolidays).sort();

  countSpan.textContent = `${holidayKeys.length} holiday${holidayKeys.length !== 1 ? "s" : ""}`;

  if (holidayKeys.length === 0) {
    listContainer.innerHTML = "";
    noMessage.style.display = "block";
    return;
  }

  noMessage.style.display = "none";
  listContainer.innerHTML = "";

  holidayKeys.forEach((key) => {
    const holidayData = allSchoolHolidays[key];
    const holiday = holidayData.name;
    const isDefault = holidayData.isDefault;
    const isHidden = holidayData.isHidden;

    const div = document.createElement("div");
    div.className = "flex items-center justify-between px-2 py-1.5 rounded border border-amber-100";
    if (isHidden) {
      div.style.backgroundColor = "#fef2f2";
    } else if (isDefault) {
      div.style.backgroundColor = "#fefce8";
    } else {
      div.style.backgroundColor = "#dcfce7";
    }
    div.id = `school-holiday-${key}`;

    const startDate = new Date(holidayData.start);
    const endDate = new Date(holidayData.end);

    let dateDisplay;
    if (holidayData.start === holidayData.end) {
      dateDisplay = startDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    } else {
      const startStr = startDate.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
      const endStr = endDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
      dateDisplay = `${startStr} - ${endStr}`;
    }

    let badge;
    if (isHidden) {
      badge = '<span class="text-[8px] bg-red-200 text-red-700 px-1.5 py-0.5 rounded ml-2">Hidden</span>';
    } else if (isDefault) {
      badge = '<span class="text-[8px] bg-amber-200 text-amber-700 px-1.5 py-0.5 rounded ml-2">Default</span>';
    } else {
      badge = '<span class="text-[8px] bg-green-200 text-green-700 px-1.5 py-0.5 rounded ml-2">Custom</span>';
    }

    const editButton = isHidden ? "" : `<button onclick="editSchoolHoliday('${key}', ${isDefault})" class="text-amber-400 hover:text-blue-500 transition-colors" title="Edit"><i class="fa-solid fa-pen text-xs"></i></button>`;

    div.innerHTML = `
      <div class="flex-1">
        <span class="text-[10px] font-bold text-amber-800">${holiday}</span>
        ${badge}
        <span class="text-[9px] text-amber-600 ml-2">${dateDisplay}</span>
      </div>
      <div class="flex items-center gap-1">
        ${editButton}
        <button onclick="deleteSchoolHoliday('${key}', ${isDefault})" class="text-amber-400 hover:text-red-500 transition-colors" title="Delete">
          <i class="fa-solid fa-trash text-xs"></i>
        </button>
      </div>
    `;
    listContainer.appendChild(div);
  });
}

function addSchoolHoliday() {
  const name = document.getElementById("schoolHolidayName").value.trim();
  const startDate = document.getElementById("schoolHolidayStart").value;
  const endDate = document.getElementById("schoolHolidayEnd").value;

  if (!name) return alert("Please enter a holiday name.");
  if (!startDate) return alert("Please select a start date.");
  if (!endDate) return alert("Please select an end date.");
  if (endDate < startDate) return alert("End date cannot be before start date.");

  tempSchoolHolidays[startDate] = {
    name: name,
    start: startDate,
    end: endDate,
  };

  document.getElementById("schoolHolidayName").value = "";
  document.getElementById("schoolHolidayStart").value = "";
  document.getElementById("schoolHolidayEnd").value = "";

  renderSchoolHolidayList();
}

function editSchoolHoliday(key, isDefault) {
  let holiday;

  if (isDefault) {
    holiday = defaultSchoolHolidays[key] || tempSchoolHolidays[key];
  } else {
    holiday = tempSchoolHolidays[key];
  }

  if (!holiday) return;

  document.getElementById("schoolHolidayName").value = holiday.name;
  document.getElementById("schoolHolidayStart").value = holiday.start;
  document.getElementById("schoolHolidayEnd").value = holiday.end;

  const addBtn = document.querySelector("#schoolHolidaySettingsView button[onclick='addSchoolHoliday()']");
  addBtn.textContent = "Update";
  addBtn.onclick = function () {
    updateSchoolHoliday(key, isDefault);
  };

  let cancelBtn = document.getElementById("cancelEditSchoolHoliday");
  if (!cancelBtn) {
    cancelBtn = document.createElement("button");
    cancelBtn.id = "cancelEditSchoolHoliday";
    cancelBtn.className = "w-full py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-600 text-[10px] font-bold rounded transition-colors mt-2";
    cancelBtn.textContent = "Cancel";
    cancelBtn.onclick = resetSchoolHolidayForm;
    addBtn.parentNode.insertBefore(cancelBtn, addBtn.nextSibling);
  }
  cancelBtn.classList.remove("hidden");
}

function updateSchoolHoliday(originalKey, isDefault) {
  const name = document.getElementById("schoolHolidayName").value.trim();
  const startDate = document.getElementById("schoolHolidayStart").value;
  const endDate = document.getElementById("schoolHolidayEnd").value;

  if (!name) return alert("Please enter a holiday name.");
  if (!startDate) return alert("Please select a start date.");
  if (!endDate) return alert("Please select an end date.");
  if (endDate < startDate) return alert("End date cannot be before start date.");

  if (isDefault) {
    tempSchoolHolidays[originalKey] = { _deleted: true, start: originalKey, end: defaultSchoolHolidays[originalKey]?.end };
    tempSchoolHolidays[startDate] = {
      name: name,
      start: startDate,
      end: endDate,
    };
  } else {
    if (originalKey !== startDate) {
      delete tempSchoolHolidays[originalKey];
    }
    tempSchoolHolidays[startDate] = {
      name: name,
      start: startDate,
      end: endDate,
    };
  }

  resetSchoolHolidayForm();
  renderSchoolHolidayList();
}

function resetSchoolHolidayForm() {
  document.getElementById("schoolHolidayName").value = "";
  document.getElementById("schoolHolidayStart").value = "";
  document.getElementById("schoolHolidayEnd").value = "";

  const addBtn = document.querySelector("#schoolHolidaySettingsView button[onclick^='updateSchoolHoliday']");
  if (addBtn) {
    addBtn.textContent = "Add";
    addBtn.onclick = addSchoolHoliday;
  }

  const cancelBtn = document.getElementById("cancelEditSchoolHoliday");
  if (cancelBtn) {
    cancelBtn.classList.add("hidden");
  }
}

function deleteSchoolHoliday(key, isDefault) {
  if (isDefault) {
    tempSchoolHolidays[key] = { _deleted: true, start: key, end: defaultSchoolHolidays[key]?.end };
  } else {
    delete tempSchoolHolidays[key];
  }
  renderSchoolHolidayList();
}

function saveSchoolHolidaySettings() {
  siteSettings.schoolHolidays = JSON.parse(JSON.stringify(tempSchoolHolidays));
  saveSchoolHolidays();
  closeSettings();
  renderCalendar();
}

