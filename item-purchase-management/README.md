# Item & Purchase Management System

A web application to manage Item Types, Items, multi-item Purchase Orders, stock availability and purchase history.
Built with a plain HTML/CSS/JavaScript frontend, a Node.js + Express backend and a MySQL database.

## Features
- Item Types: create, edit, delete (blocked if items use the type)
- Items: create, view details, update, activate/deactivate, delete (blocked if the item has purchase history)
- Purchases: one unique Order ID with multiple items and quantities
- Backend validation for every request (required fields, valid item type, valid date, no negative stock, positive quantity, no duplicate items in one order)
- Stock is deducted on the backend and can never become negative
- Purchase update adjusts stock by the quantity difference
- Purchases cannot be deleted (no DELETE endpoint, no Delete button)
- Purchase creation runs in one MySQL transaction (all steps succeed or none do)
- SQL JOINs are used for Item + Item Type and for Purchase + Purchase Items + Items + Item Types

## 1. Prerequisites and Software Versions
- Node.js v24.21.0 (v18 or newer works)
- npm v11.19.0
- MySQL Server v8.0.46
- A web browser (Chrome, Edge or Firefox)

## 2. Project Structure
```
item-purchase-management/
├── backend/
│   ├── server.js          Starts the server and connects the routes
│   ├── db.js              MySQL connection pool
│   ├── helpers.js         Validation helper functions
│   ├── routes/
│   │   ├── itemTypes.js   Item Type APIs
│   │   ├── items.js       Item APIs
│   │   └── purchases.js   Purchase APIs (no delete)
│   ├── package.json
│   └── .env               Database settings (you create this)
├── frontend/
│   ├── index.html         Pages and forms
│   ├── style.css          Styling
│   └── app.js             Frontend logic
├── schema.sql             Database schema and item type seed data
└── README.md
```

## 3. Database Creation and Schema
1. Open a terminal in the project folder and log in to MySQL:
```
   mysql -u root -p
```
2. Run the schema file. It creates the database `item_purchase_management`, the 4 tables
   (`item_types`, `items`, `purchases`, `purchase_items`) and inserts 5 sample item types:
```
   SOURCE schema.sql;
```
   If MySQL cannot find the file, use the full path, for example:
   `SOURCE C:/Users/YourName/Desktop/item-purchase-management/schema.sql;`

### Tables and relationships
- `item_types` 1 to many `items`
- `purchases` 1 to many `purchase_items`
- `items` 1 to many `purchase_items`

### Optional sample data (matches the assignment example)
Run this in MySQL after the schema to create Laptop 10, Mouse 20, Chair 15 and one inactive item:
```sql
USE item_purchase_management;

INSERT INTO items (name, item_type_id, purchase_date, stock_available, active) VALUES
('Laptop', (SELECT id FROM item_types WHERE type_name = 'Electronics'), '2026-08-01', 10, TRUE),
('Mouse',  (SELECT id FROM item_types WHERE type_name = 'Electronics'), '2026-08-01', 20, TRUE),
('Chair',  (SELECT id FROM item_types WHERE type_name = 'Furniture'),   '2026-08-01', 15, TRUE),
('Old Monitor', (SELECT id FROM item_types WHERE type_name = 'Electronics'), '2026-08-01', 4, FALSE);
```

## 4. MySQL Credentials and Configuration
Create a file named `.env` inside the `backend/` folder:
```
PORT=3000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=item_purchase_management
```
Replace `your_mysql_password` with your own MySQL root password.

## 5. Install and Run
1. Open a terminal and go to the backend folder:
```
   cd backend
```
2. Install dependencies:
```
   npm install
```
3. Start the application:
```
   node server.js
```
4. You should see:
```
   Connected to MySQL database successfully!
   Server is running at http://localhost:3000
```
5. Open http://localhost:3000 in your browser.

**Frontend startup:** the frontend is plain HTML, CSS and JavaScript. It is served by the Express
backend, so starting the backend (step 3) also starts the frontend. No separate frontend command is needed.

## 6. How to Use the Application
1. **Item Types** tab: add types such as Electronics, Furniture.
2. **Item Master** tab: create items (name, type, date, stock, status). Use View, Edit, Activate/Deactivate and Delete.
3. **Create / Edit Purchase** tab: choose a purchase date, select an active item, enter a quantity, click "Add Item to Order", repeat for more items, then "Submit Complete Purchase". Leave Order ID blank to auto-generate (PO-00001, PO-00002, ...).
4. **Purchase History** tab: view details of an order or update it. Stock adjusts automatically.
5. **Stock & Availability** tab: In Stock (more than 5), Low Stock (1 to 5), Out of Stock (0).

## 7. REST API Documentation and Usage Examples

Base URL: http://localhost:3000 (JSON requests and responses). Dates use YYYY-MM-DD.
Every error returns: `{ "error": "message" }`

### Status codes
- 200 OK, 201 Created
- 400 Validation error or malformed request
- 404 Record not found
- 409 Business conflict (duplicate, inactive item, insufficient stock, item has purchase history)
- 500 Unexpected server or database error (safe message only)

### Item Types
| Method | URL | Purpose |
|---|---|---|
| GET | /api/item-types | List all item types |
| POST | /api/item-types | Create item type |
| PUT | /api/item-types/:id | Rename item type |
| DELETE | /api/item-types/:id | Delete unused item type |

Create request: `{ "type_name": "Electronics" }`
Create response (201): `{ "message": "Item type created successfully", "id": 1, "type_name": "Electronics" }`

Errors:
- 400 "Item type name is required", 400 "Invalid item type ID"
- 404 "Item type not found"
- 409 "Item type already exists", 409 "Cannot delete item type because items are linked to it"

### Items (list and details use a SQL JOIN with item_types)
| Method | URL | Purpose |
|---|---|---|
| GET | /api/items | List all items with type name |
| GET | /api/items/:id | Item details |
| POST | /api/items | Create item |
| PUT | /api/items/:id | Update item, or activate/deactivate |
| DELETE | /api/items/:id | Delete item (only if never purchased) |

Create request:
```json
{
  "name": "Laptop",
  "item_type_id": 1,
  "purchase_date": "2026-08-01",
  "stock_available": 10,
  "active": true
}
```
Create response (201): `{ "message": "Item created successfully", "id": 1 }`

List response (200), one item:
```json
{ "id": 1, "name": "Laptop", "item_type_id": 1, "type_name": "Electronics",
  "purchase_date": "2026-08-01", "stock_available": 10, "active": 1 }
```

Errors:
- 400 "Item name is required"
- 400 "Invalid item type"
- 400 "Valid purchase date is required (YYYY-MM-DD)"
- 400 "Stock available must be a non-negative integer (0 or more)"
- 400 "Invalid item ID"
- 404 "Item not found"
- 409 "Cannot delete this item because it has existing purchase history. Please mark it as Inactive instead."

### Purchases (there is NO DELETE endpoint; purchases are permanent history)
| Method | URL | Purpose |
|---|---|---|
| GET | /api/purchases | List all purchases with items |
| GET | /api/purchases/:id | Purchase details by id or Order ID (4-table SQL JOIN) |
| POST | /api/purchases | Create purchase (MySQL transaction, deducts stock) |
| PUT | /api/purchases/:id | Update purchase, adjusts stock by quantity difference |

Create request:
```json
{
  "order_id": "PO-00001",
  "purchase_date": "2026-08-25",
  "items": [
    { "item_id": 1, "quantity": 2 },
    { "item_id": 2, "quantity": 5 },
    { "item_id": 3, "quantity": 3 }
  ]
}
```
`order_id` is optional. If left blank it is generated automatically.
Create response (201): `{ "message": "Purchase created successfully", "id": 1, "order_id": "PO-00001" }`

Details response (200) for `GET /api/purchases/PO-00001`:
```json
{
  "id": 1, "order_id": "PO-00001", "purchase_date": "2026-08-25",
  "items": [
    { "item_id": 1, "item_name": "Laptop", "type_name": "Electronics",
      "quantity": 2, "stock_available": 8, "active": 1 }
  ]
}
```

Update request (`PUT /api/purchases/1`): send the full list of items the order should contain.
```json
{ "purchase_date": "2026-08-25", "items": [ { "item_id": 1, "quantity": 5 } ] }
```
Update response (200): `{ "message": "Purchase updated and stock adjusted successfully", "order_id": "PO-00001" }`

Stock rule on update: stock changes by the difference.
- Stock 10, purchase 3: remaining 7
- Changed from 3 to 5: deduct 2 more, remaining 5
- Changed from 5 to 2: return 3, remaining 8

Errors:
- 400 "Valid purchase date is required (YYYY-MM-DD)"
- 400 "Purchase must contain at least one item"
- 400 "Invalid item selected in purchase"
- 400 "Quantity must be greater than zero"
- 400 "Duplicate items within one order are not allowed"
- 404 "Purchase order not found", 404 "Item not found"
- 409 "Order ID PO-00001 already exists"
- 409 "Item ... is inactive and cannot be purchased"
- 409 "Insufficient stock for ... Available quantity: 8, Requested: 10"

If any step of a purchase fails, the transaction is rolled back and stock stays unchanged.

### curl examples
```
curl -X POST http://localhost:3000/api/purchases -H "Content-Type: application/json" -d "{\"order_id\":\"PO-00001\",\"purchase_date\":\"2026-08-25\",\"items\":[{\"item_id\":1,\"quantity\":2}]}"

curl http://localhost:3000/api/purchases/PO-00001
```

## 8. SQL JOINs Used
Item + Item Type:
```sql
SELECT i.id, i.name, it.type_name, i.purchase_date, i.stock_available, i.active
FROM items i JOIN item_types it ON i.item_type_id = it.id;
```
Purchase + Purchase Items + Items + Item Types:
```sql
SELECT p.order_id, p.purchase_date, i.id AS item_id, i.name AS item_name, it.type_name, pi.quantity
FROM purchases p
JOIN purchase_items pi ON p.id = pi.purchase_id
JOIN items i ON pi.item_id = i.id
JOIN item_types it ON i.item_type_id = it.id
WHERE p.order_id = ?;
```

## 9. Transaction Handling
`POST /api/purchases` and `PUT /api/purchases/:id` use a MySQL transaction:
BEGIN, validate items and stock (rows locked with FOR UPDATE), insert purchase, insert purchase items,
update stock, COMMIT. Any failure runs ROLLBACK, so no partial purchase remains.

## 10. Troubleshooting
- **Failed to connect to MySQL:** check the `.env` values and that MySQL is running.
- **Port already in use:** change `PORT` in `.env`.
- **Cannot find module:** check that the backend files are in the folders shown in section 2.
- **Blank page or old behaviour:** hard refresh the browser with Ctrl+F5.
## 11. Screenshots
Screenshots of the working application are submitted separately (see the screenshots attachment in the submission email).