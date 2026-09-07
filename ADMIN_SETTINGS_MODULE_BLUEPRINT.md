# ⚙️ Zelton Admin Settings Module — Comprehensive Blueprint & Architecture

This document provides a tailored, end-to-end blueprint for the **Admin Dashboard Settings Module** in Zelton. It analyzes your entire platform (E-Commerce Storefront, Orders, Delhivery Logistics, Invoices, GST, Notifications, and Inventory) to propose the exact settings your store needs to operate smoothly and scale.

---

## 🌟 Executive Summary & Vision

Currently, the admin settings page only contains a **WhatsApp number** input. A complete enterprise e-commerce platform like Zelton requires a **Unified Settings Hub** organized into **8 intuitive tabs**:

```
⚙️ Admin Settings Hub
├── 🏢 1. General & Store Identity     (Store name, logo, contact, social links)
├── 🚚 2. Shipping & Delhivery Logistics(Pickup warehouse, free shipping threshold, test mode)
├── 💳 3. Payment & COD Rules           (COD toggles, min/max COD limits, extra COD fees, Razorpay)
├── 🧾 4. Tax, GST & Invoicing          (GSTIN, invoice prefix, signature, terms & conditions)
├── 📦 5. Inventory & Stock Rules       (Low stock alerts, out-of-stock visibility)
├── 🔔 6. Notifications & Email (SMTP)  (Admin alert email, customer email toggles, templates)
├── 🛍️ 7. Storefront & Marketing        (Announcement bar, maintenance mode, review moderation)
└── 📜 8. Legal & Policy Pages          (Privacy policy, terms of service, refund policy)
```

---

## 📑 1. General & Store Identity Settings

These settings configure your brand profile across the website, customer emails, and invoice headers.

| Setting Key | Label / Type | Default / Example | Purpose |
| :--- | :--- | :--- | :--- |
| `store_name` | Text | `Zelton` | Used in email subjects, page titles, and headers. |
| `store_tagline` | Text | `Premium Lifestyle & Modern Essentials` | Displayed on homepage meta and footer. |
| `store_logo_url` | Image Upload / URL | `/logo.png` | Main storefront header & invoice logo. |
| `store_favicon_url`| Image Upload / URL | `/favicon.ico` | Browser tab icon. |
| `support_email` | Email | `support@zelton.co.in` | Displayed to customers for inquiries & in email footers. |
| `support_phone` | Phone | `+91 9729310456` | Customer care hotline. |
| `whatsapp_number`| Phone (Digits) | `919729310456` | *(Already exists)* Powers floating WhatsApp chat button. |
| `whatsapp_default_msg`| Text | `Hi Zelton, I need help with an order.` | Pre-filled text when a customer clicks WhatsApp chat. |
| `social_instagram`| URL | `https://instagram.com/zelton` | Footer social link. |
| `social_facebook` | URL | `https://facebook.com/zelton` | Footer social link. |
| `social_youtube`  | URL | `https://youtube.com/@zelton` | Footer social link. |

---

## 🚚 2. Shipping & Delhivery Logistics Settings

Allows the admin to configure shipping fees, Delhivery warehouse details, and toggle test modes directly from the UI without modifying `.env` files.

| Setting Key | Label / Type | Default / Example | Purpose |
| :--- | :--- | :--- | :--- |
| `shipping_free_threshold` | Number (₹) | `999` | Orders above this amount get **FREE Shipping**. |
| `shipping_flat_fee` | Number (₹) | `49` | Flat shipping fee applied if order total is below threshold. |
| `delhivery_test_mode` | Toggle (Boolean) | `false` | When enabled, generates mock tracking waybills without charging real Delhivery balance. |
| `delhivery_pickup_location`| Text | `Zelton Warehouse` | Name of the registered Delhivery pickup center. |
| `delhivery_return_address` | Text | `#129 Naib Colony, Village Kanwla` | Address printed on shipping label for RTO return parcels. |
| `delhivery_return_city` | Text | `Ambala` | Return city. |
| `delhivery_return_state`| Text | `Haryana` | Return state. |
| `delhivery_return_pincode`| Text | `134003` | Return postal code. |
| `delhivery_return_phone`| Phone | `9729310456` | Return contact phone number. |
| `estimated_delivery_days`| Text | `3-5 Business Days` | Shown to customers on product & checkout pages. |

---

## 💳 3. Payment & COD Rules Settings

Gives full control over payment methods to minimize fake orders and optimize cash flow.

| Setting Key | Label / Type | Default / Example | Purpose |
| :--- | :--- | :--- | :--- |
| `payment_cod_enabled` | Toggle (Boolean) | `true` | Turn Cash on Delivery ON or OFF globally. |
| `payment_cod_min_order` | Number (₹) | `199` | Minimum cart total required to allow COD. |
| `payment_cod_max_order` | Number (₹) | `5000` | Maximum cart total allowed for COD (prevents high-value scam orders). |
| `payment_cod_extra_fee` | Number (₹) | `0` (or `39`) | Optional extra fee for COD orders (incentivizes prepaid payments). |
| `payment_online_enabled`| Toggle (Boolean) | `true` | Enable online payments (Razorpay / UPI / Cards). |
| `razorpay_key_id` | Text (Secret) | `rzp_live_...` | Razorpay public key for frontend checkout. |
| `cod_otp_verification` | Toggle (Boolean) | `false` | When enabled, requires a 4-digit SMS OTP before placing a COD order. |

---

## 🧾 4. Tax, GST & Invoicing Settings

Configures the official PDF Tax Invoice generated for orders and used in the GST download reports.

| Setting Key | Label / Type | Default / Example | Purpose |
| :--- | :--- | :--- | :--- |
| `company_legal_name` | Text | `Zelton Lifestyle Private Limited` | Official legal business name on invoices. |
| `company_gstin` | Text | `06AAAAA0000A1Z5` | 15-digit GSTIN printed on tax invoices & GST Excel exports. |
| `company_pan` | Text | `AAAAA0000A` | Business PAN number. |
| `company_billing_address` | Textarea | `Ambala City, Haryana - 134003` | Registered legal business address. |
| `invoice_prefix` | Text | `ZT/2627/` | Prefix used for generated invoice numbers (e.g. `ZT/2627/00042`). |
| `invoice_authorized_signatory`| Text | `Prince` | Name printed under the signature box on invoices. |
| `invoice_signature_image` | Image Upload | `/signature.png` | Digital signature image stamp on PDF invoices. |
| `invoice_terms` | Textarea | `1. Goods once sold can only be returned per our return policy...` | Terms and conditions printed at the bottom of the invoice PDF. |

---

## 📦 5. Inventory & Stock Rules Settings

Automates warehouse alerts and handles low stock scenarios.

| Setting Key | Label / Type | Default / Example | Purpose |
| :--- | :--- | :--- | :--- |
| `inventory_low_stock_threshold` | Number | `5` | Variants with stock $\le$ this number trigger a yellow "Low Stock" badge and admin alert. |
| `inventory_hide_out_of_stock` | Toggle (Boolean) | `false` | When `true`, automatically hides products with 0 stock from the customer catalog. |
| `inventory_allow_backorders` | Toggle (Boolean) | `false` | Allow customers to purchase items even when stock reaches 0. |

---

## 🔔 6. Notifications & Email (SMTP) Settings

Controls automated communications sent to the store owner and customers.

| Setting Key | Label / Type | Default / Example | Purpose |
| :--- | :--- | :--- | :--- |
| `admin_notification_email` | Email | `admin@zelton.co.in` | Email address that receives instant alerts for New Orders, Low Stock, and Customer Messages. |
| `email_order_confirmation` | Toggle (Boolean) | `true` | Send automated email with Invoice PDF to customer when order is placed. |
| `email_shipment_dispatched`| Toggle (Boolean) | `true` | *(Implemented)* Send email with Delhivery AWB number & tracking link when order is shipped. |
| `email_delivery_confirmation`| Toggle (Boolean)| `true` | Send delivery confirmation link when order is marked delivered. |
| `email_sender_name` | Text | `Zelton Store` | "From" name shown in customer email inboxes. |

---

## 🛍️ 7. Storefront & Marketing Settings

Gives the admin dynamic control over sales banners, reviews, and website maintenance.

| Setting Key | Label / Type | Default / Example | Purpose |
| :--- | :--- | :--- | :--- |
| `announcement_bar_enabled` | Toggle (Boolean) | `true` | Show/hide the top promotional bar on the website. |
| `announcement_bar_text` | Text | `🎉 Free Shipping on all orders above ₹999!` | Promotional text in the top announcement bar. |
| `announcement_bar_link` | Text / URL | `/categories/new-arrivals` | Optional URL when clicking the announcement bar. |
| `maintenance_mode` | Toggle (Boolean) | `false` | Puts the customer storefront into "Under Maintenance" mode while admin retains full access. |
| `maintenance_message` | Text | `We are updating our store with new collections. We'll be back shortly!` | Message shown during maintenance. |
| `reviews_auto_approve` | Toggle (Boolean) | `false` | When `false`, customer product reviews require admin approval before going public. |
| `google_analytics_id` | Text | `G-XXXXXXXXXX` | GA4 measurement ID for web analytics. |
| `meta_pixel_id` | Text | `XXXXXXXXXXXXXXX` | Facebook / Meta Pixel ID for ad tracking. |

---

## 📜 8. Legal & Policy Pages Content

Allows the store owner to easily edit website policy pages from the dashboard without needing developer code updates.

| Setting Key | Label / Type | Purpose |
| :--- | :--- | :--- |
| `policy_privacy` | Rich Text / Markdown | Content for `/privacy-policy`. |
| `policy_terms` | Rich Text / Markdown | Content for `/terms-and-conditions`. |
| `policy_refund` | Rich Text / Markdown | Content for `/return-and-refund-policy` (e.g. 7-day return rules). |
| `policy_shipping` | Rich Text / Markdown | Content for `/shipping-policy` (courier delivery timelines). |

---

## 🏗️ Technical Architecture & Database Design

### 1. Database Storage (`settings` table)
Your database already contains a flexible `settings` table:
```sql
CREATE TABLE `settings` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `key` VARCHAR(255) NOT NULL UNIQUE,
  `value` LONGTEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### 2. Backend API Endpoints (Already Built & Ready in `nest-api`):
* `GET /api/settings` — Returns all settings as a key-value list.
* `GET /api/settings/:key` — Returns a single setting value.
* `POST /api/settings` — Upserts a single key-value setting.
* `PUT /api/settings/bulk` or `POST /api/settings` — Updates multiple settings at once.

---

## 🎨 Recommended UI/UX Design for Settings Page

The settings page in `next-app/src/app/(dashboards)/dashboard/settings/page.tsx` will be upgraded from a single card into a **modern responsive multi-tab layout**:

```
+-----------------------------------------------------------------------------+
| ⚙️ Store Settings                                    [ 💾 Save Changes ]    |
| Manage all store configurations, shipping, payments, and branding.          |
+-----------------------------------------------------------------------------+
| [🏢 General] [🚚 Shipping] [💳 Payment] [🧾 Tax & GST] [📦 Stock] [🔔 Alerts] |
+-----------------------------------------------------------------------------+
| 🚚 Shipping & Delhivery Logistics                                           |
|                                                                             |
| Free Shipping Threshold (₹)         Flat Shipping Fee (₹)                   |
| [ 999                          ]   [ 49                           ]        |
|                                                                             |
| Delhivery Test Mode (Simulate AWBs without live courier charge)             |
| [ ON / OFF Toggle  🔘 ]                                                     |
|                                                                             |
| Registered Warehouse Pickup Name                                            |
| [ Zelton Warehouse             ]                                            |
|                                                                             |
| Return Address (For RTO Parcels)                                            |
| [ #129 Naib Colony, Village Kanwla, Ambala, Haryana - 134003      ]         |
+-----------------------------------------------------------------------------+
```

---

## 🚀 Recommended Implementation Phases

| Phase | Category | Key Deliverables |
| :--- | :--- | :--- |
| **Phase 1 (Essential)** | General & Shipping | Store branding, Delhivery warehouse details, Free Shipping threshold, and Test Mode toggle. |
| **Phase 2 (Finance & Tax)** | Payment & GST Tax | COD min/max limits, COD extra fee, GSTIN & Company PAN for PDF Invoices. |
| **Phase 3 (Storefront)** | Marketing & Policies | Announcement banner text, Maintenance mode switch, and Refund/Shipping policy texts. |
| **Phase 4 (Automation)** | Notifications & Stock | Low stock threshold alerts and Email notification triggers. |

---

## Summary
Building this complete Settings module will give you **100% full control** over your e-commerce operations directly from the Admin Dashboard, without ever needing to touch backend code or `.env` files for routine store adjustments.
