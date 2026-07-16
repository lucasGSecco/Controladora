require('dotenv').config();
const express = require('express');
const path = require('path');
const voucherRoutes = require('./src/routes/voucherRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/vouchers', voucherRoutes);

// tratamento de erro generico
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Erro interno no servidor.' });
});

app.listen(PORT, () => {
  console.log(`Uniserv Voucher App rodando em http://localhost:${PORT}`);
});
