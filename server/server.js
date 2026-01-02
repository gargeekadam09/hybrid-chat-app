const express = require("express");
const WebSocket = require("ws");
const url = require('url');
const cors = require('cors');
const path = require('path');
const db = require('./database');
const { hashPassword, comparePassword, generateToken, verifyToken } = require('./auth');

const app = express();

// Serve static files from React build
// Note: Commented out for backend-only deployment
/*
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/hybrid-client/build')));
}
*/

// Test database connection
db.query('SELECT 1')
  .then(() => console.log('✅ Database connected successfully!'))
  .catch(err => console.error('❌ Database connection failed:', err.message));

// Middleware
app.use(cors({
  origin: [
    'http://localhost:3000', 
    'http://localhost:3001',
    'https://hybrid-chat-8m0wmtglc-gargee-kadams-projects.vercel.app',
    'https://hybrid-chat-app.vercel.app'
  ],
  credentials: true
}));
app.use(express.json());

// In-memory user storage (in production, use a proper database)
// const users = new Map(); // email -> { username, password, email }
// Track connected users
const connectedUsers = new Map(); // username -> Set of WebSocket connections

/* =======================
   AUTHENTICATION ROUTES
   ======================= */
app.post('/register', async (req, res) => {
  try {
    const { firstName, lastName, username, email, password } = req.body;
    
    if (!firstName || !lastName || !username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    
    // Check if email or username already exists
    const existingUsers = await db.query(
      'SELECT id FROM users WHERE email = $1 OR username = $2',
      [email, username]
    );
    
    if (existingUsers.rows.length > 0) {
      return res.status(400).json({ error: 'Email or username already exists' });
    }
    
    // Hash password and save user
    const hashedPassword = await hashPassword(password);
    const result = await db.query(
      'INSERT INTO users (firstName, lastName, username, email, password) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [firstName, lastName, username, email, hashedPassword]
    );
    
    console.log('User registered successfully:', username);
    res.json({ message: 'Registration successful' });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    // Find user by email
    const users = await db.query(
      'SELECT id, firstName, lastName, username, email, password, isAdmin FROM users WHERE email = $1',
      [email]
    );
    
    if (users.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    const user = users.rows[0];
    
    // Verify password
    const isValidPassword = await comparePassword(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    // Update user online status
    await db.query(
      'UPDATE users SET isOnline = TRUE, lastSeen = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    );
    
    // Generate JWT token
    const token = generateToken(user.id, user.username, user.email, user.isAdmin);
    
    console.log('User logged in successfully:', user.username);
    res.json({ 
      token,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        email: user.email,
        isAdmin: user.isAdmin
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Message storage functions
const saveMessage = async (senderId, receiverId, content, messageType) => {
  try {
    const result = await db.query(
      'INSERT INTO messages (senderId, receiverId, content, messageType) VALUES ($1, $2, $3, $4) RETURNING id',
      [senderId, receiverId, content, messageType]
    );
    return result.rows[0].id;
  } catch (error) {
    console.error('Error saving message:', error);
    return null;
  }
};

const getUserByUsername = async (username) => {
  try {
    const users = await db.query(
      'SELECT id, username FROM users WHERE username = $1',
      [username]
    );
    return users.rows[0] || null;
  } catch (error) {
    console.error('Error getting user:', error);
    return null;
  }
};

// API endpoints for chat history
app.get('/messages/general', async (req, res) => {
  try {
    const messages = await db.query(`
      SELECT m.content, m.timestamp, u.username 
      FROM messages m 
      JOIN users u ON m.senderId = u.id 
      WHERE m.messageType = 'general' 
      ORDER BY m.timestamp ASC 
      LIMIT 50
    `);
    res.json(messages.rows);
  } catch (error) {
    console.error('Error fetching general messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

app.get('/messages/private/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    const messages = await db.query(`
      SELECT m.content, m.timestamp, sender.username as senderUsername, receiver.username as receiverUsername
      FROM messages m
      JOIN users sender ON m.senderId = sender.id
      JOIN users receiver ON m.receiverId = receiver.id
      WHERE m.messageType = 'private' 
      AND ((sender.username = $1 AND receiver.username = $2) 
           OR (sender.username = $2 AND receiver.username = $1))
      ORDER BY m.timestamp ASC
      LIMIT 50
    `, [decoded.username, username]);
    
    res.json(messages.rows);
  } catch (error) {
    console.error('Error fetching private messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Get all users with their online status
app.get('/users/status', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    const users = await db.query(`
      SELECT username, isOnline, lastSeen 
      FROM users 
      WHERE username != $1 AND isAdmin = FALSE
      ORDER BY isOnline DESC, lastSeen DESC
    `, [decoded.username]);
    
    res.json(users.rows);
  } catch (error) {
    console.error('Error fetching user status:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Test endpoint to check messages
app.get('/test/messages', async (req, res) => {
  try {
    const messages = await db.query('SELECT * FROM messages');
    res.json({ count: messages.rows.length, messages: messages.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin middleware
const requireAdmin = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  const decoded = verifyToken(token);
  if (!decoded || !decoded.isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  req.user = decoded;
  next();
};

// Admin endpoints
app.get('/admin/stats', requireAdmin, async (req, res) => {
  try {
    // Total users
    const totalUsers = await db.query('SELECT COUNT(*) as count FROM users WHERE isAdmin = FALSE');
    
    // Users registered today
    const todayUsers = await db.query(
      'SELECT COUNT(*) as count FROM users WHERE DATE(createdAt) = CURRENT_DATE AND isAdmin = FALSE'
    );
    
    // Online users
    const onlineUsers = await db.query('SELECT COUNT(*) as count FROM users WHERE isOnline = TRUE AND isAdmin = FALSE');
    
    // Total messages
    const totalMessages = await db.query('SELECT COUNT(*) as count FROM messages');
    
    // Messages today
    const todayMessages = await db.query(
      'SELECT COUNT(*) as count FROM messages WHERE DATE(timestamp) = CURRENT_DATE'
    );
    
    res.json({
      totalUsers: parseInt(totalUsers.rows[0].count),
      todayUsers: parseInt(todayUsers.rows[0].count),
      onlineUsers: parseInt(onlineUsers.rows[0].count),
      totalMessages: parseInt(totalMessages.rows[0].count),
      todayMessages: parseInt(todayMessages.rows[0].count)
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

app.get('/admin/users', requireAdmin, async (req, res) => {
  try {
    const users = await db.query(`
      SELECT id, firstName, lastName, username, email, isOnline, lastSeen, createdAt
      FROM users 
      WHERE isAdmin = FALSE
      ORDER BY createdAt DESC
    `);
    res.json(users.rows);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.get('/admin/messages', requireAdmin, async (req, res) => {
  try {
    const messages = await db.query(`
      SELECT m.id, m.content, m.messageType, m.timestamp,
             sender.username as senderUsername,
             receiver.username as receiverUsername
      FROM messages m
      JOIN users sender ON m.senderId = sender.id
      LEFT JOIN users receiver ON m.receiverId = receiver.id
      ORDER BY m.timestamp DESC
      LIMIT 100
    `);
    res.json(messages.rows);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

app.get("/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Credentials", "true");

  let notificationCount = 0;

  const interval = setInterval(() => {
    notificationCount++;
    res.write(`data: Live notification ${notificationCount}\n\n`);
  }, 3000);

  req.on("close", () => {
    clearInterval(interval);
    res.end();
  });
});

// Serve React app for all other routes in production
// Note: Commented out as this is causing issues with Express 5.x
// The frontend will be deployed separately or served differently
/*
if (process.env.NODE_ENV === 'production') {
  app.get('/*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/hybrid-client/build/index.html'));
  });
}
*/

/* =======================
   HTTP SERVER
   ======================= */
const server = app.listen(process.env.PORT || 5000, () => {
  console.log(`Hybrid server running on port ${process.env.PORT || 5000}`);
});

/* =======================
   WEBSOCKET: CLIENT ↔ SERVER
   ======================= */
const wss = new WebSocket.Server({ server });

// Broadcast current user list to all clients
function broadcastUserList() {
  const userList = Array.from(connectedUsers.keys()).join(',');
  const message = `USERS:${userList}`;
  
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// Add user connection
function addUserConnection(username, ws) {
  if (!connectedUsers.has(username)) {
    connectedUsers.set(username, new Set());
  }
  connectedUsers.get(username).add(ws);
  console.log(`User ${username} connected. Total users: ${connectedUsers.size}`);
  
  // Update user online status in database
  (async () => {
    try {
      await db.query(
        'UPDATE users SET isOnline = TRUE, lastSeen = CURRENT_TIMESTAMP WHERE username = $1',
        [username]
      );
    } catch (error) {
      console.error('Error updating user online status:', error);
    }
  })();
  
  // Broadcast updated user list to all clients
  broadcastUserList();
  
  // Send presence notification to all other users
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN && client !== ws) {
      client.send(`PRESENCE:${username}`);
    }
  });
}

// Remove user connection
function removeUserConnection(username, ws) {
  if (connectedUsers.has(username)) {
    connectedUsers.get(username).delete(ws);
    if (connectedUsers.get(username).size === 0) {
      connectedUsers.delete(username);
      console.log(`User ${username} fully disconnected. Total users: ${connectedUsers.size}`);
      console.log('Remaining users:', Array.from(connectedUsers.keys()));
      
      // Update user offline status in database
      (async () => {
        try {
          await db.query(
            'UPDATE users SET isOnline = FALSE, lastSeen = CURRENT_TIMESTAMP WHERE username = $1',
            [username]
          );
        } catch (error) {
          console.error('Error updating user offline status:', error);
        }
      })();
      
      // Broadcast updated user list to all clients
      broadcastUserList();
    }
  }
}

wss.on("connection", (ws, req) => {
  console.log("WebSocket client connected");
  
  // Extract username from query parameters
  const query = url.parse(req.url, true).query;
  const username = query.user;
  
  if (username) {
    ws.username = username;
    addUserConnection(username, ws);
  }

  ws.on("message", (message) => {
    const messageStr = message.toString();
    console.log('Received message:', messageStr);
    
    // Handle GET_USERS request
    if (messageStr === 'GET_USERS') {
      const userList = Array.from(connectedUsers.keys()).filter(u => u !== username).join(',');
      ws.send(`USERS:${userList}`);
      return;
    }
    
    // Handle PRESENCE announcements
    if (messageStr.startsWith('PRESENCE:')) {
      const presentUser = messageStr.replace('PRESENCE:', '');
      if (presentUser && !connectedUsers.has(presentUser)) {
        addUserConnection(presentUser, ws);
      }
      
      // Broadcast presence to all other clients
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN && client !== ws) {
          client.send(messageStr);
        }
      });
      return;
    }
    
    // Handle private messages (PRIVATE:sender:target:message)
    if (messageStr.startsWith('PRIVATE:')) {
      const parts = messageStr.split(':');
      if (parts.length >= 4) {
        const sender = parts[1];
        const target = parts[2];
        const privateMessage = parts.slice(3).join(':');
        
        // Save message to database
        (async () => {
          const senderUser = await getUserByUsername(sender);
          const targetUser = await getUserByUsername(target);
          if (senderUser && targetUser) {
            await saveMessage(senderUser.id, targetUser.id, privateMessage, 'private');
          }
        })();
        
        // Send to target user's connections
        if (connectedUsers.has(target)) {
          connectedUsers.get(target).forEach(targetWs => {
            if (targetWs.readyState === WebSocket.OPEN) {
              targetWs.send(messageStr);
            }
          });
        }
      }
      return;
    }
    
    // Handle public messages (PUBLIC:sender:message)
    if (messageStr.startsWith('PUBLIC:')) {
      const parts = messageStr.split(':');
      if (parts.length >= 3) {
        const sender = parts[1];
        const publicMessage = parts.slice(2).join(':');
        
        // Save message to database
        (async () => {
          const senderUser = await getUserByUsername(sender);
          if (senderUser) {
            await saveMessage(senderUser.id, null, publicMessage, 'general');
          }
        })();
      }
      
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN && client !== ws) {
          client.send(messageStr);
        }
      });
      return;
    }
    
    // Handle join messages
    if (messageStr.includes('joined the chat')) {
      const joinMatch = messageStr.match(/^(.+?)\s+joined/);
      if (joinMatch) {
        const joinedUser = joinMatch[1];
        if (joinedUser && joinedUser !== username) {
          addUserConnection(joinedUser, ws);
        }
      }
      
      // Broadcast join message to all other clients
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN && client !== ws) {
          client.send(messageStr);
        }
      });
      return;
    }
    
    // Default: broadcast to all other clients
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN && client !== ws) {
        client.send(`User says: ${messageStr}`);
      }
    });
  });
  
  ws.on('close', () => {
    console.log('WebSocket client disconnected');
  console.log('Remaining connected users:', Array.from(connectedUsers.keys()));
    if (ws.username) {
      removeUserConnection(ws.username, ws);
    }
  });
});
