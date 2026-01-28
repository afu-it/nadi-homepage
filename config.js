const categories = {
  entrepreneur: {
    label: "Usahawan",
    sub: "Entrepreneurship",
    color: "bg-yellow-100 text-yellow-700 border-yellow-200",
    dot: "bg-yellow-400",
  },
  learning: {
    label: "Pembelajaran Sepanjang Hayat",
    sub: "Lifelong Learning",
    color: "bg-blue-100 text-blue-700 border-blue-200",
    dot: "bg-blue-500",
  },
  wellbeing: {
    label: "Kesejahteraan Kendiri",
    sub: "Wellbeing",
    color: "bg-emerald-100 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-500",
  },
  awareness: {
    label: "Kesedaran",
    sub: "Awareness",
    color: "bg-violet-100 text-violet-700 border-violet-200",
    dot: "bg-violet-500",
  },
  gov: {
    label: "Inisiatif Kerajaan",
    sub: "Gov Initiative",
    color: "bg-red-100 text-red-700 border-red-200",
    dot: "bg-red-500",
  },
};

const subcategories = {
  entrepreneur: ["e-Kelas (Maxis)", "Preneur/EmpowHer", "Kidventure"],
  learning: ["e-Kelas (Maxis)", "Dilea", "Tiny Techies", "e-Sport", "Cybersecurity", "Mahir"],
  wellbeing: ["Care"],
  awareness: ["Safe", "Shield"],
  gov: [],
};

const defaultHolidays = {
  "2026-01-01": "Tahun Baru",
  "2026-02-01": "Thaipusam",
  "2026-02-17": "Tahun Baru Cina",
  "2026-02-18": "Tahun Baru Cina (Hari 2)",
  "2026-03-27": "Nuzul Al-Quran",
  "2026-05-01": "Hari Pekerja",
  "2026-05-31": "Hari Wesak",
  "2026-06-02": "Hari Keputeraan Agong",
  "2026-07-07": "Warisan George Town",
  "2026-07-11": "Hari Jadi Tuan Y.T",
  "2026-08-31": "Hari Merdeka",
  "2026-09-16": "Hari Malaysia",
  "2026-12-25": "Hari Krismas",
};

const defaultSchoolHolidays = {
  "2025-12-20": { name: "Cuti Akhir Tahun 2025-2026", start: "2025-12-20", end: "2026-01-11" },
  "2026-03-20": { name: "Cuti Penggal 1", start: "2026-03-20", end: "2026-03-28" },
  "2026-05-22": { name: "Cuti Pertengahan Tahun", start: "2026-05-22", end: "2026-06-06" },
  "2026-08-28": { name: "Cuti Penggal 2", start: "2026-08-28", end: "2026-09-05" },
  "2026-12-04": { name: "Cuti Akhir Tahun", start: "2026-12-04", end: "2026-12-31" },
};

const platformOptions = ["NES", "Gmeet", "Zoom", "Gform", "Gdrive", "Youtube", "Website", "Jotform"];

const announcementSubcategories = {
  Usahawan: ["eKelas Keusahawanan (Maxis)", "Preneur/EmpowHER", "Kidventure"],
  "Kesejahteraan Kendiri": ["Care"],
  "Kesedaran": ["Safe & Shield"],
  "Inisiatif Kerajaan": [],
  "Pembelajaran Sepanjang Hayat": ["eKelas Maxis", "DiLea", "TinyTechies", "ESPORT", "Cybersecurity", "MAHIR"],
};

// Make all constants available globally
window.categories = categories;
window.subcategories = subcategories;
window.defaultHolidays = defaultHolidays;
window.defaultSchoolHolidays = defaultSchoolHolidays;
window.platformOptions = platformOptions;
window.announcementSubcategories = announcementSubcategories;

// Initialize Supabase client
// Note: auth.storageKey is set to avoid tracking prevention issues
if (typeof window.supabaseClient === 'undefined') {
  window.supabaseClient = window.supabase.createClient(
    'https://xprztwchhoopkpmoiwdh.supabase.co',
    'sb_publishable_1yNJb7umrgVZ_ihVSe6Qsg_Wv29Q_Ap',
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      },
      global: {
        headers: { 'x-application-name': 'nadi-scsh' }
      }
    }
  );
}

