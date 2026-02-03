// =====================================================
// NADI Leave Management - Integrated System
// Works with both index.html and leave-management.html
// =====================================================

const leaveStorage = window.safeStorage || {
  getItem() {
    return null;
  },
  setItem() {},
  removeItem() {}
};

// Global leave management state
let currentLeaveUser = null;
// OPTIMIZATION: Cache leave requests to avoid redundant queries
let leaveRequestsCache = {
  data: [],
  timestamp: null,
  userId: null
};
let siteAvailabilityCache = [];
let adminRequestsCache = [];
let adminAllStaffCache = [];

function buildLeavePanelMenu(activeKey) {
  const isSupervisor = currentLeaveUser?.role === 'Supervisor';
  const leaveLabel = isSupervisor ? 'View Staff Calendar' : 'Leave';
  const items = [
    { key: 'availability', label: 'Availability', icon: 'fa-building', show: true },
    { key: 'leave', label: leaveLabel, icon: 'fa-calendar-days', show: true },
    { key: 'admin', label: 'Manage', icon: 'fa-clipboard-check', show: isSupervisor },
    { key: 'close', label: 'Close', icon: 'fa-xmark', show: true }
  ];

  const buttons = items
    .filter(item => item.show)
    .map(item => `
      <button type="button" class="lm-tab ${activeKey === item.key ? 'active' : ''}" onclick="handleLeaveMenuAction('${item.key}', this)">
        <i class="fa-solid ${item.icon}"></i>
        <span>${item.label}</span>
      </button>
    `)
    .join('');

  return `<div class="leave-panel-menu lm-tabs">${buttons}</div>`;
}

function handleLeaveMenuAction(action, btn) {
  if (action === 'leave') {
    showLeavePanel();
    return;
  }
  if (action === 'availability') {
    showNADIAvailability();
    return;
  }
  if (action === 'admin') {
    showAdminPanel();
    return;
  }
  if (action === 'close') {
    const modal = btn.closest('.leave-modal');
    if (modal) modal.remove();
  }
}

function toLocalISOString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Rate limiting for login attempts (prevent brute force)
const loginAttempts = {
  count: 0,
  lastAttempt: null,
  lockoutUntil: null,
  
  canAttempt() {
    const now = Date.now();
    
    // Check if locked out
    if (this.lockoutUntil && now < this.lockoutUntil) {
      const remainingSeconds = Math.ceil((this.lockoutUntil - now) / 1000);
      return { allowed: false, remainingSeconds };
    }
    
    // Reset if last attempt was more than 15 minutes ago
    if (this.lastAttempt && (now - this.lastAttempt) > 15 * 60 * 1000) {
      this.count = 0;
    }
    
    return { allowed: true };
  },
  
  recordAttempt(success) {
    const now = Date.now();
    this.lastAttempt = now;
    
    if (success) {
      // Reset on successful login
      this.count = 0;
      this.lockoutUntil = null;
    } else {
      this.count++;
      
      // Lockout after 5 failed attempts
      if (this.count >= 5) {
        this.lockoutUntil = now + (15 * 60 * 1000); // 15 minutes
        if (window.DEBUG_MODE) console.log('🔒 Account locked for 15 minutes');
      }
    }
  }
};

// Initialize leave system for standalone page (leave-management.html)
async function initLeaveSystem() {
  console.log('🚀 Initializing standalone leave management system...');
  
  // Suppress browser extension async errors
  window.addEventListener('unhandledrejection', (event) => {
    if (event.reason?.message?.includes('message channel closed')) {
      event.preventDefault();
    }
  });
  
  // Load sites and users for login
  await loadSitesAndUsersForLogin();
  
  // Check if user is logged in (from localStorage)
  const savedUser = leaveStorage.getItem('leave_user');
  if (savedUser) {
    try {
      currentLeaveUser = JSON.parse(savedUser);
      await showDashboard();
    } catch (error) {
      console.error('Error loading saved user:', error);
      leaveStorage.removeItem('leave_user');
    }
  }
}

// Load sites and users for standalone login
async function loadSitesAndUsersForLogin() {
  try {
    const { data: sites, error: sitesError } = await supabaseClient
      .from('sites')
      .select('site_id, site_name')
      .order('site_name');
    
    if (sitesError) throw sitesError;
    
    const siteSelect = document.getElementById('loginSiteSelect');
    if (siteSelect) {
      siteSelect.innerHTML = '<option value="">Choose your site...</option>';
      sites.forEach(site => {
        const option = document.createElement('option');
        option.value = site.site_id;
        option.textContent = site.site_name;
        siteSelect.appendChild(option);
      });
      
      // When site is selected, load users
      siteSelect.addEventListener('change', async (e) => {
        const siteId = e.target.value;
        const userSelect = document.getElementById('loginUserSelect');
        
        if (!siteId) {
          userSelect.disabled = true;
          userSelect.innerHTML = '<option value="">Select site first...</option>';
          return;
        }
        
        const { data: users, error: usersError } = await supabaseClient
          .from('leave_users')
          .select('user_id, site_id, full_name, role')
          .eq('site_id', siteId)
          .order('role');
        
        if (usersError) throw usersError;
        
        userSelect.disabled = false;
        userSelect.innerHTML = '<option value="">Choose your name...</option>';
        users.forEach(user => {
          const option = document.createElement('option');
          option.value = user.user_id;
          option.textContent = `${user.full_name} (${user.role})`;
          option.dataset.user = JSON.stringify(user);
          userSelect.appendChild(option);
        });
      });
    }
  } catch (error) {
    console.error('Error loading sites/users:', error);
  }
}

// Login as selected user (standalone page)
async function loginAsUser() {
  const userSelect = document.getElementById('loginUserSelect');
  const selectedOption = userSelect.options[userSelect.selectedIndex];
  
  if (!selectedOption || !selectedOption.dataset.user) {
    alert('Please select a staff member');
    return;
  }
  
  currentLeaveUser = JSON.parse(selectedOption.dataset.user);
  
  // Get site info
  const { data: site } = await supabaseClient
    .from('sites')
    .select('site_id, site_name')
    .eq('site_id', currentLeaveUser.site_id)
    .single();
  
  currentLeaveUser.site_name = site?.site_name || '-';
  
  // Save to localStorage
  leaveStorage.setItem('leave_user', JSON.stringify(currentLeaveUser));
  
  // Show dashboard
  await showDashboard();
}

// Show dashboard and load data
async function showDashboard() {
  document.getElementById('leaveLoginView').classList.add('hidden');
  document.getElementById('leaveDashboardView').classList.remove('hidden');
  
  // Update dashboard header
  document.getElementById('dashboardUserName').textContent = currentLeaveUser.full_name;
  document.getElementById('dashboardUserRole').textContent = currentLeaveUser.role;
  document.getElementById('dashboardUserSite').textContent = currentLeaveUser.site_name;
  
  // Load data
  await Promise.all([
    loadUserLeaveRequests(),
    syncMainCalendarOffdays()
  ]);
  
  // Render calendar and stats
  renderLeaveCalendar();
  updateLeaveStats();
  renderLeaveRequestsList();
  
  // Subscribe to realtime updates
  subscribeToLeaveUpdates();
}

// Update leave statistics
function updateLeaveStats() {
  const pending = leaveRequestsCache.data.filter(r => r.status === 'Pending').length;
  const approved = leaveRequestsCache.data.filter(r => r.status === 'Approved').length;
  const rejected = leaveRequestsCache.data.filter(r => r.status === 'Rejected').length;
  const total = leaveRequestsCache.data.length;
  
  const statPending = document.getElementById('statPending');
  const statApproved = document.getElementById('statApproved');
  const statRejected = document.getElementById('statRejected');
  const statTotal = document.getElementById('statTotal');
  
  if (statPending) statPending.textContent = pending;
  if (statApproved) statApproved.textContent = approved;
  if (statRejected) statRejected.textContent = rejected;
  if (statTotal) statTotal.textContent = total;
}

// Render leave requests list
function renderLeaveRequestsList() {
  const container = document.getElementById('leaveRequestsList');
  if (!container) return;
  
  if (leaveRequestsCache.data.length === 0) {
    container.innerHTML = '<p class="text-gray-500 text-center py-8">No leave requests yet</p>';
    return;
  }
  
  // Sort by date (newest first)
  const sorted = [...leaveRequestsCache.data].sort((a, b) => 
    new Date(b.leave_date) - new Date(a.leave_date)
  );
  
  container.innerHTML = sorted.map(request => {
    const date = new Date(request.leave_date);
    const dateStr = date.toLocaleDateString('en-MY', { 
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
    });
    
    const statusColors = {
      'Pending': 'bg-yellow-100 text-yellow-800 border-yellow-300',
      'Approved': 'bg-green-100 text-green-800 border-green-300',
      'Rejected': 'bg-red-100 text-red-800 border-red-300'
    };
    
    const statusIcons = {
      'Pending': 'fa-clock',
      'Approved': 'fa-check-circle',
      'Rejected': 'fa-times-circle'
    };
    
    return `
      <div class="border-2 ${statusColors[request.status]} rounded-lg p-4">
        <div class="flex items-start justify-between">
          <div class="flex-1">
            <div class="flex items-center gap-2 mb-2">
              <i class="fas ${statusIcons[request.status]}"></i>
              <span class="font-bold">${dateStr}</span>
            </div>
            <div class="text-sm mb-1">
              <strong>Type:</strong> ${request.request_type}
            </div>
            ${request.notes ? `
              <div class="text-sm text-gray-700">
                <strong>Notes:</strong> ${request.notes}
              </div>
            ` : ''}
          </div>
          <div class="flex flex-col items-end gap-2">
            <span class="px-3 py-1 rounded-full text-xs font-semibold ${statusColors[request.status]} border-2">
              ${request.status}
            </span>
            ${request.status === 'Pending' ? `
              <button onclick="cancelLeaveRequest(${request.request_id})" 
                      class="text-xs text-red-600 hover:text-red-800 font-semibold">
                <i class="fas fa-trash mr-1"></i>Cancel
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Initialize leave management system (for index.html integration)
function initLeaveManagement() {
  // Suppress browser extension async errors
  window.addEventListener('unhandledrejection', (event) => {
    if (event.reason?.message?.includes('message channel closed')) {
      event.preventDefault();
    }
  });
  
  // Check if user is logged in
  const savedUser = leaveStorage.getItem('leave_user');
  if (savedUser) {
    try {
      currentLeaveUser = JSON.parse(savedUser);
      updateLoginButton();
      loadUserLeaveRequests();
      subscribeToLeaveUpdates();
    } catch (error) {
      console.error('Error loading saved user:', error);
      leaveStorage.removeItem('leave_user');
    }
  }
  
  // Setup login modal event listeners
  setupLeaveSystemListeners();
  
  // Listen for offdays updates
  document.addEventListener('offdaysUpdated', () => {
    if (document.getElementById('leaveCalendarGrid')) {
      syncMainCalendarOffdays().then(() => {
        renderLeaveCalendar();
      });
    }
  });
  
  // Listen for holidays updates
  document.addEventListener('holidaysUpdated', () => {
    if (document.getElementById('leaveCalendarGrid')) {
      syncMainCalendarOffdays().then(() => {
        renderLeaveCalendar();
      });
    }
  });
}

// Update login button based on user state
function updateLoginButton() {
  const loginBtn = document.getElementById('leaveLoginBtn');
  if (!loginBtn) return;
  
  if (currentLeaveUser) {
    // User is logged in - show user info
    loginBtn.innerHTML = `
      <i class="fa-solid fa-user-check text-[#2228a4]"></i>
      <span class="hidden sm:inline">${currentLeaveUser.full_name}</span>
    `;
    loginBtn.title = `Logged in as ${currentLeaveUser.full_name} (${currentLeaveUser.role})`;
  } else {
    // Not logged in - show login button
    loginBtn.innerHTML = `<i class="fa-solid fa-calendar-check text-[#2228a4]"></i>`;
    loginBtn.title = 'Leave Management Login';
  }
}

// Show login modal
function showLeaveLogin() {
  if (currentLeaveUser) {
    // Already logged in - open availability panel directly
    showNADIAvailability();
  } else {
    // Show login modal
    document.getElementById('leaveLoginModal').classList.remove('hidden');
    loadSitesForLogin();
  }
}

// Close login modal
function closeLeaveLogin() {
  document.getElementById('leaveLoginModal').classList.add('hidden');
}

// Load sites for login dropdown
async function loadSitesForLogin() {
  try {
    const { data: sites, error } = await supabaseClient
      .from('sites')
      .select('site_id, site_name')
      .order('site_name');
    
    if (error) throw error;
    
    const grid = document.getElementById('loginSiteGrid');
    grid.innerHTML = '';
    
    sites.forEach(site => {
      const label = document.createElement('label');
      label.className = 'relative cursor-pointer';
      label.innerHTML = `
        <input type="radio" name="loginSite" value="${site.site_id}" class="sr-only peer" required />
        <div class="border-2 border-slate-200 peer-checked:border-blue-500 peer-checked:bg-blue-50 rounded-lg p-2 text-center transition-all hover:border-slate-300">
          <div class="text-[10px] font-bold text-slate-800 leading-tight">${site.site_name}</div>
        </div>
      `;
      grid.appendChild(label);
    });
  } catch (error) {
    console.error('Error loading sites:', error);
  }
}

// Show/hide login forms
function showSupervisorLogin() {
  document.getElementById('staffLoginForm').classList.add('hidden');
  document.getElementById('supervisorLoginForm').classList.remove('hidden');
}

function showStaffLogin() {
  document.getElementById('staffLoginForm').classList.remove('hidden');
  document.getElementById('supervisorLoginForm').classList.add('hidden');
}

// Handle STAFF login (no password required)
async function handleStaffLogin(e) {
  e.preventDefault();
  
  const siteId = document.querySelector('input[name="loginSite"]:checked')?.value;
  const role = document.querySelector('input[name="loginRole"]:checked')?.value;
  
  if (!siteId || !role) {
    alert('Please select both site and role');
    return;
  }
  
  try {
    // Query user by site and role (no password check)
    const { data: user, error } = await supabaseClient
      .from('leave_users')
      .select('user_id, username, full_name, role, site_id, sites(site_name)')
      .eq('site_id', siteId)
      .eq('role', role)
      .eq('is_active', true)
      .single();
    
    if (error || !user) throw new Error('User not found for this site and role');
    
    // Save session
    currentLeaveUser = {
      user_id: user.user_id,
      username: user.username,
      full_name: user.full_name,
      role: user.role,
      site_id: user.site_id,
      site_name: user.sites?.site_name
    };
    
    leaveStorage.setItem('leave_user', JSON.stringify(currentLeaveUser));
    
    // Update UI
    updateLoginButton();
    closeLeaveLogin();
    loadUserLeaveRequests();
    subscribeToLeaveUpdates();
    
    showToast(`Welcome, ${user.full_name}!`, 'success');
    
    // Manual: do not auto-open panels on login
    
  } catch (error) {
    alert(error.message || 'Login failed');
  }
}

// Handle SUPERVISOR login (password required)
async function handleSupervisorLogin(e) {
  e.preventDefault();
  
  const username = document.getElementById('supervisorUsername').value.trim();
  const password = document.getElementById('supervisorPassword').value;
  
  if (!username || !password) {
    alert('Please enter username and password');
    return;
  }
  
  // Check rate limiting
  const rateCheck = loginAttempts.canAttempt();
  if (!rateCheck.allowed) {
    alert(`Too many failed login attempts. Please try again in ${rateCheck.remainingSeconds} seconds.`);
    return;
  }
  
  try {
    // Query supervisor user
    const { data: user, error } = await supabaseClient
      .from('leave_users')
      .select('user_id, username, full_name, role, password_hash')
      .eq('username', username)
      .eq('role', 'Supervisor')
      .eq('is_active', true)
      .single();
    
    if (error || !user) {
      loginAttempts.recordAttempt(false);
      throw new Error('Invalid supervisor credentials');
    }
    
    // Verify password using secure hashing (supports legacy plain text)
    const isPasswordValid = await window.PasswordUtils.verifyPassword(password, user.password_hash);
    if (!isPasswordValid) {
      loginAttempts.recordAttempt(false);
      const remaining = 5 - loginAttempts.count;
      if (remaining > 0) {
        throw new Error(`Invalid password. ${remaining} attempts remaining.`);
      } else {
        throw new Error('Invalid password. Account locked for 15 minutes.');
      }
    }
    
    // Success - record and reset attempts
    loginAttempts.recordAttempt(true);
    
    // Save session
    currentLeaveUser = {
      user_id: user.user_id,
      username: user.username,
      full_name: user.full_name,
      role: user.role,
      site_id: null,
      site_name: 'All Sites'
    };
    
    leaveStorage.setItem('leave_user', JSON.stringify(currentLeaveUser));
    
    // Update UI
    updateLoginButton();
    closeLeaveLogin();
    subscribeToLeaveUpdates();
    
    // Delay toast to avoid autofill extension conflict
    setTimeout(() => {
      showToast(`Welcome, ${user.full_name}!`, 'success');
    }, 100);
    
    // Manual: do not auto-open panels on login
    
  } catch (error) {
    alert(error.message || 'Login failed');
  }
}

// Show user menu
function showUserMenu() {
  const menu = document.createElement('div');
  menu.className = 'leave-modal fixed inset-0 z-50 flex items-start justify-end pt-16 pr-4';
  
  // Different menu for supervisors vs staff
  const isSupervisor = currentLeaveUser.role === 'Supervisor';
  
  menu.innerHTML = `
    <div class="fixed inset-0 bg-slate-900/20" onclick="this.parentElement.remove()"></div>
    <div class="relative bg-white rounded-lg shadow-xl p-4 w-64 animate-slideIn">
      <div class="border-b border-slate-200 pb-3 mb-3">
        <div class="font-bold text-sm text-slate-800">${currentLeaveUser.full_name}</div>
        <div class="text-xs text-slate-500">${currentLeaveUser.role}</div>
        ${currentLeaveUser.site_name ? `<div class="text-xs text-slate-500 mt-1">${currentLeaveUser.site_name}</div>` : ''}
      </div>
      <button onclick="showNADIAvailability()" class="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 rounded flex items-center gap-2">
        <i class="fa-solid fa-building text-green-600"></i> NADI Availability
      </button>
      ${!isSupervisor ? `
      <button onclick="showLeavePanel()" class="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 rounded flex items-center gap-2">
        <i class="fa-solid fa-calendar-days text-blue-600"></i> My Leave Requests
      </button>` : ''}
      ${isSupervisor ? `
      <button onclick="showAdminPanel()" class="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 rounded flex items-center gap-2">
        <i class="fa-solid fa-clipboard-check text-purple-600"></i> Manage Requests
      </button>
      <button onclick="showStaffCalendarsPanel()" class="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 rounded flex items-center gap-2">
        <i class="fa-solid fa-users text-blue-600"></i> View Staff Calendars
      </button>` : ''}
      <hr class="my-2">
      <button onclick="handleLeaveLogout()" class="w-full text-left px-3 py-2 text-sm hover:bg-red-50 rounded flex items-center gap-2 text-red-600">
        <i class="fa-solid fa-right-from-bracket"></i> Logout
      </button>
    </div>
  `;
  document.body.appendChild(menu);
}

// Logout
async function handleLeaveLogout() {
  if (await customConfirm('Are you sure you want to logout?')) {
    // OPTIMIZATION: Unsubscribe from realtime updates
    if (leaveSubscription) {
      await supabaseClient.removeChannel(leaveSubscription);
      leaveSubscription = null;
      if (window.DEBUG_MODE) console.log('🔌 Unsubscribed from realtime updates');
    }
    
    // Clear cache
    leaveRequestsCache = { data: [], timestamp: null, userId: null };
    
    leaveStorage.removeItem('leave_user');
    currentLeaveUser = null;
    updateLoginButton();
    location.reload();
  }
}

// Global calendar state
let leaveCalendarDate = new Date();
let mainCalendarOffdays = { manager: [], am: [], managerReplace: [], amReplace: [] };
let mainCalendarHolidays = { public: {}, school: {} };
let leaveCalendarFilters = {
  showPublicHolidays: true,
  showSchoolHolidays: true
};

// Custom confirm dialog (works in sandboxed iframes)
function customConfirm(message) {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 z-[70] flex items-start justify-center pt-20 px-4';
    modal.innerHTML = `
      <div class="fixed inset-0 bg-slate-900/80 backdrop-blur-sm"></div>
      <div class="relative bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 animate-slideIn">
        <div class="text-center mb-6">
          <i class="fa-solid fa-circle-question text-5xl text-blue-500 mb-3"></i>
          <p class="text-slate-800 font-semibold">${message}</p>
        </div>
        <div class="flex gap-3">
          <button id="confirmCancel" class="flex-1 btn btn-secondary">Cancel</button>
          <button id="confirmOk" class="flex-1 btn btn-primary">Confirm</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    
    document.getElementById('confirmOk').onclick = () => {
      modal.remove();
      resolve(true);
    };
    document.getElementById('confirmCancel').onclick = () => {
      modal.remove();
      resolve(false);
    };
    modal.querySelector('.fixed.inset-0').onclick = () => {
      modal.remove();
      resolve(false);
    };
  });
}

// Show leave request panel with calendar
function showLeavePanel() {
  if (currentLeaveUser?.role === 'Supervisor') {
    showStaffCalendarsPanel();
    return;
  }
  document.querySelectorAll('.leave-modal').forEach(el => el.remove());
  
  const panel = document.createElement('div');
  panel.className = 'leave-modal fixed left-0 right-0 top-0 z-50 flex items-start justify-center pt-4 px-4 overflow-y-auto max-h-screen';
  panel.innerHTML = `
    <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onclick="this.parentElement.remove()"></div>
    <div class="relative bg-white rounded-xl shadow-xl w-full max-w-7xl my-4 max-h-[calc(100vh-2rem)] overflow-hidden flex flex-col">
      <div class="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-white flex items-start justify-between gap-4">
        <div>
          <h2 class="text-xl font-bold text-slate-800">Request Leave - ${currentLeaveUser.site_name || ''}</h2>
          <p class="text-sm text-slate-500">${currentLeaveUser.full_name} (${currentLeaveUser.role})</p>
        </div>
        ${buildLeavePanelMenu('leave')}
      </div>
      
      <div class="flex-1 overflow-y-auto p-6">
        <div class="flex flex-col xl:flex-row gap-6">
          <!-- Calendar Section -->
          <div class="flex-1 w-full" style="min-width: 660px;">
            <div class="bg-white rounded-lg border border-slate-200 p-4" style="min-height: 400px; overflow-y: auto;">
               <!-- Month Navigation -->
               <div class="flex items-center justify-between mb-3">
                 <button id="leaveCalendarPrev" class="w-8 h-8 rounded hover:bg-slate-100 text-slate-600 flex items-center justify-center">
                   <i class="fa-solid fa-chevron-left pointer-events-none"></i>
                 </button>
                 <div class="text-center">
                   <div id="leaveCalendarMonth" class="text-lg font-bold text-slate-900"></div>
                   <div id="leaveCalendarYear" class="text-xs font-semibold text-slate-400"></div>
                 </div>
                  <button id="leaveCalendarNext" class="w-8 h-8 rounded hover:bg-slate-100 text-slate-600 flex items-center justify-center">
                    <i class="fa-solid fa-chevron-right pointer-events-none"></i>
                  </button>
                </div>

               <!-- Calendar Grid -->
              <div class="grid grid-cols-7 gap-1 mb-2">
                <div class="text-center text-[10px] font-bold text-slate-400">SUN</div>
                <div class="text-center text-[10px] font-bold text-slate-400">MON</div>
                <div class="text-center text-[10px] font-bold text-slate-400">TUE</div>
                <div class="text-center text-[10px] font-bold text-slate-400">WED</div>
                <div class="text-center text-[10px] font-bold text-slate-400">THU</div>
                <div class="text-center text-[10px] font-bold text-slate-400">FRI</div>
                <div class="text-center text-[10px] font-bold text-slate-400">SAT</div>
              </div>
              <div id="leaveCalendarGrid" class="grid grid-cols-7 gap-1"></div>
              
              <!-- Legend (compact with filter) -->
              <div class="mt-3 pt-2 border-t border-slate-100">
                <div class="grid grid-cols-2 gap-2 text-[8px] font-semibold text-slate-500">
                  <div class="flex items-center gap-1">
                    <span class="w-2 h-1 rounded-sm bg-[#00aff0]"></span> M Off
                  </div>
                  <div class="flex items-center gap-1">
                    <span class="w-2 h-1 rounded-sm bg-[#90cf53]"></span> AM Off
                  </div>
                  <div class="flex items-center gap-1">
                    <span class="w-2 h-2 rounded-full bg-yellow-400"></span> Pending
                  </div>
                  <div class="flex items-center gap-1">
                    <span class="w-2 h-2 rounded-full bg-green-500"></span> Approved
                  </div>
                </div>
                
                <!-- Holiday Filter (small) -->
                <div class="flex items-center justify-center gap-3 mt-3 pt-2 border-t border-slate-100">
                  <label class="flex items-center gap-1 cursor-pointer">
                    <input type="checkbox" id="filterPublicHoliday" checked class="w-3 h-3 rounded border-slate-300" onchange="toggleHolidayFilter('public', this.checked)">
                    <span class="text-[7px] text-slate-500 flex items-center gap-0.5">
                      <span class="w-2 h-2 rounded-full bg-slate-300"></span> Public
                    </span>
                  </label>
                  <label class="flex items-center gap-1 cursor-pointer">
                    <input type="checkbox" id="filterSchoolHoliday" checked class="w-3 h-3 rounded border-slate-300" onchange="toggleHolidayFilter('school', this.checked)">
                    <span class="text-[7px] text-slate-500 flex items-center gap-0.5">
                      <span class="w-2 h-2 rounded-full bg-[#fff59c] border border-slate-200"></span> School
                    </span>
                  </label>
                </div>
              </div>
            </div>
          </div>
          
          <!-- My Requests Section -->
          <div class="w-full xl:w-[500px] xl:flex-shrink-0">
            <div class="bg-slate-50 rounded-lg border border-slate-200 p-4" style="min-height: 400px;">
              <h3 class="text-sm font-bold text-slate-800 mb-3">My Leave Requests</h3>
              <div id="leaveRequestsList" class="space-y-2 overflow-y-auto" style="max-height: calc(400px - 3rem);">
                <div class="text-center py-8"><div class="spinner mx-auto"></div></div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div class="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-between items-center">
        <div class="text-xs text-slate-500">
          <i class="fa-solid fa-info-circle mr-1"></i> Click on a date to request leave
        </div>
        <button onclick="handleLeaveLogout()" class="btn btn-danger btn-sm">
          <i class="fa-solid fa-right-from-bracket mr-1"></i> Logout
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(panel);
  
  // Add event listeners for month navigation using event delegation on the panel
  // This prevents duplicate listeners when panel is re-opened
  const prevBtn = document.getElementById('leaveCalendarPrev');
  const nextBtn = document.getElementById('leaveCalendarNext');
  
  if (prevBtn) {
    let isNavigating = false;
    prevBtn.onclick = function(e) {
      e.stopPropagation();
      if (isNavigating) {
        return;
      }
      isNavigating = true;
      prevBtn.classList.add('opacity-50', 'cursor-wait');
      
      leaveCalendarDate.setDate(1);
      leaveCalendarDate.setMonth(leaveCalendarDate.getMonth() - 1);
      
      setTimeout(() => {
        prevBtn.classList.remove('opacity-50', 'cursor-wait');
        isNavigating = false;
      }, 150);
      renderLeaveCalendar();
    };
  }
  
  if (nextBtn) {
    let isNavigating = false;
    nextBtn.onclick = function(e) {
      e.stopPropagation();
      if (isNavigating) {
        return;
      }
      isNavigating = true;
      nextBtn.classList.add('opacity-50', 'cursor-wait');
      
      leaveCalendarDate.setDate(1);
      leaveCalendarDate.setMonth(leaveCalendarDate.getMonth() + 1);
      
      setTimeout(() => {
        nextBtn.classList.remove('opacity-50', 'cursor-wait');
        isNavigating = false;
      }, 150);
      renderLeaveCalendar();
    };
  }
  
  // Initialize filter checkboxes
  const publicCheckbox = document.getElementById('filterPublicHoliday');
  const schoolCheckbox = document.getElementById('filterSchoolHoliday');
  if (publicCheckbox) publicCheckbox.checked = leaveCalendarFilters.showPublicHolidays;
  if (schoolCheckbox) schoolCheckbox.checked = leaveCalendarFilters.showSchoolHolidays;
  
  // Initialize calendar (sync is now async)
  syncMainCalendarOffdays().then(() => {
    renderLeaveCalendar();
  });
  loadUserLeaveRequests();
}

// Toggle holiday filter
function toggleHolidayFilter(type, value) {
  if (type === 'public') {
    leaveCalendarFilters.showPublicHolidays = value;
  } else if (type === 'school') {
    leaveCalendarFilters.showSchoolHolidays = value;
  }
  renderLeaveCalendar();
}

// Load and display user leave requests
async function loadUserLeaveRequests(forceRefresh = false) {
  if (!currentLeaveUser) return;
  
  // OPTIMIZATION: Check cache first (5 minute TTL)
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  const now = Date.now();
  
  if (!forceRefresh && 
      leaveRequestsCache.userId === currentLeaveUser.user_id &&
      leaveRequestsCache.timestamp &&
      (now - leaveRequestsCache.timestamp) < CACHE_TTL) {
    if (window.DEBUG_MODE) console.log('✅ Using cached leave requests (age: ' + Math.floor((now - leaveRequestsCache.timestamp) / 1000) + 's)');
    displayUserLeaveRequests();
    
    // Update stats if on standalone page
    if (document.getElementById('statPending')) {
      updateLeaveStats();
      renderLeaveRequestsList();
    }
    
    // Refresh calendar if it's open
    if (document.getElementById('leaveCalendarGrid')) {
      renderLeaveCalendar();
    }
    return;
  }
  
  try {
    if (window.DEBUG_MODE) console.log('📥 Fetching leave requests from database...');
    const { data, error } = await supabaseClient
      .from('leave_requests')
      .select('request_id, user_id, site_id, leave_date, request_type, status, notes, replacement_offday_date, requested_at, reviewed_by')
      .eq('user_id', currentLeaveUser.user_id)
      .order('leave_date', { ascending: false });
    
    if (error) throw error;
    
    // Update cache
    leaveRequestsCache = {
      data: data || [],
      timestamp: now,
      userId: currentLeaveUser.user_id
    };
    
    displayUserLeaveRequests();
    
    // Update stats if on standalone page
    if (document.getElementById('statPending')) {
      updateLeaveStats();
      renderLeaveRequestsList();
    }
    
    // Refresh calendar if it's open
    if (document.getElementById('leaveCalendarGrid')) {
      renderLeaveCalendar();
    }
    
  } catch (error) {
    console.error('Error loading leave requests:', error);
  }
}

// Display leave requests in the panel (compact version for sidebar)
function displayUserLeaveRequests() {
  const container = document.getElementById('leaveRequestsList');
  if (!container) return;
  
  if (leaveRequestsCache.data.length === 0) {
    container.innerHTML = `
      <div class="text-center py-8 col-span-2">
        <i class="fa-solid fa-calendar-xmark text-3xl text-slate-300 mb-2"></i>
        <p class="text-xs text-slate-500">No requests yet</p>
      </div>
    `;
    return;
  }
  
  // Separate requests by type
  const leaveRequests = leaveRequestsCache.data.filter(r => r.request_type === 'Leave').slice(0, 10);
  const replacementRequests = leaveRequestsCache.data.filter(r => r.request_type === 'Replacement Day').slice(0, 10);
  
  // Generate Leave column HTML
  const leaveHTML = leaveRequests.length > 0 ? leaveRequests.map(req => `
    <div class="bg-white border border-slate-200 rounded-lg p-3 text-xs relative">
      <div class="flex items-start justify-between mb-2">
        <div class="flex-1 pr-2">
          <div class="font-bold text-slate-800">${new Date(req.leave_date).toLocaleDateString('en-MY', {weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'})}</div>
          ${req.notes ? `<div class="text-[10px] text-slate-500 mt-1">${req.notes.replace(/\n/g, '<br>')}</div>` : ''}
        </div>
        <span class="status-badge badge-${req.status.toLowerCase().replace(' ', '-')} text-[8px] flex-shrink-0">${req.status}</span>
      </div>
      <div class="flex justify-end">
        <button onclick="cancelLeaveRequest('${req.request_id}')" class="text-red-600 hover:bg-red-50 px-2 py-1 rounded text-[8px]">
          <i class="fa-solid fa-trash"></i> Delete
        </button>
      </div>
    </div>
  `).join('') : '<p class="text-xs text-slate-400 text-center py-4">No leave requests</p>';
  
  // Generate Replacement Day column HTML
  const replacementHTML = replacementRequests.length > 0 ? replacementRequests.map(req => `
    <div class="bg-white border border-slate-200 rounded-lg p-3 text-xs relative">
      <div class="flex items-start justify-between mb-2">
        <div class="flex-1 pr-2">
          <div class="font-bold text-slate-800">${new Date(req.leave_date).toLocaleDateString('en-MY', {weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'})}</div>
          ${req.notes ? `<div class="text-[10px] text-slate-500 mt-1">${req.notes.replace(/\n/g, '<br>')}</div>` : ''}
        </div>
        <span class="status-badge badge-${req.status.toLowerCase().replace(' ', '-')} text-[8px] flex-shrink-0">${req.status}</span>
      </div>
      <div class="flex justify-end">
        <button onclick="cancelLeaveRequest('${req.request_id}')" class="text-red-600 hover:bg-red-50 px-2 py-1 rounded text-[8px]">
          <i class="fa-solid fa-trash"></i> Delete
        </button>
      </div>
    </div>
  `).join('') : '<p class="text-xs text-slate-400 text-center py-4">No replacement requests</p>';
  
  // Combine in two-column layout
  container.innerHTML = `
    <div class="grid grid-cols-2 gap-4">
      <div>
        <h4 class="text-xs font-bold text-blue-600 mb-2 flex items-center gap-1">
          <i class="fa-solid fa-calendar-days"></i> Leave
        </h4>
        <div class="space-y-2">
          ${leaveHTML}
        </div>
      </div>
      <div>
        <h4 class="text-xs font-bold text-green-600 mb-2 flex items-center gap-1">
          <i class="fa-solid fa-calendar-plus"></i> Replacement Day
        </h4>
        <div class="space-y-2">
          ${replacementHTML}
        </div>
      </div>
    </div>
  `;
}

// Sync offday data from main calendar
async function syncMainCalendarOffdays() {
  
  // Initialize offdays
  mainCalendarOffdays = { manager: [], am: [], managerReplace: [], amReplace: [] };
  mainCalendarHolidays = { public: {}, school: {} };
  
  // Get offday data from main calendar's siteSettings (global variable from app.js)
  if (typeof siteSettings !== 'undefined' && siteSettings) {
    
    mainCalendarOffdays = {
      manager: siteSettings.managerOffdays || [],
      am: siteSettings.assistantManagerOffdays || [],
      managerReplace: siteSettings.managerReplacements || [],
      amReplace: siteSettings.assistantManagerReplacements || []
    };
    
    // Check if holidays exist in siteSettings
    const hasPublicHolidays = siteSettings.publicHolidays && Object.keys(siteSettings.publicHolidays).length > 0;
    const hasSchoolHolidays = siteSettings.schoolHolidays && Object.keys(siteSettings.schoolHolidays).length > 0;
    
    
    if (hasPublicHolidays && hasSchoolHolidays) {
      // Use holidays from siteSettings
      mainCalendarHolidays = {
        public: siteSettings.publicHolidays,
        school: siteSettings.schoolHolidays
      };
    } else {
      // Load holidays directly from Supabase
      await loadHolidaysFromSupabase();
    }
  } else {
    await loadHolidaysFromSupabase();
  }
  
  // ALWAYS ensure we have holidays - load defaults if still empty
  const publicCount = Object.keys(mainCalendarHolidays.public || {}).length;
  const schoolCount = Object.keys(mainCalendarHolidays.school || {}).length;
  
  
  if (publicCount === 0 || schoolCount === 0) {
    loadDefaultHolidays();
  }
}

// Load holidays directly from Supabase
async function loadHolidaysFromSupabase() {
  
  let loadedPublic = false;
  let loadedSchool = false;
  
  try {
    // Load public holidays (id = 20)
    const { data: publicData, error: publicError } = await supabaseClient
      .from('site_settings')
      .select('settings')
      .eq('id', 20)
      .single();
    
    
    if (!publicError && publicData?.settings?.publicHolidays && Object.keys(publicData.settings.publicHolidays).length > 0) {
      mainCalendarHolidays.public = publicData.settings.publicHolidays;
      loadedPublic = true;
    } else {
    }
    
    // Load school holidays (id = 21)
    const { data: schoolData, error: schoolError } = await supabaseClient
      .from('site_settings')
      .select('settings')
      .eq('id', 21)
      .single();
    
    
    if (!schoolError && schoolData?.settings?.schoolHolidays && Object.keys(schoolData.settings.schoolHolidays).length > 0) {
      mainCalendarHolidays.school = schoolData.settings.schoolHolidays;
      loadedSchool = true;
    } else {
    }
    
    // If EITHER public or school holidays are empty, load defaults for that type
    if (!loadedPublic || !loadedSchool) {
      loadDefaultHolidays();
    }
    
    // Also try to load offdays if siteSettings is not available
    if (typeof siteSettings === 'undefined' || !siteSettings) {
      const { data: offdayData, error: offdayError } = await supabaseClient
        .from('site_settings')
        .select('settings')
        .eq('id', 1)
        .single();
      
      if (!offdayError && offdayData?.settings) {
        const settings = offdayData.settings;
        mainCalendarOffdays = {
          manager: settings.managerOffdays || [],
          am: settings.assistantManagerOffdays || [],
          managerReplace: settings.managerReplacements || [],
          amReplace: settings.assistantManagerReplacements || []
        };
      }
    }
    
  } catch (error) {
    console.error('❌ Error loading holidays from Supabase:', error);
    // Fall back to defaults
    loadDefaultHolidays();
  }
}

// Load default holidays (fills in missing holidays)
// Uses global defaultHolidays from config.js if available
function loadDefaultHolidays() {
  
  // Try to use global defaultHolidays from config.js first
  if (typeof defaultHolidays !== 'undefined' && defaultHolidays) {
    if (!mainCalendarHolidays.public || Object.keys(mainCalendarHolidays.public).length === 0) {
      mainCalendarHolidays.public = defaultHolidays;
    }
  } else {
    // Fallback - EXACT COPY from config.js
    const fallbackPublicHolidays = {
      '2026-01-01': 'Tahun Baru',
      '2026-02-01': 'Thaipusam',
      '2026-02-17': 'Tahun Baru Cina',
      '2026-02-18': 'Tahun Baru Cina (Hari 2)',
      '2026-03-27': 'Nuzul Al-Quran',
      '2026-05-01': 'Hari Pekerja',
      '2026-05-31': 'Hari Wesak',
      '2026-06-02': 'Hari Keputeraan Agong',
      '2026-07-07': 'Warisan George Town',
      '2026-07-11': 'Hari Jadi Tuan Y.T',
      '2026-08-31': 'Hari Merdeka',
      '2026-09-16': 'Hari Malaysia',
      '2026-12-25': 'Hari Krismas'
    };
    if (!mainCalendarHolidays.public || Object.keys(mainCalendarHolidays.public).length === 0) {
      mainCalendarHolidays.public = fallbackPublicHolidays;
    }
  }
  
  // Try to use global defaultSchoolHolidays from config.js first
  if (typeof defaultSchoolHolidays !== 'undefined' && defaultSchoolHolidays) {
    if (!mainCalendarHolidays.school || Object.keys(mainCalendarHolidays.school).length === 0) {
      mainCalendarHolidays.school = defaultSchoolHolidays;
    }
  } else {
    // Fallback - EXACT COPY from config.js
    const fallbackSchoolHolidays = {
      '2025-12-20': { name: 'Cuti Akhir Tahun 2025-2026', start: '2025-12-20', end: '2026-01-11' },
      '2026-03-20': { name: 'Cuti Penggal 1', start: '2026-03-20', end: '2026-03-28' },
      '2026-05-22': { name: 'Cuti Pertengahan Tahun', start: '2026-05-22', end: '2026-06-06' },
      '2026-08-28': { name: 'Cuti Penggal 2', start: '2026-08-28', end: '2026-09-05' },
      '2026-12-04': { name: 'Cuti Akhir Tahun', start: '2026-12-04', end: '2026-12-31' }
    };
    if (!mainCalendarHolidays.school || Object.keys(mainCalendarHolidays.school).length === 0) {
      mainCalendarHolidays.school = fallbackSchoolHolidays;
    }
  }
}

// Change calendar month
function changeLeaveCalendarMonth(direction) {
  leaveCalendarDate.setMonth(leaveCalendarDate.getMonth() + direction);
  renderLeaveCalendar();
}

// Helper: Check if date is in school holiday range
// Supports both formats: {endDate: "..."} and {start: "...", end: "..."}
function isDateInSchoolHoliday(dateStr, schoolHolidays) {
  const checkDate = new Date(dateStr);
  
  for (const [startStr, data] of Object.entries(schoolHolidays)) {
    // Skip deleted holidays
    if (data._deleted) continue;
    
    // Support both data formats:
    // Format 1: Supabase format with start/end properties
    // Format 2: Legacy format with endDate property
    const startDate = new Date(data.start || startStr);
    const endDate = new Date(data.end || data.endDate);
    
    if (checkDate >= startDate && checkDate <= endDate) {
      return true;
    }
  }
  return false;
}

// Render leave calendar
function renderLeaveCalendar() {
  
  const year = leaveCalendarDate.getFullYear();
  const month = leaveCalendarDate.getMonth();
  
  // Update month/year labels
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  document.getElementById('leaveCalendarMonth').textContent = monthNames[month];
  document.getElementById('leaveCalendarYear').textContent = year;
  
  // Get calendar data
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const grid = document.getElementById('leaveCalendarGrid');
  grid.innerHTML = '';
  
  // Add empty cells for days before month starts
  for (let i = 0; i < firstDay; i++) {
    const cell = document.createElement('div');
    cell.className = 'h-12';
    grid.appendChild(cell);
  }
  
  // Add cells for each day
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    // Check if this date has a leave request
    const leaveRequest = leaveRequestsCache.data.find(r => r.leave_date === dateStr);
    
    // Check if this is M or AM off day
    const isManagerOff = mainCalendarOffdays.manager.includes(dateStr);
    const isAMOff = mainCalendarOffdays.am.includes(dateStr);
    const isManagerReplace = mainCalendarOffdays.managerReplace.includes(dateStr);
    const isAMReplace = mainCalendarOffdays.amReplace.includes(dateStr);
    
    // Check for holidays (matching index.html logic)
    const publicHoliday = mainCalendarHolidays.public ? mainCalendarHolidays.public[dateStr] : null;
    
    // Check school holidays with debug logging
    let isSchoolHoliday = false;
    let schoolHolidayData = null;
    let schoolHolidayStart = null;
    let schoolHolidayEnd = null;
    
    if (mainCalendarHolidays.school) {
      for (const [startStr, data] of Object.entries(mainCalendarHolidays.school)) {
        // Skip deleted holidays
        if (data._deleted) continue;
        
        // Support both formats: data.end (app.js format) and data.endDate (legacy format)
        const startDate = new Date(data.start || startStr);
        const endDateStr = data.end || data.endDate;
        const endDate = new Date(endDateStr);
        
        if (date >= startDate && date <= endDate) {
          isSchoolHoliday = true;
          schoolHolidayData = data;
          schoolHolidayStart = data.start || startStr;
          schoolHolidayEnd = endDateStr;
          break;
        }
      }
    }
    
    // Debug logging for holidays
    const isHoliday = publicHoliday || isSchoolHoliday;
    const isPast = date < today;
    const isToday = date.getTime() === today.getTime();
    
    // Create cell with simplified classes (matching index.html structure)
    const cell = document.createElement('div');
    
    // Check if this is a replacement request (not regular leave)
    const isReplacementRequest = leaveRequest && leaveRequest.request_type === 'Replacement Day';
    
    cell.className = `min-h-[48px] w-full rounded-lg flex flex-col items-center justify-center transition-all relative py-1 ${
      isPast ? 'bg-slate-50 text-slate-300 cursor-not-allowed' : 
      isToday ? 'bg-blue-50 ring-2 ring-blue-500 cursor-pointer' :
      leaveRequest && !isReplacementRequest ? 
        leaveRequest.status === 'Pending' ? 'bg-yellow-100 border border-yellow-400 cursor-pointer' :
        leaveRequest.status === 'Approved' ? 'bg-green-100 border border-green-400 cursor-pointer' :
        'bg-red-100 border border-red-400 cursor-not-allowed' :
      isReplacementRequest && leaveRequest.status === 'Pending' ? 'border border-yellow-400 cursor-pointer' :
      isHoliday ? 'cursor-not-allowed' :
      'hover:bg-blue-50 cursor-pointer'
    }`;
    
    // Number wrapper (holds the date number and circle indicators) - matching index.html
    const numWrapper = document.createElement('div');
    numWrapper.className = 'flex items-center justify-center relative w-6 h-6';
    
    // Add holiday circle indicators (respecting filter)
    // Show circles based on filter settings
    const showPublicCircle = publicHoliday && leaveCalendarFilters.showPublicHolidays;
    const showSchoolCircle = isSchoolHoliday && leaveCalendarFilters.showSchoolHolidays;
    
    if (showPublicCircle && showSchoolCircle) {
      // Both public and school holiday - yellow circle with gray border
      const circle = document.createElement('span');
      circle.className = 'absolute inset-0 rounded-full border-2 border-slate-300 bg-[#fff59c] z-0';
      numWrapper.appendChild(circle);
    } else if (showPublicCircle) {
      // Public holiday only - gray circle
      const circle = document.createElement('span');
      circle.className = 'absolute inset-0 rounded-full bg-slate-300 z-0';
      numWrapper.appendChild(circle);
    } else if (showSchoolCircle) {
      // School holiday only - yellow circle
      const circle = document.createElement('span');
      circle.className = 'absolute inset-0 rounded-full bg-[#fff59c] z-0';
      numWrapper.appendChild(circle);
    }
    
    // Date number
    const numSpan = document.createElement('span');
    numSpan.textContent = day;
    numSpan.className = `relative z-20 text-xs font-medium text-slate-800 ${isToday ? 'w-6 h-6 flex items-center justify-center bg-blue-100 text-blue-700 rounded-full font-bold' : ''}`;
    numSpan.style.textShadow = '0 0 2px white';
    
    numWrapper.appendChild(numSpan);
    cell.appendChild(numWrapper);
    
    // Add holiday name text below date (matching index.html)
    // Show holiday name for ALL dates in the holiday range (respecting filter)
    if (publicHoliday && leaveCalendarFilters.showPublicHolidays) {
      const hText = document.createElement('span');
      hText.className = 'text-[6px] leading-tight text-center text-slate-500 font-bold mt-0.5 px-0.5 line-clamp-1 w-full';
      hText.textContent = publicHoliday;
      cell.appendChild(hText);
    } else if (schoolHolidayData && isSchoolHoliday && leaveCalendarFilters.showSchoolHolidays) {
      // School holiday name shown on ALL dates in the range
      const sText = document.createElement('span');
      sText.className = 'text-[6px] leading-tight text-center text-yellow-600 font-bold mt-0.5 px-0.5 line-clamp-1 w-full';
      sText.textContent = schoolHolidayData.name;
      cell.appendChild(sText);
    }
    
    // Add offday lines at the bottom
    if (isManagerOff) {
      const line = document.createElement('div');
      line.className = 'offday-line-m';
      cell.appendChild(line);
    }
    if (isAMOff) {
      const line = document.createElement('div');
      line.className = 'offday-line-am';
      cell.appendChild(line);
    }
    
    // Add admin-configured replacement lines (blue/green - from site_settings)
    if (isManagerReplace) {
      const line = document.createElement('div');
      line.className = 'replacement-line-m';
      cell.appendChild(line);
    }
    if (isAMReplace) {
      const line = document.createElement('div');
      line.className = 'replacement-line-am';
      cell.appendChild(line);
    }
    
    // Add orange line for staff replacement request dates (from leave_requests table)
    // Orange line appears on the replacement date (e.g., Feb 4)
    if (isReplacementRequest && leaveRequest.status === 'Approved') {
      const line = document.createElement('div');
      line.className = currentLeaveUser.role === 'Manager' ? 'replacement-line-m-orange' : 'replacement-line-am-orange';
      cell.appendChild(line);
      
      // Store replacement date info for connector
      cell.dataset.replacementDate = dateStr;
      cell.dataset.workedOffday = leaveRequest.replacement_offday_date;
    }
    
    // Check if this date was worked on (original offday that was replaced)
    const workedOnThisDate = leaveRequestsCache.data.find(r => 
      r.request_type === 'Replacement Day' && 
      r.replacement_offday_date === dateStr &&
      r.status === 'Approved'
    );
    if (workedOnThisDate) {
      // Add orange line ABOVE the green offday line (not replacing it)
      const line = document.createElement('div');
      line.className = currentLeaveUser.role === 'Manager' ? 'replacement-line-m-orange-upper' : 'replacement-line-am-orange-upper';
      cell.appendChild(line);
      
      // Store info for connector arrow
      cell.dataset.workedDate = dateStr;
      cell.dataset.replacementFor = workedOnThisDate.leave_date;
    }
    
    // Add click handler (disabled for past dates and holidays)
    if (!isPast && !isHoliday) {
      cell.onclick = () => requestLeaveForDate(dateStr);
    } else if (isHoliday) {
      const holidayName = publicHoliday || schoolHolidayData?.name || 'a school holiday';
      cell.onclick = () => alert(`Cannot request leave on ${holidayName}`);
      cell.title = holidayName;
    }
    
    grid.appendChild(cell);
  }
  
  // Draw replacement connector arrows after all cells are rendered
  drawReplacementConnectors();
}

// Draw connector arrows between worked offday and replacement date
function drawReplacementConnectors() {
  const grid = document.getElementById('leaveCalendarGrid');
  if (!grid) return;
  
  // Remove existing connectors
  document.querySelectorAll('.replacement-connector').forEach(el => el.remove());
  
  // Find all worked dates that have replacement links
  const workedCells = grid.querySelectorAll('[data-worked-date]');
  
  workedCells.forEach(workedCell => {
    const workedDate = workedCell.dataset.workedDate;
    const replacementDate = workedCell.dataset.replacementFor;
    
    // Find the replacement date cell
    const replacementCell = grid.querySelector(`[data-replacement-date="${replacementDate}"]`);
    if (!replacementCell) return;
    
    // Find the number wrapper elements (the actual date number position)
    const workedNumWrapper = workedCell.querySelector('.flex.items-center.justify-center.relative');
    const replacementNumWrapper = replacementCell.querySelector('.flex.items-center.justify-center.relative');
    
    // Get positions relative to the grid
    const gridRect = grid.getBoundingClientRect();
    const workedCellRect = workedCell.getBoundingClientRect();
    const replacementCellRect = replacementCell.getBoundingClientRect();
    
    // Get number wrapper positions (the actual number)
    const workedNumRect = workedNumWrapper ? workedNumWrapper.getBoundingClientRect() : workedCellRect;
    const replacementNumRect = replacementNumWrapper ? replacementNumWrapper.getBoundingClientRect() : replacementCellRect;
    
    // Calculate center positions
    const startCenterX = workedCellRect.left + workedCellRect.width / 2 - gridRect.left;
    const startTopY = workedCellRect.top - gridRect.top + 8;
    const endCenterX = replacementCellRect.left + replacementCellRect.width / 2 - gridRect.left;
    const endTopY = replacementCellRect.top - gridRect.top + 8;
    
    // Check if dates are on the same row (same Y position roughly)
    const sameRow = Math.abs(workedCellRect.top - replacementCellRect.top) < 10;
    
    // Check if target is to the right or left
    const targetIsRight = endCenterX > startCenterX;
    
    // Check if target is below (different row)
    const targetIsBelow = replacementCellRect.top > workedCellRect.top + 10;
    
    // Create SVG container
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('replacement-connector');
    svg.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 999;
      overflow: visible;
      opacity: 0.6;
    `;
    
    let pathData;
    let arrowPoints;
    const arrowSize = 4;
    
    if (sameRow) {
      // SAME ROW: Simple elbow - up, horizontal, down
      const elbowY = startTopY - 8;
      pathData = `
        M ${startCenterX} ${startTopY}
        L ${startCenterX} ${elbowY}
        L ${endCenterX} ${elbowY}
        L ${endCenterX} ${endTopY}
      `;
      // Arrow pointing down
      arrowPoints = `
        ${endCenterX},${endTopY}
        ${endCenterX - arrowSize},${endTopY - arrowSize - 1}
        ${endCenterX + arrowSize},${endTopY - arrowSize - 1}
      `;
    } else if (targetIsBelow && targetIsRight) {
      // PATTERN 1: Left-to-below-right
      // Start from LEFT EDGE of the date number (not cell edge)
      const startX = workedNumRect.left - gridRect.left + 2; // 2px from left edge of number
      const startY = workedNumRect.top - gridRect.top + workedNumRect.height / 2;
      const endX = replacementNumRect.left - gridRect.left + 2; // 2px from left edge of number
      const endY = replacementNumRect.top - gridRect.top + replacementNumRect.height / 2;
      
      const midY = (startY + endY) / 2;
      
      pathData = `
        M ${startX} ${startY}
        L ${startX - 8} ${startY}
        L ${startX - 8} ${midY}
        L ${endX - 8} ${midY}
        L ${endX - 8} ${endY}
        L ${endX} ${endY}
      `;
      // Arrow pointing right
      arrowPoints = `
        ${endX},${endY}
        ${endX - arrowSize - 1},${endY - arrowSize}
        ${endX - arrowSize - 1},${endY + arrowSize}
      `;
    } else if (targetIsBelow && !targetIsRight) {
      // PATTERN 2: Right-to-below-left
      // Start from RIGHT EDGE of the date number (not cell edge)
      const startX = workedNumRect.right - gridRect.left - 2; // 2px from right edge of number
      const startY = workedNumRect.top - gridRect.top + workedNumRect.height / 2;
      const endX = replacementNumRect.right - gridRect.left - 2; // 2px from right edge of number
      const endY = replacementNumRect.top - gridRect.top + replacementNumRect.height / 2;
      
      const midY = (startY + endY) / 2;
      
      pathData = `
        M ${startX} ${startY}
        L ${startX + 8} ${startY}
        L ${startX + 8} ${midY}
        L ${endX + 8} ${midY}
        L ${endX + 8} ${endY}
        L ${endX} ${endY}
      `;
      // Arrow pointing left
      arrowPoints = `
        ${endX},${endY}
        ${endX + arrowSize + 1},${endY - arrowSize}
        ${endX + arrowSize + 1},${endY + arrowSize}
      `;
    } else {
      // Target is above - use simple elbow going down first
      const elbowY = Math.max(startTopY, endTopY) + workedCellRect.height + 8;
      pathData = `
        M ${startCenterX} ${startTopY + workedCellRect.height - 16}
        L ${startCenterX} ${elbowY}
        L ${endCenterX} ${elbowY}
        L ${endCenterX} ${endTopY + replacementCellRect.height - 16}
      `;
      // Arrow pointing up
      arrowPoints = `
        ${endCenterX},${endTopY + replacementCellRect.height - 16}
        ${endCenterX - arrowSize},${endTopY + replacementCellRect.height - 16 + arrowSize + 1}
        ${endCenterX + arrowSize},${endTopY + replacementCellRect.height - 16 + arrowSize + 1}
      `;
    }
    
    // Create path
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathData);
    path.setAttribute('stroke', '#ff8c00');
    path.setAttribute('stroke-width', '1.5');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    
    // Create arrowhead
    const arrowhead = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    arrowhead.setAttribute('points', arrowPoints);
    arrowhead.setAttribute('fill', '#ff8c00');
    
    svg.appendChild(path);
    svg.appendChild(arrowhead);
    grid.appendChild(svg);
  });
}

// Redraw connectors on window resize for responsiveness
let resizeTimeout;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    if (document.getElementById('leaveCalendarGrid')) {
      drawReplacementConnectors();
    }
    if (document.getElementById('viewingCalendarGrid')) {
      drawViewingReplacementConnectors();
    }
  }, 100);
});

// Subscribe to realtime leave updates
let leaveSubscription = null; // Track subscription for cleanup

function subscribeToLeaveUpdates() {
  if (!currentLeaveUser) return;
  
  // Unsubscribe from previous subscription if exists
  if (leaveSubscription) {
    supabaseClient.removeChannel(leaveSubscription);
  }
  
  // Use new Supabase Realtime API (v2)
  leaveSubscription = supabaseClient
    .channel('leave-requests-updates')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'leave_requests',
        filter: `user_id=eq.${currentLeaveUser.user_id}`
      },
      (payload) => {
        // OPTIMIZATION: Update cache incrementally instead of full reload
        if (window.DEBUG_MODE) console.log('📡 Realtime event:', payload.eventType);
        
        if (payload.eventType === 'INSERT') {
          // Add new request to cache
          leaveRequestsCache.data.unshift(payload.new);
        } else if (payload.eventType === 'UPDATE') {
          // Update existing request in cache
          const index = leaveRequestsCache.data.findIndex(r => r.request_id === payload.new.request_id);
          if (index !== -1) {
            leaveRequestsCache.data[index] = payload.new;
          }
        } else if (payload.eventType === 'DELETE') {
          // Remove from cache
          leaveRequestsCache.data = leaveRequestsCache.data.filter(r => r.request_id !== payload.old.request_id);
        }
        
        // Update UI without refetching
        displayUserLeaveRequests();
        if (document.getElementById('statPending')) {
          updateLeaveStats();
          renderLeaveRequestsList();
        }
        if (document.getElementById('leaveCalendarGrid')) {
          renderLeaveCalendar();
        }
      }
    )
    .subscribe();
}

// Request leave for a specific date
async function requestLeaveForDate(dateStr) {
  if (!currentLeaveUser) {
    alert('Please login to request leave');
    showLeaveLogin();
    return;
  }
  
  if (currentLeaveUser.role === 'Supervisor') {
    alert('Supervisors cannot request leave through this system');
    return;
  }
  
  // Check if already has a request for this date
  const existingRequest = leaveRequestsCache.data.find(r => r.leave_date === dateStr);
  if (existingRequest) {
    if (existingRequest.status === 'Pending') {
      const cancelConfirm = await customConfirm(`You have a pending ${existingRequest.request_type} request for this date. Cancel it?`);
      if (cancelConfirm) {
        await cancelLeaveRequest(existingRequest.request_id);
      }
    } else {
      alert(`You already have a ${existingRequest.status.toLowerCase()} ${existingRequest.request_type} request for this date.`);
    }
    return;
  }
  
  // Show modal to choose request type
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 z-[60] flex items-center justify-center p-4 overflow-y-auto';
  modal.id = 'leaveRequestFormModal';
  modal.innerHTML = `
    <div class="fixed inset-0 bg-slate-900/40" onclick="document.getElementById('leaveRequestFormModal').remove()"></div>
    <div class="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6 my-8" onclick="event.stopPropagation()">
      <h3 class="text-lg font-bold text-slate-800 mb-2">Request Leave</h3>
      <p class="text-sm text-slate-600 mb-4">${new Date(dateStr).toLocaleDateString('en-MY', {weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'})}</p>
      
      <div class="space-y-3 mb-4">
        <label class="flex items-center gap-3 p-3 border-2 border-slate-200 rounded-lg cursor-pointer hover:border-blue-400 has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50">
          <input type="radio" name="requestType" value="Leave" class="w-4 h-4" checked onchange="toggleLeaveFields()" />
          <div>
            <div class="font-semibold text-slate-800">Leave</div>
            <div class="text-xs text-slate-500">Regular leave day</div>
          </div>
        </label>
        
        <label class="flex items-center gap-3 p-3 border-2 border-slate-200 rounded-lg cursor-pointer hover:border-green-400 has-[:checked]:border-green-500 has-[:checked]:bg-green-50">
          <input type="radio" name="requestType" value="Replacement Day" class="w-4 h-4" onchange="toggleLeaveFields()" />
          <div>
            <div class="font-semibold text-slate-800">Replacement Day</div>
            <div class="text-xs text-slate-500">Replacement for working on off-day</div>
          </div>
        </label>
      </div>
      
      <!-- SQL HRMS Confirmation (for Leave only) -->
      <div id="hrmsConfirmSection" class="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
        <label class="flex items-start gap-2 cursor-pointer">
          <input type="checkbox" id="hrmsConfirmed" class="w-4 h-4 mt-0.5" />
          <div class="text-xs text-slate-700">
            <span class="font-semibold">I confirm that I have applied in SQL HRMS Approved</span>
            <span class="text-red-600">*</span>
          </div>
        </label>
      </div>
      
      <!-- Replacement Offday Date (for Replacement Day only) -->
      <div id="replacementDateSection" class="mb-4 hidden">
        <label class="text-xs font-semibold text-slate-600 mb-1 block">
          Which offday are you replacing? <span class="text-red-600">*</span>
        </label>
        <input type="date" id="replacementOffdayDate" class="w-full px-3 py-2 border border-slate-200 rounded text-sm" />
        <p class="text-[10px] text-slate-500 mt-1">Select the offday you worked on</p>
      </div>
      
      <div class="mb-4">
        <label class="text-xs font-semibold text-slate-600 mb-1 block">Notes (Optional)</label>
        <textarea id="leaveNotes" class="w-full px-3 py-2 border border-slate-200 rounded text-sm" rows="2" placeholder="Add any notes..."></textarea>
      </div>
      
      <div class="flex gap-2">
        <button onclick="document.getElementById('leaveRequestFormModal').remove()" class="flex-1 btn btn-secondary">Cancel</button>
        <button onclick="submitLeaveRequest('${dateStr}')" class="flex-1 btn btn-primary">Submit Request</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

// Toggle leave request fields based on type
function toggleLeaveFields() {
  const requestType = document.querySelector('input[name="requestType"]:checked').value;
  const hrmsSection = document.getElementById('hrmsConfirmSection');
  const replacementSection = document.getElementById('replacementDateSection');
  
  if (requestType === 'Leave') {
    hrmsSection.classList.remove('hidden');
    replacementSection.classList.add('hidden');
  } else {
    hrmsSection.classList.add('hidden');
    replacementSection.classList.remove('hidden');
  }
}

// Submit leave request
async function submitLeaveRequest(dateStr) {
  const requestType = document.querySelector('input[name="requestType"]:checked').value;
  const notes = document.getElementById('leaveNotes').value.trim();
  
  // Validate based on request type
  if (requestType === 'Leave') {
    // Check SQL HRMS confirmation
    const hrmsConfirmed = document.getElementById('hrmsConfirmed').checked;
    if (!hrmsConfirmed) {
      alert('Please confirm that you have applied in SQL HRMS Approved');
      return;
    }
  } else if (requestType === 'Replacement Day') {
    // Check replacement offday date
    const replacementDate = document.getElementById('replacementOffdayDate').value;
    if (!replacementDate) {
      alert('Please select which offday you are replacing');
      return;
    }
  }
  
  // Build notes with additional info
  let finalNotes = notes;
  let replacementOffdayDate = null;
  
  if (requestType === 'Replacement Day') {
    replacementOffdayDate = document.getElementById('replacementOffdayDate').value;
    const formattedDate = new Date(replacementOffdayDate).toLocaleDateString('en-MY', {weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'});
    finalNotes = `Replacing offday:\n${formattedDate}` + (notes ? `\n${notes}` : '');
  } else if (requestType === 'Leave') {
    finalNotes = 'SQL HRMS Approved' + (notes ? `\n${notes}` : '');
  }
  
  try {
    const { data, error } = await supabaseClient
      .from('leave_requests')
      .insert({
        user_id: currentLeaveUser.user_id,
        site_id: currentLeaveUser.site_id,
        leave_date: dateStr,
        request_type: requestType,
        notes: finalNotes || null,
        replacement_offday_date: replacementOffdayDate // Store the worked offday date
      });
    
    if (error) throw error;
    
    showToast(`${requestType} request submitted!`, 'success');
    
    // Close only the form modal (not the parent leave panel)
    const formModal = document.getElementById('leaveRequestFormModal');
    if (formModal) {
      formModal.remove();
    }
    
    // Reload data (force refresh since realtime might not trigger immediately)
    await loadUserLeaveRequests(true);
    renderLeaveCalendar();
    
  } catch (error) {
    alert(error.message || 'Failed to submit leave request');
  }
}

// Cancel leave request
async function cancelLeaveRequest(requestId) {
  if (!await customConfirm('Cancel this leave request?')) return;
  
  try {
    const { error } = await supabaseClient
      .from('leave_requests')
      .delete()
      .eq('request_id', requestId);
    
    if (error) throw error;
    
    showToast('Leave request cancelled', 'success');
    loadUserLeaveRequests(true); // Force refresh after cancellation
    
  } catch (error) {
    alert('Failed to cancel request');
  }
}

// Show NADI Availability across all sites
async function showNADIAvailability() {
  // Get today's date in YYYY-MM-DD format
  const today = toLocalISOString(new Date());
  
  // Fetch all sites
    const { data: sites, error: sitesError } = await supabaseClient
      .from('sites')
      .select('site_id, site_name')
      .order('site_name');
    
  if (sitesError) {
    showToast('Failed to load sites', 'error');
    return;
  }
  
  // Fetch leave & replacement requests for today (approved only)
  const { data: leaveRequests, error: leaveError } = await supabaseClient
    .from('leave_requests')
    .select('user_id, site_id, leave_date, request_type, replacement_offday_date')
    .or(`leave_date.eq.${today},replacement_offday_date.eq.${today}`)
    .eq('status', 'Approved');
    
  if (leaveError) {
    console.error('Failed to load leave requests:', leaveError);
  }
  
  // Fetch all users
  const { data: users, error: usersError } = await supabaseClient
    .from('leave_users')
    .select('user_id, site_id, full_name, role')
    .neq('role', 'Supervisor');
    
  if (usersError) {
    console.error('Failed to load users:', usersError);
  }
  
  // Fetch offdays, replacements, and public holidays
  const { data: settings } = await supabaseClient
    .from('site_settings')
    .select('id, settings')
    .in('id', [10, 11, 20]);
  
  const managerOffdaySettings = settings?.find(s => s.id === 10) || {};
  const amOffdaySettings = settings?.find(s => s.id === 11) || {};
  const publicHolidaySettings = settings?.find(s => s.id === 20) || {};
  
  const managerOffdays = managerOffdaySettings.settings?.managerOffdays || [];
  const amOffdays = amOffdaySettings.settings?.assistantManagerOffdays || [];
  const publicHolidays = publicHolidaySettings.settings?.publicHolidays || {};
  
  // Check if today is a public holiday
  const isPublicHolidayToday = publicHolidays.hasOwnProperty(today);
  
  // Build site availability data
  const siteAvailability = sites.map(site => {
    // Find manager and AM for this site
    const manager = users?.find(u => u.site_id === site.site_id && u.role === 'Manager');
    const am = users?.find(u => u.site_id === site.site_id && u.role === 'Assistant Manager');
    
    // Check if manager is available (admin offdays + replacement requests)
    const managerOffToday = managerOffdays.includes(today);
    const managerBaseAvailable = !managerOffToday;
    
    const managerLeaveToday = leaveRequests?.some(r =>
      r.user_id === manager?.user_id &&
      r.site_id === site.site_id &&
      r.request_type === 'Leave' &&
      r.leave_date === today
    );
    const managerReplacementOffToday = leaveRequests?.some(r =>
      r.user_id === manager?.user_id &&
      r.site_id === site.site_id &&
      r.request_type === 'Replacement Day' &&
      r.leave_date === today
    );
    const managerWorkedOffdayToday = leaveRequests?.some(r =>
      r.user_id === manager?.user_id &&
      r.site_id === site.site_id &&
      r.request_type === 'Replacement Day' &&
      r.replacement_offday_date === today
    );
    
    let managerAvailable = managerBaseAvailable;
    if (isPublicHolidayToday) {
      managerAvailable = false;
    } else if (managerLeaveToday || managerReplacementOffToday) {
      managerAvailable = false;
    } else if (managerWorkedOffdayToday) {
      managerAvailable = true;
    }
    
    // Check if AM is available (admin offdays + replacement requests)
    const amOffToday = amOffdays.includes(today);
    const amBaseAvailable = !amOffToday;
    
    const amLeaveToday = leaveRequests?.some(r =>
      r.user_id === am?.user_id &&
      r.site_id === site.site_id &&
      r.request_type === 'Leave' &&
      r.leave_date === today
    );
    const amReplacementOffToday = leaveRequests?.some(r =>
      r.user_id === am?.user_id &&
      r.site_id === site.site_id &&
      r.request_type === 'Replacement Day' &&
      r.leave_date === today
    );
    const amWorkedOffdayToday = leaveRequests?.some(r =>
      r.user_id === am?.user_id &&
      r.site_id === site.site_id &&
      r.request_type === 'Replacement Day' &&
      r.replacement_offday_date === today
    );
    
    let amAvailable = amBaseAvailable;
    if (isPublicHolidayToday) {
      amAvailable = false;
    } else if (amLeaveToday || amReplacementOffToday) {
      amAvailable = false;
    } else if (amWorkedOffdayToday) {
      amAvailable = true;
    }
    
    return {
      siteName: site.site_name,
      managerAvailable,
      amAvailable
    };
  });
  
  // Remove any existing modals
  document.querySelectorAll('.leave-modal').forEach(el => el.remove());
  
  // Create modal
  const modal = document.createElement('div');
  modal.className = 'leave-modal fixed left-0 right-0 top-0 z-50 flex items-start justify-center pt-4 px-4 overflow-y-auto max-h-screen';
  modal.innerHTML = `
    <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onclick="this.parentElement.remove()"></div>
    <div class="relative bg-white rounded-xl shadow-xl w-full max-w-3xl my-4 max-h-[calc(100vh-2rem)] overflow-hidden flex flex-col">
      <div class="px-4 py-3 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-white flex items-start justify-between gap-4">
        <div>
          <h2 class="text-base font-bold text-slate-800">NADI Availability Today</h2>
          <p class="text-xs text-slate-500">${new Date().toLocaleDateString('en-MY', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        ${buildLeavePanelMenu('availability')}
      </div>
      <div class="flex-1 overflow-y-auto p-4">
        <div class="grid grid-cols-3 gap-2">
          ${siteAvailability.map(site => `
            <div class="bg-slate-50 rounded-lg border border-slate-200 p-2.5">
              <h3 class="text-xs font-bold mb-2" style="color: #2228a4;">NADI ${site.siteName}</h3>
              <div class="flex items-center gap-3">
                <div class="flex items-center gap-1.5">
                  <span class="w-2.5 h-2.5 rounded-full flex-shrink-0 ${site.managerAvailable ? 'bg-green-500' : 'bg-red-500'}"></span>
                  <span class="text-[10px] text-slate-600">Manager</span>
                </div>
                <div class="flex items-center gap-1.5">
                  <span class="w-2.5 h-2.5 rounded-full flex-shrink-0 ${site.amAvailable ? 'bg-green-500' : 'bg-red-500'}"></span>
                  <span class="text-[10px] text-slate-600">Assistant Manager</span>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
      <div class="px-4 py-2.5 border-t border-slate-200 bg-slate-50 flex justify-between items-center">
        <div class="text-[10px] text-slate-500 flex items-center gap-3">
          <div class="flex items-center gap-1">
            <span class="w-2.5 h-2.5 rounded-full bg-green-500"></span>
            <span>Available</span>
          </div>
          <div class="flex items-center gap-1">
            <span class="w-2.5 h-2.5 rounded-full bg-red-500"></span>
            <span>Off/Leave</span>
          </div>
        </div>
        <button onclick="handleLeaveLogout()" class="btn btn-danger btn-sm text-xs px-3 py-1">
          <i class="fa-solid fa-right-from-bracket mr-1"></i> Logout
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
}

// Show admin panel (for supervisors)
function showAdminPanel() {
  if (currentLeaveUser?.role !== 'Supervisor') return;
  
  document.querySelectorAll('.leave-modal').forEach(el => el.remove());
  
  const panel = document.createElement('div');
  panel.className = 'leave-modal fixed left-0 right-0 top-0 z-50 flex items-start justify-center pt-4 px-4 overflow-y-auto max-h-screen';
  panel.innerHTML = `
    <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onclick="this.parentElement.remove()"></div>
    <div class="relative bg-white rounded-xl shadow-xl w-full max-w-5xl my-4 max-h-[calc(100vh-2rem)] overflow-hidden flex flex-col">
      <div class="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-purple-50 to-white">
        <div class="flex items-start justify-between gap-4">
          <div>
            <h2 class="text-xl font-bold text-slate-800">Manage Leave Requests</h2>
            <p class="text-sm text-slate-500">Review and approve staff leave requests</p>
          </div>
          <div class="flex items-center gap-2">
            <button onclick="showDeletionLog()" class="btn btn-secondary btn-sm">
              <i class="fa-solid fa-history"></i> View Deletion Log
            </button>
            ${buildLeavePanelMenu('admin')}
          </div>
        </div>
      </div>
      <div class="flex-1 overflow-y-auto p-6">
        <div id="adminRequestsList">
          <div class="text-center py-8"><div class="spinner mx-auto"></div></div>
        </div>
      </div>
      <div class="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end">
        <button onclick="handleLeaveLogout()" class="btn btn-danger btn-sm">
          <i class="fa-solid fa-right-from-bracket mr-1"></i> Logout
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(panel);
  
  loadAllLeaveRequests();
}

// Load all leave requests (admin)
async function loadAllLeaveRequests() {
  try {
    // First, get all leave requests
    const { data: requests, error: requestsError } = await supabaseClient
      .from('leave_requests')
      .select('request_id, user_id, site_id, leave_date, request_type, status, notes, replacement_offday_date, requested_at')
      .order('requested_at', { ascending: false });
    
    if (requestsError) throw requestsError;
    
    // If no requests, show empty
    if (!requests || requests.length === 0) {
      displayAdminRequests([]);
      return;
    }
    
    // Fetch all active staff (exclude supervisors) with site names
    const { data: users, error: usersError } = await supabaseClient
      .from('leave_users')
      .select('user_id, full_name, role, site_id, sites(site_name)')
      .eq('is_active', true)
      .neq('role', 'Supervisor')
      .order('full_name');
    
    if (usersError) throw usersError;
    
    // Create lookup map
    const userMap = new Map((users || []).map(u => [u.user_id, u]));
    
    adminAllStaffCache = (users || []).map(u => ({
      user_id: u.user_id,
      full_name: u.full_name,
      role: u.role,
      site_id: u.site_id,
      site_name: u.sites?.site_name || 'Unknown'
    }));
    
    // Merge data into requests
    const mergedRequests = (requests || []).map(req => {
      const user = userMap.get(req.user_id);
      return {
        ...req,
        leave_users: user || { full_name: 'Unknown', role: 'Unknown' },
        sites: { site_name: user?.sites?.site_name || 'Unknown' }
      };
    });
    
    displayAdminRequests(mergedRequests);
    
  } catch (error) {
    console.error('Error loading requests:', error);
    document.getElementById('adminRequestsList').innerHTML = `
      <div class="text-center py-8 text-red-600">
        <i class="fa-solid fa-triangle-exclamation text-3xl mb-2"></i>
        <p>Error loading requests: ${error.message}</p>
      </div>
    `;
  }
}

// Display admin requests
function displayAdminRequests(requests) {
  const container = document.getElementById('adminRequestsList');
  if (!container) return;
  
  adminRequestsCache = Array.isArray(requests) ? requests : [];
  const staffList = Array.isArray(adminAllStaffCache) ? adminAllStaffCache : [];

  if (staffList.length === 0) {
    container.innerHTML = '<p class="text-slate-500 text-sm text-center py-6">No staff found</p>';
    return;
  }

  const staffSummaries = staffList.map((staff) => {
    const staffRequests = adminRequestsCache.filter(r => r.user_id === staff.user_id);
    const pendingCount = staffRequests.filter(r => r.status === 'Pending').length;
    return {
      ...staff,
      totalCount: staffRequests.length,
      pendingCount
    };
  });

  const siteMap = new Map();
  staffSummaries.forEach((staff) => {
    const siteKey = staff.site_id || staff.site_name || 'unknown';
    const existing = siteMap.get(siteKey) || {
      site_id: staff.site_id,
      site_name: staff.site_name || 'Unknown',
      staff: []
    };
    existing.staff.push(staff);
    siteMap.set(siteKey, existing);
  });

  const roleOrder = { Manager: 1, "Assistant Manager": 2 };
  const siteGroups = Array.from(siteMap.values())
    .map(group => ({
      ...group,
      staff: group.staff.sort((a, b) => {
        const aOrder = roleOrder[a.role] || 99;
        const bOrder = roleOrder[b.role] || 99;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return a.full_name.localeCompare(b.full_name);
      })
    }))
    .sort((a, b) => a.site_name.localeCompare(b.site_name));

  container.innerHTML = `
    <div class="grid md:grid-cols-[1fr_320px] gap-3">
      <div class="bg-slate-50 border border-slate-200 rounded-lg p-2">
        <div class="text-[10px] font-bold text-slate-600 uppercase mb-1">All Staff</div>
        <div id="adminStaffGrid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1"></div>
      </div>
      <div class="bg-white border border-slate-200 rounded-lg p-3">
        <div class="text-[10px] font-bold text-slate-600 uppercase mb-2">Requests</div>
        <div id="adminRequestsByStaff" class="space-y-2 max-h-[520px] overflow-y-auto pr-1"></div>
      </div>
    </div>
  `;

  renderAdminStaffGrid(siteGroups);
  renderAdminRequestsGrouped(staffSummaries);
}

// Render admin request card
function renderAdminRequestCard(req) {
  return `
    <div class="bg-white border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      <div class="flex items-start justify-between gap-4">
        <div class="flex-1">
          <div class="flex items-center gap-2 mb-1">
            <span class="font-bold text-slate-800">${req.leave_users?.full_name}</span>
            <span class="text-xs text-slate-500">(${req.leave_users?.role})</span>
            <span class="text-xs text-slate-500">• ${req.sites?.site_name}</span>
          </div>
          <div class="text-sm text-slate-600 mb-2">
            ${new Date(req.leave_date).toLocaleDateString('en-MY', {weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'})}
            • <span class="font-semibold">${req.request_type}</span>
          </div>
          ${req.notes ? `<div class="text-xs text-slate-500 mb-2"><i class="fa-solid fa-note-sticky mr-1"></i> ${req.notes.replace(/\n/g, '<br>')}</div>` : ''}
          <div class="status-badge badge-${req.status.toLowerCase().replace(' ', '-')}">${req.status}</div>
        </div>
        <div class="flex gap-2">
          ${req.status === 'Pending' ? `
            <button onclick="updateLeaveStatus('${req.request_id}', 'Approved')" class="btn btn-success btn-sm">
              <i class="fa-solid fa-check"></i> Approve
            </button>
            <button onclick="updateLeaveStatus('${req.request_id}', 'Rejected')" class="btn btn-danger btn-sm">
              <i class="fa-solid fa-times"></i> Reject
            </button>
          ` : ''}
          <button onclick="deleteLeaveHistory('${req.request_id}', '${req.leave_users?.full_name}', '${req.leave_date}', '${req.request_type}')" class="btn btn-secondary btn-sm" title="Delete from history">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderAdminStaffGrid(siteGroups) {
  const grid = document.getElementById('adminStaffGrid');
  if (!grid) return;

  grid.innerHTML = siteGroups.map((group) => {
    const staffRows = group.staff.map((staff) => {
      let displayName = staff.full_name || '';
      if (group.site_name) {
        const suffix = ` - ${group.site_name}`;
        if (displayName.includes(suffix)) {
          displayName = displayName.replace(suffix, '').trim();
        }
      }
      return `
      <div class="relative rounded-md border border-slate-200 bg-white px-1.5 py-1">
        <div class="text-[10px] font-bold text-slate-800 truncate leading-tight">${displayName || 'Unknown'}</div>
        ${staff.pendingCount > 0 ? '<span class="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>' : ''}
      </div>
    `;
    }).join('');

    return `
      <div class="rounded-lg border border-slate-200 bg-slate-50 p-1.5">
        <div class="text-[9px] font-bold text-slate-600 uppercase mb-1 truncate">${group.site_name}</div>
        <div class="space-y-1">
          ${staffRows}
        </div>
      </div>
    `;
  }).join('');
}

function renderAdminRequestsGrouped(staffSummaries) {
  const container = document.getElementById('adminRequestsByStaff');
  if (!container) return;

  const staffWithRequests = staffSummaries.filter(s => s.totalCount > 0);
  if (staffWithRequests.length === 0) {
    container.innerHTML = '<p class="text-xs text-slate-400 text-center py-4">No requests yet</p>';
    return;
  }

  container.innerHTML = staffWithRequests.map((staff) => {
    const staffRequests = adminRequestsCache
      .filter(r => r.user_id === staff.user_id)
      .sort((a, b) => {
        const aPending = a.status === 'Pending' ? 0 : 1;
        const bPending = b.status === 'Pending' ? 0 : 1;
        if (aPending !== bPending) return aPending - bPending;
        const aDate = new Date(a.requested_at || a.leave_date || 0);
        const bDate = new Date(b.requested_at || b.leave_date || 0);
        return bDate - aDate;
      });

    const requestsHtml = staffRequests.map((req) => {
      const dateLabel = new Date(req.leave_date).toLocaleDateString('en-MY', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
      const notesBlock = req.notes
        ? `<div class="text-[10px] text-slate-500 mt-1"><i class="fa-solid fa-note-sticky mr-1"></i> ${req.notes.replace(/\n/g, '<br>')}</div>`
        : '<div class="text-[10px] text-slate-400 mt-1">&nbsp;</div>';

      return `
        <div class="bg-white border border-slate-200 rounded-lg p-2">
          <div class="flex items-center justify-between gap-2">
            <div class="text-[11px] font-bold text-slate-800">${dateLabel}</div>
            <span class="status-badge badge-${req.status.toLowerCase().replace(' ', '-')} text-[8px]">${req.status}</span>
          </div>
          <div class="text-[10px] text-slate-500">${req.request_type}</div>
          <div class="flex items-start justify-between gap-2">
            ${notesBlock}
            <button onclick="deleteLeaveHistory('${req.request_id}', '${staff.full_name}', '${req.leave_date}', '${req.request_type}')" class="btn btn-secondary btn-sm" title="Delete from history">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
          ${req.status === 'Pending' ? `
            <div class="flex gap-2 mt-2">
              <button onclick="updateLeaveStatus('${req.request_id}', 'Approved')" class="btn btn-success btn-sm">
                <i class="fa-solid fa-check"></i> Approve
              </button>
              <button onclick="updateLeaveStatus('${req.request_id}', 'Rejected')" class="btn btn-danger btn-sm">
                <i class="fa-solid fa-times"></i> Reject
              </button>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');

    return `
      <div class="border border-slate-200 rounded-lg p-3 bg-slate-50">
        <div class="flex items-center justify-between mb-2">
          <div class="text-[11px] font-bold text-slate-800">${staff.full_name}</div>
        </div>
        <div class="space-y-2">
          ${requestsHtml}
        </div>
      </div>
    `;
  }).join('');
}

// Update leave status (admin)
async function updateLeaveStatus(requestId, status) {
  const notes = status === 'Rejected' ? prompt('Reason for rejection (optional):') : null;
  
  try {
    const { error } = await supabaseClient
      .from('leave_requests')
      .update({
        status: status,
        reviewed_by: currentLeaveUser.user_id,
        admin_notes: notes || null
      })
      .eq('request_id', requestId);
    
    if (error) throw error;
    
    showToast(`Request ${status.toLowerCase()}!`, 'success');
    loadAllLeaveRequests();
    
  } catch (error) {
    alert('Failed to update request');
  }
}

// Delete leave history (supervisor only) with logging
async function deleteLeaveHistory(requestId, staffName, leaveDate, requestType) {
  if (!await customConfirm(`Delete this ${requestType} request for ${staffName} on ${leaveDate}?\n\nThis action will be logged.`)) {
    return;
  }
  
  try {
    // Create deletion log entry
    const deletionLog = {
      request_id: requestId,
      deleted_by: currentLeaveUser.full_name,
      deleted_by_id: currentLeaveUser.user_id,
      staff_name: staffName,
      leave_date: leaveDate,
      request_type: requestType,
      deleted_at: new Date().toISOString(),
      timestamp: new Date().toLocaleString('en-MY', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      })
    };
    
    // Get existing deletion logs from site_settings
    const { data: existingSettings } = await supabaseClient
      .from('site_settings')
      .select('deletion_logs')
      .eq('id', 30)
      .single();
    
    let deletionLogs = existingSettings?.deletion_logs || [];
    deletionLogs.unshift(deletionLog); // Add to beginning
    
    // Keep only last 1000 deletions to avoid growing too large
    if (deletionLogs.length > 1000) {
      deletionLogs = deletionLogs.slice(0, 1000);
    }
    
    // Save deletion log
    const { error: logError } = await supabaseClient
      .from('site_settings')
      .upsert({
        id: 30,
        deletion_logs: deletionLogs
      });
    
    if (logError) {
      console.error('Failed to log deletion:', logError);
    }
    
    // Delete the request
    const { error } = await supabaseClient
      .from('leave_requests')
      .delete()
      .eq('request_id', requestId);
    
    if (error) throw error;
    
    showToast('Request deleted and logged', 'success');
    loadAllLeaveRequests();
    
  } catch (error) {
    alert('Failed to delete request: ' + error.message);
  }
}

// Show deletion log (supervisor only)
async function showDeletionLog() {
  try {
    const { data: settings } = await supabaseClient
      .from('site_settings')
      .select('deletion_logs')
      .eq('id', 30)
      .single();
    
    const deletionLogs = settings?.deletion_logs || [];
    
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 z-[60] flex items-center justify-center p-4';
    modal.innerHTML = `
      <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onclick="this.parentElement.remove()"></div>
      <div class="relative bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div class="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-red-50 to-white">
          <h2 class="text-xl font-bold text-slate-800">Deletion Log</h2>
          <p class="text-sm text-slate-500">History of deleted leave requests (Last ${deletionLogs.length} deletions)</p>
        </div>
        <div class="flex-1 overflow-y-auto p-6">
          ${deletionLogs.length === 0 ? `
            <div class="text-center py-12">
              <i class="fa-solid fa-inbox text-4xl text-slate-300 mb-3"></i>
              <p class="text-slate-500">No deletions recorded</p>
            </div>
          ` : `
            <div class="space-y-2">
              ${deletionLogs.map(log => `
                <div class="bg-slate-50 border border-slate-200 rounded-lg p-4">
                  <div class="flex items-start justify-between">
                    <div class="flex-1">
                      <div class="font-bold text-slate-800 mb-1">${log.staff_name}</div>
                      <div class="text-sm text-slate-600 mb-1">
                        ${new Date(log.leave_date).toLocaleDateString('en-MY', {weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'})}
                        • <span class="font-semibold">${log.request_type}</span>
                      </div>
                      <div class="text-xs text-slate-500">
                        <i class="fa-solid fa-user-shield mr-1"></i>
                        Deleted by: <span class="font-semibold">${log.deleted_by}</span>
                        • ${log.timestamp}
                      </div>
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
          `}
        </div>
        <div class="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button onclick="this.closest('.fixed').remove()" class="btn btn-secondary btn-sm">Close</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
  } catch (error) {
    alert('Failed to load deletion log: ' + error.message);
  }
}

// Setup event listeners
function setupLeaveSystemListeners() {
  // Add optimized click handler to calendar dates for leave requests
  // Use event delegation on the calendar container instead of document
  const calendarGrid = document.getElementById('calendarGrid');
  if (calendarGrid) {
    calendarGrid.addEventListener('click', (e) => {
      if (!currentLeaveUser || !e.shiftKey) return;
      
      const dateCell = e.target.closest('[data-date]');
      if (dateCell) {
        e.preventDefault();
        e.stopPropagation();
        const dateStr = dateCell.dataset.date;
        requestLeaveForDate(dateStr);
      }
    });
  }
}

// =====================================================
// SUPERVISOR: View Staff Calendars (View Only Mode)
// =====================================================

// Global state for staff viewing
let viewingStaffUser = null;
let viewingStaffRequests = [];
let viewingCalendarDate = new Date();
let staffViewSites = [];

// Show staff calendars panel for supervisor
async function showStaffCalendarsPanel() {
  if (currentLeaveUser?.role !== 'Supervisor') return;
  
  document.querySelectorAll('.leave-modal').forEach(el => el.remove());
  
  const panel = document.createElement('div');
  panel.className = 'leave-modal fixed left-0 right-0 top-0 z-50 flex items-start justify-center pt-4 px-4 overflow-y-auto max-h-screen';
  panel.id = 'staffCalendarsPanel';
  panel.innerHTML = `
    <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onclick="document.getElementById('staffCalendarsPanel').remove()"></div>
    <div class="relative bg-white rounded-xl shadow-xl w-full max-w-md my-4 overflow-hidden">
      <div class="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-white">
        <h2 class="text-xl font-bold text-slate-800">View Staff Calendars</h2>
        <p class="text-sm text-slate-500">Select site and role to view calendar</p>
      </div>
      <div class="p-6">
        <div id="staffViewContent">
          <div class="text-center py-8"><div class="spinner mx-auto"></div></div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(panel);
  
  await loadStaffViewForm();
}

// Load the staff view form (similar to login)
async function loadStaffViewForm() {
  try {
    // Fetch all sites
    const { data: sites, error: sitesError } = await supabaseClient
      .from('sites')
      .select('site_id, site_name')
      .order('site_name');
    
    if (sitesError) throw sitesError;
    
    staffViewSites = sites;
    
    // Build site grid (same style as login)
    const siteGrid = sites.map(site => `
      <label class="relative cursor-pointer">
        <input type="radio" name="viewSite" value="${site.site_id}" class="sr-only peer" />
        <div class="border-2 border-slate-200 peer-checked:border-blue-500 peer-checked:bg-blue-50 rounded-lg p-2 text-center transition-all hover:border-slate-300">
          <div class="text-[10px] font-bold text-slate-800 leading-tight">${site.site_name}</div>
        </div>
      </label>
    `).join('');
    
    const container = document.getElementById('staffViewContent');
    container.innerHTML = `
      <!-- Site Selection -->
      <div class="mb-6">
        <label class="block text-xs font-bold text-slate-600 mb-2">Select Site</label>
        <div class="grid grid-cols-3 gap-2" id="viewSiteGrid">
          ${siteGrid}
        </div>
      </div>
      
      <!-- Role Selection -->
      <div class="mb-6">
        <label class="block text-xs font-bold text-slate-600 mb-2">Select Role</label>
        <div class="grid grid-cols-2 gap-3">
          <label class="relative cursor-pointer">
            <input type="radio" name="viewRole" value="Manager" class="sr-only peer" />
            <div class="border-2 border-slate-200 peer-checked:border-blue-500 peer-checked:bg-blue-50 rounded-lg p-3 text-center transition-all hover:border-slate-300">
              <i class="fa-solid fa-user-tie text-blue-600 text-xl mb-1"></i>
              <div class="text-xs font-bold text-slate-800">Manager</div>
            </div>
          </label>
          <label class="relative cursor-pointer">
            <input type="radio" name="viewRole" value="Assistant Manager" class="sr-only peer" />
            <div class="border-2 border-slate-200 peer-checked:border-green-500 peer-checked:bg-green-50 rounded-lg p-3 text-center transition-all hover:border-slate-300">
              <i class="fa-solid fa-user text-green-600 text-xl mb-1"></i>
              <div class="text-xs font-bold text-slate-800">Assistant Manager</div>
            </div>
          </label>
        </div>
      </div>
      
      <!-- View Button -->
      <button onclick="handleViewStaffCalendar()" class="w-full btn btn-primary">
        <i class="fa-solid fa-calendar-days mr-2"></i> View Staff Calendar
      </button>
    `;
    
  } catch (error) {
    console.error('Error loading staff view form:', error);
    document.getElementById('staffViewContent').innerHTML = `
      <div class="text-center py-8 text-red-600">
        <i class="fa-solid fa-triangle-exclamation text-3xl mb-2"></i>
        <p>Error loading sites</p>
      </div>
    `;
  }
}

// Handle view staff calendar button click
async function handleViewStaffCalendar() {
  const siteId = document.querySelector('input[name="viewSite"]:checked')?.value;
  const role = document.querySelector('input[name="viewRole"]:checked')?.value;
  
  if (!siteId || !role) {
    showToast('Please select both site and role', 'error');
    return;
  }
  
  try {
    // Find the staff member
    const { data: user, error } = await supabaseClient
      .from('leave_users')
      .select('*, sites(*)')
      .eq('site_id', siteId)
      .eq('role', role)
      .eq('is_active', true)
      .single();
    
    if (error || !user) {
      showToast('No staff found for this site and role', 'error');
      return;
    }
    
    // Close current panel
    document.getElementById('staffCalendarsPanel')?.remove();
    
    // Open staff calendar view
    viewStaffCalendarById(user.user_id, user.full_name, user.role, user.sites?.site_name || 'Unknown');
    
  } catch (error) {
    console.error('Error finding staff:', error);
    showToast('Error loading staff', 'error');
  }
}

// View staff calendar by ID (called after selection)
async function viewStaffCalendarById(userId, fullName, role, siteName) {
  viewingStaffUser = { user_id: userId, full_name: fullName, role: role, site_name: siteName };
  viewingCalendarDate = new Date();
  
  // Load offday data from site settings (for supervisor viewing)
  await syncMainCalendarOffdays();
  
  // Load staff's leave requests (optimized columns)
  const { data: requests, error } = await supabaseClient
    .from('leave_requests')
    .select('request_id, user_id, site_id, leave_date, request_type, status, notes, replacement_offday_date, requested_at')
    .eq('user_id', userId)
    .order('leave_date', { ascending: false });
  
  if (error) {
    showToast('Error loading staff calendar', 'error');
    return;
  }
  
  viewingStaffRequests = requests || [];
  
  // Determine role color
  const roleColor = role === 'Manager' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600';
  
  // Create calendar panel
  const panel = document.createElement('div');
  panel.className = 'leave-modal fixed left-0 right-0 top-0 z-50 flex items-start justify-center pt-4 px-4 overflow-y-auto max-h-screen';
  panel.id = 'staffCalendarViewPanel';
  panel.innerHTML = `
    <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onclick="document.getElementById('staffCalendarViewPanel').remove()"></div>
    <div class="relative bg-white rounded-xl shadow-xl w-full max-w-6xl my-4 max-h-[calc(100vh-2rem)] overflow-hidden flex flex-col">
      <div class="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-white flex items-start justify-between gap-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full flex items-center justify-center ${roleColor}">
            <i class="fa-solid fa-user"></i>
          </div>
          <div>
            <h2 class="text-lg font-bold text-slate-800">${fullName}</h2>
            <p class="text-sm text-slate-500">${role} - ${siteName}</p>
          </div>
        </div>
        ${buildLeavePanelMenu('leave')}
      </div>
      <div class="flex-1 overflow-y-auto p-6">
        <div class="flex flex-col xl:flex-row gap-6">
          <!-- Calendar -->
          <div class="flex-1" style="min-width: 500px;">
            <div class="bg-white rounded-lg border border-slate-200 p-4">
              <!-- Month Navigation -->
              <div class="flex items-center justify-between mb-3">
                <button onclick="changeViewingCalendarMonth(-1)" class="w-8 h-8 rounded hover:bg-slate-100 text-slate-600 flex items-center justify-center">
                  <i class="fa-solid fa-chevron-left"></i>
                </button>
                <div class="text-center">
                  <div id="viewingCalendarMonth" class="text-lg font-bold text-slate-900"></div>
                  <div id="viewingCalendarYear" class="text-xs font-semibold text-slate-400"></div>
                </div>
                <button onclick="changeViewingCalendarMonth(1)" class="w-8 h-8 rounded hover:bg-slate-100 text-slate-600 flex items-center justify-center">
                  <i class="fa-solid fa-chevron-right"></i>
                </button>
              </div>
              
              <!-- Calendar Grid -->
              <div class="grid grid-cols-7 gap-1 mb-2">
                <div class="text-center text-[10px] font-bold text-slate-400">SUN</div>
                <div class="text-center text-[10px] font-bold text-slate-400">MON</div>
                <div class="text-center text-[10px] font-bold text-slate-400">TUE</div>
                <div class="text-center text-[10px] font-bold text-slate-400">WED</div>
                <div class="text-center text-[10px] font-bold text-slate-400">THU</div>
                <div class="text-center text-[10px] font-bold text-slate-400">FRI</div>
                <div class="text-center text-[10px] font-bold text-slate-400">SAT</div>
              </div>
              <div id="viewingCalendarGrid" class="grid grid-cols-7 gap-1 relative"></div>
              
              <!-- Legend -->
              <div class="mt-3 pt-2 border-t border-slate-100">
                <div class="grid grid-cols-4 gap-2 text-[8px] font-semibold text-slate-500">
                  <div class="flex items-center gap-1">
                    <span class="w-2 h-2 rounded-full bg-yellow-400"></span> Pending
                  </div>
                  <div class="flex items-center gap-1">
                    <span class="w-2 h-2 rounded-full bg-green-500"></span> Approved
                  </div>
                  <div class="flex items-center gap-1">
                    <span class="w-2 h-2 rounded-full bg-red-500"></span> Rejected
                  </div>
                  <div class="flex items-center gap-1">
                    <span class="w-2 h-1 rounded-sm ${role === 'Manager' ? 'bg-[#00aff0]' : 'bg-[#90cf53]'}"></span> ${role === 'Manager' ? 'M Off' : 'AM Off'}
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Leave Requests List -->
          <div class="w-full xl:w-[500px] xl:flex-shrink-0">
            <div class="bg-slate-50 rounded-lg border border-slate-200 p-4" style="min-height: 400px;">
              <h3 class="text-sm font-bold text-slate-800 mb-3">Leave Requests</h3>
              <div id="viewingRequestsList" class="space-y-2 overflow-y-auto" style="max-height: calc(400px - 3rem);"></div>
            </div>
          </div>
        </div>
      </div>
      <div class="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-between">
        <button onclick="document.getElementById('staffCalendarViewPanel').remove(); showStaffCalendarsPanel();" class="btn btn-secondary btn-sm">
          <i class="fa-solid fa-arrow-left mr-1"></i> Back
        </button>
        <button onclick="document.getElementById('staffCalendarViewPanel').remove()" class="btn btn-secondary btn-sm">Close</button>
      </div>
    </div>
  `;
  document.body.appendChild(panel);
  
  renderViewingCalendar();
  displayViewingRequestsList();
}

// Change viewing calendar month
function changeViewingCalendarMonth(direction) {
  viewingCalendarDate.setMonth(viewingCalendarDate.getMonth() + direction);
  renderViewingCalendar();
}

// Render viewing calendar (view only - no click handlers)
function renderViewingCalendar() {
  const year = viewingCalendarDate.getFullYear();
  const month = viewingCalendarDate.getMonth();
  
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  document.getElementById('viewingCalendarMonth').textContent = monthNames[month];
  document.getElementById('viewingCalendarYear').textContent = year;
  
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const grid = document.getElementById('viewingCalendarGrid');
  grid.innerHTML = '';
  
  // Add empty cells for days before month starts
  for (let i = 0; i < firstDay; i++) {
    const cell = document.createElement('div');
    cell.className = 'h-10';
    grid.appendChild(cell);
  }
  
  // Add cells for each day
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    // Check if this date has a leave request
    const leaveRequest = viewingStaffRequests.find(r => r.leave_date === dateStr);
    
    // Check holidays
    const publicHoliday = mainCalendarHolidays.public ? mainCalendarHolidays.public[dateStr] : null;
    let isSchoolHoliday = false;
    if (mainCalendarHolidays.school) {
      for (const [startStr, data] of Object.entries(mainCalendarHolidays.school)) {
        if (data._deleted) continue;
        const startDate = new Date(data.start || startStr);
        const endDate = new Date(data.end || data.endDate);
        if (date >= startDate && date <= endDate) {
          isSchoolHoliday = true;
          break;
        }
      }
    }
    
    const isHoliday = publicHoliday || isSchoolHoliday;
    const isToday = date.getTime() === today.getTime();
    
    // Check offdays based on staff role
    const isOffday = viewingStaffUser.role === 'Manager' 
      ? mainCalendarOffdays.manager.includes(dateStr)
      : mainCalendarOffdays.am.includes(dateStr);
    
    const cell = document.createElement('div');
    cell.className = `min-h-[40px] w-full rounded-lg flex flex-col items-center justify-center relative py-1 ${
      isToday ? 'bg-blue-50 ring-2 ring-blue-500' :
      leaveRequest ? 
        leaveRequest.status === 'Pending' ? 'bg-yellow-100 border border-yellow-400' :
        leaveRequest.status === 'Approved' ? 'bg-green-100 border border-green-400' :
        'bg-red-100 border border-red-400' :
      isHoliday ? 'bg-slate-100' :
      'bg-white'
    }`;
    
    // Number wrapper
    const numWrapper = document.createElement('div');
    numWrapper.className = 'flex items-center justify-center relative w-6 h-6';
    
    // Holiday circle
    if (publicHoliday) {
      const circle = document.createElement('span');
      circle.className = 'absolute inset-0 rounded-full bg-slate-300 z-0';
      numWrapper.appendChild(circle);
    } else if (isSchoolHoliday) {
      const circle = document.createElement('span');
      circle.className = 'absolute inset-0 rounded-full bg-[#fff59c] z-0';
      numWrapper.appendChild(circle);
    }
    
    // Date number
    const numSpan = document.createElement('span');
    numSpan.textContent = day;
    numSpan.className = `relative z-20 text-xs font-medium text-slate-800 ${isToday ? 'font-bold text-blue-700' : ''}`;
    numWrapper.appendChild(numSpan);
    cell.appendChild(numWrapper);
    
    // Add offday line
    if (isOffday) {
      const line = document.createElement('div');
      line.className = viewingStaffUser.role === 'Manager' ? 'offday-line-m' : 'offday-line-am';
      cell.appendChild(line);
    }
    
    // Check if this is a replacement request
    const isReplacementRequest = leaveRequest && leaveRequest.request_type === 'Replacement Day';
    
    // Add orange line for staff replacement request dates (approved only)
    if (isReplacementRequest && leaveRequest.status === 'Approved') {
      const line = document.createElement('div');
      line.className = viewingStaffUser.role === 'Manager' ? 'replacement-line-m-orange' : 'replacement-line-am-orange';
      cell.appendChild(line);
      
      // Store replacement date info for connector
      cell.dataset.replacementDate = dateStr;
      cell.dataset.workedOffday = leaveRequest.replacement_offday_date;
    }
    
    // Check if this date was worked on (original offday that was replaced)
    const workedOnThisDate = viewingStaffRequests.find(r => 
      r.request_type === 'Replacement Day' && 
      r.replacement_offday_date === dateStr &&
      r.status === 'Approved'
    );
    if (workedOnThisDate) {
      // Add orange line ABOVE the green/blue offday line
      const line = document.createElement('div');
      line.className = viewingStaffUser.role === 'Manager' ? 'replacement-line-m-orange-upper' : 'replacement-line-am-orange-upper';
      cell.appendChild(line);
      
      // Store info for connector arrow
      cell.dataset.workedDate = dateStr;
      cell.dataset.replacementFor = workedOnThisDate.leave_date;
    }
    
    // Add status indicator for leave requests
    if (leaveRequest) {
      const indicator = document.createElement('div');
      indicator.className = `absolute top-1 right-1 w-2 h-2 rounded-full ${
        leaveRequest.status === 'Pending' ? 'bg-yellow-500' :
        leaveRequest.status === 'Approved' ? 'bg-green-500' : 'bg-red-500'
      }`;
      cell.appendChild(indicator);
    }
    
    grid.appendChild(cell);
  }
  
  // Draw replacement connector arrows after all cells are rendered (with slight delay for DOM)
  setTimeout(() => {
    drawViewingReplacementConnectors();
  }, 50);
}

// Draw connector arrows for viewing calendar (supervisor view)
function drawViewingReplacementConnectors() {
  const grid = document.getElementById('viewingCalendarGrid');
  if (!grid) return;
  
  // Remove existing connectors
  grid.querySelectorAll('.replacement-connector').forEach(el => el.remove());
  
  // Find all worked dates that have replacement links
  const workedCells = grid.querySelectorAll('[data-worked-date]');
  
  workedCells.forEach(workedCell => {
    const workedDate = workedCell.dataset.workedDate;
    const replacementDate = workedCell.dataset.replacementFor;
    
    // Find the replacement date cell
    const replacementCell = grid.querySelector(`[data-replacement-date="${replacementDate}"]`);
    if (!replacementCell) return;
    
    // Get positions relative to the grid
    const gridRect = grid.getBoundingClientRect();
    const workedCellRect = workedCell.getBoundingClientRect();
    const replacementCellRect = replacementCell.getBoundingClientRect();
    
    // Calculate center positions
    const startCenterX = workedCellRect.left + workedCellRect.width / 2 - gridRect.left;
    const startTopY = workedCellRect.top - gridRect.top + 8;
    const endCenterX = replacementCellRect.left + replacementCellRect.width / 2 - gridRect.left;
    const endTopY = replacementCellRect.top - gridRect.top + 8;
    
    // Check if dates are on the same row
    const sameRow = Math.abs(workedCellRect.top - replacementCellRect.top) < 10;
    
    // Create SVG container
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('replacement-connector');
    svg.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 999;
      overflow: visible;
      opacity: 0.6;
    `;
    
    let pathData;
    let arrowPoints;
    const arrowSize = 4;
    
    if (sameRow) {
      // Same row: up, horizontal, down
      const elbowY = startTopY - 8;
      pathData = `
        M ${startCenterX} ${startTopY}
        L ${startCenterX} ${elbowY}
        L ${endCenterX} ${elbowY}
        L ${endCenterX} ${endTopY}
      `;
      arrowPoints = `
        ${endCenterX},${endTopY}
        ${endCenterX - arrowSize},${endTopY - arrowSize - 1}
        ${endCenterX + arrowSize},${endTopY - arrowSize - 1}
      `;
    } else {
      // Different rows: simple elbow
      const midY = (startTopY + endTopY) / 2;
      pathData = `
        M ${startCenterX} ${startTopY}
        L ${startCenterX} ${midY}
        L ${endCenterX} ${midY}
        L ${endCenterX} ${endTopY}
      `;
      arrowPoints = `
        ${endCenterX},${endTopY}
        ${endCenterX - arrowSize},${endTopY - arrowSize - 1}
        ${endCenterX + arrowSize},${endTopY - arrowSize - 1}
      `;
    }
    
    // Create path
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathData);
    path.setAttribute('stroke', '#ff8c00');
    path.setAttribute('stroke-width', '1.5');
    path.setAttribute('fill', 'none');
    svg.appendChild(path);
    
    // Create arrow
    const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    arrow.setAttribute('points', arrowPoints);
    arrow.setAttribute('fill', '#ff8c00');
    svg.appendChild(arrow);
    
    grid.appendChild(svg);
  });
}

// Display viewing staff's leave requests list (two columns like staff view)
function displayViewingRequestsList() {
  const container = document.getElementById('viewingRequestsList');
  if (!container) return;
  
  if (viewingStaffRequests.length === 0) {
    container.innerHTML = `
      <div class="text-center py-8 col-span-2">
        <i class="fa-solid fa-calendar-xmark text-3xl text-slate-300 mb-2"></i>
        <p class="text-xs text-slate-500">No leave requests</p>
      </div>
    `;
    return;
  }
  
  // Separate requests by type
  const leaveRequests = viewingStaffRequests.filter(r => r.request_type === 'Leave').slice(0, 10);
  const replacementRequests = viewingStaffRequests.filter(r => r.request_type === 'Replacement Day').slice(0, 10);
  
  const statusColors = {
    'Pending': 'bg-yellow-100 border-yellow-300 text-yellow-800',
    'Approved': 'bg-green-100 border-green-300 text-green-800',
    'Rejected': 'bg-red-100 border-red-300 text-red-800'
  };
  
  // Generate Leave column HTML
  const leaveHTML = leaveRequests.length > 0 ? leaveRequests.map(req => `
    <div class="bg-white border border-slate-200 rounded-lg p-3 text-xs">
      <div class="flex items-start justify-between mb-1">
        <div class="flex-1 pr-2">
          <div class="font-bold text-slate-800">${new Date(req.leave_date).toLocaleDateString('en-MY', {weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'})}</div>
          ${req.notes ? `<div class="text-[10px] text-slate-500 mt-1">${req.notes.replace(/\n/g, '<br>')}</div>` : ''}
        </div>
        <span class="px-2 py-0.5 rounded-full text-[8px] font-semibold border flex-shrink-0 ${statusColors[req.status]}">${req.status}</span>
      </div>
    </div>
  `).join('') : '<p class="text-xs text-slate-400 text-center py-4">No leave requests</p>';
  
  // Generate Replacement Day column HTML
  const replacementHTML = replacementRequests.length > 0 ? replacementRequests.map(req => `
    <div class="bg-white border border-slate-200 rounded-lg p-3 text-xs">
      <div class="flex items-start justify-between mb-1">
        <div class="flex-1 pr-2">
          <div class="font-bold text-slate-800">${new Date(req.leave_date).toLocaleDateString('en-MY', {weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'})}</div>
          ${req.notes ? `<div class="text-[10px] text-slate-500 mt-1">${req.notes.replace(/\n/g, '<br>')}</div>` : ''}
        </div>
        <span class="px-2 py-0.5 rounded-full text-[8px] font-semibold border flex-shrink-0 ${statusColors[req.status]}">${req.status}</span>
      </div>
    </div>
  `).join('') : '<p class="text-xs text-slate-400 text-center py-4">No replacement requests</p>';
  
  // Combine in two-column layout
  container.innerHTML = `
    <div class="grid grid-cols-2 gap-4">
      <div>
        <h4 class="text-xs font-bold text-blue-600 mb-2 flex items-center gap-1">
          <i class="fa-solid fa-calendar-days"></i> Leave
        </h4>
        <div class="space-y-2">
          ${leaveHTML}
        </div>
      </div>
      <div>
        <h4 class="text-xs font-bold text-green-600 mb-2 flex items-center gap-1">
          <i class="fa-solid fa-calendar-plus"></i> Replacement Day
        </h4>
        <div class="space-y-2">
          ${replacementHTML}
        </div>
      </div>
    </div>
  `;
}

// Helper: Show toast
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  const icons = { success: 'check-circle', error: 'exclamation-circle', info: 'info-circle' };
  toast.innerHTML = `<i class="fa-solid fa-${icons[type] || 'info-circle'}"></i><span class="text-xs font-semibold">${message}</span>`;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 200);
  }, 1600);
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initLeaveManagement);
} else {
  initLeaveManagement();
}

// Additional fallback for iframe contexts (Google Sites)
window.addEventListener('load', function() {
  // Re-initialize if button doesn't have content
  const loginBtn = document.getElementById('leaveLoginBtn');
  if (loginBtn && !loginBtn.innerHTML.trim()) {
    console.log('Leave button empty - reinitializing...');
    initLeaveManagement();
  }
});

// Force update button on any interaction (backup for iframe)
setTimeout(() => {
  const loginBtn = document.getElementById('leaveLoginBtn');
  if (loginBtn && !loginBtn.innerHTML.trim()) {
    console.log('Leave button still empty after timeout - forcing update...');
    updateLoginButton();
  }
}, 500);
