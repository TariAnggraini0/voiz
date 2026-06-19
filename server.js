require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./config/db');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

// Routes API
app.use('/api/auth', require('./routes/auth'));
app.use('/api/aspirasi', require('./routes/aspirasi'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/voting', require('./routes/voting'));

// Serve file HTML satu per satu
app.get('/kirim-aspirasi.html', (req, res) => res.sendFile(path.join(__dirname, 'kirim-aspirasi.html')));
app.get('/dashboard.html', (req, res) => res.sendFile(path.join(__dirname, 'dashboard.html')));
app.get('/login.html', (req, res) => res.sendFile(path.join(__dirname, 'login.html')));
app.get('/register.html', (req, res) => res.sendFile(path.join(__dirname, 'register.html')));
app.get('/admin.html', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));

// Static assets (css, js)
app.use(express.static(path.join(__dirname)));

// Root
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.listen(PORT, () => {
  console.log(`Server aktif di port ${PORT}`);
});
