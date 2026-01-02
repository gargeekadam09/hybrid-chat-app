import { useEffect, useState, useRef } from "react";
import { tokenManager } from "./tokenManager";

function App() {
  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
  const WS_URL = API_URL.replace('https://', 'wss://').replace('http://', 'ws://');
  
  const [notifications, setNotifications] = useState([]);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [authError, setAuthError] = useState("");
  const [userInfo, setUserInfo] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminStats, setAdminStats] = useState(null);
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminMessages, setAdminMessages] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [privateChats, setPrivateChats] = useState({});
  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, privateChats, selectedUser]);

  // Auto-login check on app startup
  useEffect(() => {
    const checkAutoLogin = () => {
      const token = tokenManager.getToken();
      if (token && !tokenManager.isTokenExpired(token)) {
        const decoded = tokenManager.decodeToken(token);
        if (decoded) {
          setUserInfo(decoded);
          setUsername(decoded.username);
          setEmail(decoded.email);
          setIsAdmin(decoded.isAdmin || false);
          setIsLoggedIn(true);
          console.log('Auto-login successful for:', decoded.username);
        }
      } else if (token) {
        // Token expired, remove it
        tokenManager.removeToken();
      }
    };
    
    checkAutoLogin();
  }, []);

  // Load chat history when user logs in
  useEffect(() => {
    if (isLoggedIn && userInfo) {
      if (isAdmin) {
        loadAdminData();
      } else {
        loadGeneralChatHistory();
        loadAllUsers();
      }
    }
  }, [isLoggedIn, userInfo, isAdmin]);

  // Load admin data
  const loadAdminData = async () => {
    try {
      const token = tokenManager.getToken();
      const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
      
      // Load stats
      const statsResponse = await fetch(`${API_URL}/admin/stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (statsResponse.ok) {
        const stats = await statsResponse.json();
        setAdminStats(stats);
      }
      
      // Load users
      const usersResponse = await fetch(`${API_URL}/admin/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (usersResponse.ok) {
        const users = await usersResponse.json();
        setAdminUsers(users);
      }
      
      // Load messages
      const messagesResponse = await fetch(`${API_URL}/admin/messages`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (messagesResponse.ok) {
        const messages = await messagesResponse.json();
        setAdminMessages(messages);
      }
    } catch (error) {
      console.error('Error loading admin data:', error);
    }
  };

  // Load all users with status
  const loadAllUsers = async () => {
    try {
      const token = tokenManager.getToken();
      const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
      const response = await fetch(`${API_URL}/users/status`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const users = await response.json();
        setAllUsers(users);
        // Update online users list
        const currentlyOnline = users.filter(user => user.isOnline).map(user => user.username);
        setOnlineUsers(currentlyOnline);
        console.log('Loaded users with status:', users.length, 'total users');
      }
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  // Load general chat history
  const loadGeneralChatHistory = async () => {
    try {
      const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
      const response = await fetch(`${API_URL}/messages/general`);
      if (response.ok) {
        const history = await response.json();
        const formattedMessages = history.map(msg => ({
          text: msg.content,
          username: msg.username,
          timestamp: msg.timestamp
        }));
        setMessages(formattedMessages);
        console.log('Loaded general chat history:', formattedMessages.length, 'messages');
      }
    } catch (error) {
      console.error('Error loading general chat history:', error);
    }
  };

  // Load private chat history
  const loadPrivateChatHistory = async (targetUsername) => {
    try {
      const token = tokenManager.getToken();
      const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
      const response = await fetch(`${API_URL}/messages/private/${targetUsername}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const history = await response.json();
        const formattedMessages = history.map(msg => ({
          text: msg.content,
          username: msg.senderUsername,
          timestamp: msg.timestamp,
          isPrivate: true
        }));
        setPrivateChats(prev => ({
          ...prev,
          [targetUsername]: formattedMessages
        }));
        console.log('Loaded private chat history with', targetUsername, ':', formattedMessages.length, 'messages');
      }
    } catch (error) {
      console.error('Error loading private chat history:', error);
    }
  };

  useEffect(() => {
    if (!isLoggedIn) return;

    console.log('Attempting to connect for user:', username);

    // SSE connection for notifications
    const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
    const eventSource = new EventSource(`${API_URL}/events?user=${username}`);

    eventSource.onopen = () => {
      console.log('SSE connection opened');
    };

    eventSource.onerror = (error) => {
      console.log('SSE connection error:', error);
    };

    eventSource.onmessage = (event) => {
      console.log('SSE received:', event.data);
      try {
        const notification = JSON.parse(event.data);
        setNotifications((prev) => [...prev, notification]);
      } catch {
        setNotifications((prev) => [...prev, event.data]);
      }
    };

    // WebSocket connection for chat
    const socket = new WebSocket(`${WS_URL}?user=${username}`);
    socketRef.current = socket;

    socket.onopen = () => {
      console.log('WebSocket connection opened for:', username);
      // Send join message
      socket.send(`${username} joined the chat`);
      setNotifications((prev) => [...prev, 'Connected to chat server']);
      
      // Request current user list from server immediately
      socket.send('GET_USERS');
    };

    socket.onmessage = (event) => {
      console.log('WebSocket received:', event.data);
      
      const messageText = event.data;
      
      // Handle user list response from server
      if (messageText.startsWith('USERS:')) {
        const userListStr = messageText.replace('USERS:', '');
        const userList = userListStr ? userListStr.split(',').filter(u => u.trim() && u.trim() !== username) : [];
        console.log('Received user list:', userList);
        setOnlineUsers(userList);
        return;
      }
      
      // Handle presence broadcasts - this ensures all users see each other
      if (messageText.startsWith('PRESENCE:')) {
        const presentUser = messageText.replace('PRESENCE:', '');
        if (presentUser && presentUser !== username) {
          setOnlineUsers((prev) => {
            if (!prev.includes(presentUser)) {
              console.log('Added user to online list:', presentUser);
              return [...prev, presentUser];
            }
            return prev;
          });
        }
        return;
      }
      
      // Skip our own join messages
      if (messageText.includes(`${username} joined`)) {
        return;
      }
      
      // Handle private messages (format: PRIVATE:sender:targetuser:message)
      if (messageText.startsWith('PRIVATE:')) {
        const parts = messageText.split(':');
        if (parts.length >= 4) {
          const sender = parts[1];
          const target = parts[2];
          const message = parts.slice(3).join(':');
          
          if (target === username) {
            // This private message is for us
            setPrivateChats(prev => ({
              ...prev,
              [sender]: [...(prev[sender] || []), {
                text: message,
                username: sender,
                timestamp: new Date().toISOString(),
                isPrivate: true
              }]
            }));
            setNotifications((prev) => [...prev, `New message from ${sender}`]);
            
            // Add sender to online users if not there
            if (sender !== username) {
              setOnlineUsers((prev) => prev.includes(sender) ? prev : [...prev, sender]);
            }
          }
        }
        return;
      }
      
      // Handle public messages (format: PUBLIC:sender:message)
      if (messageText.startsWith('PUBLIC:')) {
        const parts = messageText.split(':');
        if (parts.length >= 3) {
          const sender = parts[1];
          const message = parts.slice(2).join(':');
          
          if (sender !== username) {
            setMessages((prev) => [...prev, {
              text: message,
              username: sender,
              timestamp: new Date().toISOString()
            }]);
            
            // Add sender to online users
            setOnlineUsers((prev) => prev.includes(sender) ? prev : [...prev, sender]);
          }
        }
        return;
      }
      
      // Handle join messages from other users - extract actual username
      if (messageText.includes('joined the chat')) {
        const joinMatch = messageText.match(/^(.+?)\s+joined/);
        if (joinMatch && joinMatch[1] !== username) {
          const joinedUser = joinMatch[1];
          setOnlineUsers((prev) => {
            if (!prev.includes(joinedUser)) {
              console.log('User joined, adding to list:', joinedUser);
              return [...prev, joinedUser];
            }
            return prev;
          });
          setNotifications((prev) => [...prev, `${joinedUser} joined the chat`]);
        }
        return;
      }
      
      // Handle messages with "User says:" format - extract actual username
      if (messageText.includes('User says:')) {
        const userSaysMatch = messageText.match(/User says: (.+)/);
        if (userSaysMatch) {
          const fullMessage = userSaysMatch[1];
          
          // Try to extract username from the message
          const words = fullMessage.trim().split(' ');
          if (words.length > 1) {
            const potentialUsername = words[0];
            const restOfMessage = words.slice(1).join(' ');
            
            // Only add if it's not our username
            if (potentialUsername !== username) {
              setMessages((prev) => [...prev, {
                text: restOfMessage || fullMessage,
                username: potentialUsername,
                timestamp: new Date().toISOString()
              }]);
              
              // Add to online users
              setOnlineUsers((prev) => prev.includes(potentialUsername) ? prev : [...prev, potentialUsername]);
            }
          }
        }
        return;
      }
      
      // Handle any other messages - try to extract username from colon format
      if (!messageText.includes('Connected to chat server') && messageText.includes(':') && !messageText.startsWith('PRESENCE:')) {
        const colonMatch = messageText.match(/^(.+?):\s*(.+)$/);
        if (colonMatch) {
          const sender = colonMatch[1];
          const message = colonMatch[2];
          
          if (sender !== username && sender !== 'User says') {
            setMessages((prev) => [...prev, {
              text: message,
              username: sender,
              timestamp: new Date().toISOString()
            }]);
            
            // Add to online users
            setOnlineUsers((prev) => prev.includes(sender) ? prev : [...prev, sender]);
          }
        }
      }
    };

    return () => {
      console.log('Cleaning up connections for:', username);
      eventSource.close();
      socket.close();
    };
  }, [isLoggedIn, username]);

  const handleRegister = async (e) => {
    e.preventDefault();
    setAuthError("");
    
    if (!firstName.trim() || !lastName.trim() || !username.trim() || !email.trim() || !password.trim() || !confirmPassword.trim()) {
      setAuthError("All fields are required");
      return;
    }
    
    if (password !== confirmPassword) {
      setAuthError("Passwords do not match");
      return;
    }
    
    if (!agreeTerms) {
      setAuthError("You must agree to the terms and conditions");
      return;
    }
    
    try {
      const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
      const response = await fetch(`${API_URL}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ firstName, lastName, username, email, password }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setShowSuccessModal(true);
        // Clear form
        setFirstName("");
        setLastName("");
        setUsername("");
        setEmail("");
        setPassword("");
        setConfirmPassword("");
        setAgreeTerms(false);
      } else {
        setAuthError(data.error || "Registration failed");
      }
    } catch (error) {
      setAuthError("Network error. Please try again.");
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError("");
    
    if (!email.trim() || !password.trim()) {
      setAuthError("Email and password are required");
      return;
    }
    
    try {
      const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
      const response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        // Save token and user info
        tokenManager.saveToken(data.token);
        setUserInfo(data.user);
        setUsername(data.user.username);
        setIsAdmin(data.user.isAdmin || false);
        setIsLoggedIn(true);
        console.log('Login successful for:', data.user.username);
      } else {
        setAuthError(data.error || "Login failed");
      }
    } catch (error) {
      setAuthError("Network error. Please try again.");
    }
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN && input.trim()) {
      let messageToSend = input.trim();
      
      if (selectedUser) {
        // Private message format: PRIVATE:sender:target:message
        messageToSend = `PRIVATE:${username}:${selectedUser}:${input.trim()}`;
        
        // Add to private chat locally
        setPrivateChats(prev => ({
          ...prev,
          [selectedUser]: [...(prev[selectedUser] || []), {
            text: input.trim(),
            username,
            timestamp: new Date().toISOString(),
            isPrivate: true
          }]
        }));
      } else {
        // Public message format
        messageToSend = `PUBLIC:${username}:${input.trim()}`;
        
        // Add to general chat locally
        setMessages((prev) => [...prev, {
          text: input.trim(),
          username,
          timestamp: new Date().toISOString()
        }]);
      }
      
      socketRef.current.send(messageToSend);
      setInput("");
    }
  };

  const selectUser = (user) => {
    setSelectedUser(user);
    if (!privateChats[user]) {
      setPrivateChats(prev => ({ ...prev, [user]: [] }));
      // Load chat history for this user
      loadPrivateChatHistory(user);
    }
  };

  const backToGeneral = () => {
    setSelectedUser(null);
  };

  const handleLogout = () => {
    // Clear token and reset state
    tokenManager.removeToken();
    setIsLoggedIn(false);
    setUsername("");
    setEmail("");
    setPassword("");
    setUserInfo(null);
    setIsAdmin(false);
    setAdminStats(null);
    setAdminUsers([]);
    setAdminMessages([]);
    setAuthError("");
    setMessages([]);
    setNotifications([]);
    setOnlineUsers([]);
    setSelectedUser(null);
    setPrivateChats({});
    console.log('User logged out');
  };

  if (!isLoggedIn) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      }}>
        <div style={{
          background: 'white',
          padding: '2rem',
          borderRadius: '10px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
          width: '100%',
          maxWidth: '400px'
        }}>
          <h2 style={{ textAlign: 'center', marginBottom: '1.5rem', color: '#333' }}>
            {isRegistering ? 'Create Account' : 'Login to Chat'}
          </h2>
          
          {authError && (
            <div style={{
              padding: '10px',
              marginBottom: '1rem',
              background: authError.includes('successful') ? '#d4edda' : '#f8d7da',
              color: authError.includes('successful') ? '#155724' : '#721c24',
              border: `1px solid ${authError.includes('successful') ? '#c3e6cb' : '#f5c6cb'}`,
              borderRadius: '4px',
              fontSize: '14px'
            }}>
              {authError}
            </div>
          )}
          
          <form onSubmit={isRegistering ? handleRegister : handleLogin}>
            {isRegistering && (
              <>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First Name"
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px solid #e1e5e9',
                    borderRadius: '8px',
                    fontSize: '16px',
                    marginBottom: '1rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
                
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last Name"
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px solid #e1e5e9',
                    borderRadius: '8px',
                    fontSize: '16px',
                    marginBottom: '1rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
                
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Username"
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px solid #e1e5e9',
                    borderRadius: '8px',
                    fontSize: '16px',
                    marginBottom: '1rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </>
            )}
            
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              style={{
                width: '100%',
                padding: '12px',
                border: '2px solid #e1e5e9',
                borderRadius: '8px',
                fontSize: '16px',
                marginBottom: '1rem',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
            
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              style={{
                width: '100%',
                padding: '12px',
                border: '2px solid #e1e5e9',
                borderRadius: '8px',
                fontSize: '16px',
                marginBottom: '1rem',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
            
            {isRegistering && (
              <>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm Password"
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px solid #e1e5e9',
                    borderRadius: '8px',
                    fontSize: '16px',
                    marginBottom: '1rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
                
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  marginBottom: '1rem',
                  fontSize: '14px'
                }}>
                  <input
                    type="checkbox"
                    id="agreeTerms"
                    checked={agreeTerms}
                    onChange={(e) => setAgreeTerms(e.target.checked)}
                    style={{
                      marginRight: '8px',
                      transform: 'scale(1.2)'
                    }}
                  />
                  <label htmlFor="agreeTerms" style={{ color: '#333' }}>
                    I agree to the Terms and Conditions
                  </label>
                </div>
              </>
            )}
            
            <button
              type="submit"
              style={{
                width: '100%',
                padding: '12px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                cursor: 'pointer',
                marginBottom: '1rem'
              }}
            >
              {isRegistering ? 'Create Account' : 'Login'}
            </button>
          </form>
          
          <div style={{ textAlign: 'center' }}>
            <button
              onClick={() => {
                setIsRegistering(!isRegistering);
                setAuthError("");
              }}
              style={{
                background: 'none',
                border: 'none',
                color: '#667eea',
                cursor: 'pointer',
                textDecoration: 'underline',
                fontSize: '14px'
              }}
            >
              {isRegistering ? 'Already have an account? Login' : 'Don\'t have an account? Register'}
            </button>
          </div>
        </div>
        
        {/* Success Modal */}
        {showSuccessModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}>
            <div style={{
              background: 'white',
              padding: '2rem',
              borderRadius: '10px',
              boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
              textAlign: 'center',
              maxWidth: '400px',
              width: '90%'
            }}>
              <div style={{
                fontSize: '48px',
                color: '#4ade80',
                marginBottom: '1rem'
              }}>✓</div>
              <h3 style={{
                color: '#333',
                marginBottom: '1rem'
              }}>Account Created Successfully!</h3>
              <p style={{
                color: '#666',
                marginBottom: '1.5rem'
              }}>Your account has been created. You can now login with your credentials.</p>
              <button
                onClick={() => {
                  setShowSuccessModal(false);
                  setIsRegistering(false);
                }}
                style={{
                  padding: '12px 24px',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  cursor: 'pointer'
                }}
              >
                Continue to Login
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Admin Panel
  if (isLoggedIn && isAdmin) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: '#f5f7fa'
      }}>
        {/* Admin Header */}
        <div style={{
          padding: '1rem 2rem',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h2 style={{ margin: 0 }}>Admin Panel</h2>
            <p style={{ margin: 0, opacity: 0.9 }}>Welcome, {username}</p>
          </div>
          <button
            onClick={handleLogout}
            style={{
              padding: '8px 16px',
              background: 'rgba(255,255,255,0.2)',
              color: 'white',
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Logout
          </button>
        </div>

        {/* Stats Cards */}
        <div style={{
          padding: '2rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem'
        }}>
          {adminStats && [
            { label: 'Total Users', value: adminStats.totalUsers, color: '#3b82f6' },
            { label: 'New Users Today', value: adminStats.todayUsers, color: '#10b981' },
            { label: 'Online Users', value: adminStats.onlineUsers, color: '#f59e0b' },
            { label: 'Total Messages', value: adminStats.totalMessages, color: '#8b5cf6' },
            { label: 'Messages Today', value: adminStats.todayMessages, color: '#ef4444' }
          ].map((stat, index) => (
            <div key={index} style={{
              background: 'white',
              padding: '1.5rem',
              borderRadius: '8px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              borderLeft: `4px solid ${stat.color}`
            }}>
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '2rem', color: stat.color }}>
                {stat.value}
              </h3>
              <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Data Tables */}
        <div style={{
          flex: 1,
          padding: '0 2rem 2rem',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '2rem',
          overflow: 'hidden'
        }}>
          {/* Users Table */}
          <div style={{
            background: 'white',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{
              padding: '1rem',
              borderBottom: '1px solid #e1e5e9',
              fontWeight: 'bold'
            }}>
              Recent Users
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: '1rem' }}>
              {adminUsers.slice(0, 10).map((user, index) => (
                <div key={index} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.5rem 0',
                  borderBottom: '1px solid #f0f0f0'
                }}>
                  <div>
                    <div style={{ fontWeight: 'bold' }}>{user.username}</div>
                    <div style={{ fontSize: '12px', color: '#666' }}>{user.email}</div>
                  </div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    <div style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: user.isOnline ? '#10b981' : '#9ca3af'
                    }}></div>
                    <span style={{ fontSize: '12px', color: '#666' }}>
                      {user.isOnline ? 'Online' : 'Offline'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Messages Table */}
          <div style={{
            background: 'white',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{
              padding: '1rem',
              borderBottom: '1px solid #e1e5e9',
              fontWeight: 'bold'
            }}>
              Recent Messages
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: '1rem' }}>
              {adminMessages.slice(0, 20).map((message, index) => (
                <div key={index} style={{
                  padding: '0.5rem 0',
                  borderBottom: '1px solid #f0f0f0'
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '0.25rem'
                  }}>
                    <span style={{ fontWeight: 'bold', fontSize: '12px' }}>
                      {message.senderUsername}
                      {message.receiverUsername && ` → ${message.receiverUsername}`}
                    </span>
                    <span style={{
                      fontSize: '10px',
                      color: '#666',
                      background: message.messageType === 'private' ? '#fef3c7' : '#dbeafe',
                      padding: '2px 6px',
                      borderRadius: '10px'
                    }}>
                      {message.messageType}
                    </span>
                  </div>
                  <div style={{
                    fontSize: '12px',
                    color: '#333',
                    maxWidth: '100%',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {message.content}
                  </div>
                  <div style={{ fontSize: '10px', color: '#999', marginTop: '0.25rem' }}>
                    {new Date(message.timestamp).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      background: '#f5f7fa'
    }}>
      {/* Sidebar */}
      <div style={{
        width: '300px',
        background: 'white',
        borderRight: '1px solid #e1e5e9',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{
          padding: '1rem',
          borderBottom: '1px solid #e1e5e9',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white'
        }}>
          <h3 style={{ margin: 0, marginBottom: '0.5rem' }}>Chat App</h3>
          <p style={{ margin: 0, opacity: 0.9, fontSize: '14px' }}>Welcome, {username}</p>
          <button
            onClick={handleLogout}
            style={{
              marginTop: '0.5rem',
              padding: '4px 8px',
              background: 'rgba(255,255,255,0.2)',
              color: 'white',
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: '4px',
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            Logout
          </button>
        </div>

        {/* General Chat Option */}
        <div style={{ padding: '1rem', borderBottom: '1px solid #e1e5e9' }}>
          <div 
            onClick={backToGeneral}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '0.5rem',
              fontSize: '14px',
              cursor: 'pointer',
              borderRadius: '6px',
              backgroundColor: !selectedUser ? '#e0f2fe' : 'transparent',
              border: !selectedUser ? '1px solid #0284c7' : '1px solid transparent',
              fontWeight: 'bold'
            }}
          >
            # General Chat
          </div>
        </div>

        {/* Online Users */}
        <div style={{ padding: '1rem', borderBottom: '1px solid #e1e5e9' }}>
          <h4 style={{ margin: '0 0 0.5rem 0', color: '#333' }}>Users ({allUsers.length})</h4>
          {allUsers.length === 0 ? (
            <div style={{
              padding: '0.5rem',
              fontSize: '14px',
              color: '#666',
              fontStyle: 'italic',
              textAlign: 'center'
            }}>
              No other users
            </div>
          ) : (
            allUsers.map((user, index) => {
              const isOnline = user.isOnline;
              const lastSeen = user.lastSeen ? new Date(user.lastSeen).toLocaleString() : 'Never';
              
              return (
                <div 
                  key={index} 
                  onClick={() => selectUser(user.username)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0.5rem',
                    fontSize: '14px',
                    cursor: 'pointer',
                    borderRadius: '6px',
                    backgroundColor: selectedUser === user.username ? '#e0f2fe' : 'transparent',
                    border: selectedUser === user.username ? '1px solid #0284c7' : '1px solid transparent',
                    marginBottom: '0.25rem'
                  }}
                >
                  <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: isOnline ? '#4ade80' : '#9ca3af',
                    marginRight: '0.5rem'
                  }}></div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: isOnline ? 'bold' : 'normal' }}>
                      {user.username}
                    </div>
                    <div style={{ fontSize: '12px', color: '#666' }}>
                      {isOnline ? 'Online' : `Last seen: ${lastSeen}`}
                    </div>
                  </div>
                  {privateChats[user.username] && privateChats[user.username].length > 0 && (
                    <div style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: '#ef4444'
                    }}></div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Notifications */}
        <div style={{ padding: '1rem', flex: 1, overflowY: 'auto' }}>
          <h4 style={{ margin: '0 0 0.5rem 0', color: '#333' }}>Notifications</h4>
          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
            {notifications.slice(-5).map((notification, index) => (
              <div key={index} style={{
                padding: '0.5rem',
                background: '#f0f9ff',
                border: '1px solid #bae6fd',
                borderRadius: '6px',
                marginBottom: '0.5rem',
                fontSize: '12px',
                color: '#0369a1'
              }}>
                {notification.message || notification}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Chat Header */}
        <div style={{
          padding: '1rem',
          borderBottom: '1px solid #e1e5e9',
          background: 'white',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <h3 style={{ margin: 0, color: '#333' }}>
            {selectedUser ? `Private chat with ${selectedUser}` : 'General Chat'}
          </h3>
        </div>

        {/* Messages */}
        <div style={{
          flex: 1,
          padding: '1rem',
          overflowY: 'auto',
          background: '#fafbfc'
        }}>
          {(selectedUser ? privateChats[selectedUser] || [] : messages).map((msg, index) => {
            const isOwnMessage = msg.username === username;
            return (
              <div key={index} style={{
                display: 'flex',
                justifyContent: isOwnMessage ? 'flex-end' : 'flex-start',
                marginBottom: '1rem'
              }}>
                <div style={{
                  maxWidth: '70%',
                  padding: '0.75rem 1rem',
                  borderRadius: '18px',
                  background: isOwnMessage ? '#667eea' : 'white',
                  color: isOwnMessage ? 'white' : '#333',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}>
                  {!isOwnMessage && (
                    <div style={{
                      fontSize: '12px',
                      fontWeight: 'bold',
                      marginBottom: '0.25rem',
                      color: '#667eea'
                    }}>
                      {msg.username}
                    </div>
                  )}
                  <div>{msg.text || msg}</div>
                  {msg.timestamp && (
                    <div style={{
                      fontSize: '10px',
                      marginTop: '0.25rem',
                      opacity: 0.7
                    }}>
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div style={{
          padding: '1rem',
          background: 'white',
          borderTop: '1px solid #e1e5e9'
        }}>
          <form onSubmit={sendMessage} style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={selectedUser ? `Message ${selectedUser}...` : "Type your message..."}
              style={{
                flex: 1,
                padding: '12px 16px',
                border: '2px solid #e1e5e9',
                borderRadius: '25px',
                fontSize: '14px',
                outline: 'none'
              }}
            />
            <button
              type="submit"
              style={{
                padding: '12px 24px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '25px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 'bold'
              }}
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default App;