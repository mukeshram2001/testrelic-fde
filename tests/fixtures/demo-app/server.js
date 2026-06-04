import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 3456;

// Seed data template
const defaultTasks = [
  // 18 Completed Tasks
  { id: 2, title: 'Write unit tests for auth', priority: 'medium', completed: true, overdue: false },
  { id: 3, title: 'Fix navigation bug on mobile', priority: 'high', completed: true, overdue: false },
  { id: 4, title: 'Database schema migration', priority: 'high', completed: true, overdue: false },
  { id: 5, title: 'Configure security groups', priority: 'high', completed: true, overdue: false },
  { id: 6, title: 'Set up SSL certificates', priority: 'medium', completed: true, overdue: false },
  { id: 7, title: 'Create user registration flow', priority: 'medium', completed: true, overdue: false },
  { id: 8, title: 'Implement password reset', priority: 'medium', completed: true, overdue: false },
  { id: 9, title: 'Integrate payment gateway', priority: 'high', completed: true, overdue: false },
  { id: 10, title: 'Design dashboard layout', priority: 'low', completed: true, overdue: false },
  { id: 11, title: 'Optimize database queries', priority: 'high', completed: true, overdue: false },
  { id: 12, title: 'Write API documentation', priority: 'low', completed: true, overdue: false },
  { id: 13, title: 'Set up error monitoring', priority: 'medium', completed: true, overdue: false },
  { id: 14, title: 'Implement rate limiting', priority: 'medium', completed: true, overdue: false },
  { id: 15, title: 'Add search functionality', priority: 'medium', completed: true, overdue: false },
  { id: 16, title: 'Refactor auth middleware', priority: 'high', completed: true, overdue: false },
  { id: 17, title: 'Configure CDN caching', priority: 'medium', completed: true, overdue: false },
  { id: 18, title: 'Conduct vulnerability scan', priority: 'high', completed: true, overdue: false },
  { id: 19, title: 'Update documentation', priority: 'low', completed: true, overdue: false },

  // 4 Pending Tasks
  { id: 1, title: 'Set up CI/CD pipeline', priority: 'high', completed: false, overdue: false },
  { id: 20, title: 'Review pull request #42', priority: 'high', completed: false, overdue: false },
  { id: 21, title: 'Analyze webpack bundle size', priority: 'medium', completed: false, overdue: false },
  { id: 22, title: 'Setup email notifications', priority: 'low', completed: false, overdue: false },

  // 2 Overdue Tasks
  { id: 23, title: 'Fix memory leak in websocket', priority: 'high', completed: false, overdue: true },
  { id: 24, title: 'Upgrade React versions', priority: 'high', completed: false, overdue: true }
];

// Client-isolated state mapping: clientId -> tasks list
const clientTasks = {};
const clientNextIds = {};

function getClientData(clientId) {
  if (!clientTasks[clientId]) {
    clientTasks[clientId] = JSON.parse(JSON.stringify(defaultTasks));
    clientNextIds[clientId] = 25;
  }
  return {
    tasks: clientTasks[clientId],
    nextId: clientNextIds[clientId],
    setNextId: (val) => { clientNextIds[clientId] = val; }
  };
}

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  // Extract client ID for test isolation
  const clientId = req.headers['x-client-id'] || 'default';

  // Set default API response headers
  if (pathname.startsWith('/api/')) {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Client-ID');

    if (method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }
  }

  // API Route: Login
  if (pathname === '/api/auth/login' && method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const credentials = JSON.parse(body);
        if (credentials.email === 'user@example.com' && credentials.password === 'password123') {
          res.writeHead(200);
          res.end(JSON.stringify({ success: true, user: { email: 'user@example.com' } }));
        } else {
          res.writeHead(400);
          res.end(JSON.stringify({ success: false, error: 'Invalid credentials' }));
        }
      } catch (err) {
        res.writeHead(400);
        res.end(JSON.stringify({ success: false, error: 'Bad Request' }));
      }
    });
    return;
  }

  // API Route: GET /api/tasks
  if (pathname === '/api/tasks' && method === 'GET') {
    const data = getClientData(clientId);
    res.writeHead(200);
    res.end(JSON.stringify(data.tasks));
    return;
  }

  // API Route: POST /api/tasks
  if (pathname === '/api/tasks' && method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        if (!payload.title) {
          res.writeHead(400);
          res.end(JSON.stringify({ success: false, error: 'Title is required' }));
          return;
        }
        const data = getClientData(clientId);
        const newTask = {
          id: data.nextId,
          title: payload.title,
          priority: payload.priority || 'medium',
          completed: false,
          overdue: false
        };
        data.tasks.push(newTask);
        data.setNextId(data.nextId + 1);
        res.writeHead(201);
        res.end(JSON.stringify(newTask));
      } catch (err) {
        res.writeHead(400);
        res.end(JSON.stringify({ success: false, error: 'Bad Request' }));
      }
    });
    return;
  }

  // API Route: PUT /api/tasks/:id
  if (pathname.startsWith('/api/tasks/') && method === 'PUT') {
    const idStr = pathname.split('/').pop();
    const id = parseInt(idStr || '', 10);
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        const data = getClientData(clientId);
        const taskIndex = data.tasks.findIndex(t => t.id === id);
        if (taskIndex === -1) {
          res.writeHead(404);
          res.end(JSON.stringify({ success: false, error: 'Task not found' }));
          return;
        }
        if (typeof payload.completed === 'boolean') {
          data.tasks[taskIndex].completed = payload.completed;
        }
        res.writeHead(200);
        res.end(JSON.stringify(data.tasks[taskIndex]));
      } catch (err) {
        res.writeHead(400);
        res.end(JSON.stringify({ success: false, error: 'Bad Request' }));
      }
    });
    return;
  }

  // Serve static HTML/CSS files
  if (method === 'GET') {
    let filePath = path.join(__dirname, pathname === '/' ? 'index.html' : pathname);
    
    // Safety check: ensure file path stays inside the fixtures directory
    if (!filePath.startsWith(__dirname)) {
      res.writeHead(403);
      res.end('Access Denied');
      return;
    }

    fs.readFile(filePath, (err, content) => {
      if (err) {
        if (err.code === 'ENOENT') {
          res.writeHead(404);
          res.end('Not Found');
        } else {
          res.writeHead(500);
          res.end(`Server Error: ${err.code}`);
        }
      } else {
        let contentType = 'text/html';
        if (filePath.endsWith('.css')) contentType = 'text/css';
        if (filePath.endsWith('.js')) contentType = 'text/javascript';
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content, 'utf-8');
      }
    });
    return;
  }

  res.writeHead(404);
  res.end('Not Found');
});

server.listen(PORT, () => {
  console.log(`TaskFlow Server is running at http://localhost:${PORT}`);
});
