require('dotenv').config();
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');

const db = require('./db');
const { maskSensitiveData } = require('./utils/masker');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// --- Authentication Routes ---
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await db.query(
      `INSERT INTO users (username, email, password)
       VALUES ($1, $2, $3)
       RETURNING id, username, email`,
      [username, email.toLowerCase().trim(), hashedPassword]
    );

    const user = result.rows[0];
    const token = jwt.sign({ userId: user.id, username: user.username }, process.env.JWT_SECRET);
    res.json({ token, user: { id: user.id, username: user.username } });
  } catch (err) {
    res.status(400).json({ error: 'Registration failed. Username or email may already exist.' });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const result = await db.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase().trim()]);
  const user = result.rows[0];

  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ error: 'Invalid credentials.' });
  }

  const token = jwt.sign({ userId: user.id, username: user.username }, process.env.JWT_SECRET);
  res.json({ token, user: { id: user.id, username: user.username } });
});

// Fetch contacts/users
app.get('/api/users', async (req, res) => {
  const result = await db.query('SELECT id, username, is_online FROM users ORDER BY username ASC');
  res.json(result.rows);
});

// Fetch message history between current authenticated user and target contact
app.get('/api/messages/:otherUserId', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const token = authHeader.split(' ')[1];
    const { userId } = jwt.verify(token, process.env.JWT_SECRET);
    const otherUserId = parseInt(req.params.otherUserId, 10);

    const result = await db.query(
      `SELECT id, sender_id, recipient_id, masked_content, created_at
       FROM messages
       WHERE (sender_id = $1 AND recipient_id = $2)
          OR (sender_id = $2 AND recipient_id = $1)
       ORDER BY created_at ASC`,
      [userId, otherUserId]
    );

    res.json(result.rows);
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
});

// --- Socket.IO Middleware ---
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Authentication token required'));

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = decoded; // { userId, username }
    next();
  } catch (err) {
    next(new Error('Invalid token'));
  }
});

const onlineUsers = new Map(); // userId -> Set of active socket IDs

io.on('connection', async (socket) => {
  const userId = socket.user.userId;

  // Add client to private room
  socket.join(`user:${userId}`);

  // Track online status in memory and PostgreSQL
  if (!onlineUsers.has(userId)) {
    onlineUsers.set(userId, new Set());
    await db.query('UPDATE users SET is_online = TRUE WHERE id = $1', [userId]);
    io.emit('user_status_changed', { userId, is_online: true });
  }
  onlineUsers.get(userId).add(socket.id);

  // Private Message Handler
  socket.on('send_private_message', async ({ recipientId, text }, ackCallback) => {
    if (!text || !recipientId) return;

    // 1. Mask sensitive phone numbers & emails
    const maskedContent = maskSensitiveData(text);

    // 2. Persist to PostgreSQL database 'webapp'
    const insertResult = await db.query(
      `INSERT INTO messages (sender_id, recipient_id, original_content, masked_content)
       VALUES ($1, $2, $3, $4)
       RETURNING id, sender_id, recipient_id, masked_content, created_at`,
      [userId, recipientId, text, maskedContent]
    );

    const savedMessage = insertResult.rows[0];

    const payload = {
      id: savedMessage.id,
      sender_id: savedMessage.sender_id,
      recipient_id: savedMessage.recipient_id,
      masked_content: savedMessage.masked_content,
      created_at: savedMessage.created_at
    };

    // 3. Emit in real time to recipient's room
    io.to(`user:${recipientId}`).emit('receive_private_message', payload);

    // 4. Return masked payload back to sender
    if (typeof ackCallback === 'function') {
      ackCallback(payload);
    }
  });

  // Handle Disconnection
  socket.on('disconnect', async () => {
    const userSockets = onlineUsers.get(userId);
    if (userSockets) {
      userSockets.delete(socket.id);
      if (userSockets.size === 0) {
        onlineUsers.delete(userId);
        await db.query('UPDATE users SET is_online = FALSE WHERE id = $1', [userId]);
        io.emit('user_status_changed', { userId, is_online: false });
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
