const express = require('express');
const cors = require('cors');
const empresasRoutes = require('./routes/empresasRoutes');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

app.use('/api', empresasRoutes);

app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});