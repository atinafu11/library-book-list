const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// MIDDLEWARE
// ============================================

// Parse JSON bodies
app.use(express.json());

// Simple request logger (optional but useful)
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// ============================================
// AUTHENTICATION MIDDLEWARE
// Uses query param: ?role=librarian
// ============================================
function authenticateLibrarian(req, res, next) {
  const { role } = req.query;

  if (!role) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Provide ?role=librarian query parameter.'
    });
  }

  if (role.toLowerCase() !== 'librarian') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Only librarians can perform this action.'
    });
  }

  // Attach user info to request for downstream handlers
  req.user = { role: 'librarian' };
  next();
}

// ============================================
// IN-MEMORY DATA STORE
// ============================================
let books = [
  { id: 1, title: 'Things Fall Apart', author: 'Chinua Achebe', year: 1958, genre: 'Fiction', available: true },
  { id: 2, title: 'The River Between', author: 'Ngũgĩ wa Thiong\'o', year: 1965, genre: 'Fiction', available: true },
  { id: 3, title: 'Clean Code', author: 'Robert C. Martin', year: 2008, genre: 'Technology', available: false }
];

let nextId = 4;

// ============================================
// ROUTES
// ============================================

// Root — welcome / API info
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Welcome to the Library Management System API',
    endpoints: {
      'GET /books': 'List all books (public)',
      'GET /books/:id': 'Get one book (public)',
      'GET /books?genre=&author=&available=': 'Filter books (public)',
      'POST /books?role=librarian': 'Create a book (librarian only)',
      'PUT /books/:id?role=librarian': 'Update a book (librarian only)',
      'DELETE /books/:id?role=librarian': 'Delete a book (librarian only)'
    }
  });
});

// --------------------------------------------
// GET /books — Read all books (public)
// Supports query filters: ?genre=, ?author=, ?available=
// --------------------------------------------
app.get('/books', (req, res) => {
  const { genre, author, available } = req.query;
  let result = [...books];

  if (genre) {
    result = result.filter(b => b.genre.toLowerCase() === genre.toLowerCase());
  }
  if (author) {
    result = result.filter(b => b.author.toLowerCase().includes(author.toLowerCase()));
  }
  if (available !== undefined) {
    const isAvailable = available === 'true';
    result = result.filter(b => b.available === isAvailable);
  }

  res.status(200).json({
    success: true,
    count: result.length,
    data: result
  });
});

// --------------------------------------------
// GET /books/:id — Read one book (public)
// --------------------------------------------
app.get('/books/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const book = books.find(b => b.id === id);

  if (!book) {
    return res.status(404).json({
      success: false,
      message: `Book with id ${id} not found`
    });
  }

  res.status(200).json({ success: true, data: book });
});

// --------------------------------------------
// POST /books — Create a book (librarian only)
// --------------------------------------------
app.post('/books', authenticateLibrarian, (req, res) => {
  const { title, author, year, genre, available } = req.body;

  // Validation
  if (!title || !author) {
    return res.status(400).json({
      success: false,
      message: 'Both "title" and "author" fields are required'
    });
  }

  const newBook = {
    id: nextId++,
    title,
    author,
    year: year || null,
    genre: genre || 'Uncategorized',
    available: available !== undefined ? available : true
  };

  books.push(newBook);

  res.status(201).json({
    success: true,
    message: 'Book created successfully',
    data: newBook
  });
});

// --------------------------------------------
// PUT /books/:id — Update a book (librarian only)
// --------------------------------------------
app.put('/books/:id', authenticateLibrarian, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const book = books.find(b => b.id === id);

  if (!book) {
    return res.status(404).json({
      success: false,
      message: `Book with id ${id} not found`
    });
  }

  const { title, author, year, genre, available } = req.body;

  if (title !== undefined) book.title = title;
  if (author !== undefined) book.author = author;
  if (year !== undefined) book.year = year;
  if (genre !== undefined) book.genre = genre;
  if (available !== undefined) book.available = available;

  res.status(200).json({
    success: true,
    message: 'Book updated successfully',
    data: book
  });
});

// --------------------------------------------
// DELETE /books/:id — Delete a book (librarian only)
// --------------------------------------------
app.delete('/books/:id', authenticateLibrarian, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const index = books.findIndex(b => b.id === id);

  if (index === -1) {
    return res.status(404).json({
      success: false,
      message: `Book with id ${id} not found`
    });
  }

  const deleted = books.splice(index, 1)[0];

  res.status(200).json({
    success: true,
    message: 'Book deleted successfully',
    data: deleted
  });
});

// ============================================
// 404 HANDLER — unknown routes
// ============================================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`
  });
});

// ============================================
// GLOBAL ERROR HANDLER
// ============================================
app.use((err, req, res, next) => {
  console.error('Error:', err.message);

  // Invalid JSON body
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      message: 'Invalid JSON in request body'
    });
  }

  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

// ============================================
// START SERVER
// ============================================
app.listen(PORT, () => {
  console.log(`Library API running on http://localhost:${PORT}`);
});

module.exports = app; // for testing