# NADI Calendar & Leave Management System

A comprehensive calendar and leave management system built with vanilla JavaScript and Supabase.

## 🌟 Features

### 📅 Calendar System
- **Visual Calendar** - Monthly view with color-coded indicators
- **Manager Offdays** - Blue line indicators
- **Assistant Manager Offdays** - Green line indicators
- **Replacement Days** - Dashed line indicators for offday swaps
- **Public Holidays** - Gray circles with holiday names
- **School Holidays** - Yellow circles with period names
- **Holiday Filters** - Toggle to show/hide holiday labels
- **Legend** - Visual guide for all calendar indicators

### 👥 Leave Management System
Complete leave request and approval workflow for multiple sites.

#### **User Roles:**
- **Staff** - Submit leave requests and view personal history
  - Simple login (select site + role, no password)
  - Submit leave requests
  - View request status
  
- **Supervisors** - Manage all leave requests
  - Password-protected login
  - Review and approve/reject requests
  - Admin panel interface

#### **Leave Request Features:**

**Leave Types:**
1. **Regular Leave**
   - Standard leave requests
   - Requires validation confirmation
   
2. **Replacement Day**
   - Request replacement for working on scheduled offday
   - Must select which offday was worked (past dates only)

**Request Calendar:**
- Interactive monthly calendar
- Visual indicators:
  - Gray circles = Public holidays
  - Yellow circles = School holidays
  - Blue line = Manager offdays
  - Green line = Assistant Manager offdays
  - Status dots = Leave status (Pending/Approved/Rejected)
- Real-time updates via Supabase

**Availability Dashboard:**
- View real-time availability for all sites
- Shows today's staffing status:
  - 🟢 Green = Staff available
  - 🔴 Red = Staff not available (offday/leave/holiday)
- Grid layout showing all sites at once
- Auto-updates based on schedules and approvals

#### **Real-time Sync:**
- Holiday updates instantly appear across system
- Offday changes automatically sync
- Leave approvals trigger instant UI updates
- Powered by Supabase Realtime subscriptions

### 📢 Announcements System
- Admin panel for creating announcements
- Display on main calendar

## 🗂️ Project Structure

```
├── index.html                 # Main calendar interface
├── app.js                     # Main calendar logic
├── config.js                  # Configuration and defaults
├── leave-integrated.js        # Leave management system
├── password-utils.js          # Password security utilities
├── leave-system.css           # Leave system styling
├── styles.css                 # Main calendar styles
├── supabase.js                # Supabase client library
├── announcements.html         # Announcements panel
├── supabase.config.example.js # Supabase credentials template
├── .gitignore                 # Git ignore rules
├── AGENTS.md                  # AI coding guidelines
└── README.md                  # This file
```

## 🛠️ Technologies

- **Frontend:** Vanilla JavaScript (ES6+), HTML5, CSS3
- **Styling:** Tailwind CSS (CDN v4), Custom CSS
- **Icons:** Font Awesome 6.4.0
- **Database:** Supabase (PostgreSQL)
- **Real-time:** Supabase Realtime subscriptions
- **Security:** PBKDF2-SHA256 password hashing, rate limiting
- **No build tools** - Static files served directly

## 🗄️ Database Schema

### Tables:

**1. sites** - Site information
- `site_id` (primary key)
- `site_name`

**2. leave_users** - Staff and supervisors
- `user_id` (UUID, primary key)
- `username` (for supervisors)
- `full_name`
- `role` (Manager | Assistant Manager | Supervisor)
- `site_id` (foreign key to sites)
- `password_hash` (for supervisors)
- `is_active` (boolean)

**3. leave_requests** - Leave submissions
- `request_id` (UUID, primary key)
- `user_id` (foreign key)
- `site_id` (foreign key)
- `leave_date` (YYYY-MM-DD)
- `request_type` (Leave | Replacement Day)
- `status` (Pending | Approved | Rejected)
- `notes` (text)
- `replacement_offday_date` (for Replacement Day type)
- `requested_at` (timestamp)
- `reviewed_at` (timestamp)
- `reviewed_by` (UUID, foreign key)
- `review_notes` (text)

**4. site_settings** - Configuration data
- ID 1: Basic config (title, subtitle)
- ID 10: Manager offdays array
- ID 11: Assistant Manager offdays array
- ID 12: Manager replacements array
- ID 13: AM replacements array
- ID 20: Public holidays object
- ID 21: School holidays object
- ID 30: Custom sections array
- ID 99: Full backup

## 🚀 Setup Instructions

### 1. Clone Repository
```bash
git clone <your-repo-url>
cd <repo-name>
```

### 2. Supabase Setup

Create a Supabase project at https://supabase.com

**Create the required tables:**
```sql
-- Run your database setup script
-- Enable Row Level Security (RLS) on all tables
-- Enable Realtime for leave_requests table
```

**Configure RLS Policies:**
```sql
-- Example: Allow public read access to sites
CREATE POLICY "Allow public read" ON sites FOR SELECT USING (true);

-- Configure policies for leave_users, leave_requests, etc.
```

### 3. Configure Credentials

Copy the example config file:
```bash
cp supabase.config.example.js supabase.config.js
```

Edit `supabase.config.js` with your Supabase credentials:
```javascript
const SUPABASE_CONFIG = {
  url: 'https://your-project.supabase.co',
  anonKey: 'your-anon-key-here',
  // ...
};
```

**⚠️ IMPORTANT:** Never commit `supabase.config.js` to version control!

### 4. Run Locally

Open with a local server (required for JavaScript modules):

**Option 1: VS Code Live Server**
- Right-click `index.html` → "Open with Live Server"

**Option 2: Python**
```bash
python -m http.server 5500
```

**Option 3: Node.js**
```bash
npx serve -p 5500
```

Then open: `http://localhost:5500`

### 5. Initial Setup in Database

**Create supervisor users:**
```sql
INSERT INTO leave_users (username, full_name, role, password_hash, is_active)
VALUES 
  ('admin', 'Administrator', 'Supervisor', 'your_hashed_password', true);
```

**Create sites and staff users as needed.**

### 6. Deploy

Deploy to any static hosting:
- **GitHub Pages** - Push to `gh-pages` branch
- **Netlify** - Connect GitHub repo
- **Vercel** - Import project
- **Cloudflare Pages** - Connect repository

**Deployment Checklist:**
- ✅ Ensure `supabase.config.js` is in `.gitignore`
- ✅ Set `window.DEBUG_MODE = false` in production
- ✅ Verify RLS policies are enabled
- ✅ Test all features in production environment

## 🔒 Security Features

### Password Security
- **Algorithm:** PBKDF2-SHA256
- **Iterations:** 100,000 (OWASP 2024 standard)
- **Random salt:** 16 bytes per password
- **Constant-time comparison:** Prevents timing attacks
- **Backward compatible:** Supports legacy passwords with warnings

### Rate Limiting
- **Max attempts:** 5 failed logins
- **Lockout duration:** 15 minutes
- **Auto-reset:** After 15 minutes of inactivity
- **User feedback:** Shows remaining attempts

### Data Protection
- **Client-side hashing:** Never send plain text passwords
- **Row Level Security:** Database-level access control
- **No credentials in code:** Uses separate config file
- **Session management:** localStorage (non-sensitive data only)

## 🎨 UI/UX Features

### Main Calendar:
- Responsive grid layout
- Color-coded indicators
- Hover effects for better UX
- Month navigation
- Holiday filters

### Leave System:
- Clean, modern interface
- Modal-based workflows
- Real-time status indicators
- Toast notifications
- Form validation
- Dynamic fields based on request type

### Availability Dashboard:
- Compact grid layout
- Visual status indicators (green/red)
- All sites visible at once
- Quick staffing overview

## 📋 Validation Rules

### Leave Requests:
- ✅ Must confirm approval
- ❌ Cannot request on public holidays
- ❌ Cannot request on past dates
- ❌ No duplicate requests for same date

### Replacement Day Requests:
- ✅ Must select which offday was worked
- ✅ Offday worked must be in the past
- ❌ Cannot request on public holidays
- ❌ Cannot request on past dates

## 📱 Browser Support

Tested and working on:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## 🐛 Troubleshooting

### Application not loading?
- Check browser console for errors
- Verify `supabase.config.js` exists with valid credentials
- Ensure you're running on a local server (not file://)

### Login not working?
- Verify database connection
- Check RLS policies are configured
- Ensure users exist in database
- Check for rate limiting (wait 15 minutes if locked)

### Real-time updates not working?
- Enable Realtime in Supabase dashboard for `leave_requests` table
- Check browser console for WebSocket connection errors

## 📄 License

MIT License - See LICENSE file for details

## 👥 Contributing

Contributions are welcome! Please follow the coding guidelines in `AGENTS.md`.

## 🔄 Version History

### v1.0.0 (2026-02-03)
- Initial release
- Complete calendar system with holidays
- Full leave management integration
- Availability dashboard
- Real-time sync
- Secure password authentication
- Rate limiting protection

---

**Need help?** Check the code comments or open an issue.
