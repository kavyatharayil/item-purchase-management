const express = require('express');
const pool = require('../db');
const { isValidId, getActive, checkItemData } = require('../helpers');

const router = express.Router();

const itemQuery = `
    SELECT i.id, i.name, i.item_type_id, it.type_name,
           DATE_FORMAT(i.purchase_date, '%Y-%m-%d') AS purchase_date,
           i.stock_available, i.active, i.created_at, i.updated_at
    FROM items i
    JOIN item_types it ON i.item_type_id = it.id
`;


router.get('/', async (req, res) => {
    try {
        const [rows] = await pool.query(itemQuery + ' ORDER BY i.id ASC');
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Database error while fetching items' });
    }
});


router.get('/:id', async (req, res) => {
    try {
        if (!isValidId(req.params.id)) {
            return res.status(400).json({ error: 'Invalid item ID' });
        }

        const [rows] = await pool.query(itemQuery + ' WHERE i.id = ?', [Number(req.params.id)]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Item not found' });
        }
        res.json(rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Database error while fetching item details' });
    }
});


router.post('/', async (req, res) => {
    try {
        const body = req.body;

        const problem = await checkItemData(body);
        if (problem) {
            return res.status(400).json({ error: problem });
        }

        const active = getActive(body.active, true);   // default is active

        const [result] = await pool.query(
            'INSERT INTO items (name, item_type_id, purchase_date, stock_available, active) VALUES (?, ?, ?, ?, ?)',
            [String(body.name).trim(), Number(body.item_type_id), body.purchase_date, Number(body.stock_available), active]
        );
        res.status(201).json({ message: 'Item created successfully', id: result.insertId });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Database error while creating item' });
    }
});


router.put('/:id', async (req, res) => {
    try {
        if (!isValidId(req.params.id)) {
            return res.status(400).json({ error: 'Invalid item ID' });
        }
        const id = Number(req.params.id);
        const body = req.body;

        const [existing] = await pool.query('SELECT id, active FROM items WHERE id = ?', [id]);
        if (existing.length === 0) {
            return res.status(404).json({ error: 'Item not found' });
        }

        const problem = await checkItemData(body);
        if (problem) {
            return res.status(400).json({ error: problem });
        }

        
        const active = getActive(body.active, Boolean(existing[0].active));

        await pool.query(
            'UPDATE items SET name = ?, item_type_id = ?, purchase_date = ?, stock_available = ?, active = ? WHERE id = ?',
            [String(body.name).trim(), Number(body.item_type_id), body.purchase_date, Number(body.stock_available), active, id]
        );
        res.json({ message: 'Item updated successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Database error while updating item' });
    }
});


router.delete('/:id', async (req, res) => {
    try {
        if (!isValidId(req.params.id)) {
            return res.status(400).json({ error: 'Invalid item ID' });
        }
        const id = Number(req.params.id);

        const [existing] = await pool.query('SELECT id FROM items WHERE id = ?', [id]);
        if (existing.length === 0) {
            return res.status(404).json({ error: 'Item not found' });
        }

        
        const [used] = await pool.query('SELECT COUNT(*) AS count FROM purchase_items WHERE item_id = ?', [id]);
        if (used[0].count > 0) {
            return res.status(409).json({
                error: 'Cannot delete this item because it has existing purchase history. Please mark it as Inactive instead.'
            });
        }

        await pool.query('DELETE FROM items WHERE id = ?', [id]);
        res.json({ message: 'Item deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Database error while deleting item' });
    }
});

module.exports = router;