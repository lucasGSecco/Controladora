require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const voucherRoutes = require('./src/routes/voucherRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'uniserv-secret-key-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 15 * 60 * 1000,
      httpOnly: true,
      secure: false,
    },
  })
);

app.get(['/', '/index.html'], (req, res) => {
  if (!req.session || !req.session.unifi) {
    return res.redirect('/login.html');
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});;

app.use(express.static(path.join(__dirname, 'public')));

app.use('/api', voucherRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Erro interno no servidor.' });
});

app.listen(PORT, () => {
  console.log(`Uniserv Voucher App rodando em http://localhost:${PORT}`);
});