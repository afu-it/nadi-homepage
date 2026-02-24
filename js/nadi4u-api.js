/**
 * NADI4U Smart Services API Client
 *
 * Login directly in your app to get fresh tokens automatically
 */

const NADI4U_API = {
  baseUrl: 'https://cmms-api.nadi.my/rest/v1',
  authUrl: 'https://cmms-api.nadi.my/auth/v1',
  settingsStorageKey: 'nadi4uSettings',

  // Default API key (public for unauthenticated requests)
  defaultApiKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzU2Mjg3MDk5LCJleHAiOjE5MTM5NjcwOTl9.m-Fwhllu4DfPG7xP_u-k9ciL0C_ZluS59tOmu9zNzXE',

  // Optional legacy filter (kept for backward compatibility)
  smartServicesEventIds: [],
  userEmail: '',
  userPassword: '',
  reauthPromise: null,

  buildRequestHeaders() {
    return {
      'accept': '*/*',
      'apikey': this.apiKey,
      'authorization': `Bearer ${this.token}`,
      'accept-profile': 'public',
      'Content-Type': 'application/json'
    };
  },

  getStoredSettings() {
    let raw = null;
    try {
      raw = localStorage.getItem(this.settingsStorageKey);
    } catch (error) {
      raw = null;
    }

    if ((!raw || raw === '') && window.safeStorage?.getItem) {
      try {
        raw = window.safeStorage.getItem(this.settingsStorageKey);
      } catch (error) {
        raw = null;
      }
    }

    if (!raw) return {};

    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
      return {};
    }
  },

  saveStoredSettings(nextSettings) {
    const serialized = JSON.stringify(nextSettings || {});
    try {
      localStorage.setItem(this.settingsStorageKey, serialized);
    } catch (error) {}

    if (window.safeStorage?.setItem) {
      try {
        window.safeStorage.setItem(this.settingsStorageKey, serialized);
      } catch (error) {}
    }
  },

  setCredentials(email, password, persist = true) {
    this.userEmail = String(email || '').trim();
    this.userPassword = String(password || '');

    if (!persist) return;
    const current = this.getStoredSettings();
    this.saveStoredSettings({
      ...current,
      email: this.userEmail,
      password: this.userPassword
    });
  },

  hydrateSessionFromStorage() {
    const saved = this.getStoredSettings();
    if (!this.apiKey && saved.apiKey) this.apiKey = saved.apiKey;
    if (!this.token && saved.token) this.token = saved.token;
    if (!this.userEmail && saved.email) this.userEmail = String(saved.email).trim();
    if (!this.userPassword && saved.password) this.userPassword = String(saved.password);
  },

  isJwtExpiredError(statusCode, errorText) {
    if (Number(statusCode) !== 401) return false;
    const normalized = String(errorText || '').toLowerCase();
    return normalized.includes('jwt expired') || normalized.includes('pgrst303');
  },

  ensureAuth() {
    this.hydrateSessionFromStorage();
    if (!this.apiKey) this.apiKey = this.defaultApiKey;
    if (!this.apiKey || !this.token) {
      throw new Error('Not logged in. Call login(email, password) or configure(apiKey, token) first.');
    }
  },

  async reauthenticate() {
    if (this.reauthPromise) return this.reauthPromise;

    this.reauthPromise = (async () => {
      this.hydrateSessionFromStorage();
      if (!this.userEmail || !this.userPassword) {
        throw new Error('Saved login credentials not found. Please login again.');
      }

      await this.login(this.userEmail, this.userPassword, { rememberCredentials: true });
      return true;
    })().finally(() => {
      this.reauthPromise = null;
    });

    return this.reauthPromise;
  },

  async fetchJson(url, options = {}) {
    const { retryOnExpiredJwt = true } = options;
    const response = await fetch(url, {
      method: 'GET',
      headers: this.buildRequestHeaders()
    });

    if (!response.ok) {
      const error = await response.text();
      if (retryOnExpiredJwt && this.isJwtExpiredError(response.status, error)) {
        try {
          await this.reauthenticate();
          return this.fetchJson(url, { retryOnExpiredJwt: false });
        } catch (reauthError) {
          throw new Error(`Session expired and auto re-login failed: ${reauthError.message}`);
        }
      }
      throw new Error(`API Error: ${response.status} - ${error}`);
    }

    return await response.json();
  },

  /**
   * Login to NADI4U with email and password
   * @param {string} email - User email
   * @param {string} password - User password
   * @returns {Promise<Object>} Login response with tokens
   */
  async login(email, password, options = {}) {
    const rememberCredentials = options?.rememberCredentials !== false;
    const response = await fetch(`${this.authUrl}/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'apikey': this.defaultApiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: email,
        password: password
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error_description || error.msg || 'Login failed');
    }

    const data = await response.json();

    // Configure with the new tokens
    this.configure(this.defaultApiKey, data.access_token);
    this.setCredentials(email, password, rememberCredentials);
    const current = this.getStoredSettings();
    this.saveStoredSettings({
      ...current,
      apiKey: this.defaultApiKey,
      token: data.access_token,
      email: String(email || '').trim(),
      password: String(password || '')
    });

    return data;
  },

  /**
   * Configure API credentials
   * @param {string} apiKey - The apikey from NADI4U
   * @param {string} token - The authorization Bearer token
   */
  configure(apiKey, token) {
    this.apiKey = apiKey || this.defaultApiKey;
    this.token = token;
  },

  /**
   * Check if user is logged in
   * @returns {boolean}
   */
  isLoggedIn() {
    return !!(this.apiKey && this.token);
  },

  /**
   * Logout and clear credentials
   */
  logout() {
    this.apiKey = null;
    this.token = null;
    this.userEmail = '';
    this.userPassword = '';
    localStorage.removeItem('nadi4uSettings');
    localStorage.removeItem('nadi4uSchedule');
    localStorage.removeItem('nadi4uAnnouncements');
    localStorage.removeItem('nadi4uEventMeta');
    if (window.safeStorage) {
      window.safeStorage.removeItem('nadi4uSettings');
      window.safeStorage.removeItem('nadi4uSchedule');
      window.safeStorage.removeItem('nadi4uAnnouncements');
      window.safeStorage.removeItem('nadi4uEventMeta');
    }
  },

  /**
   * Fetch schedule data from NADI4U
   * @param {string[]} eventIds - Array of event UUIDs (optional, uses default if not provided)
   * @returns {Promise<Array>} Schedule data
   */
  async getSchedule(eventIds = this.smartServicesEventIds) {
    this.ensureAuth();
    if (!Array.isArray(eventIds) || eventIds.length === 0) return [];

    const idsFilter = eventIds.map(id => `"${id}"`).join(',');
    const url = `${this.baseUrl}/nd_event_schedule?select=event_id,day_number,schedule_date,start_time,end_time&event_id=in.(${idsFilter})&order=day_number.asc`;
    return this.fetchJson(url);
  },

  /**
   * Fetch Smart Services NADI4U event metadata
   * @param {string[]} eventIds - Array of event UUIDs (optional, uses default if not provided)
   * @returns {Promise<Array>} Event metadata rows
   */
  async getEvents(eventIds = this.smartServicesEventIds) {
    this.ensureAuth();

    if (!Array.isArray(eventIds) || eventIds.length === 0) {
      return [];
    }

    const idsFilter = eventIds.map(id => `"${id}"`).join(',');
    const url = `${this.baseUrl}/nd_event?select=id,program_name,location_event,start_datetime,end_datetime,status_id&id=in.(${idsFilter})`;
    return this.fetchJson(url);
  },

  getTakwimCategoryGroup(categoryName) {
    const normalized = String(categoryName || '').trim().toLowerCase();
    if (!normalized) return 'other';
    if (normalized.includes('nadi4u')) return 'nadi4u';
    if (normalized.includes('nadi2u')) return 'nadi2u';
    return 'other';
  },

  async getSmartServicesNadi4uMonthData(year, month) {
    this.ensureAuth();

    const monthStart = new Date(year, month, 1).toISOString();
    const monthEnd = new Date(year, month + 1, 0, 23, 59, 59, 999).toISOString();

    const primarySelectColumns = [
      'id',
      'program_name',
      'description',
      'location_event',
      'start_datetime',
      'end_datetime',
      'site_id',
      'category_id',
      'subcategory_id',
      'program_id',
      'status_id',
      'program_mode',
      'nd_program_mode:program_mode(id,name)',
      'nd_event_category:category_id(id,name)',
      'nd_event_subcategory:subcategory_id(id,name)',
      'nd_event_program:program_id(id,name)'
    ].join(',');
    const fallbackSelectColumns = [
      'id',
      'program_name',
      'description',
      'location_event',
      'start_datetime',
      'end_datetime',
      'site_id',
      'category_id',
      'status_id',
      'program_mode',
      'nd_program_mode:program_mode(id,name)',
      'nd_event_category:category_id(id,name)'
    ].join(',');
    const baseEventsQuery = `&status_id=neq.1&start_datetime=lte.${encodeURIComponent(monthEnd)}&end_datetime=gte.${encodeURIComponent(monthStart)}&order=start_datetime.asc`;

    let eventsRaw = [];
    try {
      const eventsUrl = `${this.baseUrl}/nd_event?select=${primarySelectColumns}${baseEventsQuery}`;
      eventsRaw = await this.fetchJson(eventsUrl);
    } catch (error) {
      if (window.DEBUG_MODE) {
        console.warn('NADI4U primary month query failed. Falling back to minimal metadata query.', error);
      }
      const fallbackUrl = `${this.baseUrl}/nd_event?select=${fallbackSelectColumns}${baseEventsQuery}`;
      eventsRaw = await this.fetchJson(fallbackUrl);
    }

    const events = Array.isArray(eventsRaw)
      ? eventsRaw.filter((eventItem) => this.getTakwimCategoryGroup(eventItem?.nd_event_category?.name) === 'nadi4u')
      : [];

    const eventIdList = Array.isArray(events) ? events.map((item) => item?.id).filter(Boolean) : [];
    if (eventIdList.length === 0) {
      return { events: [], schedule: [] };
    }

    const chunkSize = 50;
    const scheduleResults = [];
    for (let index = 0; index < eventIdList.length; index += chunkSize) {
      const chunk = eventIdList.slice(index, index + chunkSize);
      const idsFilter = chunk.map((id) => `"${id}"`).join(',');
      const scheduleUrl = `${this.baseUrl}/nd_event_schedule?select=event_id,day_number,schedule_date,start_time,end_time&event_id=in.(${idsFilter})&order=day_number.asc`;
      const rows = await this.fetchJson(scheduleUrl);
      if (Array.isArray(rows)) {
        scheduleResults.push(...rows);
      }
    }

    return {
      events: Array.isArray(events) ? events : [],
      schedule: scheduleResults
    };
  },

  /**
   * Fetch current announcements from NADI4U
   * @returns {Promise<Array>} Active announcements
   */
  async getAnnouncements() {
    this.ensureAuth();

    const now = new Date().toISOString();
    const url = `${this.baseUrl}/announcements?select=*&status=eq.active&start_date=lte.${encodeURIComponent(now)}&or=(end_date.gt.${encodeURIComponent(now)},end_date.is.null)&order=created_at.desc`;
    return this.fetchJson(url);
  },

  /**
   * Get user info from current session
   * @returns {Promise<Object>} User data
   */
  async getUser() {
    if (!this.token) {
      throw new Error('Not logged in');
    }

    const response = await fetch(`${this.authUrl}/user`, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'apikey': this.defaultApiKey,
        'authorization': `Bearer ${this.token}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to get user info');
    }

    return await response.json();
  }
};

// Export for use in other files
window.NADI4U_API = NADI4U_API;
