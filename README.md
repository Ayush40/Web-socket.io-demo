# WebSocket.io Demo

A small real-time private chat application built with Node.js, Express, PostgreSQL, and Socket.IO.

The app supports:

- User login and registration with bcrypt password hashing
- JWT authentication for HTTP and Socket.IO connections
- Private real-time messages between users
- PostgreSQL message history
- Online/offline contact status
- Automatic masking of phone numbers and email addresses in displayed messages

## Requirements

- Node.js 18 or newer
- PostgreSQL 14 or newer

## Setup

1. Create a PostgreSQL database named `webapp`.
2. Open a terminal in the `server` directory.
3. Install dependencies:

   ```bash
   npm install
   ```

4. Create `server/.env` with your local PostgreSQL settings:

   ```env
   DB_HOST=localhost
   DB_PORT=5432
   DB_USER=postgres
   DB_PASSWORD=your-postgres-password
   DB_NAME=webapp
   JWT_SECRET=replace-with-a-long-random-secret
   PORT=3000
   ```

The required `users` and `messages` tables are created automatically when the server starts.

## Run

From the `server` directory:

```bash
npm start
```

For automatic restarts during development:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in a browser.

## Demo users

To create the sample accounts, run this from the `server` directory:

```bash
node seed.js
```

This resets the `users` and `messages` tables and creates:

| Username | Email | Password |
| --- | --- | --- |
| Alice | `alice@test.com` | `password123` |
| Bob | `bob@test.com` | `password123` |

Use two browser windows or tabs to log in as Alice and Bob and test private messaging.

## Project structure

```text
server/
├── db.js                 # PostgreSQL connection and schema initialization
├── package.json          # Scripts and dependencies
├── seed.js               # Demo data reset and seed script
├── server.js             # Express API and Socket.IO server
├── public/
│   ├── app.js            # Browser client logic
│   ├── index.html        # Chat UI markup
│   └── style.css         # Chat UI styles
└── utils/
    └── masker.js         # Email and phone number masking
```

## API overview

- `POST /api/register` creates a user and returns a JWT.
- `POST /api/login` authenticates a user and returns a JWT.
- `GET /api/users` returns contacts and their online status.
- `GET /api/messages/:otherUserId` returns conversation history and requires a Bearer token.
- Socket.IO event `send_private_message` persists and delivers a private message.

## Notes

- The original message is stored in PostgreSQL, while the masked message is returned to clients.
- Do not commit `server/.env` or production credentials.
- The Socket.IO server currently allows connections from any origin; restrict CORS before deploying publicly.
