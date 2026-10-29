let socket;
let currentUser = null;
let activeChatUserId = null;
let token = null;

const authPanel = document.getElementById('auth-panel');
const chatApp = document.getElementById('chat-app');
const userList = document.getElementById('user-list');
const messagesContainer = document.getElementById('messages-container');
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const chatHeader = document.getElementById('chat-header');
const displayUsername = document.getElementById('display-username');

document.getElementById('login-btn').addEventListener('click', async () => {
  const email = document.getElementById('email-input').value;
  const password = document.getElementById('password-input').value;

  let res;
  try {
    res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
  } catch (error) {
    alert('Cannot reach the server. Start it with: npm start');
    return;
  }

  if (!res.ok) return alert('Login failed');
  const data = await res.json();

  token = data.token;
  currentUser = data.user;
  displayUsername.textContent = `Logged in as: ${currentUser.username}`;

  authPanel.classList.add('hidden');
  chatApp.classList.remove('hidden');

  initializeSocket();
  loadUserList();
});

function initializeSocket() {
  socket = io({ auth: { token } });

  socket.on('receive_private_message', (msg) => {
    if (activeChatUserId === msg.sender_id) {
      appendMessage(msg.masked_content, 'received', msg.created_at);
    }
  });

  socket.on('user_status_changed', ({ userId, is_online }) => {
    const statusDot = document.getElementById(`status-${userId}`);
    if (statusDot) {
      statusDot.className = `status-dot ${is_online ? 'online' : ''}`;
    }
  });
}

async function loadUserList() {
  const res = await fetch('/api/users');
  const users = await res.json();
  userList.innerHTML = '';

  users.filter(u => u.id !== currentUser.id).forEach(user => {
    const li = document.createElement('li');
    li.id = `user-item-${user.id}`;
    li.innerHTML = `
      <span>${user.username}</span>
      <span id="status-${user.id}" class="status-dot ${user.is_online ? 'online' : ''}"></span>
    `;
    li.onclick = () => selectUser(user);
    userList.appendChild(li);
  });
}

async function selectUser(user) {
  activeChatUserId = user.id;
  chatHeader.textContent = `Chatting with ${user.username}`;
  messageForm.classList.remove('hidden');
  messagesContainer.innerHTML = '';

  document.querySelectorAll('#user-list li').forEach(el => el.classList.remove('active'));
  document.getElementById(`user-item-${user.id}`)?.classList.add('active');

  const res = await fetch(`/api/messages/${user.id}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const history = await res.json();
  history.forEach(msg => {
    const type = msg.sender_id === currentUser.id ? 'sent' : 'received';
    appendMessage(msg.masked_content, type, msg.created_at);
  });
}

messageForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = messageInput.value.trim();
  if (!text || !activeChatUserId) return;

  socket.emit('send_private_message', { recipientId: activeChatUserId, text }, (ackPayload) => {
    appendMessage(ackPayload.masked_content, 'sent', ackPayload.created_at);
  });

  messageInput.value = '';
});

function appendMessage(text, type, timestamp) {
  const el = document.createElement('div');
  el.className = `msg ${type}`;
  const time = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  el.innerHTML = `<div>${escapeHtml(text)}</div><div class="msg-time">${time}</div>`;
  messagesContainer.appendChild(el);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function escapeHtml(str) {
  return str.replace(/[&<>'"]/g, tag => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[tag] || tag));
}
