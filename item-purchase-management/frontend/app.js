
let allTypes = [];
let allItems = [];
let orderLines = [];

function safe(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function today() {
    const d = new Date();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + month + '-' + day;
}

async function callApi(url, method, body) {
    const options = { method: method || 'GET', headers: {} };
    if (body) {
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(body);
    }
    const response = await fetch(url, options);
    let data = {};
    try {
        data = await response.json();
    } catch (e) {
        data = {};
    }
    return { ok: response.ok, data: data };
}

function showMessage(text, type) {
    const box = document.getElementById('alert-box');
    box.textContent = text;
    box.className = 'alert ' + (type === 'error' ? 'alert-error' : 'alert-success');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(function () {
        box.classList.add('hidden');
    }, 5000);
}

function stockBadge(stock) {
    const qty = Number(stock);
    if (qty <= 0) {
        return '<span class="badge badge-danger">Out of Stock</span>';
    }
    if (qty <= 5) {
        return '<span class="badge badge-warning">Low Stock (' + qty + ')</span>';
    }
    return '<span class="badge badge-success">In Stock</span>';
}

function activeBadge(active) {
    if (active) {
        return '<span class="badge badge-success">Active</span>';
    }
    return '<span class="badge badge-danger">Inactive</span>';
}

document.addEventListener('DOMContentLoaded', async function () {
    document.getElementById('item-date').value = today();
    document.getElementById('order-date').value = today();

    await loadTypes();
    await loadItems();
    await loadPurchases();
});

function switchTab(tabId, button) {
    const sections = document.querySelectorAll('.tab-content');
    const buttons = document.querySelectorAll('.tab-btn');

    sections.forEach(function (s) { s.classList.remove('active'); });
    buttons.forEach(function (b) { b.classList.remove('active'); });

    document.getElementById(tabId).classList.add('active');
    if (button) {
        button.classList.add('active');
    }
}

async function loadTypes() {
    try {
        const result = await callApi('/api/item-types');
        if (!result.ok) {
            showMessage(result.data.error || 'Could not load item types', 'error');
            return;
        }
        allTypes = result.data;

        const select = document.getElementById('item-type');
        const chosen = select.value;
        let options = '<option value="">-- Select Item Type --</option>';
        for (const t of allTypes) {
            options += '<option value="' + t.id + '">' + safe(t.type_name) + '</option>';
        }
        select.innerHTML = options;
        select.value = chosen;

        const body = document.getElementById('types-table-body');
        if (allTypes.length === 0) {
            body.innerHTML = '<tr><td colspan="3" class="text-center">No item types found.</td></tr>';
            return;
        }
        let rows = '';
        for (const t of allTypes) {
            rows += '<tr>' +
                '<td>' + t.id + '</td>' +
                '<td>' + safe(t.type_name) + '</td>' +
                '<td class="action-group">' +
                    '<button class="btn btn-sm btn-secondary" onclick="editType(' + t.id + ')">Edit</button>' +
                    '<button class="btn btn-sm btn-danger" onclick="deleteType(' + t.id + ')">Delete</button>' +
                '</td>' +
                '</tr>';
        }
        body.innerHTML = rows;
    } catch (error) {
        showMessage('Could not load item types', 'error');
    }
}

async function handleTypeSubmit(event) {
    event.preventDefault();

    const id = document.getElementById('type-id').value;
    const typeName = document.getElementById('type-name').value.trim();

    let url = '/api/item-types';
    let method = 'POST';
    if (id) {
        url = '/api/item-types/' + id;
        method = 'PUT';
    }

    try {
        const result = await callApi(url, method, { type_name: typeName });
        if (!result.ok) {
            showMessage(result.data.error || 'Could not save item type', 'error');
            return;
        }
        showMessage(result.data.message, 'success');
        resetTypeForm();
        await loadTypes();
        await loadItems();
    } catch (error) {
        showMessage('Network error while saving item type', 'error');
    }
}

function editType(id) {
    const type = allTypes.find(function (t) { return t.id === id; });
    if (!type) return;

    document.getElementById('type-id').value = type.id;
    document.getElementById('type-name').value = type.type_name;
    document.getElementById('type-form-title').textContent = 'Edit Item Type #' + type.id;
    document.getElementById('type-submit-btn').textContent = 'Update Item Type';
    document.getElementById('type-cancel-btn').classList.remove('hidden');
}

function resetTypeForm() {
    document.getElementById('type-id').value = '';
    document.getElementById('type-name').value = '';
    document.getElementById('type-form-title').textContent = 'Create Item Type';
    document.getElementById('type-submit-btn').textContent = 'Save Item Type';
    document.getElementById('type-cancel-btn').classList.add('hidden');
}

async function deleteType(id) {
    if (!confirm('Delete this Item Type?')) return;

    try {
        const result = await callApi('/api/item-types/' + id, 'DELETE');
        if (!result.ok) {
            showMessage(result.data.error || 'Could not delete item type', 'error');
            return;
        }
        showMessage(result.data.message, 'success');
        await loadTypes();
    } catch (error) {
        showMessage('Could not delete item type', 'error');
    }
}

async function loadItems() {
    try {
        const result = await callApi('/api/items');
        if (!result.ok) {
            showMessage(result.data.error || 'Could not load items', 'error');
            return;
        }
        allItems = result.data;

        const itemsBody = document.getElementById('items-table-body');
        const stockBody = document.getElementById('stock-table-body');

        if (allItems.length === 0) {
            itemsBody.innerHTML = '<tr><td colspan="8" class="text-center">No items created yet. Use the form on the left to add items.</td></tr>';
            stockBody.innerHTML = '<tr><td colspan="6" class="text-center">No items found.</td></tr>';
        } else {
            let itemRows = '';
            let stockRows = '';

            for (const item of allItems) {
                let toggleText = 'Activate';
                if (item.active) {
                    toggleText = 'Deactivate';
                }

                itemRows += '<tr>' +
                    '<td>' + item.id + '</td>' +
                    '<td><strong>' + safe(item.name) + '</strong></td>' +
                    '<td>' + safe(item.type_name) + '</td>' +
                    '<td>' + safe(item.purchase_date) + '</td>' +
                    '<td><strong>' + item.stock_available + '</strong></td>' +
                    '<td>' + stockBadge(item.stock_available) + '</td>' +
                    '<td>' + activeBadge(item.active) + '</td>' +
                    '<td class="action-group">' +
                        '<button class="btn btn-sm btn-info" onclick="viewItem(' + item.id + ')">View</button>' +
                        '<button class="btn btn-sm btn-secondary" onclick="editItem(' + item.id + ')">Edit</button>' +
                        '<button class="btn btn-sm btn-warning" onclick="toggleItem(' + item.id + ')">' + toggleText + '</button>' +
                        '<button class="btn btn-sm btn-danger" onclick="deleteItem(' + item.id + ')">Delete</button>' +
                    '</td>' +
                    '</tr>';

                stockRows += '<tr>' +
                    '<td>' + item.id + '</td>' +
                    '<td><strong>' + safe(item.name) + '</strong></td>' +
                    '<td>' + safe(item.type_name) + '</td>' +
                    '<td><strong>' + item.stock_available + '</strong></td>' +
                    '<td>' + stockBadge(item.stock_available) + '</td>' +
                    '<td>' + activeBadge(item.active) + '</td>' +
                    '</tr>';
            }

            itemsBody.innerHTML = itemRows;
            stockBody.innerHTML = stockRows;
        }

        let options = '<option value="">-- Choose an Active Item --</option>';
        for (const item of allItems) {
            if (item.active) {
                options += '<option value="' + item.id + '">' +
                    safe(item.name) + ' (' + safe(item.type_name) + ') - Stock: ' + item.stock_available +
                    '</option>';
            }
        }
        document.getElementById('select-purchase-item').innerHTML = options;
    } catch (error) {
        showMessage('Could not load items', 'error');
    }
}

async function handleItemSubmit(event) {
    event.preventDefault();

    const id = document.getElementById('item-id').value;
    const data = {
        name: document.getElementById('item-name').value.trim(),
        item_type_id: Number(document.getElementById('item-type').value),
        purchase_date: document.getElementById('item-date').value,
        stock_available: Number(document.getElementById('item-stock').value),
        active: document.getElementById('item-status').value === 'true'
    };

    let url = '/api/items';
    let method = 'POST';
    if (id) {
        url = '/api/items/' + id;
        method = 'PUT';
    }

    try {
        const result = await callApi(url, method, data);
        if (!result.ok) {
            showMessage(result.data.error || 'Could not save item', 'error');
            return;
        }
        showMessage(result.data.message, 'success');
        resetItemForm();
        await loadItems();
    } catch (error) {
        showMessage('Could not save item', 'error');
    }
}

function editItem(id) {
    const item = allItems.find(function (i) { return i.id === id; });
    if (!item) return;

    document.getElementById('item-id').value = item.id;
    document.getElementById('item-name').value = item.name;
    document.getElementById('item-type').value = item.item_type_id;
    document.getElementById('item-date').value = item.purchase_date;
    document.getElementById('item-stock').value = item.stock_available;
    document.getElementById('item-status').value = item.active ? 'true' : 'false';

    document.getElementById('item-form-title').textContent = 'Update Item #' + item.id;
    document.getElementById('item-submit-btn').textContent = 'Update Item';
    document.getElementById('item-cancel-btn').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetItemForm() {
    document.getElementById('item-id').value = '';
    document.getElementById('item-name').value = '';
    document.getElementById('item-type').value = '';
    document.getElementById('item-date').value = today();
    document.getElementById('item-stock').value = '';
    document.getElementById('item-status').value = 'true';

    document.getElementById('item-form-title').textContent = 'Create New Item';
    document.getElementById('item-submit-btn').textContent = 'Save Item';
    document.getElementById('item-cancel-btn').classList.add('hidden');
}

async function toggleItem(id) {
    const item = allItems.find(function (i) { return i.id === id; });
    if (!item) return;

    const newActive = !item.active;

    try {
        const result = await callApi('/api/items/' + id, 'PUT', {
            name: item.name,
            item_type_id: item.item_type_id,
            purchase_date: item.purchase_date,
            stock_available: item.stock_available,
            active: newActive
        });
        if (!result.ok) {
            showMessage(result.data.error || 'Could not change status', 'error');
            return;
        }
        showMessage('Item "' + item.name + '" is now ' + (newActive ? 'Active' : 'Inactive'), 'success');
        await loadItems();
    } catch (error) {
        showMessage('Could not change status', 'error');
    }
}

async function deleteItem(id) {
    if (!confirm('Are you sure you want to delete this item?')) return;

    try {
        const result = await callApi('/api/items/' + id, 'DELETE');
        if (!result.ok) {
            showMessage(result.data.error || 'Could not delete item', 'error');
            return;
        }
        showMessage(result.data.message, 'success');
        await loadItems();
    } catch (error) {
        showMessage('Could not delete item', 'error');
    }
}

async function viewItem(id) {
    try {
        const result = await callApi('/api/items/' + id);
        if (!result.ok) {
            showMessage(result.data.error || 'Could not load item', 'error');
            return;
        }
        const item = result.data;

        document.getElementById('modal-title').textContent = 'Item Details - #' + item.id;
        document.getElementById('modal-body').innerHTML =
            '<table>' +
            '<tr><th>Item ID</th><td>' + item.id + '</td></tr>' +
            '<tr><th>Item Name</th><td><strong>' + safe(item.name) + '</strong></td></tr>' +
            '<tr><th>Item Type</th><td>' + safe(item.type_name) + '</td></tr>' +
            '<tr><th>Purchase Date</th><td>' + safe(item.purchase_date) + '</td></tr>' +
            '<tr><th>Current Stock</th><td>' + item.stock_available + '</td></tr>' +
            '<tr><th>Availability</th><td>' + stockBadge(item.stock_available) + '</td></tr>' +
            '<tr><th>Status</th><td>' + (item.active ? 'Active' : 'Inactive') + '</td></tr>' +
            '</table>';
        document.getElementById('details-modal').classList.remove('hidden');
    } catch (error) {
        showMessage('Could not load item', 'error');
    }
}

function addOrderLine() {
    const itemId = Number(document.getElementById('select-purchase-item').value);
    const qty = Number(document.getElementById('purchase-qty').value);

    if (!itemId) {
        showMessage('Please select an Active Item first', 'error');
        return;
    }
    if (!Number.isInteger(qty) || qty <= 0) {
        showMessage('Quantity must be greater than zero', 'error');
        return;
    }

    const item = allItems.find(function (i) { return i.id === itemId; });
    if (!item) {
        showMessage('Selected item not found', 'error');
        return;
    }
    if (!item.active) {
        showMessage('Inactive item cannot be purchased', 'error');
        return;
    }

    const oldLine = orderLines.find(function (l) { return l.item_id === itemId; });
    if (oldLine) {
        oldLine.quantity = oldLine.quantity + qty;
    } else {
        orderLines.push({
            item_id: item.id,
            item_name: item.name,
            type_name: item.type_name,
            stock_available: item.stock_available,
            quantity: qty
        });
    }

    document.getElementById('select-purchase-item').value = '';
    document.getElementById('purchase-qty').value = '';
    showOrderLines();
}

function changeLineQty(index, value) {
    const qty = Number(value);
    if (!Number.isInteger(qty) || qty <= 0) {
        showMessage('Quantity must be greater than zero', 'error');
        showOrderLines();
        return;
    }
    orderLines[index].quantity = qty;
}

function removeOrderLine(index) {
    orderLines.splice(index, 1);
    showOrderLines();
}

function showOrderLines() {
    const body = document.getElementById('order-lines-body');

    if (orderLines.length === 0) {
        body.innerHTML = '<tr><td colspan="6" class="text-center">No items added to this order yet.</td></tr>';
        return;
    }

    let rows = '';
    for (let i = 0; i < orderLines.length; i++) {
        const line = orderLines[i];
        rows += '<tr>' +
            '<td>' + line.item_id + '</td>' +
            '<td><strong>' + safe(line.item_name) + '</strong></td>' +
            '<td>' + safe(line.type_name) + '</td>' +
            '<td>' + line.stock_available + '</td>' +
            '<td><input type="number" min="1" step="1" value="' + line.quantity + '" ' +
                'style="width: 90px; padding: 5px;" onchange="changeLineQty(' + i + ', this.value)" /></td>' +
            '<td><button type="button" class="btn btn-sm btn-danger" onclick="removeOrderLine(' + i + ')">Remove Line</button></td>' +
            '</tr>';
    }
    body.innerHTML = rows;
}

async function submitPurchaseOrder(event) {
    event.preventDefault();

    if (orderLines.length === 0) {
        showMessage('Purchase must contain at least one item', 'error');
        return;
    }

    const editId = document.getElementById('edit-purchase-id').value;

    const data = {
        order_id: document.getElementById('order-id').value.trim(),
        purchase_date: document.getElementById('order-date').value,
        items: orderLines.map(function (line) {
            return { item_id: line.item_id, quantity: Number(line.quantity) };
        })
    };

    let url = '/api/purchases';
    let method = 'POST';
    if (editId) {
        url = '/api/purchases/' + editId;
        method = 'PUT';
    }

    try {
        const result = await callApi(url, method, data);
        if (!result.ok) {
            showMessage(result.data.error || 'Purchase failed', 'error');
            return;
        }

        showMessage(result.data.message + ' (Order ID: ' + result.data.order_id + ')', 'success');
        resetPurchaseForm();
        await loadItems();
        await loadPurchases();
        switchTab('purchase-list-tab', document.querySelectorAll('.tab-btn')[2]);
    } catch (error) {
        showMessage('Network error while saving purchase', 'error');
    }
}

function resetPurchaseForm() {
    document.getElementById('edit-purchase-id').value = '';
    document.getElementById('order-id').value = '';
    document.getElementById('order-id').disabled = false;
    document.getElementById('order-date').value = today();
    orderLines = [];
    showOrderLines();

    document.getElementById('purchase-form-title').textContent = 'Create New Purchase Order';
    document.getElementById('submit-purchase-btn').textContent = 'Submit Complete Purchase';
    document.getElementById('cancel-purchase-edit-btn').classList.add('hidden');
}

async function loadPurchases() {
    try {
        const result = await callApi('/api/purchases');
        if (!result.ok) {
            showMessage(result.data.error || 'Could not load purchases', 'error');
            return;
        }
        const purchases = result.data;

        const body = document.getElementById('purchases-table-body');
        if (purchases.length === 0) {
            body.innerHTML = '<tr><td colspan="6" class="text-center">No purchase orders recorded yet.</td></tr>';
            return;
        }

        let rows = '';
        for (const p of purchases) {
            const parts = [];
            for (const i of p.items) {
                parts.push(safe(i.item_name) + ' - ' + i.quantity);
            }
            const summary = parts.join('; ');

            rows += '<tr>' +
                '<td>' + p.id + '</td>' +
                '<td><strong>' + safe(p.order_id) + '</strong></td>' +
                '<td>' + safe(p.purchase_date) + '</td>' +
                '<td>' + (summary || 'No items') + '</td>' +
                '<td>' + new Date(p.created_at).toLocaleString() + '</td>' +
                '<td class="action-group">' +
                    '<button class="btn btn-sm btn-info" onclick="viewPurchase(' + p.id + ')">View Details</button>' +
                    '<button class="btn btn-sm btn-secondary" onclick="editPurchase(' + p.id + ')">Update Order</button>' +
                '</td>' +
                '</tr>';
        }
        body.innerHTML = rows;
    } catch (error) {
        showMessage('Could not load purchases', 'error');
    }
}

async function viewPurchase(id) {
    try {
        const result = await callApi('/api/purchases/' + id);
        if (!result.ok) {
            showMessage(result.data.error || 'Could not load purchase', 'error');
            return;
        }
        const p = result.data;

        let rows = '';
        for (const item of p.items) {
            rows += '<tr>' +
                '<td>' + item.item_id + '</td>' +
                '<td><strong>' + safe(item.item_name) + '</strong></td>' +
                '<td>' + safe(item.type_name) + '</td>' +
                '<td><strong>' + item.quantity + '</strong></td>' +
                '<td>' + item.stock_available + '</td>' +
                '<td>' + stockBadge(item.stock_available) + '</td>' +
                '</tr>';
        }

        document.getElementById('modal-title').textContent = 'Purchase Order Details - ' + p.order_id;
        document.getElementById('modal-body').innerHTML =
            '<p><strong>Order ID:</strong> ' + safe(p.order_id) +
            ' &nbsp;|&nbsp; <strong>Purchase Date:</strong> ' + safe(p.purchase_date) + '</p>' +
            '<div class="table-responsive mt-15"><table>' +
            '<thead><tr>' +
                '<th>Item ID</th><th>Item Name</th><th>Item Type</th>' +
                '<th>Purchased Qty</th><th>Current Remaining Stock</th><th>Current Availability</th>' +
            '</tr></thead>' +
            '<tbody>' + rows + '</tbody>' +
            '</table></div>';
        document.getElementById('details-modal').classList.remove('hidden');
    } catch (error) {
        showMessage('Could not load purchase', 'error');
    }
}

async function editPurchase(id) {
    try {
        const result = await callApi('/api/purchases/' + id);
        if (!result.ok) {
            showMessage(result.data.error || 'Could not load purchase', 'error');
            return;
        }
        const p = result.data;

        document.getElementById('edit-purchase-id').value = p.id;
        document.getElementById('order-id').value = p.order_id;
        document.getElementById('order-id').disabled = true;
        document.getElementById('order-date').value = p.purchase_date;

        orderLines = [];
        for (const i of p.items) {
            orderLines.push({
                item_id: i.item_id,
                item_name: i.item_name,
                type_name: i.type_name,
                stock_available: i.stock_available,
                quantity: i.quantity
            });
        }
        showOrderLines();

        document.getElementById('purchase-form-title').textContent = 'Update Purchase Order - ' + p.order_id;
        document.getElementById('submit-purchase-btn').textContent = 'Update Purchase & Adjust Stock';
        document.getElementById('cancel-purchase-edit-btn').classList.remove('hidden');

        switchTab('purchases-tab', document.querySelectorAll('.tab-btn')[1]);
    } catch (error) {
        showMessage('Could not load purchase', 'error');
    }
}

function closeModal() {
    document.getElementById('details-modal').classList.add('hidden');
}
