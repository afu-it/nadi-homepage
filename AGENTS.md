# AGENTS.md - NADI Calendar & Leave Management System

## Project Overview
A vanilla JavaScript calendar and leave management system for NADI Pulau Pinang sites (18 locations). Uses Supabase as backend. No build tools or package manager - static files served directly.

## Technology Stack
- **Frontend:** HTML5, Vanilla JavaScript (ES6+), Tailwind CSS (CDN)
- **Backend:** Supabase (PostgreSQL + Realtime)
- **Icons:** Font Awesome 6.4.0 (CDN)
- **Sanitization:** DOMPurify (CDN)
- **No bundler/build step** - direct browser execution

## Build/Lint/Test Commands

### Development Server
```bash
# Using VS Code Live Server (recommended)
# Right-click index.html -> "Open with Live Server"

# Or using Python
python -m http.server 5500

# Or using Node.js
npx serve -p 5500
```

### Syntax Checking
```bash
# Check individual JavaScript file
node --check leave-integrated.js
node --check app.js
node --check config.js

# Check all JS files
node --check leave-integrated.js && node --check app.js && node --check config.js
```

### No Formal Test Suite
This project has no automated tests. Manual testing required:
1. Open `index.html` in browser
2. Triple-click header logo to access Site Settings
3. Test leave management via Leave Management button

## File Structure
```
├── index.html           # Main calendar page
├── app.js               # Main calendar logic (~3400 lines)
├── leave-integrated.js  # Leave management system (~2700 lines)
├── config.js            # Constants, categories, Supabase client
├── supabase.js          # Supabase client library (CDN bundle)
├── styles.css           # Main calendar styles
├── leave-system.css     # Leave management styles
├── announcements.html   # Announcements admin page
└── README.md            # Project documentation
```

## Code Style Guidelines

### JavaScript Conventions

#### Naming
- **Functions:** camelCase, verb prefix (`loadData`, `renderCalendar`, `handleClick`)
- **Async functions:** Always prefixed with action verb (`async function loadUserLeaveRequests()`)
- **Variables:** camelCase (`currentMonth`, `leaveRequestsCache`)
- **Constants:** camelCase for objects, UPPER_SNAKE for primitives (`window.DEBUG_MODE`)
- **DOM IDs:** camelCase (`leaveCalendarGrid`, `settingsModal`)
- **CSS Classes:** kebab-case (`offday-line-m`, `replacement-connector`)

#### Functions
```javascript
// Async function with try-catch
async function loadData() {
  try {
    const { data, error } = await supabaseClient.from('table').select('*');
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error loading data:', error);
    showToast('Error loading data', 'error');
  }
}

// Sync function
function renderCalendar() {
  const grid = document.getElementById('calendarGrid');
  if (!grid) return;
  // ... implementation
}
```

#### Error Handling
- Always wrap Supabase calls in try-catch
- Use `if (error) throw error;` pattern for Supabase errors
- Show user-friendly errors via `showToast(message, 'error')`
- Log technical errors with `console.error()`
- Use `window.DEBUG_MODE` guard for verbose logging

#### DOM Manipulation
```javascript
// Prefer getElementById for single elements
const element = document.getElementById('myElement');
if (!element) return;  // Always null-check

// Use template literals for HTML generation
container.innerHTML = `
  <div class="card">
    <span>${escapedValue}</span>
  </div>
`;

// Escape user input before rendering
${req.notes ? `<div>${req.notes.replace(/\n/g, '<br>')}</div>` : ''}
```

#### Event Listeners
```javascript
// Use onclick for dynamically generated HTML
<button onclick="handleAction('${id}')">Click</button>

// Use addEventListener for static elements
document.getElementById('btn').addEventListener('click', handler);

// Debounce resize handlers
let resizeTimeout;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => { /* handler */ }, 100);
});
```

### CSS Conventions

#### Class Naming (leave-system.css)
```css
/* Component: .component-name */
.offday-line-m { }
.offday-line-am { }

/* Modifier: .component-name-modifier */
.replacement-line-m-orange { }
.replacement-line-am-orange-upper { }

/* State: .state-name */
.badge-pending { }
.badge-approved { }
```

#### Tailwind Usage
- Use Tailwind classes inline for layout and spacing
- Use custom CSS for complex animations and pseudo-elements
- Common patterns: `flex`, `grid`, `gap-*`, `p-*`, `m-*`, `rounded-*`

### Supabase Patterns

#### Database IDs (site_settings table)
| ID | Purpose |
|----|---------|
| 1  | Basic config (title, subtitle) |
| 10 | Manager offdays array |
| 11 | Assistant Manager offdays array |
| 12 | Manager replacements array |
| 13 | AM replacements array |
| 20 | Public holidays object |
| 21 | School holidays object |
| 30 | Custom sections array |
| 99 | Full backup |

#### Query Pattern
```javascript
const { data, error } = await supabaseClient
  .from('table_name')
  .select('*')
  .eq('column', value)
  .order('column', { ascending: true });

if (error) throw error;
```

## Important Implementation Notes

### Modal System
- Use `z-50` for standard modals, `z-[60]` for nested modals
- Always add backdrop blur: `bg-slate-900/60 backdrop-blur-sm`
- Close with specific ID targeting, not `this.closest('.fixed').remove()`

### Date Formatting
```javascript
// Standard date string format: YYYY-MM-DD
const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

// Display format
new Date(dateStr).toLocaleDateString('en-MY', {
  weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
});
```

### Color Codes
- **Manager:** Blue `#00aff0` (`bg-blue-*`, `text-blue-*`)
- **Assistant Manager:** Green `#90cf53` (`bg-green-*`, `text-green-*`)
- **Replacement (staff):** Orange `#ff8c00`
- **Pending:** Yellow (`bg-yellow-*`)
- **Approved:** Green (`bg-green-*`)
- **Rejected:** Red (`bg-red-*`)

## Common Pitfalls to Avoid

1. **Don't use `console.log` in production** - use `if (window.DEBUG_MODE) console.log()`
2. **Don't add event listeners in loops** - they accumulate on each call
3. **Always null-check DOM elements** before accessing properties
4. **Escape user input** when rendering to prevent XSS
5. **Use specific IDs for modals** to avoid removing wrong elements
6. **Don't store sensitive data in localStorage** except session tokens
