require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./config/db');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

// Serve frontend dari root repo
app.use(express.static(path.join(__dirname)));

// Routes API
app.use('/api/auth', require('./routes/auth'));
app.use('/api/aspirasi', require('./routes/aspirasi'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/voting', require('./routes/voting'));

app.get('*', (req, res) => {
  // Kalau ada ekstensi file (.html, .css, .js, dll), serve file itu
  if (path.extname(req.path)) {
    res.sendFile(path.join(__dirname, req.path), (err) => {
      if (err) res.status(404).send('Not found');
    });
  } else {
    // Kalau tidak ada ekstensi, fallback ke index.html
    res.sendFile(path.join(__dirname, 'index.html'));
  }
});

app.listen(PORT, () => {
  console.log(`Server aktif di port ${PORT}`);
});
