const express = require('express');
const path = require('path');
require('dotenv').config();
const pool = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));


app.use('/api/item-types', require('./routes/itemTypes'));
app.use('/api/items', require('./routes/items'));
app.use('/api/purchases', require('./routes/purchases'));


app.use('/api', (req, res) => {
    res.status(404).json({ error: 'API route not found' });
});


app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({ error: 'Malformed JSON request body' });
    }
    console.error(err);
    res.status(500).json({ error: 'Unexpected server error' });
});


app.listen(PORT, async () => {
    try {
        const connection = await pool.getConnection();
        console.log('Connected to MySQL database successfully!');
        connection.release();
    } catch (error) {
        console.error('Failed to connect to MySQL:', error.message);
    }
    console.log('Server is running at http://localhost:' + PORT);
});