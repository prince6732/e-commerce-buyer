# Zelton E-Commerce - Complete Notification Guide

This document lists all the notifications triggered across the Zelton E-Commerce platform for both **Customers** and **Admins**.

---

## 🙋‍♂️ 1. Customer Notifications

Customers receive notifications in real-time via the bell icon in their profile header (`/profile?tab=orders`) and via Email.

### 🛍️ Order & Payment Notifications
1. **Order Placed Successfully (COD & Online Payment)**
   - **Title**: `🎉 Order Placed Successfully`
   - **Message**: `Your order #ORD-XXXX for ₹1,299 has been received!`
   - **When triggered**: Triggered immediately when a customer completes checkout (Cash on Delivery or successful Cashfree online payment).
   - **Link**: Redirects customer to `/profile?tab=orders` to view order details.

2. **Order Status Changed**
   - **Title**: `📦 Order Status: [CONFIRMED / SHIPPED / OUT_FOR_DELIVERY / DELIVERED]`
   - **Message**: `Your order #ORD-XXXX status is now "SHIPPED".`
   - **When triggered**: Triggered when Admin updates the status of an order in the Admin Dashboard.
   - **Link**: Redirects customer to `/profile?tab=orders`.

3. **Order Cancelled**
   - **Title**: `❌ Order Cancelled`
   - **Message**: `Your order #ORD-XXXX has been successfully cancelled.`
   - **When triggered**: Triggered when either the customer or admin cancels an order.
   - **Link**: Redirects customer to `/profile?tab=orders`.

4. **Courier / Shipping Tracking Update**
   - **Title**: `Shipment Update`
   - **Message**: `Your package for order #ORD-XXXX status updated to "In Transit".`
   - **When triggered**: Triggered automatically when Delhivery logistics updates shipment tracking.

---

### 👤 Account & Security Notifications
5. **Welcome Notification**
   - **Title**: `👋 Welcome to Zelton!`
   - **Message**: `Hi [Customer Name], welcome to Zelton E-Commerce! Explore our latest products and exclusive deals.`
   - **When triggered**: Sent when a new customer registers and verifies their email account.

6. **Password Changed**
   - **Title**: `🔒 Password Changed Successfully`
   - **Message**: `Your account password was recently changed. If you did not make this change, please contact support immediately.`
   - **When triggered**: Sent immediately whenever a customer resets or changes their password.

---

### 📢 Promotional & Broadcast Notifications
7. **Store Announcements / Offers**
   - **Title**: *(Custom Title set by Admin)*
   - **Message**: *(Custom Promotional Message / Discount Code)*
   - **When triggered**: Sent whenever Admin broadcasts a message to all users or specific customer groups.

---

## 👑 2. Admin Notifications

Admins receive real-time popups, audio chimes, and notifications in the Admin Dashboard header (`/dashboard`).

### 🛒 Sales & Order Alerts
1. **New Order Placed (COD & Online Payment)**
   - **Title**: `🛒 New Order Placed`
   - **Message**: `New order #ORD-XXXX placed for ₹1,299`
   - **When triggered**: Triggered instantly whenever any customer completes an order (COD or Online Payment).
   - **Link**: Redirects Admin directly to `/dashboard/orders`.

2. **Order Cancelled by Customer**
   - **Title**: `Order Cancelled`
   - **Message**: `Order #ORD-XXXX was cancelled by customer.`
   - **When triggered**: Triggered when a customer cancels their order.

---

### 📦 Inventory & Stock Alerts
3. **Low Stock Warning**
   - **Title**: `📉 Low Stock Warning`
   - **Message**: `"Slim Fit Denim Jeans" has only 3 units remaining (Threshold: 5).`
   - **When triggered**: Triggered automatically when product stock drops below 5 units.
   - **Link**: Redirects Admin to `/dashboard/products/[id]`.

4. **Product Out of Stock**
   - **Title**: `🚨 Product Out of Stock`
   - **Message**: `"Wireless Earbuds" is completely OUT OF STOCK (0 units remaining).`
   - **When triggered**: Triggered instantly when product stock reaches 0.

---

### 💬 Customer Engagement Alerts
5. **New Customer Contact Inquiry / Complaint**
   - **Title**: `📩 New Customer Inquiry / Complaint`
   - **Message**: `Inquiry from Rahul Sharma (rahul@gmail.com): "Need help with order refund"`
   - **When triggered**: Triggered when a visitor submits the "Contact Us" form on the website.
   - **Link**: Redirects Admin to `/dashboard/contact-messages`.

6. **New Product Review & Rating**
   - **Title**: `⭐ New Product Review (5 Stars)` OR `⚠️ Low Rating Review (1 Star)`
   - **Message**: `Review on "Cotton T-Shirt" by Rahul: "Great quality product!"`
   - **When triggered**: Triggered when a verified customer posts a review/rating on a product.

---

### 🚚 Shipping & Logistics Alerts
7. **Delhivery Shipping Failure Alert**
   - **Title**: `🚨 Delhivery Shipment Creation Failed`
   - **Message**: `Failed to create shipment for Order #ORD-XXXX: Delhivery API authentication error.`
   - **When triggered**: Triggered if auto-generating a Delhivery shipping label encounters an error.

---

## ⚡ How Real-Time Notifications Work Technical Summary
- **Sockets**: Powered by Socket.IO WebSockets for instant header popup badges and sound alerts.
- **Database Persistence**: Saved in the `notifications` MySQL database table so users can read past notifications anytime.
- **Emails**: Important events (Order Placed, Invoice, Password Reset) also trigger HTML emails automatically.
