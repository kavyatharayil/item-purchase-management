const express = require('express');
const pool = require('../db');
const { isValidDate, isValidId, checkLines } = require('../helpers');

const router = express.Router();



router.get('/', async (req, res) => {
    try {
        const [purchases] = await pool.query(`
            SELECT id, order_id, DATE_FORMAT(purchase_date, '%Y-%m-%d') AS purchase_date, created_at, updated_at
            FROM purchases
            ORDER BY id DESC
        `);

        
        const [lines] = await pool.query(`
            SELECT pi.purchase_id, p.order_id, DATE_FORMAT(p.purchase_date, '%Y-%m-%d') AS purchase_date,
                   i.id AS item_id, i.name AS item_name, it.type_name, pi.quantity, i.stock_available
            FROM purchases p
            JOIN purchase_items pi ON p.id = pi.purchase_id
            JOIN items i ON pi.item_id = i.id
            JOIN item_types it ON i.item_type_id = it.id
            ORDER BY pi.id ASC
        `);

        
        for (const p of purchases) {
            p.items = lines.filter(line => line.purchase_id === p.id);
        }
        res.json(purchases);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Database error while fetching purchases' });
    }
});


router.get('/:id', async (req, res) => {
    try {
        const param = String(req.params.id).trim();
        const column = /^\d+$/.test(param) ? 'id' : 'order_id';

        const [found] = await pool.query(
            `SELECT id, order_id, DATE_FORMAT(purchase_date, '%Y-%m-%d') AS purchase_date, created_at, updated_at
             FROM purchases WHERE ${column} = ?`,
            [param]
        );
        if (found.length === 0) {
            return res.status(404).json({ error: 'Purchase order not found' });
        }
        const purchase = found[0];

        
        const [items] = await pool.query(
            `SELECT p.order_id, DATE_FORMAT(p.purchase_date, '%Y-%m-%d') AS purchase_date,
                    i.id AS item_id, i.name AS item_name, it.type_name, pi.quantity,
                    i.stock_available, i.active
             FROM purchases p
             JOIN purchase_items pi ON p.id = pi.purchase_id
             JOIN items i ON pi.item_id = i.id
             JOIN item_types it ON i.item_type_id = it.id
             WHERE p.order_id = ?
             ORDER BY pi.id ASC`,
            [purchase.order_id]
        );

        purchase.items = items;
        res.json(purchase);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Database error while fetching purchase details' });
    }
});


router.post('/', async (req, res) => {
    let connection;
    try {
        let orderId = req.body.order_id;
        const purchaseDate = req.body.purchase_date;
        const items = req.body.items;

        if (!isValidDate(purchaseDate)) {
            return res.status(400).json({ error: 'Valid purchase date is required (YYYY-MM-DD)' });
        }
        const problem = checkLines(items);
        if (problem) {
            return res.status(400).json({ error: problem });
        }

        connection = await pool.getConnection();
        await connection.beginTransaction();

        
        if (!orderId || !String(orderId).trim()) {
            const [maxRows] = await connection.query(
                'SELECT IFNULL(MAX(id), 0) + 1 AS nextId FROM purchases FOR UPDATE'
            );
            orderId = 'PO-' + String(maxRows[0].nextId).padStart(5, '0');
        } else {
            orderId = String(orderId).trim();
        }

        
        const [same] = await connection.query('SELECT id FROM purchases WHERE order_id = ?', [orderId]);
        if (same.length > 0) {
            await connection.rollback();
            return res.status(409).json({ error: 'Order ID ' + orderId + ' already exists' });
        }

       
        for (const line of items) {
            const qty = Number(line.quantity);
            const [rows] = await connection.query(
                'SELECT id, name, stock_available, active FROM items WHERE id = ? FOR UPDATE',
                [Number(line.item_id)]
            );

            if (rows.length === 0) {
                await connection.rollback();
                return res.status(404).json({ error: 'Item not found' });
            }
            const item = rows[0];

            if (!item.active) {
                await connection.rollback();
                return res.status(409).json({ error: 'Item "' + item.name + '" is inactive and cannot be purchased' });
            }
            if (qty > item.stock_available) {
                await connection.rollback();
                return res.status(409).json({
                    error: 'Insufficient stock for "' + item.name + '". Available quantity: ' +
                           item.stock_available + ', Requested: ' + qty
                });
            }
        }

        
        const [saved] = await connection.query(
            'INSERT INTO purchases (order_id, purchase_date) VALUES (?, ?)',
            [orderId, purchaseDate]
        );
        const purchaseId = saved.insertId;

        
        for (const line of items) {
            await connection.query(
                'INSERT INTO purchase_items (purchase_id, item_id, quantity) VALUES (?, ?, ?)',
                [purchaseId, Number(line.item_id), Number(line.quantity)]
            );
            await connection.query(
                'UPDATE items SET stock_available = stock_available - ? WHERE id = ?',
                [Number(line.quantity), Number(line.item_id)]
            );
        }

        await connection.commit();
        res.status(201).json({ message: 'Purchase created successfully', id: purchaseId, order_id: orderId });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error(error);
        res.status(500).json({ error: 'Database error while processing purchase' });
    } finally {
        if (connection) connection.release();
    }
});

router.put('/:id', async (req, res) => {
    let connection;
    try {
        if (!isValidId(req.params.id)) {
            return res.status(400).json({ error: 'Invalid purchase ID' });
        }
        const purchaseId = Number(req.params.id);
        const purchaseDate = req.body.purchase_date;
        const items = req.body.items;

        if (!isValidDate(purchaseDate)) {
            return res.status(400).json({ error: 'Valid purchase date is required (YYYY-MM-DD)' });
        }
        const problem = checkLines(items);
        if (problem) {
            return res.status(400).json({ error: problem });
        }

        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [purchase] = await connection.query(
            'SELECT id, order_id FROM purchases WHERE id = ? FOR UPDATE',
            [purchaseId]
        );
        if (purchase.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Purchase order not found' });
        }

        
        const [oldLines] = await connection.query(
            'SELECT item_id, quantity FROM purchase_items WHERE purchase_id = ? FOR UPDATE',
            [purchaseId]
        );
        const oldQty = {};
        for (const line of oldLines) {
            oldQty[line.item_id] = line.quantity;
        }

        
        const newQty = {};
        for (const line of items) {
            newQty[Number(line.item_id)] = Number(line.quantity);
        }

        
        const allIds = new Set([...Object.keys(oldQty), ...Object.keys(newQty)].map(Number));

        for (const itemId of allIds) {
            const before = oldQty[itemId] || 0;
            const after = newQty[itemId] || 0;
            const difference = after - before;   // plus = take more stock, minus = give stock back

            const [rows] = await connection.query(
                'SELECT id, name, stock_available, active FROM items WHERE id = ? FOR UPDATE',
                [itemId]
            );
            if (rows.length === 0) {
                await connection.rollback();
                return res.status(404).json({ error: 'Item not found' });
            }
            const item = rows[0];

            
            if (after > before && !item.active) {
                await connection.rollback();
                return res.status(409).json({ error: 'Item "' + item.name + '" is inactive and cannot be purchased' });
            }

            
            if (difference > item.stock_available) {
                await connection.rollback();
                return res.status(409).json({
                    error: 'Insufficient stock for "' + item.name + '". Available stock: ' +
                           item.stock_available + ', Additional needed: ' + difference
                });
            }

            if (difference !== 0) {
                await connection.query(
                    'UPDATE items SET stock_available = stock_available - ? WHERE id = ?',
                    [difference, itemId]
                );
            }
        }

        await connection.query('UPDATE purchases SET purchase_date = ? WHERE id = ?', [purchaseDate, purchaseId]);

    
        await connection.query('DELETE FROM purchase_items WHERE purchase_id = ?', [purchaseId]);
        for (const line of items) {
            await connection.query(
                'INSERT INTO purchase_items (purchase_id, item_id, quantity) VALUES (?, ?, ?)',
                [purchaseId, Number(line.item_id), Number(line.quantity)]
            );
        }

        await connection.commit();
        res.json({
            message: 'Purchase updated and stock adjusted successfully',
            order_id: purchase[0].order_id
        });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error(error);
        res.status(500).json({ error: 'Database error while updating purchase' });
    } finally {
        if (connection) connection.release();
    }
});

module.exports = router;