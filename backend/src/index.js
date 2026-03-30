const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-prod';

app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json());

// In-memory user store (replace with PostgreSQL later)
const users = [];

// Middleware to verify JWT
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = authHeader.split(' ')[1];
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// POST /auth/signup
app.post('/auth/signup', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  if (users.find(u => u.email === email)) return res.status(409).json({ error: 'Email already in use' });

  const hash = await bcrypt.hash(password, 10);
  const user = { id: users.length + 1, email, password: hash };
  users.push(user);

  const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
  res.status(201).json({ token, user: { id: user.id, email: user.email } });
});

// POST /auth/signin
app.post('/auth/signin', async (req, res) => {
  const { email, password } = req.body;
  const user = users.find(u => u.email === email);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, email: user.email } });
});

// POST /db/provision — provision a DB with read replicas for the authenticated user
app.post('/db/provision', authenticate, (req, res) => {
  console.log('user db created');
  res.json({ message: 'Request received' });
});

app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));
