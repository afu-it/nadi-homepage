# NADI Calendar & Leave Management System

A comprehensive calendar and leave management system for NADI Pulau Pinang sites, built with vanilla JavaScript and Supabase.

## 🌟 Features

### 📅 Main Calendar System
- **Visual Calendar** - Monthly view with color-coded indicators
- **Manager Offdays** - Blue line indicators (Saturdays by default)
- **Assistant Manager Offdays** - Green line indicators (Sundays by default)
- **Replacement Days** - Dashed line indicators for offday swaps
- **Public Holidays** - Gray circles with holiday names (13 Malaysian holidays)
- **School Holidays** - Yellow circles with period names (5 school holiday periods)
- **Holiday Filters** - Toggle to show/hide public and school holiday labels
- **Legend** - Visual guide for all calendar indicators

### 👥 Leave Management System
Complete leave request and approval workflow for 18 Pulau Pinang sites:

#### **Sites Covered:**
1. Air Putih
2. Kebun Bunga
3. Pulau Tikus
4. Tanjong Bunga
5. Komtar
6. Padang Kota
7. Pengkalan Kota
8. Batu Lancang
9. Datok Keramat
10. Sungai Pinang
11. Air Itam
12. Paya Terubong
13. Seri Delima
14. Batu Uban
15. Batu Maung
16. Pantai Jerejak
17. Bayan Lepas
18. Pulau Betong

#### **User Roles:**
- **Staff** - 36 users (2 per site: Manager + Assistant Manager)
  - Simple login (select site + role, no password)
  - Submit leave requests
  - View personal request history
- **Supervisors** - 2 users with password authentication
  - Review all leave requests
  - Approve/reject with optional notes
  - Admin panel interface

#### **Leave Request Features:**

**Leave Type:**
- Regular leave requests
- **Validation:** Must confirm SQL HRMS approval by Madam
- Auto-note: "SQL HRMS approved by Madam"

**Replacement Day:**
- Request replacement for working on scheduled offday
- **Validation:** Must select which offday was worked (past dates only)
- Auto-note: "Replacing offday: [date]"

**Request Calendar:**
- Interactive monthly calendar
- Visual indicators:
  - Gray circles = Public holidays (synced from main calendar)
  - Yellow circles = School holidays (synced)
  - Blue line = Manager offdays
  - Green line = Assistant Manager offdays
  - Yellow/Green/Red dots = Leave status (Pending/Approved/Rejected)
- Click any date to submit request
- Cannot request on holidays or past dates
- Real-time updates

**NADI Availability Dashboard:**
- View real-time availability for all 18 sites
- Shows today's staffing status:
  - 🟢 Green = Available (staff is working)
  - 🔴 Red = Not available (offday, leave, or public holiday)
- 3-column grid layout (3×6 = 18 sites)
- Manager and Assistant Manager status side by side
- Auto-refreshes based on:
  - Scheduled offdays
  - Approved leave requests
  - Public holidays

#### **Real-time Sync:**
- Holiday updates from main calendar instantly appear in leave system
- Offday changes automatically sync
- Leave approvals trigger instant UI updates
- Supabase real-time subscriptions for live data

### 📢 Announcements System
- Admin panel for creating announcements
- Display on main calendar
- (Details to be documented)

## 🗂️ Project Structure

```
NADI-Calendar/
├── index.html                 # Main calendar interface + leave modal
├── app.js                     # Main calendar logic (128KB)
├── config.js                  # Default holidays configuration
├── leave-integrated.js        # Leave management system (57KB)
├── leave-system.css           # Leave system styling
├── styles.css                 # Main calendar styles
├── supabase.js                # Supabase client (160KB)
├── announcements.html         # Announcements panel
├── UPDATE-SITES.sql           # Database setup script
├── .gitignore                 # Git ignore rules
└── README.md                  # This file
```

## 🛠️ Technologies

- **Frontend:** Vanilla JavaScript, HTML5, CSS3
- **Styling:** Tailwind CSS (CDN), custom CSS
- **Icons:** Font Awesome 6
- **Database:** Supabase (PostgreSQL)
- **Real-time:** Supabase Realtime subscriptions
- **Authentication:** Custom login system (no password for staff, password for supervisors)

## 🗄️ Database Schema

### Tables:
1. **sites** - 18 Pulau Pinang sites
   - `site_id` (primary key)
   - `site_name`

2. **leave_users** - Staff and supervisors
   - `user_id` (UUID, primary key)
   - `username` (for supervisors only)
   - `full_name`
   - `role` (Manager | Assistant Manager | Supervisor)
   - `site_id` (foreign key to sites)
   - `password_hash` (for supervisors only)
   - `is_active`

3. **leave_requests** - All leave submissions
   - `request_id` (UUID, primary key)
   - `user_id` (foreign key to leave_users)
   - `site_id` (foreign key to sites)
   - `leave_date` (YYYY-MM-DD)
   - `request_type` (Leave | Replacement Day)
   - `status` (Pending | Approved | Rejected)
   - `notes` (text)
   - `requested_at` (timestamp)
   - `reviewed_at` (timestamp)
   - `reviewed_by` (UUID, foreign key to leave_users)
   - `review_notes` (text)

4. **site_settings** - Configuration data
   - `id=1` - Offdays (managerOffdays, assistantManagerOffdays)
   - `id=20` - Public holidays (publicHolidays object)
   - `id=21` - School holidays (schoolHolidays object)

## 📋 Default Holidays

### Public Holidays (13):
1. Tahun Baru (New Year's Day)
2. Thaipusam
3. Tahun Baru Cina (Chinese New Year)
4. Nuzul Al-Quran
5. Hari Pekerja (Labour Day)
6. Hari Wesak (Wesak Day)
7. Hari Keputeraan DYMM Yang di-Pertuan Agong
8. Hari Raya Aidilfitri (2 days)
9. Hari Raya Aidiladha
10. Awal Muharram (Maal Hijrah)
11. Hari Kebangsaan (National Day)
12. Hari Malaysia
13. Hari Natal (Christmas)

### School Holidays (5 periods):
1. Cuti Akhir Tahun (Year-end break)
2. Cuti Penggal Pertama (Mid-term break 1)
3. Cuti Pertengahan Tahun (Mid-year break)
4. Cuti Penggal Kedua (Mid-term break 2)
5. Cuti Peperiksaan (Examination leave)

## 🚀 Setup Instructions

### 1. Supabase Setup
```sql
-- Run UPDATE-SITES.sql to create tables and insert initial data
-- Configure Row Level Security (RLS) policies
-- Enable Realtime for leave_requests table
```

### 2. Supabase Configuration
Update `supabase.js` with your credentials:
```javascript
const SUPABASE_URL = 'your-project-url'
const SUPABASE_ANON_KEY = 'your-anon-key'
```

### 3. Deploy
- Host on any static web server (GitHub Pages, Netlify, Vercel, etc.)
- Or open `index.html` directly in browser for local testing

### 4. Default Credentials
**Supervisors:**
- Username: `supervisor1` / Password: `password123`
- Username: `supervisor2` / Password: `password123`

**Staff:**
- Select site + role (no password required)

## 🎨 UI/UX Features

### Main Calendar:
- Responsive grid layout
- Color-coded indicators for different types
- Hover effects for better UX
- Month navigation with smooth transitions
- Fixed date rollover bugs for accurate month navigation

### Leave System:
- Clean, modern interface
- Modal-based workflows
- Real-time status indicators
- Toast notifications for user feedback
- Validation to prevent invalid requests
- Dynamic form fields based on request type

### NADI Availability:
- Compact 3-column grid
- Visual status indicators (green/red circles)
- All 18 sites visible at once
- Perfect for quick staffing overview

## 📝 Key Functions

### Main Calendar (app.js):
- `saveOffdaySettings()` - Save manager/AM offdays, triggers event
- `savePublicHolidays()` - Save public holidays, triggers event
- `saveSchoolHolidays()` - Save school holidays, triggers event
- Event dispatchers notify leave system of changes

### Leave System (leave-integrated.js):
- `showLeaveLogin()` - Display login modal
- `handleSupervisorLogin()` - Authenticate supervisors
- `handleStaffLogin()` - Authenticate staff (no password)
- `showLeavePanel()` - Show calendar for leave requests
- `requestLeaveForDate()` - Open request modal with validations
- `submitLeaveRequest()` - Validate and submit request
- `showNADIAvailability()` - Display real-time site availability
- `showAdminPanel()` - Supervisor review panel
- `toggleLeaveFields()` - Switch between Leave/Replacement Day fields

## 🐛 Bug Fixes Completed

### Critical Fixes:
1. ✅ **Month Navigation Bug** - Fixed date rollover (Jan 30 → Feb → Mar 2)
   - Solution: Always set day to 1 before changing month
2. ✅ **Holiday Sync Bug** - Holidays not appearing in leave calendar
   - Solution: Added event dispatchers + data format compatibility
3. ✅ **Supabase Join Error** - Multiple relationships error
   - Solution: Fetch data separately and merge manually
4. ✅ **Autofill Extension Conflict** - Browser extension errors on supervisor login
   - Solution: Added `autocomplete="off"` + delayed toast/panel rendering
5. ✅ **Site Column Name Error** - Used `site.name` instead of `site.site_name`
   - Solution: Updated all references to use correct column names

## 🔒 Security Notes

⚠️ **Important:** Current setup uses client-side authentication for demonstration purposes.

### For Production:
- Implement server-side authentication
- Use environment variables for Supabase credentials
- Enable proper Row Level Security (RLS) policies
- Hash supervisor passwords with bcrypt or similar
- Add CSRF protection
- Implement rate limiting for API calls
- Use secure session management

## 📊 Data Flow

### Leave Request Flow:
```
Staff → Select Date → Choose Type → Fill Validations → Submit
                                                            ↓
                                                    Store in Supabase
                                                            ↓
Supervisor → Review Panel → Approve/Reject → Update Status
                                                            ↓
                                    Staff sees updated status (real-time)
```

### Holiday Sync Flow:
```
Admin → Main Calendar → Save Holiday
                            ↓
                    Dispatch Event
                            ↓
            Leave System Listens
                            ↓
                Update Leave Calendar
```

## 🎯 Validation Rules

### Leave Requests:
- ✅ Must confirm SQL HRMS approval by Madam
- ❌ Cannot request on public holidays
- ❌ Cannot request on past dates
- ❌ Cannot have duplicate requests for same date

### Replacement Day Requests:
- ✅ Must select which offday was worked
- ✅ Replacement date must be in the past
- ❌ Cannot request on public holidays
- ❌ Cannot request on past dates

## 📱 Browser Support

Tested and working on:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## 📄 License

[Specify your license here]

## 👥 Credits

Developed for NADI Pulau Pinang

## 🔄 Version History

### v1.0.0 (2026-01-31)
- Initial release
- Complete calendar system with holidays
- Full leave management integration
- NADI availability dashboard
- Real-time sync between systems
- 18 sites, 36 staff users, 2 supervisors

---

**For questions or support, contact [your contact info]**
