const express = require('express');
const pool = require('../db');
const { isValidId } = require('../helpers');

const router = express.Router();


router.get('/', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT id, type_name FROM item_types ORDER BY id ASC');
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Database error while fetching item types' });
    }
});


router.post('/', async (req, res) => {
    try {
        const typeName = req.body.type_name;
        if (!typeName || !String(typeName).trim()) {
            return res.status(400).json({ error: 'Item type name is required' });
        }

        const name = String(typeName).trim();
        const [result] = await pool.query('INSERT INTO item_types (type_name) VALUES (?)', [name]);
        res.status(201).json({
            message: 'Item type created successfully',
            id: result.insertId,
            type_name: name
        });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'Item type already exists' });
        }
        console.error(error);
        res.status(500).json({ error: 'Database error while creating item type' });
    }
});

router.put('/:id', async (req, res) => {
    try {
        if (!isValidId(req.params.id)) {
            return res.status(400).json({ error: 'Invalid item type ID' });
        }

        const typeName = req.body.type_name;
        if (!typeName || !String(typeName).trim()) {
            return res.status(400).json({ error: 'Item type name is required' });
        }

        const [result] = await pool.query(
            'UPDATE item_types SET type_name = ? WHERE id = ?',
            [String(typeName).trim(), Number(req.params.id)]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Item type not found' });
        }
        res.json({ message: 'Item type updated successfully' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'Item type already exists' });
        }
        console.error(error);
        res.status(500).json({ error: 'Database error while updating item type' });
    }
});


router.delete('/:id', async (req, res) => {
    try {
        if (!isValidId(req.params.id)) {
            return res.status(400).json({ error: 'Invalid item type ID' });
        }

        const [result] = await pool.query('DELETE FROM item_types WHERE id = ?', [Number(req.params.id)]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Item type not found' });
        }
        res.json({ message: 'Item type deleted successfully' });
    } catch (error) {
        
        if (error.code === 'ER_ROW_IS_REFERENCED_2') {
            return res.status(409).json({ error: 'Cannot delete item type because items are linked to it' });
        }
        console.error(error);
        res.status(500).json({ error: 'Database error while deleting item type' });
    }
});

module.exports = router;