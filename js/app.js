const schoolHolidays = {};
window.DEBUG_MODE = false;

function toLocalISOString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isValidDateParts(year, month, day) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const candidate = new Date(year, month - 1, day);
  return candidate.getFullYear() === year
    && candidate.getMonth() === month - 1
    && candidate.getDate() === day;
}

function isoDateToDisplay(isoDate) {
  const match = typeof isoDate === "string" ? isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/) : null;
  if (!match) return "";

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);
  if (!isValidDateParts(year, month, day)) return "";

  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${String(year).padStart(4, "0")}`;
}

function parseDateInputToIso(dateStr) {
  const raw = typeof dateStr === "string" ? dateStr.trim() : "";
  if (!raw) return "";

  let year;
  let month;
  let day;

  const displayMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (displayMatch) {
    day = parseInt(displayMatch[1], 10);
    month = parseInt(displayMatch[2], 10);
    year = parseInt(displayMatch[3], 10);
  } else {
    const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!isoMatch) return "";
    year = parseInt(isoMatch[1], 10);
    month = parseInt(isoMatch[2], 10);
    day = parseInt(isoMatch[3], 10);
  }

  if (!isValidDateParts(year, month, day)) return "";
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function normalizeProgramDateInput(input) {
  if (!input) return "";
  const isoDate = parseDateInputToIso(input.value);
  if (!isoDate) return "";
  input.value = isoDateToDisplay(isoDate);
  return isoDate;
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

function linkifyPlainTextUrlsInElement(rootElement) {
  if (!rootElement || typeof document === "undefined") return;

  const showTextFilter = typeof NodeFilter !== "undefined" ? NodeFilter.SHOW_TEXT : 4;
  const walker = document.createTreeWalker(rootElement, showTextFilter);
  const textNodes = [];
  let node = walker.nextNode();

  while (node) {
    const textValue = typeof node.nodeValue === "string" ? node.nodeValue : "";
    const parentTagName = node.parentElement?.tagName?.toLowerCase() || "";
    const hasUrlLikeText =
      textValue.includes("http://") ||
      textValue.includes("https://") ||
      /\b(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.nadi\.my\b/i.test(textValue);
    if (hasUrlLikeText) {
      if (parentTagName !== "a" && parentTagName !== "script" && parentTagName !== "style") {
        textNodes.push(node);
      }
    }
    node = walker.nextNode();
  }

  const normalizeUrlForAnchor = (rawUrl) => {
    const trimmed = String(rawUrl || "").trim();
    if (!trimmed) return "";

    if (/^https?:\/\//i.test(trimmed)) {
      return trimmed;
    }

    const nadiDomainMatch = trimmed.match(/^((?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.nadi\.my)(\/[^\s<>"']*)?$/i);
    if (nadiDomainMatch) {
      const host = nadiDomainMatch[1];
      const path = nadiDomainMatch[2] || "/";
      const hostWithWww = /^www\./i.test(host) ? host : `www.${host}`;
      return `https://${hostWithWww}${path}`;
    }

    return `https://${trimmed}`;
  };

  textNodes.forEach((textNode) => {
    const textValue = textNode.nodeValue || "";
    const urlRegex = /((?:https?:\/\/[^\s<>"']+)|(?:\b(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.nadi\.my(?:\/[^\s<>"']*)?))/gi;
    let lastIndex = 0;
    let hasMatch = false;
    let match = urlRegex.exec(textValue);
    const fragment = document.createDocumentFragment();

    while (match) {
      hasMatch = true;
      const startIndex = match.index;
      const fullUrl = match[1];
      const punctuationMatch = fullUrl.match(/[),.;!?]+$/);
      const trailingPunctuation = punctuationMatch ? punctuationMatch[0] : "";
      const cleanUrl = trailingPunctuation ? fullUrl.slice(0, -trailingPunctuation.length) : fullUrl;
      if (startIndex > lastIndex) {
        fragment.appendChild(document.createTextNode(textValue.slice(lastIndex, startIndex)));
      }

      const linkEl = document.createElement("a");
      linkEl.href = normalizeUrlForAnchor(cleanUrl);
      linkEl.textContent = cleanUrl;
      linkEl.target = "_blank";
      linkEl.rel = "noopener noreferrer";
      linkEl.className = "text-blue-600 hover:underline break-all";
      fragment.appendChild(linkEl);

      if (trailingPunctuation) {
        fragment.appendChild(document.createTextNode(trailingPunctuation));
      }

      lastIndex = startIndex + fullUrl.length;
      match = urlRegex.exec(textValue);
    }

    if (!hasMatch) return;

    if (lastIndex < textValue.length) {
      fragment.appendChild(document.createTextNode(textValue.slice(lastIndex)));
    }

    if (textNode.parentNode) {
      textNode.parentNode.replaceChild(fragment, textNode);
    }
  });
}

function sanitizeHTMLWithLinks(html) {
  let sanitized = sanitizeHTML(html);
  if (typeof document !== "undefined") {
    const temp = document.createElement("div");
    temp.innerHTML = sanitized;
    linkifyPlainTextUrlsInElement(temp);
    temp.querySelectorAll("a").forEach((a) => {
      const href = String(a.getAttribute("href") || "").trim();
      const needsHttps = href && !/^(https?:\/\/|mailto:|tel:|#|\/)/i.test(href);
      if (needsHttps) {
        const nadiHrefMatch = href.match(/^((?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.nadi\.my)(\/[^\s<>"']*)?$/i);
        if (nadiHrefMatch) {
          const host = nadiHrefMatch[1];
          const path = nadiHrefMatch[2] || "/";
          const hostWithWww = /^www\./i.test(host) ? host : `www.${host}`;
          a.setAttribute("href", `https://${hostWithWww}${path}`);
        } else {
          a.setAttribute("href", `https://${href}`);
        }
      }
      a.setAttribute("target", "_blank");
      a.setAttribute("rel", "noopener noreferrer");
    });
    return temp.innerHTML;
  }
  return sanitized.replace(/<a\s+/gi, '<a target="_blank" rel="noopener noreferrer" ');
}

function escapeAttribute(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function getPlainTextFromHtml(html) {
  const value = typeof html === "string" ? html : "";
  if (!value) return "";
  if (typeof document !== "undefined") {
    const temp = document.createElement("div");
    temp.innerHTML = value;
    return (temp.textContent || temp.innerText || "").replace(/\u00a0/g, " ").trim();
  }
  return value.replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " ").trim();
}

function hasProgramInfoValue(info, images, assumeUnknownHasInfo = false) {
  const hasImages = normalizeProgramImages(images).length > 0;
  if (typeof info !== "string") {
    return hasImages || assumeUnknownHasInfo;
  }

  const plainText = getPlainTextFromHtml(info);
  const normalizedText = plainText.toLowerCase().replace(/\s+/g, " ").trim();
  const isNoInfoPlaceholder =
    normalizedText === "no program info available." ||
    normalizedText === "no program info available";

  if (isNoInfoPlaceholder) {
    return hasImages;
  }

  return hasImages || plainText.length > 0;
}

function setProgramInfoIndicatorColor(eventId, hasInfo) {
  const color = hasInfo ? "#cb233b" : "#94a3b8";
  const label = document.getElementById(`info-label-${eventId}`);
  const icon = document.getElementById(`info-icon-${eventId}`);
  if (label) label.style.color = color;
  if (icon) icon.style.color = color;
}

const appStorage = window.safeStorage || {
  getItem() {
    return null;
  },
  setItem() {},
  removeItem() {}
};

function formatDate(dateStr, options = { weekday: "short", day: "numeric", month: "short", year: "numeric" }) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-GB", options);
}

function getAutoSelectedDateForMonth(year, month) {
  const isCurrentLocalMonth = year === today.getFullYear() && month === today.getMonth();
  if (isCurrentLocalMonth) {
    return toLocalISOString(today);
  }

  const lastDay = new Date(year, month + 1, 0).getDate();
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
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

// Skeleton Loading Functions
function showCalendarSkeleton() {
  const calendarGrid = document.getElementById('calendarGrid');
  const calendarSkeleton = document.getElementById('calendarSkeleton');
  if (calendarGrid && calendarSkeleton) {
    calendarGrid.classList.add('hidden');
    calendarSkeleton.classList.remove('hidden');
  }
}

function hideCalendarSkeleton() {
  const calendarGrid = document.getElementById('calendarGrid');
  const calendarSkeleton = document.getElementById('calendarSkeleton');
  if (calendarGrid && calendarSkeleton) {
    calendarGrid.classList.remove('hidden');
    calendarSkeleton.classList.add('hidden');
  }
}

function showEventListSkeleton() {
  const eventListContainer = document.getElementById('eventListContainer');
  const eventListSkeleton = document.getElementById('eventListSkeleton');
  if (eventListContainer && eventListSkeleton) {
    eventListContainer.classList.add('hidden');
    eventListSkeleton.classList.remove('hidden');
  }
}

function hideEventListSkeleton() {
  const eventListContainer = document.getElementById('eventListContainer');
  const eventListSkeleton = document.getElementById('eventListSkeleton');
  if (eventListContainer && eventListSkeleton) {
    eventListContainer.classList.remove('hidden');
    eventListSkeleton.classList.add('hidden');
  }
}

function showAllSkeletons() {
  showCalendarSkeleton();
  showEventListSkeleton();
}

function hideAllSkeletons() {
  hideCalendarSkeleton();
  hideEventListSkeleton();
}

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
const EVENT_SUMMARY_SELECT_COLUMNS = "id,title,start,end,category,subcategory,time,secondTime,links,registrationLinks,submitLinks";
const EVENT_DETAIL_SELECT_COLUMNS = "id,info,images";
const EVENT_DETAIL_FALLBACK_SELECT_COLUMNS = "id,info";
const EVENT_DETAIL_CACHE_DURATION = 10 * 60 * 1000; // 10 minutes
const MAX_PROGRAM_INFO_BYTES = 120 * 1024; // 120 KB
const MAX_PROGRAM_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
const PROGRAM_IMAGE_BUCKET = "announcement-images";
const PROGRAM_IMAGE_DISABLED_MSG = "Program images are disabled until the `images` column exists in Supabase.";
let eventsCache = {
  data: null,
  timestamp: null,
  monthKey: null  // Store which month this cache is for
};
const eventDetailsCache = new Map();

function clearEventsCache() {
  eventsCache = {
    data: null,
    timestamp: null,
    monthKey: null
  };
  try {
    appStorage.removeItem('events_cache');
  } catch (e) {
    if (window.DEBUG_MODE) console.warn('Could not clear events cache:', e);
  }
}

function getUtf8ByteLength(value) {
  const safeValue = typeof value === "string" ? value : "";
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(safeValue).length;
  }
  return unescape(encodeURIComponent(safeValue)).length;
}

function containsEmbeddedDataImage(html) {
  if (!html) return false;
  return /data:image\/[a-zA-Z0-9.+-]+;base64,/i.test(html);
}

// =====================================================
// OPTIMIZATION: Load events for specific month
// =====================================================
  async function loadEventsForMonth(year, month, forceRefresh = false) {
    const firstDay = new Date(year, month, 1).toISOString().split('T')[0];
    const lastDay = new Date(year, month + 1, 0).toISOString().split('T')[0];
    const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
  
  // Check cache first
  if (!forceRefresh &&
      eventsCache.monthKey === monthKey && 
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
      .lte('start', lastDay)
      .gte('end', firstDay)
      .order('start', { ascending: true });

    let { data, error } = await queryEventsForMonth(EVENT_SUMMARY_SELECT_COLUMNS);

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
    appStorage.setItem('events_cache', JSON.stringify({
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

async function loadEventsForDateRange(startDate, endDate) {
  const { data, error } = await supabaseClient
    .from('events')
    .select(EVENT_SUMMARY_SELECT_COLUMNS)
    .lte('start', endDate)
    .gte('end', startDate)
    .order('start', { ascending: true });

  if (error) throw error;
  return data || [];
}

function normalizeProgramImages(images) {
  if (!Array.isArray(images)) return [];
  return images
    .map((img) => {
      if (!img) return null;
      if (typeof img === "string") {
        return { url: img, path: null, name: "" };
      }
      const url = img.url || img.publicUrl || img.href || "";
      if (!url) return null;
      return {
        url: url,
        path: img.path || null,
        name: img.name || ""
      };
    })
    .filter(Boolean);
}

function cloneProgramImages(images) {
  return normalizeProgramImages(images).map((img) => ({
    url: img.url,
    path: img.path || null,
    name: img.name || ""
  }));
}

function areProgramImagesEqual(left, right) {
  return JSON.stringify(cloneProgramImages(left)) === JSON.stringify(cloneProgramImages(right));
}

function setProgramImagesEnabled(isEnabled) {
  programImagesEnabled = Boolean(isEnabled);

  const input = document.getElementById("programInfoImages");
  const button = document.getElementById("programInfoImagesButton");
  const note = document.getElementById("programInfoImagesDisabledNote");
  const zone = document.getElementById("programInfoImageDropzone");

  if (input) input.disabled = !programImagesEnabled;
  if (button) {
    button.disabled = !programImagesEnabled;
    button.classList.toggle("opacity-50", !programImagesEnabled);
    button.classList.toggle("cursor-not-allowed", !programImagesEnabled);
  }
  if (zone) {
    zone.classList.toggle("opacity-60", !programImagesEnabled);
    zone.classList.toggle("cursor-not-allowed", !programImagesEnabled);
  }
  if (note) note.classList.toggle("hidden", programImagesEnabled);
}

async function ensureProgramImagesFeatureSupport() {
  if (programImagesCapabilityChecked) return programImagesEnabled;
  if (!supabaseClient) return programImagesEnabled;

  try {
    const { error } = await supabaseClient
      .from("events")
      .select("id,images")
      .limit(1);

    if (error && isMissingColumnError(error)) {
      setProgramImagesEnabled(false);
    } else if (!error) {
      setProgramImagesEnabled(true);
    }
  } catch (error) {
    if (window.DEBUG_MODE) console.warn("Program image capability check failed:", error);
  }

  programImagesCapabilityChecked = true;
  return programImagesEnabled;
}

async function loadEventDetailsById(eventId, forceRefresh = false) {
  if (!eventId) {
    return { info: "", images: [] };
  }

  const cached = eventDetailsCache.get(eventId);
  if (!forceRefresh && cached && (Date.now() - cached.timestamp) < EVENT_DETAIL_CACHE_DURATION) {
    return {
      info: typeof cached.info === "string" ? cached.info : "",
      images: cloneProgramImages(cached.images)
    };
  }

  let { data, error } = await supabaseClient
    .from("events")
    .select(EVENT_DETAIL_SELECT_COLUMNS)
    .eq("id", eventId)
    .single();

  if (error && isMissingColumnError(error)) {
    setProgramImagesEnabled(false);
    programImagesCapabilityChecked = true;
    const fallback = await supabaseClient
      .from("events")
      .select(EVENT_DETAIL_FALLBACK_SELECT_COLUMNS)
      .eq("id", eventId)
      .single();
    data = fallback.data;
    error = fallback.error;
  }

  if (error) throw error;

  const details = {
    info: typeof data?.info === "string" ? data.info : "",
    images: programImagesEnabled ? normalizeProgramImages(data?.images) : []
  };

  eventDetailsCache.set(eventId, {
    info: details.info,
    images: cloneProgramImages(details.images),
    timestamp: Date.now()
  });

  const eventInList = events.find((eventItem) => eventItem.id === eventId);
  if (eventInList) {
    eventInList.info = details.info;
    if (programImagesEnabled) {
      eventInList.images = cloneProgramImages(details.images);
    }
  }

  return details;
}

async function loadEventInfoById(eventId, forceRefresh = false) {
  const details = await loadEventDetailsById(eventId, forceRefresh);
  return details.info;
}

async function prefetchEventDetailsForVisibleEventIds(eventIds) {
  if (!Array.isArray(eventIds) || eventIds.length === 0 || !supabaseClient) return;

  const uniqueIds = [...new Set(eventIds.filter((id) => id !== null && id !== undefined && id !== ""))];
  if (!uniqueIds.length) return;

  const now = Date.now();
  const idsToFetch = [];

  uniqueIds.forEach((eventId) => {
    const cached = eventDetailsCache.get(eventId);
    if (cached && (now - cached.timestamp) < EVENT_DETAIL_CACHE_DURATION) {
      const eventInList = events.find((eventItem) => String(eventItem.id) === String(eventId));
      if (eventInList) {
        eventInList.info = typeof cached.info === "string" ? cached.info : "";
        if (programImagesEnabled) {
          eventInList.images = cloneProgramImages(cached.images);
        }
      }
      setProgramInfoIndicatorColor(eventId, hasProgramInfoValue(cached.info, cached.images, false));
      return;
    }

    const inFlightKey = String(eventId);
    if (prefetchEventDetailsInFlight.has(inFlightKey)) return;
    prefetchEventDetailsInFlight.add(inFlightKey);
    idsToFetch.push(eventId);
  });

  if (!idsToFetch.length) return;

  try {
    let { data, error } = await supabaseClient
      .from("events")
      .select(EVENT_DETAIL_SELECT_COLUMNS)
      .in("id", idsToFetch);

    if (error && isMissingColumnError(error)) {
      setProgramImagesEnabled(false);
      programImagesCapabilityChecked = true;
      const fallback = await supabaseClient
        .from("events")
        .select(EVENT_DETAIL_FALLBACK_SELECT_COLUMNS)
        .in("id", idsToFetch);
      data = fallback.data;
      error = fallback.error;
    }

    if (error) throw error;

    const rows = Array.isArray(data) ? data : [];
    const rowsById = new Map(rows.map((row) => [String(row.id), row]));
    const timestamp = Date.now();

    idsToFetch.forEach((eventId) => {
      const row = rowsById.get(String(eventId));
      const details = {
        info: typeof row?.info === "string" ? row.info : "",
        images: programImagesEnabled ? normalizeProgramImages(row?.images) : []
      };

      eventDetailsCache.set(eventId, {
        info: details.info,
        images: cloneProgramImages(details.images),
        timestamp: timestamp
      });

      const eventInList = events.find((eventItem) => String(eventItem.id) === String(eventId));
      if (eventInList) {
        eventInList.info = details.info;
        if (programImagesEnabled) {
          eventInList.images = cloneProgramImages(details.images);
        }
      }

      setProgramInfoIndicatorColor(eventId, hasProgramInfoValue(details.info, details.images, false));
    });
  } catch (error) {
    if (window.DEBUG_MODE) console.warn("Failed to prefetch event details for list indicators:", error);
  } finally {
    idsToFetch.forEach((eventId) => {
      prefetchEventDetailsInFlight.delete(String(eventId));
    });
  }
}

// =====================================================
// OPTIMIZATION: Load from cache or Supabase
// =====================================================
async function loadEventsWithCache() {
  showAllSkeletons();
  
  // Try to load from localStorage cache first
  try {
    const cached = appStorage.getItem('events_cache');
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

        hideAllSkeletons();
        renderCalendar();
        renderEventList();
        return; // Skip Supabase loading
      }
    }
  } catch (e) {
    if (window.DEBUG_MODE) console.warn('Could not read events cache:', e);
  }

  // Load from Supabase if no valid cache
  try {
    const monthEvents = await loadEventsForMonth(currentYear, currentMonth);
    events = monthEvents;
    hideAllSkeletons();
    renderCalendar();
    renderEventList();
  } catch (error) {
    hideAllSkeletons();
    throw error;
  }
}

async function backupSiteSettings() {
  siteSettingsBackup = JSON.parse(JSON.stringify(siteSettings));
  // Also save to localStorage as secondary backup
  try {
    appStorage.setItem("nadi_siteSettings_backup", JSON.stringify(siteSettings));
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
        appStorage.setItem("nadi_siteSettings_backup", JSON.stringify(backupData.settings));
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
    const localBackup = appStorage.getItem("nadi_siteSettings_backup");
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

const ANNOUNCEMENT_SELECT_COLUMNS = "id,title,content,category,ssoMain,ssoSub,dueDate,isUrgent,created_at";
const LATEST_ANNOUNCEMENT_SELECT_COLUMNS = "id,created_at";
let announcements = [];
let latestAnnouncementMeta = null;
let programInfoContent = "";
let originalProgramInfoContent = "";
let programImagesEnabled = true;
let programImagesCapabilityChecked = false;
let programExistingImages = [];
let programNewImageFiles = [];
let programRemovedImages = [];
let originalProgramImages = [];
let editorProgramExistingImages = [];
let editorProgramNewImageFiles = [];
let editorProgramRemovedImages = [];
let programEditorPreviewUrls = [];
let eventImageMap = {};
let currentProgramImageUrl = "";
let currentProgramImageName = "";
let currentProgramImageList = [];
let currentProgramImageIndex = 0;
let programImageMaximized = false;
const prefetchEventDetailsInFlight = new Set();
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
let eventListLookup = new Map();
const PROGRAM_LIST_VIEW_RECENT = "recent";
const PROGRAM_LIST_VIEW_NADI4U = "nadi4u";
let currentProgramListView = PROGRAM_LIST_VIEW_NADI4U;
let nadi4uSearchQuery = "";
let nadi4uSubcategoryFilter = "";
let nadi4uSubcategoryFilterSource = "";
let nadi4uSearchDebounceTimer = null;
const NADI4U_SEARCH_DEBOUNCE_MS = 350;

const NADI4U_SCHEDULE_STORAGE_KEY = "nadi4uSchedule";
const NADI4U_EVENT_META_STORAGE_KEY = "nadi4uEventMeta";
const NADI4U_HEADER_ROLE_MANAGER = "manager";
const NADI4U_HEADER_ROLE_ASSISTANT = "assistantmanager";
const NADI4U_AUTO_LOGIN_EMAIL = "assistantmanager@kebun-bunga.nadi.my";
const NADI4U_AUTO_LOGIN_PASSWORD = "1234qwefASDF#";
const NADI4U_AUTO_LOGIN_SITE_NAME = "NADI Kebun Bunga";
const NADI4U_AUTO_LOGIN_SITE_SLUG = "kebun-bunga";
const NADI4U_AUTO_LOGIN_SOURCE = "autoKebunBunga";
let nadi4uAutoLoginSyncPromise = null;
const NADI4U_LIST_TYPE_DAY = "day";
const NADI4U_LIST_TYPE_MULTI = "multi";
let nadi4uListType = NADI4U_LIST_TYPE_DAY;
const NADI4U_WEEKLY_VIEW_RECENT = "recent";
const NADI4U_WEEKLY_VIEW_ALL = "all";
let nadi4uWeeklyViewMode = NADI4U_WEEKLY_VIEW_RECENT;
const EXTERNAL_NADI4U_CATEGORY = {
  label: "Smart Services",
  sub: "NADI4U",
  color: "bg-cyan-100 text-cyan-700 border-cyan-200",
  dot: "bg-cyan-500",
};
const NADI4U_KPI_TITLE_RULES = [
  {
    category: "wellbeing",
    subcategory: "CARE",
    patterns: [/\bnadi[\s-]*care\b/i, /\bnadicare\b/i, /\bsihat\s+ramadan\b/i]
  },
  {
    category: "entrepreneur",
    subcategory: "Preneur",
    patterns: [/\bnadi[\s-]*preneur\b/i, /\bnadipreneur\b/i]
  },
  {
    category: "entrepreneur",
    subcategory: "Kidventure",
    patterns: [/\bkids?\s*venture\b/i, /\bkidventure\b/i]
  },
  {
    category: "entrepreneur",
    subcategory: "EmpowHer",
    patterns: [/\bempow\s*her\b/i, /\bempowerher\b/i]
  },
  {
    category: "learning",
    subcategory: "DiLea",
    patterns: [/\bdilea\b/i]
  },
  {
    category: "learning",
    subcategory: "Mahir",
    patterns: [/\bmahir\s+baiki\s+gajet\b/i, /\bmahir\b/i]
  },
  {
    category: "awareness",
    subcategory: "KIS",
    patterns: [/\bkempen\s+internet\s+selamat\b/i, /\(\s*kis\s*\)/i, /\bkis\b/i]
  }
];
const NADI4U_KPI_PILLAR_RULES = [
  {
    category: "entrepreneur",
    patterns: [/\bentrepreneur(ship)?\b/i, /\bkeusahawan(an)?\b/i, /\busahawan\b/i]
  },
  {
    category: "learning",
    patterns: [/\blifelong\s+learning\b/i, /\bpembelajaran\b/i, /\bsepanjang\s+hayat\b/i]
  },
  {
    category: "wellbeing",
    patterns: [/\bwell\s*being\b/i, /\bwellbeing\b/i, /\bkesejahteraan\b/i]
  },
  {
    category: "awareness",
    patterns: [/\bawareness\b/i, /\bkesedaran\b/i]
  },
  {
    category: "gov",
    patterns: [/\bgov(?:ernment)?\s*initiative\b/i, /\binisiatif\b/i, /\bkerajaan\b/i, /\bmydigital\s*id\b/i]
  }
];
const NADI4U_KPI_SUBCATEGORY_RULES = [
  {
    category: "entrepreneur",
    subcategory: "Preneur",
    patterns: [/\bpreneur\b/i]
  },
  {
    category: "entrepreneur",
    subcategory: "EmpowHer",
    patterns: [/\bempow\s*her\b/i, /\bempowerher\b/i]
  },
  {
    category: "entrepreneur",
    subcategory: "Kidventure",
    patterns: [/\bkids?\s*venture\b/i, /\bkidventure\b/i]
  },
  {
    category: "learning",
    subcategory: "eKelas Keusahawanan",
    patterns: [/\bekelas\b.*\bkeusahawanan\b/i, /\bkeusahawanan\b.*\bekelas\b/i]
  },
  {
    category: "learning",
    subcategory: "DiLea",
    patterns: [/\bdilea\b/i]
  },
  {
    category: "learning",
    subcategory: "Cybersecurity",
    patterns: [/\bcyber\s*security\b/i, /\bcybersecurity\b/i]
  },
  {
    category: "learning",
    subcategory: "eKelas Maxis",
    patterns: [/\bekelas\b.*\bmaxis\b/i, /\bmaxis\b.*\bekelas\b/i]
  },
  {
    category: "learning",
    subcategory: "Tinytechies",
    patterns: [/\btiny\s*techies\b/i, /\btinytechies\b/i]
  },
  {
    category: "learning",
    subcategory: "eSport",
    patterns: [/\be\s*sport\b/i, /\besport\b/i]
  },
  {
    category: "learning",
    subcategory: "Mahir",
    patterns: [/\bmahir\b/i]
  },
  {
    category: "wellbeing",
    subcategory: "CARE",
    patterns: [/\bcare\b/i, /\bnadi[\s-]*care\b/i, /\bsihat\s+ramadan\b/i]
  },
  {
    category: "wellbeing",
    subcategory: "MenWell",
    patterns: [/\bmen\s*well\b/i, /\bmenwell\b/i]
  },
  {
    category: "wellbeing",
    subcategory: "FlourisHer",
    patterns: [/\bflouris\s*her\b/i, /\bflourisher\b/i]
  },
  {
    category: "awareness",
    subcategory: "KIS",
    patterns: [/\bkempen\s+internet\s+selamat\b/i, /\(\s*kis\s*\)/i, /\bkis\b/i]
  },
  {
    category: "gov",
    subcategory: "MyDigital ID",
    patterns: [/\bmy\s*digital\s*id\b/i, /\bmydigital\s*id\b/i]
  }
];

function getNadi4uStorageItem(key) {
  let value = null;

  try {
    value = appStorage?.getItem ? appStorage.getItem(key) : null;
  } catch (error) {
    value = null;
  }

  if (value !== null && value !== undefined && value !== "") {
    return value;
  }

  try {
    return localStorage.getItem(key);
  } catch (error) {
    return null;
  }
}

function setNadi4uStorageItem(key, value) {
  const serialized = typeof value === "string" ? value : JSON.stringify(value);

  try {
    if (appStorage?.setItem) {
      appStorage.setItem(key, serialized);
    }
  } catch (error) {}

  try {
    localStorage.setItem(key, serialized);
  } catch (error) {}
}

function parseStoredJsonArray(key) {
  const raw = getNadi4uStorageItem(key);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (window.DEBUG_MODE) console.warn(`Invalid JSON in ${key}:`, error);
    return [];
  }
}

function sanitizeEventCardIdPart(value) {
  return String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/-+/g, "-");
}

function format24HourTo12Hour(timeValue) {
  if (typeof timeValue !== "string") return "";
  const match = timeValue.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return "";

  let hour = parseInt(match[1], 10);
  const minute = match[2];
  const suffix = hour >= 12 ? "PM" : "AM";
  hour = hour % 12;
  if (hour === 0) hour = 12;

  return `${hour}:${minute} ${suffix}`;
}

function formatNadi4uTimeRange(startTime, endTime) {
  const start = format24HourTo12Hour(startTime);
  const end = format24HourTo12Hour(endTime);
  let durationLabel = "";

  if (start && end) {
    const startDate = new Date(`2000-01-01T${String(startTime).trim()}`);
    const endDate = new Date(`2000-01-01T${String(endTime).trim()}`);
    if (!Number.isNaN(startDate.getTime()) && !Number.isNaN(endDate.getTime())) {
      const diffHours = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60));
      durationLabel = ` (${diffHours}h)`;
    }
  }

  if (start && end) return `${start} - ${end}${durationLabel}`;
  if (start) return start;
  if (end) return end;
  return "";
}

function extractUrlsFromProgramInfo(infoContent) {
  const value = typeof infoContent === "string" ? infoContent : "";
  if (!value) return [];

  const urls = [];
  const pushUrl = (url) => {
    const href = String(url || "").trim();
    if (!href || !/^https?:\/\//i.test(href)) return;
    urls.push(href);
  };

  if (typeof document !== "undefined") {
    const temp = document.createElement("div");
    temp.innerHTML = typeof sanitizeHTMLWithLinks === "function" ? sanitizeHTMLWithLinks(value) : value;
    temp.querySelectorAll("a").forEach((anchor) => {
      pushUrl(anchor.getAttribute("href"));
    });
  } else {
    const urlRegex = /https?:\/\/[^\s<>"']+/gi;
    const matches = value.match(urlRegex) || [];
    matches.forEach((url) => {
      pushUrl(url);
    });
  }

  const seen = new Set();
  return urls.filter((url) => {
    const key = url.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function mergeRegistrationLinksWithProgramInfo(registrationLinks, infoContent) {
  const baseLinks = Array.isArray(registrationLinks)
    ? registrationLinks.filter((link) => link && typeof link.url === "string" && link.url.trim())
    : [];

  const result = baseLinks.map((link) => ({
    platform: link.platform || "NES",
    url: String(link.url || "").trim(),
    message: link.message || undefined
  }));

  const existingUrlSet = new Set(result.map((link) => link.url.toLowerCase()));
  const infoUrls = extractUrlsFromProgramInfo(infoContent);
  infoUrls.forEach((url) => {
    const key = url.toLowerCase();
    if (existingUrlSet.has(key)) return;
    result.push({ platform: "Website", url });
    existingUrlSet.add(key);
  });

  return result;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function toIsoDateFromDateTime(value) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  const datePart = trimmed.includes("T") ? trimmed.split("T")[0] : trimmed;
  return parseDateInputToIso(datePart);
}

function compareNadi4uScheduleRows(left, right) {
  const dateCompare = String(left?.schedule_date || "").localeCompare(String(right?.schedule_date || ""));
  if (dateCompare !== 0) return dateCompare;

  const dayLeft = Number.parseInt(left?.day_number, 10);
  const dayRight = Number.parseInt(right?.day_number, 10);
  if (Number.isFinite(dayLeft) && Number.isFinite(dayRight) && dayLeft !== dayRight) {
    return dayLeft - dayRight;
  }

  return String(left?.start_time || "").localeCompare(String(right?.start_time || ""));
}

function getStoredNadi4uEventMetaMap() {
  const rows = parseStoredJsonArray(NADI4U_EVENT_META_STORAGE_KEY);
  const map = new Map();

  rows.forEach((row) => {
    const id = typeof row?.id === "string" ? row.id.trim() : "";
    if (!id) return;
    map.set(id, row);
  });

  return map;
}

function getTakwimSmartServiceGroup(categoryName) {
  const normalized = String(categoryName || "").trim().toLowerCase();
  if (!normalized) return "other";
  if (normalized.includes("nadi4u")) return "nadi4u";
  if (normalized.includes("nadi2u")) return "nadi2u";
  return "other";
}

function getPrimaryNadi4uSiteId(siteValue) {
  if (Array.isArray(siteValue)) {
    const first = siteValue.find((item) => item !== null && item !== undefined && String(item).trim() !== "");
    return first !== undefined ? String(first).trim() : "";
  }

  if (siteValue !== null && siteValue !== undefined) {
    const value = String(siteValue).trim();
    if (value) return value;
  }

  return "";
}


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

function getCurrentNadi4uWeeklyViewMode() {
  return nadi4uWeeklyViewMode === NADI4U_WEEKLY_VIEW_ALL
    ? NADI4U_WEEKLY_VIEW_ALL
    : NADI4U_WEEKLY_VIEW_RECENT;
}

function setNadi4uWeeklyViewMode(mode) {
  const normalizedMode = String(mode || "").trim().toLowerCase();
  nadi4uWeeklyViewMode = normalizedMode === NADI4U_WEEKLY_VIEW_ALL
    ? NADI4U_WEEKLY_VIEW_ALL
    : NADI4U_WEEKLY_VIEW_RECENT;
}

function getNadi4uRecentWeeklyBuckets(buckets = []) {
  if (!Array.isArray(buckets) || buckets.length === 0) return [];

  const now = new Date();
  const todayIso = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0")
  ].join("-");
  const currentBucket = buckets.find((bucket) => {
    const startDate = String(bucket?.startDate || "").trim();
    const endDate = String(bucket?.endDate || "").trim();
    return startDate && endDate && todayIso >= startDate && todayIso <= endDate;
  });
  if (currentBucket) return [currentBucket];

  const recentBucketWithEvents = [...buckets].reverse().find((bucket) => (Number(bucket?.total) || 0) > 0);
  if (recentBucketWithEvents) return [recentBucketWithEvents];

  return [buckets[buckets.length - 1]];
}

function handleNadi4uWeeklyViewModeChange(mode) {
  setNadi4uWeeklyViewMode(mode);
  if (currentProgramListView === PROGRAM_LIST_VIEW_NADI4U) {
    renderEventList();
  }
}

function buildNadi4uRegistrationUrl(eventId, siteValue) {
  const eventIdValue = String(eventId || "").trim();
  if (!eventIdValue) return "";

  const siteIdValue = getPrimaryNadi4uSiteId(siteValue);
  const base = `https://app.nadi.my/event-registration/${encodeURIComponent(eventIdValue)}`;
  return siteIdValue ? `${base}?site_id=${encodeURIComponent(siteIdValue)}` : base;
}

function isExcludedNadi4uProgramTitle(title) {
  const source = String(title || "").trim();
  if (!source) return false;
  return /\btest\s*program\b/i.test(source);
}

function getNadi4uKpiLabelFromTitle(title) {
  const source = String(title || "").trim();
  if (!source) return null;

  for (const rule of NADI4U_KPI_TITLE_RULES) {
    if (Array.isArray(rule.patterns) && rule.patterns.some((pattern) => pattern.test(source))) {
      return {
        category: rule.category,
        subcategory: rule.subcategory
      };
    }
  }

  return null;
}

function getNadi4uKpiCategoryFromPillar(pillarName) {
  const source = String(pillarName || "").trim();
  if (!source) return "";

  for (const rule of NADI4U_KPI_PILLAR_RULES) {
    if (Array.isArray(rule.patterns) && rule.patterns.some((pattern) => pattern.test(source))) {
      return rule.category;
    }
  }

  return "";
}

function getNadi4uKpiSubcategoryFromText(sourceText, categoryKey = "") {
  const source = String(sourceText || "").trim();
  if (!source) return "";

  for (const rule of NADI4U_KPI_SUBCATEGORY_RULES) {
    if (categoryKey && rule.category !== categoryKey) continue;
    if (Array.isArray(rule.patterns) && rule.patterns.some((pattern) => pattern.test(source))) {
      return rule.subcategory;
    }
  }

  return "";
}

function resolveNadi4uKpiLabel(eventMeta, title) {
  const pillarLabel = typeof eventMeta?.nd_event_subcategory?.name === "string"
    ? eventMeta.nd_event_subcategory.name.trim()
    : "";
  const programLabel = typeof eventMeta?.nd_event_program?.name === "string"
    ? eventMeta.nd_event_program.name.trim()
    : "";
  let categoryKey = getNadi4uKpiCategoryFromPillar(pillarLabel) || getNadi4uKpiCategoryFromPillar(programLabel);
  let subcategoryLabel = getNadi4uKpiSubcategoryFromText(programLabel, categoryKey);

  if (!subcategoryLabel) {
    subcategoryLabel = getNadi4uKpiSubcategoryFromText(title, categoryKey);
  }

  const titleMapped = getNadi4uKpiLabelFromTitle(title);
  if (!categoryKey && titleMapped?.category) {
    categoryKey = titleMapped.category;
  }
  if (!subcategoryLabel && titleMapped?.subcategory && (!categoryKey || titleMapped.category === categoryKey)) {
    subcategoryLabel = titleMapped.subcategory;
  }

  if (!subcategoryLabel && programLabel) {
    subcategoryLabel = programLabel;
  }

  return {
    category: categoryKey || "",
    subcategory: subcategoryLabel || "",
    pillar: pillarLabel,
    programme: programLabel
  };
}

function getNadi4uProgramTypeLabel(eventMeta) {
  const modeName = typeof eventMeta?.nd_program_mode?.name === "string"
    ? eventMeta.nd_program_mode.name.trim()
    : "";
  if (modeName) return modeName;

  const rawMode = eventMeta?.program_mode;
  if (typeof rawMode === "string") {
    const value = rawMode.trim();
    if (value && !/^\d+$/.test(value)) {
      return value;
    }
  }

  return "";
}

function buildNadi4uDisplayEvents() {
  const scheduleRows = parseStoredJsonArray(NADI4U_SCHEDULE_STORAGE_KEY);
  const eventMetaRows = parseStoredJsonArray(NADI4U_EVENT_META_STORAGE_KEY);
  if (scheduleRows.length === 0 && eventMetaRows.length === 0) return [];

  const scheduleByEventId = new Map();
  scheduleRows.forEach((row) => {
    const eventId = typeof row?.event_id === "string" ? row.event_id.trim() : "";
    if (!eventId) return;
    if (!scheduleByEventId.has(eventId)) {
      scheduleByEventId.set(eventId, []);
    }
    scheduleByEventId.get(eventId).push(row);
  });
  scheduleByEventId.forEach((rows, eventId) => {
    rows.sort(compareNadi4uScheduleRows);
    scheduleByEventId.set(eventId, rows);
  });

  const metaById = new Map();
  eventMetaRows.forEach((row) => {
    const eventId = typeof row?.id === "string" ? row.id.trim() : "";
    if (!eventId) return;
    if (!metaById.has(eventId)) {
      metaById.set(eventId, row);
    }
  });

  const result = [];

  const userSiteId = getUserNadi4uSiteId();
  metaById.forEach((eventMeta, sourceEventId) => {
    const categoryName = typeof eventMeta?.nd_event_category?.name === "string"
      ? eventMeta.nd_event_category.name
      : (typeof eventMeta?.category_name === "string" ? eventMeta.category_name : "");
    if (getTakwimSmartServiceGroup(categoryName) !== "nadi4u") {
      return;
    }

    const schedules = scheduleByEventId.get(sourceEventId) || [];
    const fallbackId = sourceEventId.slice(0, 8);
    const programName = typeof eventMeta?.program_name === "string" && eventMeta.program_name.trim()
      ? eventMeta.program_name.trim()
      : `Smart Services NADI4U (${fallbackId})`;
    if (isExcludedNadi4uProgramTitle(programName)) {
      return;
    }

    const startDateFromMeta = toIsoDateFromDateTime(eventMeta?.start_datetime);
    const endDateFromMeta = toIsoDateFromDateTime(eventMeta?.end_datetime);
    const firstScheduleDate = schedules.length > 0 ? parseDateInputToIso(schedules[0]?.schedule_date) : "";
    const lastScheduleDate = schedules.length > 0 ? parseDateInputToIso(schedules[schedules.length - 1]?.schedule_date) : "";

    const startDate = startDateFromMeta || firstScheduleDate;
    const endDate = endDateFromMeta || lastScheduleDate || startDate;
    if (!startDate || !endDate) return;

    const targetDate = getProgramListTargetDate();
    let activeSchedule = null;
    if (targetDate) {
      activeSchedule = schedules.find((row) => parseDateInputToIso(row?.schedule_date) === targetDate) || null;
    }
    if (!activeSchedule && schedules.length > 0) {
      activeSchedule = schedules[0];
    }

    const startTimeRaw = typeof activeSchedule?.start_time === "string" ? activeSchedule.start_time.trim() : "";
    const endTimeRaw = typeof activeSchedule?.end_time === "string" ? activeSchedule.end_time.trim() : "";
    const timeRange = formatNadi4uTimeRange(startTimeRaw, endTimeRaw);

    const locationName = typeof eventMeta?.location_event === "string" ? eventMeta.location_event.trim() : "";
    const description = typeof eventMeta?.description === "string" ? eventMeta.description.trim() : "";
    const infoParts = [
      locationName ? `Location: ${locationName}` : null,
      description || null
    ].filter(Boolean);

    const compositeId = `${sourceEventId}-${startDate}-${endDate}`;
    const externalId = `nadi4u-${sanitizeEventCardIdPart(compositeId)}`;
    const mappedKpiLabel = resolveNadi4uKpiLabel(eventMeta, programName);
    const programType = getNadi4uProgramTypeLabel(eventMeta);
    let registrationLinks = [];
    if (userSiteId) {
      const nadi4uRegistrationUrl = buildNadi4uRegistrationUrl(sourceEventId, userSiteId);
      if (nadi4uRegistrationUrl) {
        registrationLinks = [{ platform: "NES", url: nadi4uRegistrationUrl }];
      }
    } else {
      registrationLinks = [{ platform: "NES", url: "https://app.nadi.my/", message: "Please login to register easily" }];
    }

    result.push({
      id: externalId,
      source: "nadi4u",
      sourceEventId: sourceEventId,
      isExternal: true,
      title: programName,
      start: startDate,
      end: endDate,
      category: "nadi4u",
      subcategory: "Smart Services",
      kpiCategory: mappedKpiLabel?.category || "",
      kpiSubcategory: mappedKpiLabel?.subcategory || "",
      kpiPillar: mappedKpiLabel?.pillar || "",
      kpiProgramme: mappedKpiLabel?.programme || "",
      programType: programType,
      time: timeRange,
      secondTime: "",
      links: [],
      registrationLinks: registrationLinks,
      submitLinks: [],
      info: infoParts.join("<br>"),
      images: [],
      schedules: schedules,
      externalDescription: description
    });
  });

  return result;
}

function getCombinedEventListSource() {
  ensureEventsArray();
  const nadi4uEvents = buildNadi4uDisplayEvents();
  return [...events, ...nadi4uEvents];
}

function getRecentEventListSource(sourceEvents) {
  if (!Array.isArray(sourceEvents)) return [];
  return sourceEvents.filter((eventItem) => !(eventItem?.isExternal && eventItem?.source === "nadi4u"));
}

function getNadi4uEventListSource(sourceEvents) {
  if (!Array.isArray(sourceEvents)) return [];
  return sourceEvents.filter((eventItem) => eventItem?.isExternal && eventItem?.source === "nadi4u");
}

function getProgramListTargetDate() {
  if (window.selectedFilterDate) {
    return window.selectedFilterDate;
  }
  return getAutoSelectedDateForMonth(currentYear, currentMonth);
}

function normalizeNadi4uSearchQuery(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeNadi4uSubcategoryFilterValue(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function parseNadi4uSubcategoryFilterSource(rawSource) {
  const source = String(rawSource || "").trim().toLowerCase();
  if (!source) {
    return { scope: "", weekIndex: null };
  }

  const weeklyMatch = source.match(/^weekly:(\d+)$/);
  if (weeklyMatch) {
    const parsedWeekIndex = Number.parseInt(weeklyMatch[1], 10);
    return {
      scope: "weekly",
      weekIndex: Number.isInteger(parsedWeekIndex) && parsedWeekIndex > 0 ? parsedWeekIndex : null
    };
  }

  if (source === "weekly") {
    return { scope: "weekly", weekIndex: null };
  }

  return {
    scope: source,
    weekIndex: null
  };
}

function isMonthlyNadi4uSubcategoryFilterActive() {
  const normalizedSubcategoryFilter = normalizeNadi4uSubcategoryFilterValue(nadi4uSubcategoryFilter);
  if (!normalizedSubcategoryFilter) return false;
  const filterSourceContext = parseNadi4uSubcategoryFilterSource(nadi4uSubcategoryFilterSource);
  return filterSourceContext.scope === "monthly";
}

function getEventSubcategoryForNadi4uFilter(eventItem) {
  const mappedSubcategory = eventItem?.isExternal
    && eventItem?.source === "nadi4u"
    && typeof eventItem?.kpiSubcategory === "string"
    ? eventItem.kpiSubcategory
    : "";
  const fallbackSubcategory = typeof eventItem?.subcategory === "string"
    ? eventItem.subcategory
    : "";

  return String(mappedSubcategory || fallbackSubcategory || "").trim();
}

function eventMatchesNadi4uSubcategoryFilter(eventItem, normalizedFilter) {
  if (!normalizedFilter) return true;
  const eventSubcategory = getEventSubcategoryForNadi4uFilter(eventItem);
  return normalizeNadi4uSubcategoryFilterValue(eventSubcategory) === normalizedFilter;
}

function getProgramListDaySectionLabel() {
  return "Today Events";
}

function eventMatchesNadi4uSearch(eventItem, normalizedQuery) {
  if (!normalizedQuery) return true;
  const haystack = [
    eventItem?.title,
    eventItem?.programType,
    eventItem?.kpiPillar,
    eventItem?.kpiProgramme,
    eventItem?.externalDescription,
    eventItem?.info,
    eventItem?.kpiSubcategory,
    eventItem?.kpiCategory,
    eventItem?.subcategory,
    eventItem?.time
  ].join(" ").toLowerCase();

  const tokens = normalizedQuery.split(" ").filter(Boolean);
  return tokens.every((token) => haystack.includes(token));
}

function isNadi4uEventOnDate(eventItem, targetDate) {
  if (!eventItem || !targetDate) return false;

  const schedules = Array.isArray(eventItem.schedules) ? eventItem.schedules : [];
  if (schedules.length > 0) {
    return schedules.some((row) => parseDateInputToIso(row?.schedule_date) === targetDate);
  }

  return targetDate >= eventItem.start && targetDate <= eventItem.end;
}

function getIsoWeekRange(targetIsoDate) {
  const normalizedDate = parseDateInputToIso(targetIsoDate);
  if (!normalizedDate) {
    return { startDate: "", endDate: "" };
  }

  const [year, month, day] = normalizedDate.split("-").map((value) => Number.parseInt(value, 10));
  const target = new Date(year, month - 1, day);
  if (Number.isNaN(target.getTime())) {
    return { startDate: "", endDate: "" };
  }

  const mondayOffset = (target.getDay() + 6) % 7; // Monday=0, Sunday=6
  const startDate = new Date(target);
  startDate.setDate(target.getDate() - mondayOffset);

  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 6);

  return {
    startDate: toLocalISOString(startDate),
    endDate: toLocalISOString(endDate)
  };
}

function getIsoMonthRange(year, month) {
  const normalizedYear = Number.parseInt(year, 10);
  const normalizedMonth = Number.parseInt(month, 10);
  if (!Number.isInteger(normalizedYear) || !Number.isInteger(normalizedMonth)) {
    return { startDate: "", endDate: "" };
  }

  const startDate = `${normalizedYear}-${String(normalizedMonth + 1).padStart(2, "0")}-01`;
  const monthLastDay = new Date(normalizedYear, normalizedMonth + 1, 0).getDate();
  const endDate = `${normalizedYear}-${String(normalizedMonth + 1).padStart(2, "0")}-${String(monthLastDay).padStart(2, "0")}`;
  return { startDate, endDate };
}

function getMonthWeekRanges(year, month) {
  const normalizedYear = Number.parseInt(year, 10);
  const normalizedMonth = Number.parseInt(month, 10);
  if (!Number.isInteger(normalizedYear) || !Number.isInteger(normalizedMonth)) {
    return [];
  }

  const monthLastDay = new Date(normalizedYear, normalizedMonth + 1, 0).getDate();
  const ranges = [];
  let weekIndex = 1;

  for (let startDay = 1; startDay <= monthLastDay; startDay += 7) {
    const endDay = Math.min(startDay + 6, monthLastDay);
    ranges.push({
      weekIndex,
      startDay,
      endDay,
      startDate: `${normalizedYear}-${String(normalizedMonth + 1).padStart(2, "0")}-${String(startDay).padStart(2, "0")}`,
      endDate: `${normalizedYear}-${String(normalizedMonth + 1).padStart(2, "0")}-${String(endDay).padStart(2, "0")}`
    });
    weekIndex += 1;
  }

  return ranges;
}

function isNadi4uEventInDateRange(eventItem, startDate, endDate) {
  if (!eventItem || !startDate || !endDate) return false;

  const schedules = Array.isArray(eventItem?.schedules) ? eventItem.schedules : [];
  if (schedules.length > 0) {
    return schedules.some((row) => {
      const scheduleDate = parseDateInputToIso(row?.schedule_date);
      return Boolean(scheduleDate && scheduleDate >= startDate && scheduleDate <= endDate);
    });
  }

  const eventStart = parseDateInputToIso(eventItem?.start);
  const eventEnd = parseDateInputToIso(eventItem?.end || eventItem?.start);
  if (!eventStart || !eventEnd) return false;

  return eventStart <= endDate && eventEnd >= startDate;
}

function normalizeDuplicateEventTitle(title) {
  return String(title || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function getNadi4uScheduleDateRange(eventItem) {
  const schedules = Array.isArray(eventItem?.schedules) ? eventItem.schedules : [];
  const parsedDates = schedules
    .map((row) => parseDateInputToIso(row?.schedule_date))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  if (parsedDates.length > 0) {
    return {
      startDate: parsedDates[0],
      endDate: parsedDates[parsedDates.length - 1]
    };
  }

  return {
    startDate: eventItem?.start || "",
    endDate: eventItem?.end || eventItem?.start || ""
  };
}

function getNadi4uScheduleTimeForDate(eventItem, targetDate) {
  const schedules = Array.isArray(eventItem?.schedules) ? eventItem.schedules : [];
  const byDate = schedules.find((row) => parseDateInputToIso(row?.schedule_date) === targetDate) || null;
  if (byDate?.start_time) return String(byDate.start_time).trim();
  if (byDate?.end_time) return String(byDate.end_time).trim();
  return "";
}

function isNadi4uMultiDayEvent(eventItem) {
  if (!(eventItem?.isExternal && eventItem?.source === "nadi4u")) return false;
  const range = getNadi4uScheduleDateRange(eventItem);
  return Boolean(range.startDate && range.endDate && range.startDate !== range.endDate);
}

function isRecentMultiDayEvent(eventItem) {
  if (!eventItem || (eventItem?.isExternal && eventItem?.source === "nadi4u")) return false;
  return Boolean(eventItem.start && eventItem.end && eventItem.start !== eventItem.end);
}

function dedupeNadi4uEventsByTitle(eventList) {
  if (!Array.isArray(eventList) || eventList.length === 0) return [];

  const seen = new Set();
  const deduped = [];

  eventList.forEach((eventItem) => {
    const dedupeKey = normalizeDuplicateEventTitle(eventItem?.title);
    if (!dedupeKey) {
      deduped.push(eventItem);
      return;
    }

    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    deduped.push(eventItem);
  });

  return deduped;
}

function getNadi4uScopedFilterResult(sourceEvents) {
  const nadi4uEvents = getNadi4uEventListSource(sourceEvents);
  const normalizedSearch = normalizeNadi4uSearchQuery(nadi4uSearchQuery);
  const normalizedSubcategoryFilter = normalizeNadi4uSubcategoryFilterValue(nadi4uSubcategoryFilter);
  const filterSourceContext = parseNadi4uSubcategoryFilterSource(nadi4uSubcategoryFilterSource);
  const targetDate = getProgramListTargetDate();
  const monthRange = getIsoMonthRange(currentYear, currentMonth);

  let scopedEvents = nadi4uEvents;
  if (normalizedSubcategoryFilter.length > 0) {
    switch (filterSourceContext.scope) {
      case "day":
        scopedEvents = nadi4uEvents.filter((eventItem) =>
          isNadi4uEventOnDate(eventItem, targetDate) && !isNadi4uMultiDayEvent(eventItem)
        );
        break;
      case "multi":
        scopedEvents = nadi4uEvents.filter((eventItem) =>
          isNadi4uEventOnDate(eventItem, targetDate) && isNadi4uMultiDayEvent(eventItem)
        );
        break;
      case "weekly": {
        const weekRanges = getMonthWeekRanges(currentYear, currentMonth);
        const targetWeek = Number.isInteger(filterSourceContext.weekIndex)
          ? weekRanges.find((bucket) => bucket.weekIndex === filterSourceContext.weekIndex) || null
          : null;
        if (targetWeek) {
          scopedEvents = nadi4uEvents.filter((eventItem) =>
            isNadi4uEventInDateRange(eventItem, targetWeek.startDate, targetWeek.endDate)
          );
        } else {
          const selectedWeekRange = getIsoWeekRange(targetDate);
          scopedEvents = nadi4uEvents.filter((eventItem) =>
            isNadi4uEventInDateRange(eventItem, selectedWeekRange.startDate, selectedWeekRange.endDate)
          );
        }
        break;
      }
      case "monthly":
        scopedEvents = nadi4uEvents.filter((eventItem) =>
          isNadi4uEventInDateRange(eventItem, monthRange.startDate, monthRange.endDate)
        );
        break;
      default:
        scopedEvents = nadi4uEvents.filter((eventItem) => isNadi4uEventOnDate(eventItem, targetDate));
        break;
    }
  } else if (normalizedSearch.length > 0) {
    scopedEvents = nadi4uEvents;
  } else {
    scopedEvents = nadi4uEvents.filter((eventItem) => isNadi4uEventOnDate(eventItem, targetDate));
  }

  const deduped = dedupeNadi4uEventsByTitle(scopedEvents);
  const filteredBySubcategory = normalizedSubcategoryFilter
    ? deduped.filter((eventItem) => eventMatchesNadi4uSubcategoryFilter(eventItem, normalizedSubcategoryFilter))
    : deduped;
  const filteredBySearch = normalizedSearch
    ? filteredBySubcategory.filter((eventItem) => eventMatchesNadi4uSearch(eventItem, normalizedSearch))
    : filteredBySubcategory;

  return {
    filteredBySearch,
    normalizedSearch,
    normalizedSubcategoryFilter,
    filterSourceContext,
    targetDate
  };
}

function getFilteredNadi4uEventList(sourceEvents) {
  const {
    filteredBySearch,
    normalizedSearch,
    normalizedSubcategoryFilter,
    filterSourceContext,
    targetDate
  } = getNadi4uScopedFilterResult(sourceEvents);

  const applyDayMultiSplit = normalizedSubcategoryFilter.length === 0
    && !isMonthlyNadi4uSubcategoryFilterActive();
  const filteredByListType = applyDayMultiSplit
    ? filteredBySearch.filter((eventItem) => {
      const isMultiDay = isNadi4uMultiDayEvent(eventItem);
      return nadi4uListType === NADI4U_LIST_TYPE_MULTI ? isMultiDay : !isMultiDay;
    })
    : filteredBySearch;
  const shouldUseRangeBasedSorting = normalizedSearch.length > 0
    || filterSourceContext.scope === "weekly"
    || filterSourceContext.scope === "monthly";

  return [...filteredByListType].sort((left, right) => {
    const leftRange = getNadi4uScheduleDateRange(left);
    const rightRange = getNadi4uScheduleDateRange(right);
    const leftIsMultiDay = leftRange.startDate && leftRange.endDate && leftRange.startDate !== leftRange.endDate;
    const rightIsMultiDay = rightRange.startDate && rightRange.endDate && rightRange.startDate !== rightRange.endDate;
    const shouldPrioritizeMultiDayGrouping = normalizedSubcategoryFilter.length === 0
      || filterSourceContext.scope === "weekly";

    if (shouldPrioritizeMultiDayGrouping && leftIsMultiDay !== rightIsMultiDay) {
      return leftIsMultiDay ? 1 : -1;
    }

    if (shouldUseRangeBasedSorting) {
      const leftStart = String(left?.start || "");
      const rightStart = String(right?.start || "");
      if (leftStart && rightStart && leftStart !== rightStart) {
        return leftStart.localeCompare(rightStart);
      }

      const leftTimeFromStart = leftStart ? getNadi4uScheduleTimeForDate(left, leftStart) : "";
      const rightTimeFromStart = rightStart ? getNadi4uScheduleTimeForDate(right, rightStart) : "";
      if (leftTimeFromStart && rightTimeFromStart && leftTimeFromStart !== rightTimeFromStart) {
        return leftTimeFromStart.localeCompare(rightTimeFromStart);
      }
      if (leftTimeFromStart && !rightTimeFromStart) return -1;
      if (!leftTimeFromStart && rightTimeFromStart) return 1;

      return String(left?.title || "").localeCompare(String(right?.title || ""));
    }

    const leftTime = getNadi4uScheduleTimeForDate(left, targetDate);
    const rightTime = getNadi4uScheduleTimeForDate(right, targetDate);
    if (leftTime && rightTime && leftTime !== rightTime) {
      return leftTime.localeCompare(rightTime);
    }
    if (leftTime && !rightTime) return -1;
    if (!leftTime && rightTime) return 1;

    return String(left?.title || "").localeCompare(String(right?.title || ""));
  });
}

function getProgramListPageStateKey() {
  return "nadi4uListCurrentPage";
}

function syncNadi4uProgramListHeightToTotals() {
  const eventListContainer = document.getElementById("eventListContainer");
  if (!eventListContainer) return;

  const isNadi4uView = currentProgramListView === PROGRAM_LIST_VIEW_NADI4U;
  const isDesktopLayout = typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches;

  if (!isNadi4uView) {
    eventListContainer.style.height = "";
    eventListContainer.style.maxHeight = "500px";
    return;
  }

  if (!isDesktopLayout) {
    eventListContainer.style.height = "";
    eventListContainer.style.maxHeight = "620px";
    return;
  }

  const categoryCounts = document.getElementById("categoryCounts");
  const totalProgramsCard = categoryCounts?.firstElementChild || null;
  const targetBottomEl = totalProgramsCard || categoryCounts;

  if (!targetBottomEl) {
    eventListContainer.style.height = "";
    eventListContainer.style.maxHeight = "620px";
    return;
  }

  const listTop = eventListContainer.getBoundingClientRect().top;
  const totalsBottom = targetBottomEl.getBoundingClientRect().bottom;
  const calculatedHeight = Math.floor(totalsBottom - listTop);
  const minHeight = 360;
  const maxHeight = 1000;

  if (!Number.isFinite(calculatedHeight) || calculatedHeight < minHeight) {
    eventListContainer.style.height = "";
    eventListContainer.style.maxHeight = "620px";
    return;
  }

  const clampedHeight = Math.max(minHeight, Math.min(calculatedHeight, maxHeight));
  eventListContainer.style.height = `${clampedHeight}px`;
  eventListContainer.style.maxHeight = `${clampedHeight}px`;
}

function updateProgramListHeader() {
  const titleEl = document.getElementById("programsListHeader");
  const modeEl = document.getElementById("programsListModeLabel");
  const prevBtn = document.getElementById("programListPrevBtn");
  const nextBtn = document.getElementById("programListNextBtn");
  const typeTabs = document.getElementById("programListTypeTabs");
  const dayBtn = document.getElementById("programListDayBtn");
  const multiBtn = document.getElementById("programListMultiBtn");
  const sortBtn = document.getElementById("programListSortBtn");
  const sortSection = document.getElementById("sortSection");
  const searchBtn = document.getElementById("programListSearchBtn");
  const searchSection = document.getElementById("nadi4uSearchSection");
  const searchInput = document.getElementById("nadi4uSearchInput");
  const clearSearchBtn = document.getElementById("clearNadi4uSearchBtn");
  const isNadi4uView = true;
  const hideTypeTabs = isMonthlyNadi4uSubcategoryFilterActive();

  if (titleEl) {
    titleEl.textContent = "Smart Services NADI4U";
  }

  if (modeEl) {
    modeEl.textContent = "Program List";
  }

  if (prevBtn) {
    prevBtn.classList.add("hidden");
    prevBtn.disabled = true;
  }

  if (nextBtn) {
    nextBtn.classList.add("hidden");
    nextBtn.disabled = true;
  }

  if (sortBtn) {
    sortBtn.classList.add("hidden");
  }

  if (searchBtn) {
    searchBtn.classList.toggle("hidden", !isNadi4uView);
  }

  if (sortSection && isNadi4uView) {
    sortSection.classList.add("hidden");
    sortSection.classList.add("filter-hidden");
  }

  if (searchSection) {
    searchSection.classList.remove("hidden");
  }

  if (searchInput) {
    searchInput.value = nadi4uSearchQuery;
  }

  if (clearSearchBtn) {
    clearSearchBtn.classList.toggle("hidden", !nadi4uSearchQuery && !nadi4uSubcategoryFilter);
  }

  if (typeTabs) {
    typeTabs.classList.toggle("hidden", hideTypeTabs);
  }

  const applyTypeButtonStyles = (button, isActive) => {
    if (!button) return;
    button.classList.remove("bg-cyan-600", "text-white", "border-cyan-600", "bg-white", "text-cyan-700", "border-cyan-200", "hover:bg-cyan-50");
    if (isActive) {
      button.classList.add("bg-cyan-600", "text-white", "border-cyan-600");
    } else {
      button.classList.add("bg-white", "text-cyan-700", "border-cyan-200", "hover:bg-cyan-50");
    }
  };

  applyTypeButtonStyles(dayBtn, nadi4uListType === NADI4U_LIST_TYPE_DAY);
  applyTypeButtonStyles(multiBtn, nadi4uListType === NADI4U_LIST_TYPE_MULTI);

  requestAnimationFrame(syncNadi4uProgramListHeightToTotals);
}

function getProgramListDisplayEvents(sourceEvents) {
  return getFilteredNadi4uEventList(sourceEvents);
}

function setProgramListView(view) {
  const normalizedView = PROGRAM_LIST_VIEW_NADI4U;
  if (currentProgramListView === normalizedView) {
    updateProgramListHeader();
    return;
  }

  currentProgramListView = normalizedView;
  window[getProgramListPageStateKey()] = 0;
  renderEventList();
}

function changeProgramListView(direction) {
  setProgramListView(PROGRAM_LIST_VIEW_NADI4U);
}

window.changeProgramListView = changeProgramListView;

function setNadi4uListType(nextType) {
  const normalizedType = nextType === NADI4U_LIST_TYPE_MULTI
    ? NADI4U_LIST_TYPE_MULTI
    : NADI4U_LIST_TYPE_DAY;
  if (nadi4uListType === normalizedType) {
    updateProgramListHeader();
    return;
  }

  nadi4uListType = normalizedType;
  window.nadi4uListCurrentPage = 0;
  renderEventList();
}

window.setNadi4uListType = setNadi4uListType;

function toggleNadi4uSearch() {
  if (currentProgramListView !== PROGRAM_LIST_VIEW_NADI4U) return;
  const section = document.getElementById("nadi4uSearchSection");
  const input = document.getElementById("nadi4uSearchInput");
  if (!section) return;
  section.classList.toggle("filter-hidden");
  if (!section.classList.contains("filter-hidden") && input) {
    input.focus();
    input.select();
  }
  requestAnimationFrame(syncNadi4uProgramListHeightToTotals);
}

function queueNadi4uSearch(value) {
  if (currentProgramListView !== PROGRAM_LIST_VIEW_NADI4U) return;
  if (nadi4uSearchDebounceTimer) {
    clearTimeout(nadi4uSearchDebounceTimer);
  }

  const nextValue = typeof value === "string" ? value : "";
  nadi4uSearchDebounceTimer = setTimeout(() => {
    nadi4uSearchQuery = nextValue.trim();
    window.nadi4uListCurrentPage = 0;
    renderEventList();
  }, NADI4U_SEARCH_DEBOUNCE_MS);
}

function applyNadi4uSearch() {
  if (nadi4uSearchDebounceTimer) {
    clearTimeout(nadi4uSearchDebounceTimer);
    nadi4uSearchDebounceTimer = null;
  }
  const input = document.getElementById("nadi4uSearchInput");
  nadi4uSearchQuery = input ? input.value.trim() : "";
  window.nadi4uListCurrentPage = 0;
  renderEventList();
}

function handleNadi4uSubcategoryFilterClick(subcategoryLabel, sourceSection = "monthly") {
  const label = String(subcategoryLabel || "").trim();
  if (!label) return;
  const source = String(sourceSection || "monthly").trim().toLowerCase() || "monthly";

  const normalizedLabel = normalizeNadi4uSubcategoryFilterValue(label);
  const normalizedCurrent = normalizeNadi4uSubcategoryFilterValue(nadi4uSubcategoryFilter);
  const normalizedCurrentSource = String(nadi4uSubcategoryFilterSource || "").trim().toLowerCase();
  const isSameSelection = normalizedLabel === normalizedCurrent && source === normalizedCurrentSource;

  nadi4uSubcategoryFilter = isSameSelection ? "" : label;
  nadi4uSubcategoryFilterSource = isSameSelection ? "" : source;
  if (!isSameSelection) {
    if (source === "day") {
      nadi4uListType = NADI4U_LIST_TYPE_DAY;
    } else if (source === "multi") {
      nadi4uListType = NADI4U_LIST_TYPE_MULTI;
    }
  }
  nadi4uSearchQuery = "";
  if (nadi4uSearchDebounceTimer) {
    clearTimeout(nadi4uSearchDebounceTimer);
    nadi4uSearchDebounceTimer = null;
  }
  const searchInput = document.getElementById("nadi4uSearchInput");
  if (searchInput) searchInput.value = "";

  window.nadi4uListCurrentPage = 0;
  if (currentProgramListView !== PROGRAM_LIST_VIEW_NADI4U) {
    setProgramListView(PROGRAM_LIST_VIEW_NADI4U);
    return;
  }
  renderEventList();
}

function clearNadi4uSearch() {
  if (nadi4uSearchDebounceTimer) {
    clearTimeout(nadi4uSearchDebounceTimer);
    nadi4uSearchDebounceTimer = null;
  }
  const input = document.getElementById("nadi4uSearchInput");
  if (input) input.value = "";
  nadi4uSearchQuery = "";
  nadi4uSubcategoryFilter = "";
  nadi4uSubcategoryFilterSource = "";
  window.nadi4uListCurrentPage = 0;
  renderEventList();
}

function getFilteredEventList(sourceEvents) {
  if (!Array.isArray(sourceEvents)) return [];

  if (window.selectedFilterDate) {
    return sourceEvents.filter((eventItem) => window.selectedFilterDate >= eventItem.start && window.selectedFilterDate <= eventItem.end);
  }

  if (rangeFilter.start && rangeFilter.end) {
    return sourceEvents.filter((eventItem) => eventItem.start <= rangeFilter.end && eventItem.end >= rangeFilter.start);
  }

  const todayStr = toLocalISOString(today);
  return sourceEvents.filter((eventItem) => eventItem.end >= todayStr);
}

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

// Fallback: Save all non-event settings at once
async function saveAllSettings() {
  if (!isDataLoaded) {
    if (window.DEBUG_MODE) console.warn("saveAllSettings called but data not loaded yet");
    return Promise.reject(new Error("Data not loaded yet"));
  }

  if (window.DEBUG_MODE) console.log("💾 Saving settings to Supabase...");
  
  try {
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
    const hasRangeFilter = Boolean(rangeFilter.start && rangeFilter.end);
    const newEvents = hasRangeFilter
      ? await loadEventsForDateRange(rangeFilter.start, rangeFilter.end)
      : await loadEventsForMonth(currentYear, currentMonth, true);

    events = newEvents;
    if (window.DEBUG_MODE) console.log("✓ Refreshed events from Supabase:", events.length, "events");
    renderCalendar();
    renderEventList();
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
    showAllSkeletons();
    events = await loadEventsForMonth(currentYear, currentMonth);
    await ensureProgramImagesFeatureSupport();
    // Render events immediately
    hideAllSkeletons();
    renderCalendar();
    renderEventList();

    // =====================================================
    // OPTIMIZATION: Load only latest announcement meta (for red dot)
    // =====================================================
    loadLatestAnnouncementMeta();
    
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
  updateSiteTitleShimmer();
}

function updateSiteTitleShimmer() {
  const titleEl = document.getElementById("siteTitle");
  if (!titleEl) return;
  const text = (titleEl.textContent || "").trim();
  const spread = Math.max(24, text.length * 4);
  titleEl.style.setProperty("--spread", `${spread}px`);
}

function initGlowCards() {
  const root = document.documentElement;
  if (!root) return;

  const updatePointer = (event) => {
    const { clientX, clientY } = event;
    root.style.setProperty("--glow-x", clientX.toFixed(2));
    root.style.setProperty("--glow-y", clientY.toFixed(2));
  };

  const setCenter = () => {
    root.style.setProperty("--glow-x", (window.innerWidth / 2).toFixed(2));
    root.style.setProperty("--glow-y", (window.innerHeight / 2).toFixed(2));
  };

  setCenter();
  document.addEventListener("pointermove", updatePointer, { passive: true });
  window.addEventListener("resize", setCenter);
}

function checkNewAnnouncements() {
  const lastReadAnnouncement = appStorage.getItem("lastReadAnnouncementId");
  const latestId = latestAnnouncementMeta?.id != null ? String(latestAnnouncementMeta.id) : null;
  const dot = document.getElementById("newAnnouncementDot");
  if (dot) {
    if (latestId && lastReadAnnouncement !== latestId) {
      dot.classList.remove("hidden");
    } else {
      dot.classList.add("hidden");
    }
  }
}

function markAnnouncementsAsRead() {
  const latestId = latestAnnouncementMeta?.id != null ? String(latestAnnouncementMeta.id) : null;
  if (!latestId) return;
  appStorage.setItem("lastReadAnnouncementId", latestId);
  const dot = document.getElementById("newAnnouncementDot");
  if (dot) dot.classList.add("hidden");
}

async function loadLatestAnnouncementMeta() {
  try {
    const { data, error } = await supabaseClient
      .from('announcements')
      .select(LATEST_ANNOUNCEMENT_SELECT_COLUMNS)
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (error) throw error;
    latestAnnouncementMeta = Array.isArray(data) && data.length > 0 ? data[0] : null;
    if (window.DEBUG_MODE) {
      console.log("✅ Loaded latest announcement meta:", latestAnnouncementMeta?.id || "none");
    }
  } catch (error) {
    console.error("Error loading latest announcement:", error);
    latestAnnouncementMeta = null;
  }
  
  checkNewAnnouncements();
}

(function init() {
  initGlowCards();
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

    await clearRangeFilter(false);
    window.selectedFilterDate = getAutoSelectedDateForMonth(currentYear, currentMonth);
    
    // Load events for the new month
    showCalendarSkeleton();
    const monthEvents = await loadEventsForMonth(currentYear, currentMonth);
    events = monthEvents;
    hideCalendarSkeleton();

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

    await clearRangeFilter(false);
    window.selectedFilterDate = getAutoSelectedDateForMonth(currentYear, currentMonth);

    // Load events for the new month
    showCalendarSkeleton();
    const monthEvents = await loadEventsForMonth(currentYear, currentMonth);
    events = monthEvents;
    hideCalendarSkeleton();

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

  const startDateInput = document.getElementById("startDate");
  const endDateInput = document.getElementById("endDate");
  if (startDateInput && endDateInput) {
    startDateInput.addEventListener("change", function () {
      const startDateIso = normalizeProgramDateInput(this);
      if (!startDateIso) return;
      endDateInput.value = isoDateToDisplay(startDateIso);
    });

    endDateInput.addEventListener("change", function () {
      normalizeProgramDateInput(this);
    });
  }

  document.querySelectorAll('input[name="category"]').forEach((radio) => {
    radio.addEventListener("change", function () {
      updateSubcategories(this.value);
      // Hide category error when a category is selected
      hideCategoryError();
    });
  });

  document.getElementById("announcementBtn").addEventListener("click", markAnnouncementsAsRead);

  const programsListHeader = document.getElementById("programsListHeader");
  if (programsListHeader) {
    programsListHeader.addEventListener("click", () => {
      programsListClicks++;
      clearTimeout(programsListTimer);
      programsListTimer = setTimeout(() => (programsListClicks = 0), 500);
      if (programsListClicks === 3) {
        showEditDeleteButtons = !showEditDeleteButtons;
        programsListClicks = 0;
        renderEventList();
      }
    });
  }
  window.addEventListener("resize", () => requestAnimationFrame(syncNadi4uProgramListHeightToTotals), { passive: true });
  updateProgramListHeader();
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
    "nadi4uSettingsView",
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
    const local = appStorage.getItem("nadi_siteSettings_backup");
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
    let imagesToDelete = [];
    if (programImagesEnabled) {
      try {
        const details = await loadEventDetailsById(deleteEventId);
        imagesToDelete = cloneProgramImages(details.images);
      } catch (error) {}
    }

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
        // Re-sync the current month instead of rewriting the full events table
        clearEventsCache();
        events = await loadEventsForMonth(currentYear, currentMonth, true);
      } else {
        if (imagesToDelete.length > 0 && programImagesEnabled) {
          await deleteProgramImages(imagesToDelete);
        }
        clearEventsCache();
      }
      eventDetailsCache.delete(deleteEventId);
      delete eventImageMap[String(deleteEventId)];
      
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
        columnDiv.className = "flex flex-col gap-3 min-w-0";

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
              "flex flex-wrap items-center justify-center gap-1.5 bg-white border border-slate-200 hover:border-nadi hover:text-nadi hover:shadow text-slate-700 font-semibold text-xs py-2 px-3 rounded-lg transition-all text-center leading-snug break-words w-full min-w-0";
            a.innerHTML = `<span class="break-words whitespace-normal min-w-0">${btnData.label}</span><i class="fa-solid fa-arrow-up-right-from-square text-[10px] shrink-0"></i>`;
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
  if (currentProgramListView === PROGRAM_LIST_VIEW_NADI4U) return;
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

    cell.onclick = async () => {
      const hadRangeFilter = Boolean(rangeFilter.start && rangeFilter.end);
      clearRangeFilter(false);
      showEventListSkeleton();

      try {
        if (hadRangeFilter) {
          events = await loadEventsForMonth(currentYear, currentMonth);
        }
        window.selectedFilterDate = window.selectedFilterDate === dateStr ? null : dateStr;
        renderCalendar();
        renderEventList();
      } catch (error) {
        console.error("Failed to update day filter:", error);
      } finally {
        hideEventListSkeleton();
      }
    };

    grid.appendChild(cell);
  }
}

async function applyRangeFilter() {
  const start = document.getElementById("filterStart").value;
  const end = document.getElementById("filterEnd").value;

  if (start && end) {
    rangeFilter = { start, end };
    window.selectedFilterDate = null;
    showEventListSkeleton();
    try {
      events = await loadEventsForDateRange(start, end);
      renderCalendar();
      renderEventList();
      document.getElementById("clearRangeBtn").classList.remove("hidden");
    } catch (error) {
      console.error("Failed to apply range filter:", error);
    } finally {
      hideEventListSkeleton();
    }
  }
}

function openModalWithSelectedDate() {
  openModal(null, window.selectedFilterDate || "");
}

async function clearRangeFilter(shouldRender = true) {
  document.getElementById("filterStart").value = "";
  document.getElementById("filterEnd").value = "";
  rangeFilter = { start: null, end: null };
  document.getElementById("clearRangeBtn").classList.add("hidden");
  if (!shouldRender) return;

  showEventListSkeleton();
  try {
    events = await loadEventsForMonth(currentYear, currentMonth);
    renderCalendar();
    renderEventList();
  } catch (error) {
    console.error("Failed to clear range filter:", error);
  } finally {
    hideEventListSkeleton();
  }
}

function renderCategoryCounts(displayEvents = [], sourceEvents = null) {
  const container = document.getElementById("categoryCounts");
  if (!container) return;

  const createEmptyCounts = () => ({});
  const todayCounts = createEmptyCounts();
  const multiDayCounts = createEmptyCounts();
  const monthlyCounts = createEmptyCounts();
  let weeklyBuckets = [];
  const isNadi4uView = currentProgramListView === PROGRAM_LIST_VIEW_NADI4U;
  const sourceEventList = Array.isArray(sourceEvents) && sourceEvents.length > 0
    ? sourceEvents
    : getCombinedEventListSource();
  const normalizedSubcategoryFilter = isNadi4uView
    ? normalizeNadi4uSubcategoryFilterValue(nadi4uSubcategoryFilter)
    : "";
  const normalizedSubcategoryFilterSource = String(nadi4uSubcategoryFilterSource || "").trim().toLowerCase();
  const isMultiDayInCurrentView = isNadi4uView ? isNadi4uMultiDayEvent : isRecentMultiDayEvent;
  const normalizeCountKey = (value) => String(value || "").trim().toLowerCase();
  const countTotal = (counts) => Object.values(counts || {}).reduce((sum, item) => {
    return sum + (Number(item?.count) || 0);
  }, 0);
  const getEventCountCategory = (eventItem) => {
    const mappedNadi4uCategory = eventItem?.isExternal
      && eventItem?.source === "nadi4u"
      && typeof eventItem?.kpiCategory === "string"
      ? eventItem.kpiCategory
      : "";
    return mappedNadi4uCategory || eventItem?.category || "";
  };
  const getEventCountSubcategory = (eventItem, categoryKey) => {
    const mappedNadi4uSubcategory = eventItem?.isExternal
      && eventItem?.source === "nadi4u"
      && typeof eventItem?.kpiSubcategory === "string"
      ? eventItem.kpiSubcategory
      : "";
    const defaultSubcategory = typeof eventItem?.subcategory === "string"
      ? eventItem.subcategory
      : "";
    const subcategoryLabel = String(mappedNadi4uSubcategory || defaultSubcategory || "").trim();
    if (subcategoryLabel) return subcategoryLabel;

    if (categoryKey && categories?.[categoryKey]?.sub) {
      return String(categories[categoryKey].sub || "").trim();
    }

    return "Uncategorized";
  };
  const addCount = (counts, subcategoryLabel, categoryKey) => {
    const label = String(subcategoryLabel || "").trim();
    if (!label) return;

    const key = normalizeCountKey(label);
    if (!key) return;

    if (!counts[key]) {
      counts[key] = {
        label,
        count: 0,
        category: categoryKey || ""
      };
    }

    counts[key].count += 1;
    if (!counts[key].category && categoryKey) {
      counts[key].category = categoryKey;
    }
  };

  let dayMultiCountSourceEvents = Array.isArray(displayEvents) ? displayEvents : [];
  if (isNadi4uView) {
    const scopedFilterResult = getNadi4uScopedFilterResult(sourceEventList);
    dayMultiCountSourceEvents = Array.isArray(scopedFilterResult.filteredBySearch)
      ? scopedFilterResult.filteredBySearch
      : [];
  }

  dayMultiCountSourceEvents.forEach((eventItem) => {
    const countCategory = getEventCountCategory(eventItem);
    const countSubcategory = getEventCountSubcategory(eventItem, countCategory);
    const targetCounts = isMultiDayInCurrentView(eventItem) ? multiDayCounts : todayCounts;
    addCount(targetCounts, countSubcategory, countCategory);
  });

  const todayTotal = countTotal(todayCounts);
  const multiDayTotal = countTotal(multiDayCounts);
  let monthlyTotal = 0;

  if (isNadi4uView) {
    const normalizedSearch = normalizeNadi4uSearchQuery(nadi4uSearchQuery);
    let nadi4uAggregateEvents = dedupeNadi4uEventsByTitle(getNadi4uEventListSource(sourceEventList));

    if (normalizedSubcategoryFilter) {
      nadi4uAggregateEvents = nadi4uAggregateEvents.filter((eventItem) =>
        eventMatchesNadi4uSubcategoryFilter(eventItem, normalizedSubcategoryFilter)
      );
    }

    if (normalizedSearch) {
      nadi4uAggregateEvents = nadi4uAggregateEvents.filter((eventItem) =>
        eventMatchesNadi4uSearch(eventItem, normalizedSearch)
      );
    }

    const monthRange = getIsoMonthRange(currentYear, currentMonth);
    weeklyBuckets = getMonthWeekRanges(currentYear, currentMonth).map((range) => ({
      ...range,
      counts: createEmptyCounts(),
      total: 0
    }));

    nadi4uAggregateEvents.forEach((eventItem) => {
      const countCategory = getEventCountCategory(eventItem);
      const countSubcategory = getEventCountSubcategory(eventItem, countCategory);
      if (!countSubcategory) return;

      weeklyBuckets.forEach((bucket) => {
        if (isNadi4uEventInDateRange(eventItem, bucket.startDate, bucket.endDate)) {
          addCount(bucket.counts, countSubcategory, countCategory);
        }
      });

      if (isNadi4uEventInDateRange(eventItem, monthRange.startDate, monthRange.endDate)) {
        addCount(monthlyCounts, countSubcategory, countCategory);
      }
    });

    weeklyBuckets = weeklyBuckets.map((bucket) => ({
      ...bucket,
      total: countTotal(bucket.counts)
    }));
    monthlyTotal = countTotal(monthlyCounts);
  }

  const renderCountBadges = (counts, options = {}) => {
    const clickable = options?.clickable === true;
    const clickSource = String(options?.clickSource || "monthly").trim().toLowerCase() || "monthly";
    const categoryOrder = ["entrepreneur", "learning", "wellbeing", "awareness", "gov"];
    const getCategoryRank = (categoryKey) => {
      const index = categoryOrder.indexOf(String(categoryKey || "").trim().toLowerCase());
      return index >= 0 ? index : categoryOrder.length;
    };

    const items = Object.values(counts || {})
      .filter((item) => item && (Number(item.count) || 0) > 0)
      .sort((left, right) => {
        const rankDiff = getCategoryRank(left.category) - getCategoryRank(right.category);
        if (rankDiff !== 0) return rankDiff;

        const labelDiff = String(left.label || "").localeCompare(String(right.label || ""));
        if (labelDiff !== 0) return labelDiff;

        return (Number(right.count) || 0) - (Number(left.count) || 0);
      });

    const badgesHtml = items.map((item) => {
      const categoryMeta = categories?.[item.category] || EXTERNAL_NADI4U_CATEGORY;
      const colorTokens = String(categoryMeta?.color || "").split(" ").filter(Boolean);
      const bgClass = colorTokens[0] || "bg-slate-100";
      const textClass = colorTokens[1] || "text-slate-700";
      const borderClass = colorTokens[2] || "border-slate-200";
      const dotClass = categoryMeta?.dot || "bg-slate-400";
      const normalizedItemLabel = normalizeNadi4uSubcategoryFilterValue(item.label);
      const isClickable = clickable && isNadi4uView && normalizedItemLabel.length > 0;
      const isActive = isClickable
        && normalizedItemLabel === normalizedSubcategoryFilter
        && clickSource === normalizedSubcategoryFilterSource;
      const encodedLabel = encodeURIComponent(item.label);
      const clickableClasses = isClickable ? "cursor-pointer hover:shadow-sm hover:-translate-y-[1px] transition-all" : "";
      const activeClasses = isActive ? "ring-2 ring-cyan-400 ring-offset-1" : "";
      const clickAttrs = isClickable
        ? `role="button" tabindex="0" onclick="handleNadi4uSubcategoryFilterClick(decodeURIComponent('${encodedLabel}'),'${clickSource}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();handleNadi4uSubcategoryFilterClick(decodeURIComponent('${encodedLabel}'),'${clickSource}');}"`
        : "";

      return `<div class="flex items-center gap-1.5 px-2 py-1 ${bgClass} border ${borderClass} rounded-md ${clickableClasses} ${activeClasses}" ${clickAttrs}>
        <span class="w-2 h-2 rounded-full ${dotClass}"></span>
        <span class="text-[8px] font-bold ${textClass}">${escapeHtml(item.label)}: ${item.count}</span>
      </div>`;
    }).join("");

    if (!badgesHtml) {
      return '<div class="text-[8px] italic text-slate-400">No events</div>';
    }
    return `<div class="flex flex-wrap gap-2">${badgesHtml}</div>`;
  };

  const renderCountSection = (sectionLabel, sectionCounts, sectionTotal, options = {}) => {
    const isFirst = options?.isFirst === true;
    const clickable = options?.clickable === true;
    const clickSource = String(options?.clickSource || "monthly").trim().toLowerCase() || "monthly";
    return `
    <div class="${isFirst ? "" : "mt-3 pt-3 border-t border-slate-100"}">
      <div class="flex items-center justify-between mb-1">
        <span class="text-[8px] font-bold uppercase tracking-wide text-slate-500">${sectionLabel}</span>
        <span class="text-[8px] font-semibold text-slate-400">${sectionTotal}</span>
      </div>
      ${renderCountBadges(sectionCounts, { clickable, clickSource })}
    </div>
  `;
  };

  const renderWeeklyBreakdownSection = (buckets = [], options = {}) => {
    if (!Array.isArray(buckets) || buckets.length === 0) return "";
    const isFirst = options?.isFirst === true;
    const clickable = options?.clickable === true;
    const clickSourceBase = String(options?.clickSource || "weekly").trim().toLowerCase() || "weekly";
    const weeklyViewMode = getCurrentNadi4uWeeklyViewMode();
    const visibleBuckets = weeklyViewMode === NADI4U_WEEKLY_VIEW_ALL
      ? buckets
      : getNadi4uRecentWeeklyBuckets(buckets);

    const weekRows = visibleBuckets.map((bucket) => `
      <div class="rounded-md border border-slate-100 bg-slate-50 p-2">
        <div class="flex items-center justify-between mb-1">
          <span class="text-[8px] font-bold uppercase tracking-wide text-slate-500">Week ${bucket.weekIndex} (${bucket.startDay}-${bucket.endDay})</span>
          <span class="text-[8px] font-semibold text-slate-400">${bucket.total}</span>
        </div>
        ${renderCountBadges(bucket.counts, { clickable, clickSource: `${clickSourceBase}:${bucket.weekIndex}` })}
      </div>
    `).join("");

    return `
      <div class="${isFirst ? "" : "mt-3 pt-3 border-t border-slate-100"}">
        <div class="flex items-center justify-between mb-2">
          <span class="text-[8px] font-bold uppercase tracking-wide text-slate-500">Weekly Events</span>
          <div class="flex items-center gap-2">
            <span class="text-[8px] font-semibold text-slate-400">${visibleBuckets.length}/${buckets.length} Weeks</span>
            <select
              class="text-[8px] font-semibold text-slate-600 border border-slate-200 rounded px-1.5 py-0.5 bg-white"
              onchange="handleNadi4uWeeklyViewModeChange(this.value)"
            >
              <option value="${NADI4U_WEEKLY_VIEW_RECENT}" ${weeklyViewMode === NADI4U_WEEKLY_VIEW_RECENT ? "selected" : ""}>Recent Week</option>
              <option value="${NADI4U_WEEKLY_VIEW_ALL}" ${weeklyViewMode === NADI4U_WEEKLY_VIEW_ALL ? "selected" : ""}>All Weeks</option>
            </select>
          </div>
        </div>
        <div class="space-y-2">${weekRows}</div>
      </div>
    `;
  };

  let html = '<div class="bg-white rounded-lg border border-slate-200 p-3 shadow-sm">';
  html += '<div class="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Total Programs</div>';
  let hasRenderedSection = false;
  html += renderCountSection(getProgramListDaySectionLabel(), todayCounts, todayTotal, { isFirst: true, clickable: true, clickSource: "day" });
  hasRenderedSection = true;
  html += renderCountSection("Multiple Day Events", multiDayCounts, multiDayTotal, { isFirst: false, clickable: true, clickSource: "multi" });
  if (isNadi4uView) {
    const weeklySectionHtml = renderWeeklyBreakdownSection(weeklyBuckets, { isFirst: !hasRenderedSection, clickable: true, clickSource: "weekly" });
    if (weeklySectionHtml) {
      html += weeklySectionHtml;
      hasRenderedSection = true;
    }
    html += renderCountSection("Monthly Events", monthlyCounts, monthlyTotal, { isFirst: !hasRenderedSection, clickable: true });
  }
  html += "</div>";
  container.innerHTML = html;
  requestAnimationFrame(syncNadi4uProgramListHeightToTotals);
}

function renderEventList() {
  // Ensure local events state is valid before merging external feeds
  ensureEventsArray();
  const allEvents = getCombinedEventListSource();
  const isNadi4uView = currentProgramListView === PROGRAM_LIST_VIEW_NADI4U;
  updateProgramListHeader();

  const container = document.getElementById("eventListContainer");
  if (!container) {
    console.error("eventListContainer not found!");
    return;
  }
  container.innerHTML = "";
  eventImageMap = {};

  let displayEvents = getProgramListDisplayEvents(allEvents);
  renderCategoryCounts(displayEvents, allEvents);

  eventListLookup = new Map();
  displayEvents.forEach((eventItem) => {
    eventListLookup.set(String(eventItem.id), eventItem);
  });

  if (!isNadi4uView) {
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

    displayEvents.sort((a, b) => {
      const leftIsMultiDay = isRecentMultiDayEvent(a);
      const rightIsMultiDay = isRecentMultiDayEvent(b);
      if (leftIsMultiDay === rightIsMultiDay) return 0;
      return leftIsMultiDay ? 1 : -1;
    });
  }

  // =====================================================
  // OPTIMIZATION: Pagination (20 events per page)
  // =====================================================
  const EVENTS_PER_PAGE = 20;
  let currentPage = 0;
  const pageStateKey = getProgramListPageStateKey();
  
  // Store pagination state globally
  window[pageStateKey] = window[pageStateKey] || 0;
  currentPage = window[pageStateKey];
  
  const totalPages = Math.ceil(displayEvents.length / EVENTS_PER_PAGE);
  if (currentPage >= totalPages && totalPages > 0) {
    currentPage = totalPages - 1;
    window[pageStateKey] = currentPage;
  }
  const paginatedEvents = displayEvents.slice(
    currentPage * EVENTS_PER_PAGE, 
    (currentPage + 1) * EVENTS_PER_PAGE
  );

  if (displayEvents.length === 0) {
    window[pageStateKey] = 0;
    const emptyTitle = isNadi4uView ? "No Smart Services NADI4U events found" : "No programs found";
    const emptySubtitle = isNadi4uView
      ? "Sync NADI4U from settings to refresh the Smart Services list"
      : 'Select a date to add a program or click "Add" to create one';

    container.innerHTML = `
      <div class="text-center p-6 bg-slate-50 rounded-lg border border-dashed border-slate-300 text-slate-500 text-xs mt-2">
        <i class="fa-regular fa-calendar-xmark text-2xl text-slate-300 mb-2"></i>
        <p class="font-medium">${emptyTitle}</p>
        <p class="text-[10px] text-slate-400 mt-1">${emptySubtitle}</p>
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
  const isMultiDayInCurrentView = isNadi4uView ? isNadi4uMultiDayEvent : isRecentMultiDayEvent;
  const sectionAccentClass = isNadi4uView ? "cyan" : "blue";
  const shouldRenderDayMultiHeaders = false;
  
  paginatedEvents.forEach((ev) => {
    // Validate event data
    if (!ev || !ev.id || !ev.start || !ev.end) {
      if (window.DEBUG_MODE) console.warn("Invalid event data:", ev);
      return;
    }

    const isCurrentEventMultiDay = isMultiDayInCurrentView(ev);

    if (shouldRenderDayMultiHeaders && !isCurrentEventMultiDay) {
      const recentDivider = document.createElement("div");
      recentDivider.className = "relative my-2 py-1";
      recentDivider.innerHTML = `
        <div class="absolute inset-0 flex items-center">
          <div class="w-full border-t border-${sectionAccentClass}-200"></div>
        </div>
        <div class="relative flex justify-center">
          <span class="px-2 text-[9px] font-bold uppercase tracking-wide text-${sectionAccentClass}-700 bg-slate-50 rounded">${getProgramListDaySectionLabel()}</span>
        </div>
      `;
      container.appendChild(recentDivider);
    }

    if (shouldRenderDayMultiHeaders && isCurrentEventMultiDay) {
      const divider = document.createElement("div");
      divider.className = "relative my-2 py-1";
      divider.innerHTML = `
        <div class="absolute inset-0 flex items-center">
          <div class="w-full border-t border-${sectionAccentClass}-300"></div>
        </div>
        <div class="relative flex justify-center">
          <span class="px-2 text-[9px] font-bold uppercase tracking-wide text-${sectionAccentClass}-700 bg-slate-50 rounded">Multiple Day Events</span>
        </div>
      `;
      container.appendChild(divider);
    }

    const displayCategoryKey = ev?.isExternal && ev?.source === "nadi4u" && ev?.kpiCategory
      ? ev.kpiCategory
      : ev.category;
    const cat = categories[displayCategoryKey] || EXTERNAL_NADI4U_CATEGORY;
    const displaySubcategory = ev?.isExternal && ev?.source === "nadi4u" && ev?.kpiSubcategory
      ? ev.kpiSubcategory
      : ev.subcategory;

    const card = document.createElement("div");
    card.className = "event-card glow-card group bg-white rounded-lg border border-slate-200 p-2 shadow-sm relative";

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

    let dateStartForDisplay = d1;
    let dateEndForDisplay = d2;
    if (ev?.isExternal && ev?.source === "nadi4u") {
      const range = getNadi4uScheduleDateRange(ev);
      if (range.startDate) {
        const parsedStart = new Date(`${range.startDate}T00:00:00`);
        if (!Number.isNaN(parsedStart.getTime())) {
          dateStartForDisplay = parsedStart;
        }
      }
      if (range.endDate) {
        const parsedEnd = new Date(`${range.endDate}T00:00:00`);
        if (!Number.isNaN(parsedEnd.getTime())) {
          dateEndForDisplay = parsedEnd;
        }
      }
    }

    let dateDisplay = dateStartForDisplay.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    let dateDisplayHtml = escapeHtml(dateDisplay.toUpperCase());
    const isMultiDayDisplay = dateStartForDisplay.toDateString() !== dateEndForDisplay.toDateString();
    if (isMultiDayDisplay) {
      const rangeEndDisplay = dateEndForDisplay.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
      dateDisplay = `${dateDisplay} - ${rangeEndDisplay}`;
      dateDisplayHtml = escapeHtml(dateDisplay.toUpperCase());
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
    const mergedRegistrationLinks = mergeRegistrationLinksWithProgramInfo(ev.registrationLinks, ev.info);
    const hasRegistrationLinks = mergedRegistrationLinks.length > 0;
    const hasSubmitLinks = ev.submitLinks && ev.submitLinks.length > 0;
    
    if (hasRegistrationLinks || hasSubmitLinks) {
      actionLinksHtml = '<div class="mt-2 space-y-2">';
      
      // Add all registration links
      if (hasRegistrationLinks) {
        actionLinksHtml += '<div class="flex flex-col gap-1">';
        actionLinksHtml += '<label class="text-[8px] font-bold text-slate-400 uppercase tracking-wide">Registration Link</label>';
        mergedRegistrationLinks.forEach((link) => {
          if (link.url) {
            actionLinksHtml += `
            <div class="flex items-center gap-2 text-[9px] bg-slate-50 px-2 py-1 rounded border border-slate-100 relative overflow-hidden flex-wrap sm:flex-nowrap">
              <span class="font-bold text-slate-600 w-12 truncate shrink-0">${link.platform || 'NES'}</span>
              <a href="${link.url}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline truncate ${link.message ? 'shrink-0 max-w-[150px]' : 'flex-1 block'}">${link.url}</a>
              ${link.message ? `<span class="text-red-500 font-bold ml-auto shrink-0 truncate">${link.message}</span>` : ''}
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


    const infoMarkup = typeof ev.info === "string"
      ? buildProgramInfoMarkup(ev.id, ev.info, ev.images)
      : '<span class="text-[9px] text-slate-400 italic">Loading program info...</span>';
    const hasLoadedDetails = eventDetailsCache.has(ev.id);
    const hasProgramInfo = hasLoadedDetails
      ? hasProgramInfoValue(ev.info, ev.images, false)
      : true;
    const infoIndicatorColor = hasProgramInfo ? "#cb233b" : "#94a3b8";
    const actionButtonsHtml = showEditDeleteButtons && !ev.isExternal
      ? `<div class="absolute top-0 right-0 flex gap-2 opacity-100 transition-opacity bg-white/80 backdrop-blur pl-2 pb-1 rounded-bl-lg">
          <button onclick="openModal('${ev.id}')" class="text-slate-400 hover:text-blue-600 transition-colors" title="Edit">
            <i class="fa-solid fa-pen text-xs"></i>
          </button>
          <button onclick="deleteEvent('${ev.id}')" class="text-slate-400 hover:text-red-500 transition-colors" title="Delete">
            <i class="fa-solid fa-trash text-xs"></i>
          </button>
        </div>`
      : "";
    const programTypeLabel = ev?.isExternal && ev?.source === "nadi4u" && typeof ev?.programType === "string"
      ? ev.programType.trim()
      : "";
    const isLearningCategoryCard = displayCategoryKey === "learning";
    const categoryBadgeWidthClass = isLearningCategoryCard ? "min-w-[110px] max-w-[110px]" : "min-w-[80px]";
    const categoryLabelClass = isLearningCategoryCard
      ? "text-[9px] font-bold uppercase leading-tight whitespace-normal break-words text-right"
      : "text-[9px] font-bold uppercase whitespace-nowrap leading-none";

    card.innerHTML = `
      <div class="flex flex-col gap-1 relative">
        <div class="flex justify-between items-start gap-2">
          <div class="flex-1 min-w-0">
            <span class="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">${dateDisplayHtml}</span>
            ${programTypeLabel ? `<span class="text-[10px] font-bold tracking-wide block mt-0.5" style="color:#2228a4;">- ${escapeHtml(programTypeLabel.toUpperCase())} -</span>` : ""}
            <h4 class="text-xs font-bold text-slate-800 leading-tight mt-0.5 break-words">${ev.title}</h4>
          </div>
          <div class="flex flex-col items-end w-auto text-right gap-1 shrink-0">
            <div class="flex flex-col items-end justify-center px-2 py-1 rounded border ${cat.color} ${categoryBadgeWidthClass}">
              <span class="${categoryLabelClass}">${cat.label}</span>
              <span class="text-[8px] opacity-80 whitespace-nowrap leading-none mt-0.5">${cat.sub}</span>
            </div>
            ${displaySubcategory ? `<span class="text-[9px] font-semibold ${cat.color.split(" ")[1]} ${cat.color.split(" ")[2]}">${displaySubcategory}</span>` : ""}
          </div>
        </div>
        ${ev.time || ev.secondTime ? `<div class="text-[10px] text-slate-500 font-medium"><i class="fa-regular fa-clock mr-1"></i>${ev.time || ""}${ev.secondTime ? `<br><i class="fa-regular fa-clock mr-1"></i>${ev.secondTime}` : ""}</div>` : ""}
        <div class="mt-1 flex justify-end">
          <button type="button" onclick="toggleEventInfo('${ev.id}')" class="text-[8px] text-slate-500 hover:text-slate-700 flex items-center gap-1 transition-colors cursor-pointer">
            <span id="info-label-${ev.id}" class="font-semibold" style="color: ${infoIndicatorColor};">Program Info</span>
            <i id="info-icon-${ev.id}" class="fa-solid fa-chevron-down text-[7px]" style="color: ${infoIndicatorColor};"></i>
          </button>
        </div>
        <div id="event-info-${ev.id}" class="hidden text-[9.5px] text-slate-600 mt-1 bg-slate-50 p-2 rounded leading-relaxed whitespace-pre-line event-info-content overflow-hidden">${infoMarkup}</div>
        ${linksHtml}
        ${actionLinksHtml}
        ${actionButtonsHtml}
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

  const visibleEventIds = paginatedEvents
    .filter((eventItem) => !eventItem?.isExternal)
    .map((eventItem) => eventItem?.id)
    .filter(Boolean);
  prefetchEventDetailsForVisibleEventIds(visibleEventIds);
}

// =====================================================
// OPTIMIZATION: Change event page
// =====================================================
function changeEventPage(direction) {
  const allEvents = getCombinedEventListSource();
  const displayEvents = getProgramListDisplayEvents(allEvents);
  const pageStateKey = getProgramListPageStateKey();
  
  const EVENTS_PER_PAGE = 20;
  const totalPages = Math.ceil(displayEvents.length / EVENTS_PER_PAGE);

  if (totalPages <= 0) {
    window[pageStateKey] = 0;
    renderEventList();
    return;
  }

  window[pageStateKey] = window[pageStateKey] || 0;
  window[pageStateKey] = Math.max(0, Math.min(totalPages - 1, window[pageStateKey] + direction));
  
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


async function openModal(id = null, dateHint = null) {
  showModal("eventModal", "modalPanel", "eventTitle");
  await ensureProgramImagesFeatureSupport();
  setProgramImagesEnabled(programImagesEnabled);

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
    const eventStartDisplay = isoDateToDisplay(ev.start);
    const eventEndDisplay = isoDateToDisplay(ev.end || ev.start);
    document.getElementById("startDate").value = eventStartDisplay;
    document.getElementById("endDate").value = eventEndDisplay;



    let eventInfo = typeof ev.info === "string" ? ev.info : "";
    let eventImages = normalizeProgramImages(ev.images);
    const needsDetailsFetch = typeof ev.info !== "string" || (programImagesEnabled && !Array.isArray(ev.images));
    if (needsDetailsFetch) {
      try {
        const details = await loadEventDetailsById(ev.id);
        eventInfo = details.info || "";
        eventImages = cloneProgramImages(details.images);
      } catch (error) {
        console.error("Failed to load event details:", error);
      }
    }

    programInfoContent = eventInfo || "";
    originalProgramInfoContent = programInfoContent;
    programExistingImages = cloneProgramImages(eventImages);
    programNewImageFiles = [];
    programRemovedImages = [];
    originalProgramImages = cloneProgramImages(eventImages);
    updateProgramInfoPreview();
    const infoContainer = document.getElementById("programInfoContainer");
    if (infoContainer) {
      infoContainer.classList.remove("hidden");
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
    const subcategorySelect = document.getElementById("subcategory");
    if (subcategorySelect) subcategorySelect.value = "";
    const checkedCategory = document.querySelector('input[name="category"]:checked');
    updateSubcategories(checkedCategory ? checkedCategory.value : null);

    programInfoContent = "";
    originalProgramInfoContent = "";
    programExistingImages = [];
    programNewImageFiles = [];
    programRemovedImages = [];
    originalProgramImages = [];
    clearProgramEditorPreviewUrls();
    updateProgramInfoPreview();

    // Set date to today or clicked date
    let dateToUse = dateHint || window.selectedFilterDate;
    if (!dateToUse) {
      dateToUse = toLocalISOString(today);
    }
    
    document.getElementById("modalTitle").textContent = "New Program";
    const displayDateToUse = isoDateToDisplay(dateToUse);
    document.getElementById("startDate").value = displayDateToUse;
    document.getElementById("endDate").value = displayDateToUse;
    
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

function clearProgramEditorPreviewUrls() {
  programEditorPreviewUrls.forEach((url) => {
    try {
      URL.revokeObjectURL(url);
    } catch (error) {}
  });
  programEditorPreviewUrls = [];
}

function syncProgramImageDraftFromState() {
  editorProgramExistingImages = cloneProgramImages(programExistingImages);
  editorProgramNewImageFiles = Array.isArray(programNewImageFiles) ? programNewImageFiles.slice() : [];
  editorProgramRemovedImages = cloneProgramImages(programRemovedImages);
}

function commitProgramImageDraftToState() {
  programExistingImages = cloneProgramImages(editorProgramExistingImages);
  programNewImageFiles = Array.isArray(editorProgramNewImageFiles) ? editorProgramNewImageFiles.slice() : [];
  programRemovedImages = cloneProgramImages(editorProgramRemovedImages);
}

function renderProgramImagePreviews() {
  const container = document.getElementById("programInfoImagePreview");
  if (!container) return;

  clearProgramEditorPreviewUrls();
  const previewItems = [];

  editorProgramExistingImages.forEach((img, index) => {
    previewItems.push(`
      <div class="relative group">
        <button type="button" onclick="programOpenEditorImage('existing', ${index})" class="block w-full">
          <img src="${escapeAttribute(img.url)}" alt="Program image" class="w-full h-24 object-cover rounded border border-slate-200" />
        </button>
        <button type="button" onclick="programRemoveExistingImage(${index})" class="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
    `);
  });

  editorProgramNewImageFiles.forEach((file, index) => {
    const previewUrl = URL.createObjectURL(file);
    programEditorPreviewUrls.push(previewUrl);
    previewItems.push(`
      <div class="relative group">
        <button type="button" onclick="programOpenEditorImage('new', ${index})" class="block w-full">
          <img src="${escapeAttribute(previewUrl)}" alt="New program image" class="w-full h-24 object-cover rounded border border-slate-200" />
        </button>
        <button type="button" onclick="programRemoveNewImage(${index})" class="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
    `);
  });

  container.innerHTML = previewItems.join("");
}

function validateProgramImageFiles(files) {
  const accepted = [];
  const rejected = [];

  files.forEach((file) => {
    if (!file || !file.type || !file.type.startsWith("image/")) {
      rejected.push(`${file?.name || "unknown-file"} (not an image)`);
      return;
    }
    if (file.size > MAX_PROGRAM_IMAGE_BYTES) {
      rejected.push(`${file.name} (over 5 MB)`);
      return;
    }
    accepted.push(file);
  });

  if (rejected.length > 0) {
    alert(`Some files were skipped:\n- ${rejected.join("\n- ")}`);
  }

  return accepted;
}

function addProgramImageFiles(files) {
  if (!programImagesEnabled) {
    alert(PROGRAM_IMAGE_DISABLED_MSG);
    return 0;
  }
  const imageFiles = validateProgramImageFiles(Array.isArray(files) ? files : []);
  if (!imageFiles.length) return 0;
  editorProgramNewImageFiles = editorProgramNewImageFiles.concat(imageFiles);
  renderProgramImagePreviews();
  return imageFiles.length;
}

function addProgramImageUrls(urls) {
  const result = { added: 0, skippedData: 0 };
  if (!programImagesEnabled || !Array.isArray(urls) || !urls.length) return result;

  urls.forEach((url) => {
    const cleanUrl = typeof url === "string" ? url.trim() : "";
    if (!cleanUrl) return;
    if (/^data:image\//i.test(cleanUrl)) {
      result.skippedData += 1;
      return;
    }
    if (!/^https?:\/\//i.test(cleanUrl)) return;

    const exists = editorProgramExistingImages.some((img) => img.url === cleanUrl);
    if (!exists) {
      editorProgramExistingImages.push({ url: cleanUrl, path: null, name: "pasted-image" });
      result.added += 1;
    }
  });

  if (result.added > 0) {
    renderProgramImagePreviews();
  }
  return result;
}

function programTriggerImagePicker() {
  if (!programImagesEnabled) {
    alert(PROGRAM_IMAGE_DISABLED_MSG);
    return;
  }
  const input = document.getElementById("programInfoImages");
  if (input) input.click();
}

function programHandleImageSelection(input) {
  if (!programImagesEnabled) {
    alert(PROGRAM_IMAGE_DISABLED_MSG);
    if (input) input.value = "";
    return;
  }
  const files = Array.from(input?.files || []);
  if (!files.length) return;
  addProgramImageFiles(files);
  if (input) input.value = "";
}

function programSetDropActive(isActive) {
  const zone = document.getElementById("programInfoImageDropzone");
  if (!zone) return;
  if (isActive) {
    zone.classList.add("ring-2", "ring-blue-300", "bg-blue-50/60");
  } else {
    zone.classList.remove("ring-2", "ring-blue-300", "bg-blue-50/60");
  }
}

function programHandleImageDragOver(event) {
  if (!programImagesEnabled) return;
  event.preventDefault();
  programSetDropActive(true);
}

function programHandleImageDragLeave(event) {
  if (!programImagesEnabled) return;
  event.preventDefault();
  programSetDropActive(false);
}

function programHandleImageDrop(event) {
  if (!programImagesEnabled) {
    event.preventDefault();
    programSetDropActive(false);
    alert(PROGRAM_IMAGE_DISABLED_MSG);
    return;
  }
  event.preventDefault();
  programSetDropActive(false);
  const files = Array.from(event.dataTransfer?.files || []);
  if (!files.length) return;
  addProgramImageFiles(files);
}

function programRemoveExistingImage(index) {
  const removed = editorProgramExistingImages.splice(index, 1)[0];
  if (removed) {
    const alreadyQueued = editorProgramRemovedImages.some(
      (img) => img.url === removed.url && (img.path || null) === (removed.path || null)
    );
    if (!alreadyQueued) {
      editorProgramRemovedImages.push(removed);
    }
  }
  renderProgramImagePreviews();
}

function programRemoveNewImage(index) {
  editorProgramNewImageFiles.splice(index, 1);
  renderProgramImagePreviews();
}

function programOpenEditorImage(type, index) {
  const images = [];
  editorProgramExistingImages.forEach((img) => {
    images.push({ url: img.url, name: img.name || "program-image" });
  });
  editorProgramNewImageFiles.forEach((file, fileIndex) => {
    const previewUrl = programEditorPreviewUrls[fileIndex];
    if (previewUrl) {
      images.push({ url: previewUrl, name: file.name || "new-program-image" });
    }
  });

  let targetIndex = type === "existing" ? index : editorProgramExistingImages.length + index;
  if (targetIndex < 0) targetIndex = 0;
  if (!images.length) return;
  openProgramImageViewerWithList(images, targetIndex);
}

function extractImagesFromEditor(editor) {
  const urls = [];
  if (!editor) return urls;
  editor.querySelectorAll("img").forEach((img) => {
    const src = (img.getAttribute("src") || "").trim();
    if (src) urls.push(src);
    img.remove();
  });
  return urls;
}

function programHandleEditorPaste(event, editor) {
  const clipboard = event?.clipboardData;
  const items = Array.from(clipboard?.items || []);
  const imageFiles = items
    .filter((item) => item.type && item.type.startsWith("image/"))
    .map((item) => item.getAsFile())
    .filter(Boolean);

  if (imageFiles.length > 0) {
    event.preventDefault();
    const plainText = clipboard?.getData("text/plain");
    if (plainText) {
      document.execCommand("insertText", false, plainText);
    }
    const added = addProgramImageFiles(imageFiles);
    if (added > 0) {
      alert("Pasted image added to Program Images.");
    }
    setTimeout(() => autoConvertUrlsToLinks(editor), 0);
    return;
  }

  setTimeout(() => {
    const extractedUrls = extractImagesFromEditor(editor);
    if (extractedUrls.length > 0) {
      const result = addProgramImageUrls(extractedUrls);
      if (result.added > 0) {
        alert("Pasted image was moved to Program Images.");
      } else if (result.skippedData > 0) {
        alert("Embedded base64 images are not allowed. Use image upload instead.");
      }
    }
    autoConvertUrlsToLinks(editor);
  }, 0);
}

function programHandleEditorDrop(event, editor) {
  const files = Array.from(event?.dataTransfer?.files || []);
  if (!files.length) return;
  if (!files.some((file) => file?.type && file.type.startsWith("image/"))) return;

  event.preventDefault();
  const added = addProgramImageFiles(files);
  if (added > 0) {
    alert("Dropped image added to Program Images.");
  }
  setTimeout(() => autoConvertUrlsToLinks(editor), 0);
}

async function openRichTextEditor() {
  await ensureProgramImagesFeatureSupport();
  setProgramImagesEnabled(programImagesEnabled);
  syncProgramImageDraftFromState();
  renderProgramImagePreviews();

  const editor = document.getElementById("richTextEditor");
  editor.innerHTML = programInfoContent || "";
  editor.onpaste = function (event) {
    programHandleEditorPaste(event, editor);
  };
  editor.ondragover = function (event) {
    if ((event.dataTransfer?.types || []).includes("Files")) {
      event.preventDefault();
    }
  };
  editor.ondrop = function (event) {
    programHandleEditorDrop(event, editor);
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
  clearProgramEditorPreviewUrls();
  programSetDropActive(false);
  closeProgramImageViewer();
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
  if (programExistingImages.length > 0) {
    programRemovedImages = programRemovedImages.concat(cloneProgramImages(programExistingImages));
  }
  programExistingImages = [];
  programNewImageFiles = [];
  updateProgramInfoPreview();
  closeConfirmModal();
  closeRichTextModal();
}

function saveRichText() {
  const editor = document.getElementById("richTextEditor");
  const nextContent = editor.innerHTML.trim();
  if (containsEmbeddedDataImage(nextContent)) {
    alert("Embedded base64 images are not allowed in Program Info. Use Program Images upload instead.");
    return;
  }

  const contentBytes = getUtf8ByteLength(nextContent);
  if (contentBytes > MAX_PROGRAM_INFO_BYTES) {
    alert(`Program Info is too large (${Math.ceil(contentBytes / 1024)} KB). Maximum allowed is ${Math.ceil(MAX_PROGRAM_INFO_BYTES / 1024)} KB.`);
    return;
  }

  programInfoContent = nextContent;
  commitProgramImageDraftToState();
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

function buildProgramInfoMarkup(eventId, info, images) {
  const normalizedImages = normalizeProgramImages(images);
  const mapKey = String(eventId);
  eventImageMap[mapKey] = normalizedImages.map((img) => ({
    url: img.url,
    name: img.name || "program-image"
  }));

  const imagesHtml = normalizedImages.length > 0
    ? `<div class="mb-2 flex flex-wrap gap-2 items-start justify-start">${normalizedImages.map((img, index) => `<button type="button" onclick="openEventCardImage('${mapKey}', ${index})" class="block cursor-pointer"><div class="h-[60px] max-w-full bg-white border border-slate-200 rounded overflow-hidden hover:opacity-95 transition-opacity flex items-start justify-start cursor-pointer"><img src="${escapeAttribute(img.url)}" alt="Program image" class="h-[60px] w-auto max-w-full object-contain object-left-top cursor-pointer" loading="lazy" /></div></button>`).join("")}</div>`
    : "";

  const infoHtml = info
    ? sanitizeHTMLWithLinks(info)
    : '<span class="text-[9px] text-slate-400 italic">No program info available.</span>';

  return `${imagesHtml}${infoHtml}`;
}

function openEventCardImage(eventId, index) {
  const images = eventImageMap[String(eventId)] || [];
  if (!images.length) return;
  openProgramImageViewerWithList(images, index);
}

function openProgramImageViewer(url, name = "") {
  openProgramImageViewerWithList([{ url, name: name || "program-image" }], 0);
}

function openProgramImageViewerWithList(images, index) {
  const modal = document.getElementById("programImageModal");
  if (!modal || !Array.isArray(images) || images.length === 0) return;
  currentProgramImageList = images;
  currentProgramImageIndex = Math.min(Math.max(index, 0), images.length - 1);
  updateProgramImageViewer();
  modal.classList.remove("hidden");
}

function updateProgramImageViewer() {
  const img = document.getElementById("programImagePreviewLarge");
  const counter = document.getElementById("programImageCounter");
  const prevBtn = document.getElementById("programImagePrev");
  const nextBtn = document.getElementById("programImageNext");
  if (!img) return;

  const current = currentProgramImageList[currentProgramImageIndex];
  if (!current) return;

  currentProgramImageUrl = current.url;
  currentProgramImageName = current.name || "program-image";
  img.src = currentProgramImageUrl;
  img.alt = currentProgramImageName;
  if (counter) counter.textContent = `${currentProgramImageIndex + 1} / ${currentProgramImageList.length}`;

  const isPrevDisabled = currentProgramImageIndex <= 0;
  const isNextDisabled = currentProgramImageIndex >= currentProgramImageList.length - 1;

  if (prevBtn) {
    prevBtn.disabled = isPrevDisabled;
    prevBtn.classList.toggle("opacity-40", isPrevDisabled);
    prevBtn.classList.toggle("hidden", isPrevDisabled);
  }
  if (nextBtn) {
    nextBtn.disabled = isNextDisabled;
    nextBtn.classList.toggle("opacity-40", isNextDisabled);
    nextBtn.classList.toggle("hidden", isNextDisabled);
  }
}

function showPrevProgramImage() {
  if (currentProgramImageIndex <= 0) return;
  currentProgramImageIndex -= 1;
  updateProgramImageViewer();
}

function showNextProgramImage() {
  if (currentProgramImageIndex >= currentProgramImageList.length - 1) return;
  currentProgramImageIndex += 1;
  updateProgramImageViewer();
}

function closeProgramImageViewer() {
  const modal = document.getElementById("programImageModal");
  const img = document.getElementById("programImagePreviewLarge");
  if (img) img.src = "";
  if (modal) modal.classList.add("hidden");
  currentProgramImageUrl = "";
  currentProgramImageName = "";
  currentProgramImageList = [];
  currentProgramImageIndex = 0;
  exitProgramImageFullscreen();
}

function handleProgramImageOverlayClick(event) {
  const panel = document.getElementById("programImagePanel");
  const frame = document.getElementById("programImageFrame");
  const target = event?.target;
  if (!panel || !target) return;

  if (!programImageMaximized) {
    if (!panel.contains(target)) {
      closeProgramImageViewer();
    }
    return;
  }

  if (frame && !frame.contains(target)) {
    exitProgramImageFullscreen();
  }
}

async function copyProgramImage() {
  if (!currentProgramImageUrl) return;
  try {
    if (navigator.clipboard && window.ClipboardItem) {
      const response = await fetch(currentProgramImageUrl);
      const blob = await response.blob();
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
      alert("Image copied to clipboard.");
      return;
    }
  } catch (error) {}

  try {
    await navigator.clipboard.writeText(currentProgramImageUrl);
    alert("Image link copied to clipboard.");
  } catch (error) {
    alert("Unable to copy image. Please use Download.");
  }
}

function downloadProgramImage() {
  if (!currentProgramImageUrl) return;
  const link = document.createElement("a");
  link.href = currentProgramImageUrl;
  link.download = currentProgramImageName || "program-image";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function toggleProgramImageFullscreen() {
  const modal = document.getElementById("programImageModal");
  const icon = document.getElementById("programImageFullscreenIcon");
  if (!modal) return;
  programImageMaximized = !programImageMaximized;
  modal.classList.toggle("image-modal-full", programImageMaximized);
  if (icon) {
    icon.classList.toggle("fa-expand", !programImageMaximized);
    icon.classList.toggle("fa-compress", programImageMaximized);
  }
}

function exitProgramImageFullscreen() {
  const modal = document.getElementById("programImageModal");
  const icon = document.getElementById("programImageFullscreenIcon");
  programImageMaximized = false;
  if (modal) modal.classList.remove("image-modal-full");
  if (icon) {
    icon.classList.remove("fa-compress");
    icon.classList.add("fa-expand");
  }
}

async function uploadProgramImages(eventId, files) {
  const uploaded = [];
  for (const file of files) {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const uniquePart = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const path = `events/program-info/${eventId}/${uniquePart}-${safeName}`;
    const { error } = await supabaseClient.storage
      .from(PROGRAM_IMAGE_BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw error;
    const { data } = supabaseClient.storage.from(PROGRAM_IMAGE_BUCKET).getPublicUrl(path);
    if (data?.publicUrl) {
      uploaded.push({ url: data.publicUrl, path: path, name: file.name });
    }
  }
  return uploaded;
}

async function deleteProgramImages(images) {
  const paths = normalizeProgramImages(images).map((img) => img.path).filter(Boolean);
  if (!paths.length) return;
  try {
    await supabaseClient.storage.from(PROGRAM_IMAGE_BUCKET).remove(paths);
  } catch (error) {}
}

async function toggleEventInfo(eventId) {
  const container = document.getElementById("event-info-" + eventId);
  const icon = document.getElementById("info-icon-" + eventId);
  if (!container || !icon) return;
  const isOpen = !container.classList.contains("hidden");

  if (isOpen) {
    container.classList.add("hidden");
    toggleChevron(icon, false);
    return;
  }

  const eventKey = String(eventId);
  const eventData = eventListLookup.get(eventKey) || events.find((eventItem) => String(eventItem.id) === eventKey);
  const isExternalEvent = Boolean(eventData?.isExternal);
  const needsDetailsFetch = !isExternalEvent && (!eventData
    || typeof eventData.info !== "string"
    || (programImagesEnabled && !Array.isArray(eventData.images)));

  if (needsDetailsFetch) {
    container.innerHTML = '<span class="text-[9px] text-slate-400 italic">Loading program info...</span>';
    container.classList.remove("hidden");
    toggleChevron(icon, true);
    try {
      const details = await loadEventDetailsById(eventId);
      container.innerHTML = buildProgramInfoMarkup(eventId, details.info, details.images);
      setProgramInfoIndicatorColor(eventId, hasProgramInfoValue(details.info, details.images, false));
    } catch (error) {
      console.error("Failed to load program info:", error);
      container.innerHTML = '<span class="text-[9px] text-red-500 italic">Failed to load program info.</span>';
    }
  } else {
    container.classList.remove("hidden");
    container.innerHTML = buildProgramInfoMarkup(eventId, eventData.info || "", eventData.images);
    setProgramInfoIndicatorColor(eventId, hasProgramInfoValue(eventData.info, eventData.images, false));
    toggleChevron(icon, true);
  }
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
  const startDateInputValue = document.getElementById("startDate").value.trim();
  const endDateInputValue = document.getElementById("endDate").value.trim();
  const start = parseDateInputToIso(startDateInputValue);
  const parsedEnd = parseDateInputToIso(endDateInputValue);
  const end = parsedEnd || start;
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
  if (!startDateInputValue || !title) {
    alert("Start Date and Title are required.");
    return;
  }

  if (!start) {
    alert("Start Date must be in dd/mm/yyyy format.");
    return;
  }

  if (endDateInputValue && !parsedEnd) {
    alert("End Date must be in dd/mm/yyyy format.");
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

  const infoChanged = programInfoVal !== originalProgramInfoContent;
  if (infoChanged && containsEmbeddedDataImage(programInfoVal)) {
    alert("Embedded base64 images are not allowed in Program Info. Use Program Images upload instead.");
    return;
  }

  const infoBytes = getUtf8ByteLength(programInfoVal);
  if (infoChanged && infoBytes > MAX_PROGRAM_INFO_BYTES) {
    alert(`Program Info is too large (${Math.ceil(infoBytes / 1024)} KB). Maximum allowed is ${Math.ceil(MAX_PROGRAM_INFO_BYTES / 1024)} KB.`);
    return;
  }

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

  const imagesChanged = !areProgramImagesEqual(programExistingImages, originalProgramImages)
    || programNewImageFiles.length > 0
    || programRemovedImages.length > 0;

  let uploadedImages = [];
  let savedEvent = { ...eventData };
  let imagesColumnMissing = false;

  try {
    if (id) {
      const updatePayload = { ...eventData };
      let finalImages = cloneProgramImages(programExistingImages);

      if (programImagesEnabled && imagesChanged) {
        if (programNewImageFiles.length > 0) {
          uploadedImages = await uploadProgramImages(id, programNewImageFiles);
          finalImages = finalImages.concat(uploadedImages);
        }
        updatePayload.images = finalImages;
      }

      let { error: updateError } = await supabaseClient
        .from("events")
        .update(updatePayload)
        .eq("id", id);

      if (updateError && isMissingColumnError(updateError) && programImagesEnabled) {
        imagesColumnMissing = true;
        setProgramImagesEnabled(false);
        programImagesCapabilityChecked = true;
        if (uploadedImages.length > 0) {
          await deleteProgramImages(uploadedImages);
          uploadedImages = [];
        }
        const retry = await supabaseClient
          .from("events")
          .update(eventData)
          .eq("id", id);
        updateError = retry.error;
      }

      if (updateError) throw updateError;

      savedEvent = { ...eventData };
      if (programImagesEnabled) {
        savedEvent.images = imagesChanged
          ? cloneProgramImages(finalImages)
          : cloneProgramImages(programExistingImages);
      }
    } else {
      const { error: insertError } = await supabaseClient
        .from("events")
        .insert([eventData]);

      if (insertError) throw insertError;

      savedEvent = { ...eventData };

      if (programImagesEnabled && imagesChanged) {
        let finalImages = cloneProgramImages(programExistingImages);
        if (programNewImageFiles.length > 0) {
          uploadedImages = await uploadProgramImages(eventData.id, programNewImageFiles);
          finalImages = finalImages.concat(uploadedImages);
        }

        if (finalImages.length > 0) {
          let { error: imageUpdateError } = await supabaseClient
            .from("events")
            .update({ images: finalImages })
            .eq("id", eventData.id);

          if (imageUpdateError && isMissingColumnError(imageUpdateError)) {
            imagesColumnMissing = true;
            setProgramImagesEnabled(false);
            programImagesCapabilityChecked = true;
            if (uploadedImages.length > 0) {
              await deleteProgramImages(uploadedImages);
              uploadedImages = [];
            }
            finalImages = [];
          } else if (imageUpdateError) {
            throw imageUpdateError;
          }
        }

        if (programImagesEnabled) {
          savedEvent.images = cloneProgramImages(finalImages);
        }
      }
    }

    if (programImagesEnabled && programRemovedImages.length > 0) {
      await deleteProgramImages(programRemovedImages);
    }
  } catch (error) {
    console.error("Error saving event:", error);
    if (uploadedImages.length > 0) {
      await deleteProgramImages(uploadedImages);
    }
    if (/bucket|storage/i.test(error?.message || "")) {
      alert("Image upload failed. Please check the Supabase storage bucket.");
    } else {
      alert("Failed to save event. Please try again.");
    }
    return;
  }

  if (id) {
    const index = events.findIndex((e) => e.id === id);
    if (index !== -1) events[index] = savedEvent;
  } else {
    events.push(savedEvent);
  }
  eventDetailsCache.set(savedEvent.id, {
    info: savedEvent.info || "",
    images: cloneProgramImages(savedEvent.images),
    timestamp: Date.now()
  });

  originalProgramInfoContent = savedEvent.info || "";
  programExistingImages = cloneProgramImages(savedEvent.images);
  programNewImageFiles = [];
  programRemovedImages = [];
  originalProgramImages = cloneProgramImages(savedEvent.images);
  clearProgramEditorPreviewUrls();

  clearEventsCache();
  closeModal();
  renderCalendar();
  renderEventList();

  if (imagesColumnMissing) {
    alert("Program saved, but images were skipped because the `events.images` column is missing.");
  }
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

// NADI4U API Functions
function openNADI4USettings() {
  document.getElementById('settingsMenuView').classList.add('hidden');
  document.getElementById('nadi4uSettingsView').classList.remove('hidden');
  document.getElementById('nadi4uSettingsView').classList.add('flex');

  // Check if logged in
  updateNADI4UView();
}

function parseNadi4uSettingsFromStorage() {
  const raw = getNadi4uStorageItem('nadi4uSettings');
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (error) {
    return null;
  }
}

function persistNadi4uSettings(settings) {
  setNadi4uStorageItem('nadi4uSettings', settings || {});
}

function buildAutoNadi4uSettings(existingSettings = {}) {
  const base = existingSettings && typeof existingSettings === 'object' ? existingSettings : {};
  const apiKey = (window.NADI4U_API && NADI4U_API.defaultApiKey) || base.apiKey || '';

  return {
    ...base,
    apiKey,
    email: NADI4U_AUTO_LOGIN_EMAIL,
    password: NADI4U_AUTO_LOGIN_PASSWORD,
    templateRole: NADI4U_HEADER_ROLE_ASSISTANT,
    templateSiteName: NADI4U_AUTO_LOGIN_SITE_NAME,
    templateSiteSlug: NADI4U_AUTO_LOGIN_SITE_SLUG,
    lastLoginSource: NADI4U_AUTO_LOGIN_SOURCE
  };
}

function persistAutoNadi4uSettings() {
  const currentSettings = parseNadi4uSettingsFromStorage() || {};
  const nextSettings = buildAutoNadi4uSettings(currentSettings);
  persistNadi4uSettings(nextSettings);

  if (window.NADI4U_API) {
    NADI4U_API.configure(nextSettings.apiKey || NADI4U_API.defaultApiKey, nextSettings.token || '');
    if (typeof NADI4U_API.setCredentials === 'function') {
      NADI4U_API.setCredentials(nextSettings.email, nextSettings.password, false);
    }
  }

  return nextSettings;
}

async function autoLoginAndSyncNadi4uOnLoad() {
  if (!window.NADI4U_API) return null;
  if (nadi4uAutoLoginSyncPromise) return nadi4uAutoLoginSyncPromise;

  nadi4uAutoLoginSyncPromise = (async () => {
    try {
      persistAutoNadi4uSettings();
      const loginResult = await NADI4U_API.login(NADI4U_AUTO_LOGIN_EMAIL, NADI4U_AUTO_LOGIN_PASSWORD, { rememberCredentials: true });

      const mergedSettings = buildAutoNadi4uSettings(parseNadi4uSettingsFromStorage() || {});
      if (loginResult?.access_token) {
        mergedSettings.token = loginResult.access_token;
      }
      mergedSettings.userEmail = NADI4U_AUTO_LOGIN_EMAIL;
      try {
        const raw = localStorage.getItem('leave_user');
        if (raw) {
          const leaveUser = JSON.parse(raw);
          const mappedId = resolveNumericSiteId(leaveUser?.site_name) || resolveNumericSiteId(leaveUser?.site_id);
          if (mappedId) mergedSettings.templateSiteId = mappedId;
        }
      } catch (_) {}
      persistNadi4uSettings(mergedSettings);

      updateNADI4UView();
      const syncResult = await syncNADI4UData({ throwOnError: false });
      return syncResult || null;
    } catch (error) {
      if (window.DEBUG_MODE) {
        console.error('Auto NADI4U login/sync failed:', error);
      }
      showNADI4UStatus(`Auto sync failed: ${error.message}`, 'error');
      return null;
    } finally {
      nadi4uAutoLoginSyncPromise = null;
    }
  })();

  return nadi4uAutoLoginSyncPromise;
}

function closeHeaderLoginMenu() {
  const dropdown = document.getElementById('logoutDropdown');
  if (dropdown) {
    dropdown.classList.add('hidden');
  }
  const loginBtn = document.getElementById('loginBtn');
  if (loginBtn) {
    loginBtn.setAttribute('aria-expanded', 'false');
  }
}

function parseLeaveUserFromStorage() {
  let raw = null;
  try {
    raw = appStorage?.getItem ? appStorage.getItem('leave_user') : null;
  } catch (error) {
    raw = null;
  }

  if (!raw) {
    try {
      raw = localStorage.getItem('leave_user');
    } catch (error) {
      raw = null;
    }
  }

  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (error) {
    return null;
  }
}

function mapLeaveRoleToNadi4uRole(leaveRole) {
  const normalized = String(leaveRole || '').trim().toLowerCase();
  if (!normalized) return '';
  if (normalized === 'manager') return NADI4U_HEADER_ROLE_MANAGER;
  if (normalized === 'assistant manager') return NADI4U_HEADER_ROLE_ASSISTANT;
  return '';
}

function toNadiSiteSlug(siteName) {
  const raw = String(siteName || '').trim().toLowerCase();
  if (!raw) return '';
  const withoutPrefix = raw.replace(/^nadi\s+/, '');
  return withoutPrefix
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .replace(/_/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function buildNadi4uTemplateEmail(role, siteSlug) {
  const safeSlug = String(siteSlug || '').trim().toLowerCase();
  if (!safeSlug) return '';
  const safeRole = role === NADI4U_HEADER_ROLE_ASSISTANT
    ? NADI4U_HEADER_ROLE_ASSISTANT
    : NADI4U_HEADER_ROLE_MANAGER;
  return `${safeRole}@${safeSlug}.nadi.my`;
}

function getNadi4uTemplateFromLeaveSession() {
  const leaveUser = parseLeaveUserFromStorage();
  if (!leaveUser) return null;

  const role = mapLeaveRoleToNadi4uRole(leaveUser.role);
  const siteName = String(leaveUser.site_name || '').trim();
  const siteSlug = toNadiSiteSlug(siteName);
  if (!role || !siteSlug) return null;

  return {
    role,
    siteName,
    siteSlug,
    siteId: leaveUser.site_id != null ? String(leaveUser.site_id) : '',
    email: buildNadi4uTemplateEmail(role, siteSlug)
  };
}

function showNadi4uHeaderInlineStatus(message, type = 'info') {
  const statusEl = document.getElementById('nadi4uHeaderInlineStatus');
  if (!statusEl) return;

  if (!message) {
    statusEl.classList.add('hidden');
    statusEl.textContent = '';
    return;
  }

  statusEl.classList.remove('hidden');
  if (type === 'error') {
    statusEl.className = 'px-2 py-1.5 rounded text-[10px] bg-red-100 text-red-700 border border-red-200';
  } else if (type === 'success') {
    statusEl.className = 'px-2 py-1.5 rounded text-[10px] bg-green-100 text-green-700 border border-green-200';
  } else {
    statusEl.className = 'px-2 py-1.5 rounded text-[10px] bg-blue-100 text-blue-700 border border-blue-200';
  }
  statusEl.textContent = message;
}

function persistNadi4uHeaderTemplateState() {
  const settings = parseNadi4uSettingsFromStorage() || {};
  const template = getNadi4uTemplateFromLeaveSession();

  if (template) {
    settings.templateSiteId = template.siteId;
    settings.templateSiteName = template.siteName;
    settings.templateSiteSlug = template.siteSlug;
    settings.templateRole = template.role;
  } else {
    settings.templateSiteId = '';
    settings.templateSiteName = '';
    settings.templateSiteSlug = '';
    settings.templateRole = '';
  }

  persistNadi4uSettings(settings);
  return settings;
}

function refreshNadi4uHeaderEmailPreview(persistSelection = true) {
  const previewInput = document.getElementById('nadi4uHeaderEmailPreview');
  if (!previewInput) return '';

  const template = getNadi4uTemplateFromLeaveSession();
  const email = template?.email || '';
  previewInput.value = email;

  if (persistSelection) {
    persistNadi4uHeaderTemplateState();
  }

  return email;
}

function hydrateNadi4uHeaderFormFromSettings() {
  refreshNadi4uHeaderEmailPreview(false);
  persistNadi4uHeaderTemplateState();
}

function updateNadi4uHeaderBadge() {
  const settings = parseNadi4uSettingsFromStorage() || {};
  const badge = document.getElementById('nadi4uHeaderBadgeDot');
  if (!badge) return;

  if (settings?.token) {
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

function refreshNadi4uHeaderMenuState() {
  const settings = parseNadi4uSettingsFromStorage() || {};
  const isConnected = !!settings?.token;
  const template = getNadi4uTemplateFromLeaveSession();
  refreshNadi4uHeaderEmailPreview(false);

  const stateEl = document.getElementById('nadi4uHeaderState');
  const logoutBtn = document.getElementById('nadi4uHeaderLogoutBtn');

  if (stateEl) {
    if (isConnected) {
      stateEl.textContent = 'Connected to NES';
      stateEl.className = 'text-[10px] text-green-700 mt-1';
    } else if (template) {
      const roleLabel = template.role === NADI4U_HEADER_ROLE_ASSISTANT ? 'Assistant Manager' : 'Manager';
      stateEl.textContent = `Detected from Leave: ${roleLabel} - ${template.siteName}`;
      stateEl.className = 'text-[10px] text-cyan-800 mt-1';
    } else {
      stateEl.textContent = 'Login Leave Access as Manager or Assistant Manager first';
      stateEl.className = 'text-[10px] text-cyan-800 mt-1';
    }
  }

  if (logoutBtn) {
    logoutBtn.classList.toggle('hidden', !isConnected);
  }

  updateNadi4uHeaderBadge();
}

function initNadi4uHeaderMenu() {
  hydrateNadi4uHeaderFormFromSettings();
  refreshNadi4uHeaderMenuState();
}

function openNadi4uSettingsFromHeaderMenu() {
  closeHeaderLoginMenu();
  openSettings();
  openNADI4USettings();
}

async function ensureNADI4USession(settings, options = {}) {
  if (!window.NADI4U_API) {
    throw new Error('NADI4U API is not available');
  }

  const allowBackgroundLogin = options.allowBackgroundLogin !== false;
  const activeSettings = settings && typeof settings === 'object' ? settings : {};
  const apiKey = activeSettings.apiKey || NADI4U_API.defaultApiKey;
  const token = activeSettings.token || '';
  const email = typeof activeSettings.email === 'string' ? activeSettings.email.trim() : '';
  const password = typeof activeSettings.password === 'string' ? activeSettings.password : '';

  NADI4U_API.configure(apiKey, token);
  if (typeof NADI4U_API.setCredentials === 'function' && email && password) {
    NADI4U_API.setCredentials(email, password, false);
  }

  if (token) {
    return activeSettings;
  }

  if (allowBackgroundLogin && email && password) {
    await NADI4U_API.login(email, password, { rememberCredentials: true });
    return parseNadi4uSettingsFromStorage() || activeSettings;
  }

  throw new Error('Please login with email & password first.');
}

function updateNADI4UView() {
  const settings = parseNadi4uSettingsFromStorage();
  const loginView = document.getElementById('nadi4uLoginView');
  const loggedInView = document.getElementById('nadi4uLoggedInView');
  const emailInput = document.getElementById('nadi4uEmail');
  const passwordInput = document.getElementById('nadi4uPassword');

  if (emailInput) {
    emailInput.value = settings?.email || '';
  }

  if (passwordInput) {
    passwordInput.value = settings?.password || '';
  }

  if (settings && settings.token && loginView && loggedInView) {
    // Logged in or have manual credentials
    loginView.classList.add('hidden');
    loggedInView.classList.remove('hidden');

    // Show user email if available
    const userEmailEl = document.getElementById('nadi4uUserEmail');
    if (userEmailEl) {
      if (settings.userEmail) {
        userEmailEl.textContent = settings.userEmail;
      } else if (settings.email) {
        userEmailEl.textContent = settings.email;
      } else {
        userEmailEl.textContent = '';
      }
    }

    // Configure API
    if (window.NADI4U_API) {
      NADI4U_API.configure(settings.apiKey, settings.token);
      if (typeof NADI4U_API.setCredentials === 'function' && settings.email && settings.password) {
        NADI4U_API.setCredentials(settings.email, settings.password, false);
      }
    }
  } else if (loginView && loggedInView) {
    // Not logged in
    loginView.classList.remove('hidden');
    loggedInView.classList.add('hidden');
  }

  refreshNadi4uHeaderMenuState();
  updateNadi4uHeaderBadge();
  hydrateNadi4uHeaderFormFromSettings();
}

async function loginNADI4U(event) {
  const email = document.getElementById('nadi4uEmail').value.trim();
  const password = document.getElementById('nadi4uPassword').value;

  if (!email || !password) {
    alert('Please enter email and password');
    return;
  }

  const btn = event?.currentTarget || document.querySelector('button[onclick^="loginNADI4U"]');
  const originalText = btn ? btn.innerHTML : '';
  if (btn) {
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> Logging in...';
    btn.disabled = true;
  }

  try {
    if (window.NADI4U_API) {
      const result = await NADI4U_API.login(email, password, { rememberCredentials: true });

      // Get user info
      let userEmail = email;
      try {
        const user = await NADI4U_API.getUser();
        userEmail = user.email || email;
      } catch (e) {}

      // Save settings
      const settings = parseNadi4uSettingsFromStorage() || {};
      settings.apiKey = NADI4U_API.defaultApiKey;
      settings.token = result.access_token;
      settings.userEmail = userEmail;
      settings.email = email;
      settings.password = password;
      settings.lastLoginSource = 'settings';
      persistNadi4uSettings(settings);

      updateNADI4UView();
      alert('Login successful!');
    }
  } catch (err) {
    alert('Login failed: ' + err.message);
  } finally {
    if (btn) {
      btn.innerHTML = originalText;
      btn.disabled = false;
    }
  }
}

async function loginNadi4uWithLeaveAccessContext(options = {}) {
  if (!window.NADI4U_API) {
    throw new Error('NADI4U API is not available.');
  }

  const leaveUser = parseLeaveUserFromStorage();
  const rawRole = typeof options.role === 'string' ? options.role : (leaveUser?.role || '');
  const normalizedRawRole = String(rawRole || '').trim().toLowerCase();
  let mappedRole = mapLeaveRoleToNadi4uRole(rawRole);
  if (!mappedRole && (normalizedRawRole === NADI4U_HEADER_ROLE_MANAGER || normalizedRawRole === NADI4U_HEADER_ROLE_ASSISTANT)) {
    mappedRole = normalizedRawRole;
  }
  if (!mappedRole) {
    throw new Error('Leave role must be Manager or Assistant Manager.');
  }

  const siteName = String(options.siteName || leaveUser?.site_name || '').trim();
  if (!siteName) {
    throw new Error('Leave site is required for NADI4U login.');
  }

  const siteSlug = toNadiSiteSlug(siteName);
  if (!siteSlug) {
    throw new Error('Unable to generate site slug for NADI4U email.');
  }

  const siteId = options.siteId != null
    ? String(options.siteId)
    : (leaveUser?.site_id != null ? String(leaveUser.site_id) : '');
  const email = buildNadi4uTemplateEmail(mappedRole, siteSlug).trim().toLowerCase();
  const storedSettings = parseNadi4uSettingsFromStorage() || {};
  const storedPassword = typeof storedSettings.password === 'string' ? storedSettings.password : '';
  const password = typeof options.password === 'string' && options.password !== ''
    ? options.password
    : storedPassword;

  if (!password) {
    throw new Error('NADI APP password is required.');
  }

  const result = await NADI4U_API.login(email, password, { rememberCredentials: true });

  let userEmail = email;
  try {
    const user = await NADI4U_API.getUser();
    userEmail = user?.email || email;
  } catch (error) {}

  const settings = parseNadi4uSettingsFromStorage() || {};
  settings.apiKey = NADI4U_API.defaultApiKey;
  settings.token = result.access_token;
  settings.userEmail = userEmail;
  settings.email = email;
  settings.password = password;
  settings.templateSiteId = siteId;
  settings.templateSiteName = siteName;
  settings.templateSiteSlug = siteSlug;
  settings.templateRole = mappedRole;
  settings.lastLoginSource = typeof options.source === 'string' ? options.source : 'leaveAccess';
  persistNadi4uSettings(settings);

  updateNADI4UView();

  let syncResult = null;
  if (options.autoSync !== false) {
    syncResult = await syncNADI4UData({ throwOnError: true });
  }

  return {
    email,
    siteName,
    siteSlug,
    role: mappedRole,
    syncResult
  };
}

async function loginNadi4uFromHeader(event) {
  if (!window.NADI4U_API) {
    showNadi4uHeaderInlineStatus('NADI4U API is not available.', 'error');
    return;
  }

  const button = event?.currentTarget || document.getElementById('nadi4uHeaderLoginSyncBtn');
  const template = getNadi4uTemplateFromLeaveSession();
  if (!template || !template.email) {
    showNadi4uHeaderInlineStatus('Please login Leave Access as Manager/Assistant Manager first.', 'error');
    return;
  }

  const originalText = button ? button.innerHTML : '';
  if (button) {
    button.disabled = true;
    button.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i>Logging...';
  }
  showNadi4uHeaderInlineStatus('Logging in and syncing current month...', 'info');

  try {
    const loginResult = await loginNadi4uWithLeaveAccessContext({
      siteId: template.siteId || '',
      siteName: template.siteName,
      role: template.role,
      autoSync: true,
      source: 'headerInline'
    });
    showNadi4uHeaderInlineStatus('Login & sync complete.', 'success');

    setTimeout(() => {
      closeHeaderLoginMenu();
      showNadi4uHeaderInlineStatus('');
    }, 900);
  } catch (error) {
    showNadi4uHeaderInlineStatus(`Login/sync failed: ${error.message}`, 'error');
  } finally {
    if (button) {
      button.disabled = false;
      button.innerHTML = originalText;
    }
  }
}

function logoutNADI4U() {
  const previous = parseNadi4uSettingsFromStorage() || {};
  const preservedSettings = {
    apiKey: previous.apiKey || (window.NADI4U_API ? NADI4U_API.defaultApiKey : ''),
    email: previous.email || '',
    password: previous.password || '',
    templateSiteId: previous.templateSiteId || '',
    templateSiteName: previous.templateSiteName || '',
    templateSiteSlug: previous.templateSiteSlug || '',
    templateRole: previous.templateRole || NADI4U_HEADER_ROLE_MANAGER,
    lastLoginSource: 'logout'
  };

  if (window.NADI4U_API) {
    NADI4U_API.logout();
    NADI4U_API.configure(preservedSettings.apiKey || NADI4U_API.defaultApiKey, '');
    if (typeof NADI4U_API.setCredentials === 'function' && preservedSettings.email && preservedSettings.password) {
      NADI4U_API.setCredentials(preservedSettings.email, preservedSettings.password, false);
    }
  }

  persistNadi4uSettings(preservedSettings);

  updateNADI4UView();
  renderEventList();
}

function logoutNadi4uFromHeaderMenu() {
  logoutNADI4U();
  showNadi4uHeaderInlineStatus('');
  closeHeaderLoginMenu();
}

function saveNADI4USettings() {
  const apiKey = document.getElementById('nadi4uApiKey').value.trim();
  const token = document.getElementById('nadi4uToken').value.trim();

  if (!apiKey || !token) {
    alert('Please fill in API Key and Token');
    return;
  }

  const settings = parseNadi4uSettingsFromStorage() || {};
  settings.apiKey = apiKey;
  settings.token = token;
  settings.userEmail = 'Manual credentials';
  settings.lastLoginSource = 'manualCredentials';
  persistNadi4uSettings(settings);

  // Configure the API
  if (window.NADI4U_API) {
    NADI4U_API.configure(apiKey, token);
    if (typeof NADI4U_API.setCredentials === 'function' && settings.email && settings.password) {
      NADI4U_API.setCredentials(settings.email, settings.password, false);
    }
  }

  updateNADI4UView();
  alert('Settings saved successfully!');
}

async function testNADI4UConnection() {
  const settings = parseNadi4uSettingsFromStorage();
  if (!settings) {
    showNADI4UStatus('Please login or enter credentials first', 'error');
    return;
  }

  showNADI4UStatus('Testing connection...', 'info');

  if (window.NADI4U_API) {
    try {
      await ensureNADI4USession(settings);
      const data = await NADI4U_API.getAnnouncements();
      updateNADI4UView();
      showNADI4UStatus(`Connection successful! Found ${data.length} announcements.`, 'success');
    } catch (err) {
      showNADI4UStatus(`Error: ${err.message}`, 'error');
    }
  }
}

async function syncNADI4UData(options = {}) {
  const throwOnError = options?.throwOnError === true;
  const settings = parseNadi4uSettingsFromStorage();
  if (!settings) {
    showNADI4UStatus('Please login or enter credentials first', 'error');
    if (throwOnError) throw new Error('Please login or enter credentials first');
    return;
  }

  if (window.NADI4U_API) {
    showNADI4UStatus('Syncing data...', 'info');

    try {
      await ensureNADI4USession(settings);
      const monthYear = currentYear;
      const monthIndex = currentMonth;

      let nadi4uMonthData = { events: [], schedule: [] };
      if (typeof NADI4U_API.getSmartServicesNadi4uMonthData === "function") {
        nadi4uMonthData = await NADI4U_API.getSmartServicesNadi4uMonthData(monthYear, monthIndex);
      } else {
        throw new Error("Smart Services category sync is not available in the current API client.");
      }

      const [announcements] = await Promise.all([
        NADI4U_API.getAnnouncements()
      ]);

      const eventMeta = Array.isArray(nadi4uMonthData.events) ? nadi4uMonthData.events : [];
      const schedule = Array.isArray(nadi4uMonthData.schedule) ? nadi4uMonthData.schedule : [];

      // Show preview
      document.getElementById('nadi4uDataPreview').classList.remove('hidden');
      const preview = {
        schedule: schedule.slice(0, 5),
        scheduleCount: schedule.length,
        events: eventMeta.slice(0, 5),
        eventCount: eventMeta.length,
        announcements: announcements.slice(0, 3),
        announcementCount: announcements.length
      };
      document.getElementById('nadi4uPreviewContent').textContent = JSON.stringify(preview, null, 2);

      // Store for later use
      setNadi4uStorageItem(NADI4U_SCHEDULE_STORAGE_KEY, schedule);
      setNadi4uStorageItem('nadi4uAnnouncements', announcements);
      setNadi4uStorageItem(NADI4U_EVENT_META_STORAGE_KEY, eventMeta);

      showNADI4UStatus('Sync completed successfully.', 'success');
      updateNADI4UView();
      window.eventListCurrentPage = 0;
      window.nadi4uListCurrentPage = 0;
      renderEventList();
      return {
        scheduleCount: schedule.length,
        eventCount: eventMeta.length,
        announcementCount: announcements.length
      };
    } catch (err) {
      showNADI4UStatus(`Sync failed: ${err.message}`, 'error');
      if (throwOnError) throw err;
    }
  }
}

function showNADI4UStatus(message, type) {
  const statusEl = document.getElementById('nadi4uStatus');
  if (!statusEl) return;

  statusEl.classList.remove('hidden');

  if (type === 'error') {
    statusEl.className = 'p-3 rounded-lg text-[10px] bg-red-100 text-red-700 border border-red-200';
  } else if (type === 'success') {
    statusEl.className = 'p-3 rounded-lg text-[10px] bg-green-100 text-green-700 border border-green-200';
  } else {
    statusEl.className = 'p-3 rounded-lg text-[10px] bg-blue-100 text-blue-700 border border-blue-200';
  }

  statusEl.textContent = message;
}

// Initialize NADI4U on load
document.addEventListener('DOMContentLoaded', async function() {
  const settings = persistAutoNadi4uSettings();
  if (window.NADI4U_API) {
    if (settings?.token) {
      NADI4U_API.configure(settings.apiKey, settings.token);
    }
    if (typeof NADI4U_API.setCredentials === 'function' && settings?.email && settings?.password) {
      NADI4U_API.setCredentials(settings.email, settings.password, false);
    }
  }

  initNadi4uHeaderMenu();
  updateNADI4UView();
  await autoLoginAndSyncNadi4uOnLoad();
});

