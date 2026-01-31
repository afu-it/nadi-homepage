// =====================================================
// NADI Leave Management - Integrated System
// Add this to your existing index.html
// =====================================================

// Global leave management state
let currentLeaveUser = null;
let leaveRequestsCache = [];
let siteAvailabilityCache = [];

// Initialize leave management system
function initLeaveManagement() {
  // Suppress browser extension async errors
  window.addEventListener('unhandledrejection', (event) => {
    if (event.reason?.message?.includes('message channel closed')) {
      event.preventDefault();
    }
  });
  
  // Check if user is logged in
  const savedUser = localStorage.getItem('leave_user');
  if (savedUser) {
    try {
      currentLeaveUser = JSON.parse(savedUser);
      updateLoginButton();
      loadUserLeaveRequests();
      subscribeToLeaveUpdates();
    } catch (error) {
      console.error('Error loading saved user:', error);
      localStorage.removeItem('leave_user');
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
    // Already logged in - show user menu
    showUserMenu();
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
      .select('*')
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
      .select('*, sites(*)')
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
    
    localStorage.setItem('leave_user', JSON.stringify(currentLeaveUser));
    
    // Update UI
    updateLoginButton();
    closeLeaveLogin();
    loadUserLeaveRequests();
    subscribeToLeaveUpdates();
    
    showToast(`Welcome, ${user.full_name}!`, 'success');
    
    // Show leave request panel
    showLeavePanel();
    
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
  
  try {
    // Query supervisor user
    const { data: user, error } = await supabaseClient
      .from('leave_users')
      .select('*')
      .eq('username', username)
      .eq('role', 'Supervisor')
      .eq('is_active', true)
      .single();
    
    if (error || !user) throw new Error('Invalid supervisor credentials');
    if (user.password_hash !== password) throw new Error('Invalid password');
    
    // Save session
    currentLeaveUser = {
      user_id: user.user_id,
      username: user.username,
      full_name: user.full_name,
      role: user.role,
      site_id: null,
      site_name: 'All Sites'
    };
    
    localStorage.setItem('leave_user', JSON.stringify(currentLeaveUser));
    
    // Update UI
    updateLoginButton();
    closeLeaveLogin();
    subscribeToLeaveUpdates();
    
    // Delay toast to avoid autofill extension conflict
    setTimeout(() => {
      showToast(`Welcome, ${user.full_name}!`, 'success');
    }, 100);
    
    // Show admin panel for supervisors (NOT the calendar)
    setTimeout(() => {
      showAdminPanel();
    }, 150);
    
  } catch (error) {
    alert(error.message || 'Login failed');
  }
}

// Show user menu
function showUserMenu() {
  const menu = document.createElement('div');
  menu.className = 'fixed inset-0 z-50 flex items-start justify-end pt-16 pr-4';
  
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
    localStorage.removeItem('leave_user');
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
  console.log('📅 showLeavePanel() called');
  console.log('  Removing existing panels...');
  document.querySelectorAll('.fixed.inset-0.z-50').forEach(el => el.remove());
  
  console.log('  leaveCalendarDate at panel open:', leaveCalendarDate);
  console.log('  Month:', leaveCalendarDate.getMonth(), 'Year:', leaveCalendarDate.getFullYear());
  
  const panel = document.createElement('div');
  panel.className = 'fixed left-0 right-0 top-0 z-50 flex items-start justify-center pt-4 px-4 overflow-y-auto max-h-screen';
  panel.innerHTML = `
    <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onclick="this.parentElement.remove()"></div>
    <div class="relative bg-white rounded-xl shadow-xl w-full max-w-5xl my-4 max-h-[calc(100vh-2rem)] overflow-hidden flex flex-col">
      <div class="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-white">
        <h2 class="text-xl font-bold text-slate-800">Request Leave - ${currentLeaveUser.site_name || ''}</h2>
        <p class="text-sm text-slate-500">${currentLeaveUser.full_name} (${currentLeaveUser.role})</p>
      </div>
      
      <div class="flex-1 overflow-y-auto p-6">
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <!-- Calendar Section -->
          <div class="lg:col-span-2">
            <div class="bg-white rounded-lg border border-slate-200 p-4">
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
          <div class="lg:col-span-1">
            <div class="bg-slate-50 rounded-lg border border-slate-200 p-4">
              <h3 class="text-sm font-bold text-slate-800 mb-3">My Leave Requests</h3>
              <div id="leaveRequestsList" class="space-y-2 max-h-96 overflow-y-auto">
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
        <button onclick="this.closest('.fixed').remove()" class="btn btn-secondary btn-sm">Close</button>
      </div>
    </div>
  `;
  document.body.appendChild(panel);
  
  // Add event listeners for month navigation using event delegation on the panel
  // This prevents duplicate listeners when panel is re-opened
  const prevBtn = document.getElementById('leaveCalendarPrev');
  const nextBtn = document.getElementById('leaveCalendarNext');
  
  console.log('🔹 Setting up navigation buttons');
  console.log('  Current leaveCalendarDate:', leaveCalendarDate);
  console.log('  Current month:', leaveCalendarDate.getMonth(), '(0=Jan, 1=Feb, etc.)');
  console.log('  Current year:', leaveCalendarDate.getFullYear());
  
  if (prevBtn) {
    let isNavigating = false;
    prevBtn.onclick = function(e) {
      console.log('⬅️ PREV BUTTON CLICKED');
      console.log('  isNavigating flag:', isNavigating);
      e.stopPropagation();
      if (isNavigating) {
        console.log('  ❌ Blocked - already navigating');
        return;
      }
      isNavigating = true;
      prevBtn.classList.add('opacity-50', 'cursor-wait');
      
      console.log('  Before change - Month:', leaveCalendarDate.getMonth());
      // Fix: Set to day 1 to prevent rollover issues
      leaveCalendarDate.setDate(1);
      leaveCalendarDate.setMonth(leaveCalendarDate.getMonth() - 1);
      console.log('  After change - Month:', leaveCalendarDate.getMonth());
      
      setTimeout(() => {
        prevBtn.classList.remove('opacity-50', 'cursor-wait');
        isNavigating = false;
        console.log('  ✅ Navigation cooldown cleared');
      }, 150);
      renderLeaveCalendar();
    };
    console.log('✅ Prev button handler attached');
  } else {
    console.log('❌ Prev button not found!');
  }
  
  if (nextBtn) {
    let isNavigating = false;
    nextBtn.onclick = function(e) {
      console.log('➡️ NEXT BUTTON CLICKED');
      console.log('  isNavigating flag:', isNavigating);
      e.stopPropagation();
      if (isNavigating) {
        console.log('  ❌ Blocked - already navigating');
        return;
      }
      isNavigating = true;
      nextBtn.classList.add('opacity-50', 'cursor-wait');
      
      console.log('  Before change - Month:', leaveCalendarDate.getMonth(), 'Year:', leaveCalendarDate.getFullYear());
      // Fix: Set to day 1 to prevent rollover issues (e.g., Jan 31 -> Feb 31 -> Mar 3)
      leaveCalendarDate.setDate(1);
      leaveCalendarDate.setMonth(leaveCalendarDate.getMonth() + 1);
      console.log('  After change - Month:', leaveCalendarDate.getMonth(), 'Year:', leaveCalendarDate.getFullYear());
      
      setTimeout(() => {
        nextBtn.classList.remove('opacity-50', 'cursor-wait');
        isNavigating = false;
        console.log('  ✅ Navigation cooldown cleared');
      }, 150);
      renderLeaveCalendar();
    };
    console.log('✅ Next button handler attached');
  } else {
    console.log('❌ Next button not found!');
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
  console.log(`🎛️ Toggle ${type} holiday:`, value);
  if (type === 'public') {
    leaveCalendarFilters.showPublicHolidays = value;
  } else if (type === 'school') {
    leaveCalendarFilters.showSchoolHolidays = value;
  }
  renderLeaveCalendar();
}

// Load and display user leave requests
async function loadUserLeaveRequests() {
  if (!currentLeaveUser) return;
  
  try {
    const { data, error } = await supabaseClient
      .from('leave_requests')
      .select('*')
      .eq('user_id', currentLeaveUser.user_id)
      .order('leave_date', { ascending: false });
    
    if (error) throw error;
    
    leaveRequestsCache = data || [];
    displayUserLeaveRequests();
    
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
  
  if (leaveRequestsCache.length === 0) {
    container.innerHTML = `
      <div class="text-center py-8">
        <i class="fa-solid fa-calendar-xmark text-3xl text-slate-300 mb-2"></i>
        <p class="text-xs text-slate-500">No requests yet</p>
      </div>
    `;
    return;
  }
  
  const html = leaveRequestsCache.slice(0, 10).map(req => `
    <div class="bg-white border border-slate-200 rounded-lg p-3 text-xs">
      <div class="font-bold text-slate-800 mb-1">${new Date(req.leave_date).toLocaleDateString('en-MY', {month: 'short', day: 'numeric'})}</div>
      <div class="flex items-center gap-1 mb-1">
        <span class="status-badge badge-${req.status.toLowerCase().replace(' ', '-')} text-[8px]">${req.status}</span>
        <span class="text-[8px] text-slate-500">${req.request_type}</span>
      </div>
      <button onclick="cancelLeaveRequest('${req.request_id}')" class="text-red-600 hover:bg-red-50 px-2 py-1 rounded text-[8px] mt-1">
        <i class="fa-solid fa-trash text-[8px]"></i> Cancel
      </button>
    </div>
  `).join('');
  
  container.innerHTML = html;
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
  console.log('🎨 renderLeaveCalendar() called');
  
  const year = leaveCalendarDate.getFullYear();
  const month = leaveCalendarDate.getMonth();
  
  console.log('  Rendering for Year:', year, 'Month:', month, '(' + ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][month] + ')');
  
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
    const leaveRequest = leaveRequestsCache.find(r => r.leave_date === dateStr);
    
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
    cell.className = `min-h-[48px] w-full rounded-lg flex flex-col items-center justify-center transition-all relative py-1 ${
      isPast ? 'bg-slate-50 text-slate-300 cursor-not-allowed' : 
      isToday ? 'bg-blue-50 ring-2 ring-blue-500 cursor-pointer' :
      leaveRequest ? 
        leaveRequest.status === 'Pending' ? 'bg-yellow-100 border border-yellow-400 cursor-pointer' :
        leaveRequest.status === 'Approved' ? 'bg-green-100 border border-green-400 cursor-pointer' :
        'bg-red-100 border border-red-400 cursor-not-allowed' :
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
    
    // Add leave status indicator dot
    if (leaveRequest) {
      const statusDot = document.createElement('span');
      statusDot.className = `absolute top-1 right-1 w-2 h-2 rounded-full ${
        leaveRequest.status === 'Pending' ? 'bg-yellow-500' :
        leaveRequest.status === 'Approved' ? 'bg-green-500' : 'bg-red-500'
      }`;
      cell.appendChild(statusDot);
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
}

// Subscribe to realtime leave updates
function subscribeToLeaveUpdates() {
  if (!currentLeaveUser) return;
  
  // Use new Supabase Realtime API (v2)
  supabaseClient
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
        loadUserLeaveRequests();
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
  const existingRequest = leaveRequestsCache.find(r => r.leave_date === dateStr);
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
  modal.className = 'fixed inset-0 z-[60] flex items-center justify-center p-4';
  modal.innerHTML = `
    <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onclick="this.parentElement.remove()"></div>
    <div class="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6">
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
            <span class="font-semibold">I confirm that I have applied in SQL HRMS and been approved by Madam</span>
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
        <button onclick="this.closest('.fixed').remove()" class="flex-1 btn btn-secondary">Cancel</button>
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
      alert('Please confirm that you have applied in SQL HRMS and been approved by Madam');
      return;
    }
  } else if (requestType === 'Replacement Day') {
    // Check replacement offday date
    const replacementDate = document.getElementById('replacementOffdayDate').value;
    if (!replacementDate) {
      alert('Please select which offday you are replacing');
      return;
    }
    
    // Validate that replacement date is in the past
    const today = new Date().toISOString().split('T')[0];
    if (replacementDate > today) {
      alert('Replacement offday must be a past date (the offday you already worked on)');
      return;
    }
  }
  
  // Build notes with additional info
  let finalNotes = notes;
  if (requestType === 'Replacement Day') {
    const replacementDate = document.getElementById('replacementOffdayDate').value;
    const formattedDate = new Date(replacementDate).toLocaleDateString('en-MY', {weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'});
    finalNotes = `Replacing offday: ${formattedDate}` + (notes ? `\n${notes}` : '');
  } else if (requestType === 'Leave') {
    finalNotes = 'SQL HRMS approved by Madam' + (notes ? `\n${notes}` : '');
  }
  
  try {
    const { data, error } = await supabaseClient
      .from('leave_requests')
      .insert({
        user_id: currentLeaveUser.user_id,
        site_id: currentLeaveUser.site_id,
        leave_date: dateStr,
        request_type: requestType,
        notes: finalNotes || null
      });
    
    if (error) throw error;
    
    showToast(`${requestType} request submitted!`, 'success');
    
    // Close modal
    document.querySelectorAll('.fixed.inset-0.z-\\[60\\]').forEach(el => el.remove());
    
    // Reload data
    await loadUserLeaveRequests();
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
    loadUserLeaveRequests();
    
  } catch (error) {
    alert('Failed to cancel request');
  }
}

// Show NADI Availability across all sites
async function showNADIAvailability() {
  // Get today's date in YYYY-MM-DD format
  const today = new Date().toISOString().split('T')[0];
  
  // Fetch all sites
  const { data: sites, error: sitesError } = await supabaseClient
    .from('sites')
    .select('*')
    .order('site_name');
    
  if (sitesError) {
    showToast('Failed to load sites', 'error');
    return;
  }
  
  // Fetch all leave requests for today (approved only)
  const { data: leaveRequests, error: leaveError } = await supabaseClient
    .from('leave_requests')
    .select('user_id, site_id')
    .eq('leave_date', today)
    .eq('status', 'Approved');
    
  if (leaveError) {
    console.error('Failed to load leave requests:', leaveError);
  }
  
  // Fetch all users
  const { data: users, error: usersError } = await supabaseClient
    .from('leave_users')
    .select('*')
    .neq('role', 'Supervisor');
    
  if (usersError) {
    console.error('Failed to load users:', usersError);
  }
  
  // Fetch site settings to get offdays
  const { data: settings } = await supabaseClient
    .from('site_settings')
    .select('*')
    .in('id', [1, 20]);
    
  const offdaySettings = settings?.find(s => s.id === 1) || {};
  const publicHolidaySettings = settings?.find(s => s.id === 20) || {};
  
  const managerOffdays = offdaySettings.managerOffdays || [];
  const amOffdays = offdaySettings.assistantManagerOffdays || [];
  const publicHolidays = publicHolidaySettings.publicHolidays || {};
  
  // Check if today is a public holiday
  const isPublicHolidayToday = publicHolidays.hasOwnProperty(today);
  
  // Build site availability data
  const siteAvailability = sites.map(site => {
    // Find manager and AM for this site
    const manager = users?.find(u => u.site_id === site.site_id && u.role === 'Manager');
    const am = users?.find(u => u.site_id === site.site_id && u.role === 'Assistant Manager');
    
    // Check if manager is available
    const managerOffToday = managerOffdays.includes(today);
    const managerOnLeave = leaveRequests?.some(r => r.user_id === manager?.user_id && r.site_id === site.site_id);
    const managerAvailable = !managerOffToday && !managerOnLeave && !isPublicHolidayToday;
    
    // Check if AM is available
    const amOffToday = amOffdays.includes(today);
    const amOnLeave = leaveRequests?.some(r => r.user_id === am?.user_id && r.site_id === site.site_id);
    const amAvailable = !amOffToday && !amOnLeave && !isPublicHolidayToday;
    
    return {
      siteName: site.site_name,
      managerAvailable,
      amAvailable
    };
  });
  
  // Remove any existing modals
  document.querySelectorAll('.fixed.inset-0.z-50').forEach(el => el.remove());
  
  // Create modal
  const modal = document.createElement('div');
  modal.className = 'fixed left-0 right-0 top-0 z-50 flex items-start justify-center pt-4 px-4 overflow-y-auto max-h-screen';
  modal.innerHTML = `
    <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onclick="this.parentElement.remove()"></div>
    <div class="relative bg-white rounded-xl shadow-xl w-full max-w-3xl my-4 max-h-[calc(100vh-2rem)] overflow-hidden flex flex-col">
      <div class="px-4 py-3 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-white">
        <h2 class="text-base font-bold text-slate-800">NADI Availability Today</h2>
        <p class="text-xs text-slate-500">${new Date().toLocaleDateString('en-MY', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>
      <div class="flex-1 overflow-y-auto p-4">
        <div class="grid grid-cols-3 gap-2">
          ${siteAvailability.map(site => `
            <div class="bg-slate-50 rounded-lg border border-slate-200 p-2.5">
              <h3 class="text-xs font-bold mb-2"><span style="color: #2228a4;">NADI</span> <span class="text-slate-800">${site.siteName}</span></h3>
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
        <button onclick="this.closest('.fixed').remove()" class="btn btn-secondary btn-sm text-xs px-3 py-1">Close</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
}

// Show admin panel (for supervisors)
function showAdminPanel() {
  if (currentLeaveUser?.role !== 'Supervisor') return;
  
  document.querySelectorAll('.fixed.inset-0.z-50').forEach(el => el.remove());
  
  const panel = document.createElement('div');
  panel.className = 'fixed left-0 right-0 top-0 z-50 flex items-start justify-center pt-4 px-4 overflow-y-auto max-h-screen';
  panel.innerHTML = `
    <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onclick="this.parentElement.remove()"></div>
    <div class="relative bg-white rounded-xl shadow-xl w-full max-w-5xl my-4 max-h-[calc(100vh-2rem)] overflow-hidden flex flex-col">
      <div class="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-purple-50 to-white">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-xl font-bold text-slate-800">Manage Leave Requests</h2>
            <p class="text-sm text-slate-500">Review and approve staff leave requests</p>
          </div>
          <button onclick="showDeletionLog()" class="btn btn-secondary btn-sm">
            <i class="fa-solid fa-history"></i> View Deletion Log
          </button>
        </div>
      </div>
      <div class="flex-1 overflow-y-auto p-6">
        <div id="adminRequestsList">
          <div class="text-center py-8"><div class="spinner mx-auto"></div></div>
        </div>
      </div>
      <div class="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end">
        <button onclick="this.closest('.fixed').remove()" class="btn btn-secondary btn-sm">Close</button>
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
      .select('*')
      .order('requested_at', { ascending: false });
    
    if (requestsError) throw requestsError;
    
    // If no requests, show empty
    if (!requests || requests.length === 0) {
      displayAdminRequests([]);
      return;
    }
    
    // Get user IDs from requests
    const userIds = [...new Set(requests.map(r => r.user_id))];
    const siteIds = [...new Set(requests.map(r => r.site_id))];
    
    // Fetch users and sites separately
    const { data: users, error: usersError } = await supabaseClient
      .from('leave_users')
      .select('user_id, full_name, role, site_id')
      .in('user_id', userIds);
    
    if (usersError) throw usersError;
    
    const { data: sites, error: sitesError } = await supabaseClient
      .from('sites')
      .select('site_id, site_name')
      .in('site_id', siteIds);
    
    if (sitesError) throw sitesError;
    
    // Create lookup maps
    const userMap = new Map(users.map(u => [u.user_id, u]));
    const siteMap = new Map(sites.map(s => [s.site_id, s]));
    
    // Merge data into requests
    const mergedRequests = requests.map(req => ({
      ...req,
      leave_users: userMap.get(req.user_id) || { full_name: 'Unknown', role: 'Unknown' },
      sites: siteMap.get(req.site_id) || { site_name: 'Unknown' }
    }));
    
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
  
  const pending = requests.filter(r => r.status === 'Pending');
  const others = requests.filter(r => r.status !== 'Pending');
  
  container.innerHTML = `
    <div class="mb-6">
      <h3 class="text-lg font-bold text-slate-800 mb-3">Pending Requests (${pending.length})</h3>
      ${pending.length === 0 ? '<p class="text-slate-500 text-sm">No pending requests</p>' : `
        <div class="space-y-2">
          ${pending.map(req => renderAdminRequestCard(req)).join('')}
        </div>
      `}
    </div>
    <div>
      <h3 class="text-lg font-bold text-slate-800 mb-3">Recent History</h3>
      <div class="space-y-2">
        ${others.slice(0, 10).map(req => renderAdminRequestCard(req)).join('')}
      </div>
    </div>
  `;
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
          ${req.notes ? `<div class="text-xs text-slate-500 mb-2"><i class="fa-solid fa-note-sticky mr-1"></i> ${req.notes}</div>` : ''}
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

// Helper: Show toast
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  const icons = { success: 'check-circle', error: 'exclamation-circle', info: 'info-circle' };
  toast.innerHTML = `<i class="fa-solid fa-${icons[type] || 'info-circle'}"></i><span class="text-sm font-semibold">${message}</span>`;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
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
