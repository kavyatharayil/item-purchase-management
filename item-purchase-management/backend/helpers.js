const pool = require('./db');


function isValidDate(text) {
    if (!text) return false;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
    const d = new Date(text);
    if (isNaN(d.getTime())) return false;
    return d.toISOString().slice(0, 10) === text;
}


function isValidId(value) {
    const n = Number(value);
    return Number.isInteger(n) && n > 0;
}


function getActive(value, defaultValue) {
    if (value === undefined || value === null) {
        return defaultValue;
    }
    return value === true || value === 'true' || value === 1;
}


async function checkItemData(body) {
    if (!body.name || !String(body.name).trim()) {
        return 'Item name is required';
    }

    const typeId = Number(body.item_type_id);
    if (!Number.isInteger(typeId) || typeId <= 0) {
        return 'Invalid item type';
    }

    if (!isValidDate(body.purchase_date)) {
        return 'Valid purchase date is required (YYYY-MM-DD)';
    }

    const stock = Number(body.stock_available);
    if (body.stock_available === undefined || body.stock_available === null ||
        body.stock_available === '' || !Number.isInteger(stock) || stock < 0) {
        return 'Stock available must be a non-negative integer (0 or more)';
    }

    
    const [rows] = await pool.query('SELECT id FROM item_types WHERE id = ?', [typeId]);
    if (rows.length === 0) {
        return 'Invalid item type';
    }

    return null;
}


function checkLines(items) {
    if (!Array.isArray(items) || items.length === 0) {
        return 'Purchase must contain at least one item';
    }

    const seen = [];
    for (const line of items) {
        const itemId = Number(line && line.item_id);
        const qty = Number(line && line.quantity);

        if (!Number.isInteger(itemId) || itemId <= 0) {
            return 'Invalid item selected in purchase';
        }
        if (!Number.isInteger(qty) || qty <= 0) {
            return 'Quantity must be greater than zero';
        }
        if (seen.includes(itemId)) {
            return 'Duplicate items within one order are not allowed';
        }
        seen.push(itemId);
    }
    return null;
}

module.exports = { isValidDate, isValidId, getActive, checkItemData, checkLines };