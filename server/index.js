require('dotenv').config();

const path = require('path');
const express = require('express');
const apiRoutes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3000;

// 20mb cobre um PDF de até ~15MB (a codificação base64 do upload da Etapa 3
// infla o tamanho original em ~33%).
app.use(express.json({ limit: '20mb' }));

app.use('/api', apiRoutes);

app.use('/assets', express.static(path.join(__dirname, '..', 'assets')));
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[erro nao tratado]', err);
  res.status(500).json({ error: 'Erro interno do servidor.' });
});

app.listen(PORT, () => {
  console.log(`Diagnóstico de Maturidade Digital rodando em http://localhost:${PORT}`);
});
