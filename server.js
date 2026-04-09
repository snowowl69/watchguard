const express = require('express');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = 3000;

// Ensure directories
['data', 'uploads/faces'].forEach(dir => {
  fs.mkdirSync(path.join(__dirname, dir), { recursive: true });
});

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(session({
  secret: crypto.randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

// ===================== DATABASE =====================
const db = new Database(path.join(__dirname, 'data', 'watchguard.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    full_name TEXT NOT NULL,
    email TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    role TEXT DEFAULT 'user',
    user_type TEXT DEFAULT 'student',
    department TEXT DEFAULT '',
    user_id_code TEXT UNIQUE,
    status TEXT DEFAULT 'pending',
    face_image TEXT DEFAULT '',
    face_descriptor TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    time_in TEXT,
    time_out TEXT,
    location TEXT DEFAULT 'Main Gate',
    status TEXT DEFAULT 'present',
    confidence REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    icon TEXT DEFAULT 'blue',
    message TEXT NOT NULL,
    is_read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// ===================== SEED DATA =====================
const adminExists = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
if (!adminExists) {
  const hash = bcrypt.hashSync('admin123', 10);
  const seedUsers = [
    ['admin', hash, 'Raghav Agarwal', 'raghav@watchguard.io', '+91 98765 43210', 'admin', 'staff', 'Security & Administration', 'WG-ADMIN-001', 'approved'],
    ['amit.kumar', bcrypt.hashSync('password123', 10), 'Amit Kumar', 'amit@college.edu', '+91 91234 56780', 'user', 'student', 'Computer Science', 'WG-2024-0847', 'approved'],
    ['priya.sharma', bcrypt.hashSync('password123', 10), 'Priya Sharma', 'priya@college.edu', '+91 91234 56781', 'user', 'student', 'Electronics', 'WG-2024-0512', 'approved'],
    ['rahul.jain', bcrypt.hashSync('password123', 10), 'Rahul Jain', 'rahul@college.edu', '+91 91234 56782', 'user', 'student', 'Mechanical', 'WG-2024-0331', 'approved'],
    ['neha.singh', bcrypt.hashSync('password123', 10), 'Neha Singh', 'neha@college.edu', '+91 91234 56783', 'user', 'faculty', 'Computer Science', 'WG-2024-0204', 'approved'],
    ['karthik.patel', bcrypt.hashSync('password123', 10), 'Karthik Patel', 'karthik@college.edu', '+91 91234 56784', 'user', 'student', 'Civil', 'WG-2024-0789', 'approved'],
    ['divya.menon', bcrypt.hashSync('password123', 10), 'Divya Menon', 'divya@college.edu', '+91 91234 56785', 'user', 'student', 'Computer Science', 'WG-2024-0615', 'approved'],
    ['suresh.mehta', bcrypt.hashSync('password123', 10), 'Suresh Mehta', 'suresh@college.edu', '+91 91234 56786', 'user', 'staff', 'Administration', 'WG-2024-0423', 'approved'],
    ['vikram.rathore', bcrypt.hashSync('password123', 10), 'Vikram Rathore', 'vikram@college.edu', '+91 91234 56787', 'user', 'student', 'Computer Science', 'WG-2024-1102', 'pending'],
    ['sneha.patel', bcrypt.hashSync('password123', 10), 'Sneha Patel', 'sneha@college.edu', '+91 91234 56788', 'user', 'faculty', 'Electronics', 'WG-2024-1103', 'pending'],
    ['rajesh.gupta', bcrypt.hashSync('password123', 10), 'Rajesh Gupta', 'rajesh@college.edu', '+91 91234 56789', 'user', 'staff', 'Administration', 'WG-2024-1104', 'pending'],
  ];
  const insert = db.prepare(`INSERT INTO users (username,password,full_name,email,phone,role,user_type,department,user_id_code,status) VALUES (?,?,?,?,?,?,?,?,?,?)`);
  for (const u of seedUsers) insert.run(...u);

  // Seed attendance
  const today = new Date().toISOString().slice(0, 10);
  const attInsert = db.prepare('INSERT INTO attendance (user_id,date,time_in,time_out,location,status,confidence) VALUES (?,?,?,?,?,?,?)');
  attInsert.run(2, today, '08:15 AM', null, 'Main Gate', 'present', 97.8);
  attInsert.run(3, today, '08:32 AM', null, 'Parking', 'present', 95.2);
  attInsert.run(4, today, '09:18 AM', null, 'Lobby', 'late', 92.1);
  attInsert.run(5, today, '07:55 AM', '04:30 PM', 'Main Gate', 'present', 98.5);
  attInsert.run(7, today, '08:05 AM', '05:12 PM', 'Main Gate', 'present', 96.3);
  attInsert.run(8, today, '09:45 AM', null, 'Hostel Entry', 'late', 91.0);

  // Seed notifications
  const nInsert = db.prepare('INSERT INTO notifications (type,icon,message,created_at) VALUES (?,?,?,?)');
  const now = new Date();
  nInsert.run('alert', 'red', 'Unauthorized face detected at Hostel Entry', new Date(now - 2*60000).toISOString());
  nInsert.run('checkin', 'green', 'Amit Kumar checked in via Main Gate', new Date(now - 5*60000).toISOString());
  nInsert.run('request', 'blue', 'New face registration request from Vikram R.', new Date(now - 12*60000).toISOString());
  nInsert.run('system', 'yellow', 'Camera 06 reconnected after 3 min downtime', new Date(now - 28*60000).toISOString());

  console.log('  Database seeded with sample data.');
}

// ===================== AUTH MIDDLEWARE =====================
function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
  next();
}
function requireAdmin(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
  if (req.session.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  next();
}

// ===================== AUTH ROUTES =====================
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }
  if (user.status !== 'approved' && user.role !== 'admin') {
    return res.status(403).json({ error: 'Account not yet approved by admin' });
  }
  req.session.userId = user.id;
  req.session.role = user.role;
  const { password: _, face_descriptor: __, ...safe } = user;
  res.json(safe);
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy();
  res.json({ ok: true });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT id,username,full_name,email,phone,role,user_type,department,user_id_code,status,face_image,created_at FROM users WHERE id = ?').get(req.session.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

// ===================== DASHBOARD =====================
app.get('/api/dashboard/stats', requireAuth, (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const totalRegistered = db.prepare("SELECT COUNT(*) as c FROM users WHERE status='approved'").get().c;
  const presentToday = db.prepare('SELECT COUNT(DISTINCT user_id) as c FROM attendance WHERE date=?').get(today).c;
  const unauthorized = db.prepare("SELECT COUNT(*) as c FROM notifications WHERE type='alert' AND date(created_at)=?").get(today).c;
  const pending = db.prepare("SELECT COUNT(*) as c FROM users WHERE status='pending'").get().c;
  res.json({
    totalRegistered,
    presentToday,
    unauthorized,
    activeCameras: 8,
    pending,
    attendanceRate: totalRegistered > 0 ? ((presentToday / totalRegistered) * 100).toFixed(1) : '0.0'
  });
});

// ===================== USERS =====================
app.get('/api/users', requireAuth, (req, res) => {
  const users = db.prepare("SELECT id,username,full_name,email,phone,role,user_type,department,user_id_code,status,face_image,created_at FROM users WHERE status='approved' ORDER BY created_at DESC").all();
  res.json(users);
});

app.get('/api/users/pending', requireAuth, (req, res) => {
  const users = db.prepare("SELECT id,username,full_name,email,phone,role,user_type,department,user_id_code,status,face_image,created_at FROM users WHERE status='pending' ORDER BY created_at DESC").all();
  res.json(users);
});

app.get('/api/users/processed', requireAuth, (req, res) => {
  const users = db.prepare("SELECT id,username,full_name,email,phone,role,user_type,department,user_id_code,status,updated_at FROM users WHERE status IN ('approved','rejected') AND role != 'admin' ORDER BY updated_at DESC LIMIT 5").all();
  res.json(users);
});

app.post('/api/users', (req, res) => {
  const { full_name, id_code, user_type, department, email, phone, face_image, face_descriptor } = req.body;
  if (!full_name) return res.status(400).json({ error: 'Full name is required' });

  const username = full_name.toLowerCase().replace(/[^a-z0-9]/g, '.').replace(/\.+/g, '.') + '.' + Date.now().toString(36);
  const password = bcrypt.hashSync('password123', 10);
  const count = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  const userIdCode = id_code || ('WG-' + new Date().getFullYear() + '-' + String(count + 1).padStart(4, '0'));

  let faceImagePath = '';
  if (face_image && face_image.startsWith('data:image')) {
    const fileName = `face_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.png`;
    const filePath = path.join(__dirname, 'uploads', 'faces', fileName);
    const base64Data = face_image.replace(/^data:image\/\w+;base64,/, '');
    fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
    faceImagePath = `/uploads/faces/${fileName}`;
  }

  try {
    const result = db.prepare(
      `INSERT INTO users (username,password,full_name,email,phone,user_type,department,user_id_code,status,face_image,face_descriptor) VALUES (?,?,?,?,?,?,?,?,'pending',?,?)`
    ).run(username, password, full_name, email || '', phone || '', user_type || 'student', department || '', userIdCode, faceImagePath, face_descriptor ? JSON.stringify(face_descriptor) : '');

    db.prepare("INSERT INTO notifications (type,icon,message) VALUES ('request','blue',?)").run(`New face registration request from ${full_name}`);
    res.json({ id: result.lastInsertRowid, user_id_code: userIdCode });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/users/:id/approve', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id);
  db.prepare("UPDATE users SET status='approved', updated_at=CURRENT_TIMESTAMP WHERE id=?").run(id);
  const user = db.prepare('SELECT full_name FROM users WHERE id=?').get(id);
  if (user) db.prepare("INSERT INTO notifications (type,icon,message) VALUES ('info','green',?)").run(`${user.full_name} has been approved and registered`);
  res.json({ ok: true });
});

app.put('/api/users/:id/reject', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id);
  db.prepare("UPDATE users SET status='rejected', updated_at=CURRENT_TIMESTAMP WHERE id=?").run(id);
  const user = db.prepare('SELECT full_name FROM users WHERE id=?').get(id);
  if (user) db.prepare("INSERT INTO notifications (type,icon,message) VALUES ('info','red',?)").run(`${user.full_name} registration was rejected`);
  res.json({ ok: true });
});

app.delete('/api/users/:id', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id);
  db.prepare('DELETE FROM attendance WHERE user_id=?').run(id);
  db.prepare('DELETE FROM users WHERE id=?').run(id);
  res.json({ ok: true });
});

// ===================== FACES =====================
app.get('/api/faces', requireAuth, (req, res) => {
  const users = db.prepare("SELECT id,full_name,user_id_code,user_type,department,face_descriptor,face_image FROM users WHERE status='approved' AND face_descriptor!=''").all();
  const faces = users.map(u => ({
    id: u.id, name: u.full_name, id_code: u.user_id_code,
    user_type: u.user_type, department: u.department,
    descriptor: u.face_descriptor ? JSON.parse(u.face_descriptor) : null,
    image: u.face_image
  })).filter(f => f.descriptor);
  res.json(faces);
});

app.post('/api/faces/recognize', requireAuth, (req, res) => {
  const { user_id, confidence, location } = req.body;
  if (!user_id) return res.status(400).json({ error: 'User ID required' });

  const today = new Date().toISOString().slice(0, 10);
  const now = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  const isLate = new Date().getHours() >= 9;

  const existing = db.prepare('SELECT id FROM attendance WHERE user_id=? AND date=?').get(user_id, today);
  if (!existing) {
    db.prepare('INSERT INTO attendance (user_id,date,time_in,location,status,confidence) VALUES (?,?,?,?,?,?)').run(
      user_id, today, now, location || 'Main Gate', isLate ? 'late' : 'present', confidence || 0
    );
    const user = db.prepare('SELECT full_name FROM users WHERE id=?').get(user_id);
    if (user) db.prepare("INSERT INTO notifications (type,icon,message) VALUES ('checkin','green',?)").run(`${user.full_name} checked in via ${location || 'Main Gate'}`);
  }
  const user = db.prepare('SELECT id,full_name,user_id_code,user_type,department FROM users WHERE id=?').get(user_id);
  res.json({ ok: true, already: !!existing, user });
});

app.post('/api/faces/alert', requireAuth, (req, res) => {
  const { location } = req.body;
  db.prepare("INSERT INTO notifications (type,icon,message) VALUES ('alert','red',?)").run(`Unauthorized face detected at ${location || 'Unknown Location'}`);
  res.json({ ok: true });
});

// ===================== ATTENDANCE =====================
app.get('/api/attendance', requireAuth, (req, res) => {
  const { date, status, search, department } = req.query;
  let sql = `SELECT a.*, u.full_name, u.user_id_code, u.department, u.user_type FROM attendance a JOIN users u ON a.user_id=u.id WHERE 1=1`;
  const params = [];
  if (date) { sql += ' AND a.date=?'; params.push(date); }
  if (status && status !== 'all') { sql += ' AND a.status=?'; params.push(status); }
  if (search) { sql += ' AND (u.full_name LIKE ? OR u.user_id_code LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
  if (department && department !== 'all') { sql += ' AND u.department=?'; params.push(department); }
  sql += ' ORDER BY a.created_at DESC LIMIT 50';
  const records = db.prepare(sql).all(...params);
  const total = db.prepare('SELECT COUNT(*) as c FROM attendance').get().c;
  res.json({ records, total });
});

app.post('/api/attendance/:id/checkout', requireAuth, (req, res) => {
  const now = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  db.prepare('UPDATE attendance SET time_out=? WHERE id=?').run(now, parseInt(req.params.id));
  res.json({ ok: true });
});

// ===================== NOTIFICATIONS =====================
app.get('/api/notifications', requireAuth, (req, res) => {
  const notifications = db.prepare('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 20').all();
  const unread = db.prepare('SELECT COUNT(*) as c FROM notifications WHERE is_read=0').get().c;
  res.json({ notifications, unread });
});

app.put('/api/notifications/read', requireAuth, (req, res) => {
  db.prepare('UPDATE notifications SET is_read=1 WHERE is_read=0').run();
  res.json({ ok: true });
});

// ===================== PROFILE =====================
app.put('/api/profile', requireAuth, (req, res) => {
  const { full_name, email, phone, department } = req.body;
  db.prepare('UPDATE users SET full_name=?,email=?,phone=?,department=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(
    full_name, email, phone, department, req.session.userId
  );
  res.json({ ok: true });
});

app.put('/api/profile/password', requireAuth, (req, res) => {
  const { current_password, new_password } = req.body;
  const user = db.prepare('SELECT password FROM users WHERE id=?').get(req.session.userId);
  if (!bcrypt.compareSync(current_password, user.password)) return res.status(400).json({ error: 'Current password is incorrect' });
  db.prepare('UPDATE users SET password=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(bcrypt.hashSync(new_password, 10), req.session.userId);
  res.json({ ok: true });
});

// ===================== START =====================
app.listen(PORT, () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════════════╗');
  console.log('  ║   🛡️  Watch Guard Security System v2.4.0     ║');
  console.log(`  ║   Running at http://localhost:${PORT}           ║`);
  console.log('  ║                                              ║');
  console.log('  ║   Admin login:  admin / admin123             ║');
  console.log('  ╚══════════════════════════════════════════════╝');
  console.log('');
});
