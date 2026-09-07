import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const PDFDocument = require('pdfkit');

@Injectable()
export class InvoicePdfService {
  private readonly logger = new Logger(InvoicePdfService.name);

  /**
   * Generates a Tax Invoice PDF matching the Truckage-group format.
   * Uses PDFKit native APIs only — no splitTextToSize (that is jsPDF only).
   */
  async generateInvoicePdf(orderData: any, settingsData: Record<string, string> = {}): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 0, size: 'A4' });
        const buffers: Buffer[] = [];
        doc.on('data', (chunk) => buffers.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', (err) => reject(err));

        // ── Settings ──────────────────────────────────────────────────────
        const soldByName = settingsData?.sold_by_name?.trim() || 'Rahul Singh';
        const soldByAddress = settingsData?.sold_by_address?.trim() || 'Home no. 129 naib colony near army gate village kanwla, AMBALA, HARYANA, 134003, IN';
        const soldByPan = settingsData?.pan_no?.trim() || settingsData?.pan?.trim() || 'EDKPS7525H';
        const soldByGstin = settingsData?.gstin?.trim() || '06EDKPS7525H1Z3';
        const supportPhone = settingsData?.support_phone?.trim() || '9996646857';
        const supportEmail = settingsData?.support_email?.trim() || 'zelton456@gmail.com';

        // ── Order fields ───────────────────────────────────────────────────
        const getFinancialYear = (d: any): string => {
          const dt = d ? new Date(d) : new Date();
          const validDt = isNaN(dt.getTime()) ? new Date() : dt;
          const year = validDt.getFullYear();
          const month = validDt.getMonth(); // 0-11
          let startYear: number, endYear: number;
          if (month >= 3) {
            startYear = year;
            endYear = year + 1;
          } else {
            startYear = year - 1;
            endYear = year;
          }
          return `${String(startYear).slice(-2)}${String(endYear).slice(-2)}`;
        };

        const rawId = String(orderData.id || '1').replace(/\D/g, '') || '1';
        const orderDt = orderData.createdAt || orderData.created_at;
        const fyStr = getFinancialYear(orderDt);
        const seqPadded = rawId.padStart(5, '0');

        const orderNumber = orderData.orderNumber || orderData.order_number || `ORD-${rawId}`;
        const invoiceNum =
          (orderData as any).invoiceNumber ||
          orderData.invoice_number ||
          `ZT/${fyStr}/${seqPadded}`;

        const formattedOrderId = orderNumber;

        const fmtDate = (d: any): string => {
          if (!d) return new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
          const dt = new Date(d);
          return isNaN(dt.getTime())
            ? new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-')
            : dt.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
        };

        const orderDate = fmtDate(orderData.createdAt || orderData.created_at);
        const invoiceDate = fmtDate(orderData.deliveredAt || orderData.delivered_at || orderData.createdAt || orderData.created_at);

        const user = (orderData.user as any) || {};
        const customerName = user.name || 'Valued Customer';
        const customerEmail = user.email || '';
        const customerPhone = user.phone || user.phone_number || user.phoneNumber || user.contact || '';

        const rawAddr = orderData.shippingAddress || orderData.shipping_address;
        let shippingAddr = '';
        let parsedAddr: any = null;
        if (typeof rawAddr === 'object' && rawAddr !== null) {
          parsedAddr = rawAddr;
        } else if (typeof rawAddr === 'string') {
          const trimmed = rawAddr.trim();
          if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
            try {
              parsedAddr = JSON.parse(trimmed);
            } catch (e) {
              parsedAddr = null;
            }
          }
        }

        if (parsedAddr) {
          shippingAddr = [
            parsedAddr.add,
            parsedAddr.city,
            [parsedAddr.state, parsedAddr.pin].filter(Boolean).join(' '),
            parsedAddr.country,
          ]
            .filter(Boolean)
            .join(', ');
        } else if (typeof rawAddr === 'string') {
          shippingAddr = rawAddr
            .split(/\r?\n/)
            .map((s) => s.trim())
            .filter(Boolean)
            .join(', ');
        }
        if (!shippingAddr) shippingAddr = 'N/A';

        const items: any[] = orderData.orderItems || orderData.order_items || orderData.items || [];

        const totalAmount = parseFloat(String(orderData.total || '0')) || 0;
        const subtotalAmount = parseFloat(String(orderData.subtotal || orderData.total || '0')) || totalAmount;
        const shippingFee = parseFloat(String(orderData.shippingFee || orderData.shipping_fee || '0')) || 0;

        const paymentMethod = (orderData.paymentMethod || orderData.payment_method || 'cash_on_delivery') === 'cash_on_delivery'
          ? 'Cash on Delivery (COD)' : 'Online Payment';
        const paymentStatus = (orderData.paymentStatus || orderData.payment_status || 'pending').toUpperCase();
        const transactionId = orderData.transactionId || orderData.transaction_id || null;

        // ── Layout constants (matching Truckage X-positions) ───────────────
        const L = 39.68;   // left margin
        const R = 555.59;  // right margin

        // Table column X positions  — evenly divided 5 numeric boxes
        const C_DESC = L; const W_DESC = 195.32;   // Description (X: 39.68 -> 235.00)
        const C_QTY = 235.0; const W_QTY = 30.0;     // Qty (X: 235.00 -> 265.00)

        // 5 numeric boxes spanning 265.00 to 555.59 (width = 290.59 / 5 = 58.1 each)
        const C_GROSS = 265.0; const W_GROSS = 58.1;  // Gross (X: 265.00 -> 323.10)
        const C_DISC = 323.1; const W_DISC = 58.1;   // Discount (X: 323.10 -> 381.20)
        const C_TAX = 381.2; const W_TAX = 58.1;    // Taxable (X: 381.20 -> 439.30)
        const C_IGST = 439.3; const W_IGST = 58.1;   // IGST (X: 439.30 -> 497.40)
        const C_TOTAL = 497.4; const W_TOTAL = 58.19; // Total (X: 497.40 -> 555.59 = R)

        // Helper to draw a horizontal full-width line
        const hLine = (y: number, w = 1.1, color = '#000000') =>
          doc.moveTo(L, y).lineTo(R, y).lineWidth(w).strokeColor(color).stroke();

        // Helper to draw a vertical column separator line
        const vLine = (x: number, y1: number, y2: number, lw = 0.6, color = '#cccccc') =>
          doc.moveTo(x, y1).lineTo(x, y2).lineWidth(lw).strokeColor(color).stroke();

        // ════════════════════════════════════════════════════════════════
        // 1.  HEADER  — title + sold-by + logo + invoice-number box
        // ════════════════════════════════════════════════════════════════
        doc.font('Helvetica-Bold').fontSize(16).fillColor('#000000')
          .text('Tax Invoice', 0, 39.68, { align: 'center', width: 595.28 });

        // Sold By (left column)
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#000000')
          .text(`Sold By: ${soldByName} ,`, L, 62.36);
        doc.font('Helvetica-Oblique').fontSize(8.5).fillColor('#333333');
        const shipFromText = `Ship-from Address: ${soldByAddress}`;
        const shipFromH = doc.heightOfString(shipFromText, { width: 340 });
        doc.text(shipFromText, L, 73.70, { width: 340 });

        const gstinY = Math.max(99, 73.70 + shipFromH + 3);
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#000000')
          .text(`PAN: ${soldByPan}   |   GSTIN - ${soldByGstin}`, L, gstinY);

        // Logo (top-right) — shifted to right (x=445) so right edge aligns cleanly above invoice box
        const logoPath = path.join(process.cwd(), 'uploads', 'logo', 'ZeltonLogoBlack.png');
        let logoRendered = false;
        if (fs.existsSync(logoPath)) {
          try {
            // Logo at x=445, y=18, height=52 → ends at y=70, aligned to right
            doc.image(logoPath, 475, 18, { height: 52, fit: [110, 52] });
            logoRendered = true;
          } catch (e) { /* fall through */ }
        }
        if (!logoRendered) {
          // Fallback: icon placeholder square + brand name
          doc.rect(450, 34, 28, 28).fillColor('#1e293b').fill();
          doc.font('Helvetica-Bold').fontSize(18).fillColor('#0f172a')
            .text('ZELTON', 483, 40, { width: 72 });
        }

        // Invoice Number box  — Truckage: rect(391.18, 85, 164.4, 19.8)
        doc.rect(391.18, 85.0, 164.4, 19.8).lineWidth(0.85).strokeColor('#969696').stroke();
        doc.font('Helvetica-Bold').fontSize(8).fillColor('#000000')
          .text('Invoice Number', 396.85, 90.5);
        doc.font('Helvetica').fontSize(8).fillColor('#000000')
          .text(invoiceNum, 464.8, 90.5, { width: 88, align: 'right' });

        // ── Top divider (Truckage: Y = 141.73)
        hLine(141.73, 1.1);

        // ════════════════════════════════════════════════════════════════
        // 2.  ORDER INFO  +  SHIPPING ADDRESS  (dynamic height)
        // ════════════════════════════════════════════════════════════════
        const infoY = 158.74;

        // Left: order meta
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#000000');
        doc.text(`Order ID:     ${formattedOrderId}`, L, infoY);
        doc.text(`Order Date:   ${orderDate}`, L, infoY + 17);
        doc.text(`Invoice Date: ${invoiceDate}`, L, infoY + 34);
        doc.text(`Payment:      ${paymentMethod}`, L, infoY + 51);
        let leftEndY = infoY + 68;
        if (transactionId) {
          doc.text(`Txn ID:       ${transactionId}`, L, infoY + 68);
          leftEndY = infoY + 85;
        }

        // Right: shipping address (positioned further right: col2X = 275.0)
        const col2X = 275.0;
        const col2W = R - col2X;

        doc.font('Helvetica-Bold').fontSize(9).fillColor('#000000')
          .text('Shipping / Billing Address', col2X, infoY);
        doc.font('Helvetica').fontSize(8.5).fillColor('#333333');
        doc.text(`Name:  ${customerName}`, col2X, infoY + 17);

        let addrSubY = infoY + 32;
        if (customerPhone) {
          doc.text(`Phone: ${customerPhone}`, col2X, addrSubY);
          addrSubY += 14;
        }
        if (customerEmail) {
          doc.text(`Email: ${customerEmail}`, col2X, addrSubY);
          addrSubY += 14;
        }
        // PDFKit wraps automatically with {width}; use heightOfString to measure
        const addrText = `Address: ${shippingAddr}`;
        doc.text(addrText, col2X, addrSubY, { width: col2W });
        const addrH = doc.heightOfString(addrText, { width: col2W });
        const rightEndY = addrSubY + addrH + 8;

        // Table top Y — must be below both columns
        const tableTopY = Math.max(leftEndY, rightEndY) + 14;

        // ── Table-top divider (Truckage style: thick)
        hLine(tableTopY, 1.4);

        // ════════════════════════════════════════════════════════════════
        // 3.  TABLE  — headers + rows + vertical column lines
        // ════════════════════════════════════════════════════════════════
        const HDR_Y = tableTopY + 10;
        const HDR_H = 22;   // header cell height (2-line for IGST/Total)
        const HDR_LINE = tableTopY + HDR_H + 10;   // line below header

        // ── Column headers  (5 numeric boxes divided equally, centered)
        doc.font('Helvetica-Bold').fontSize(8).fillColor('#0f172a');
        doc.text('Description', C_DESC, HDR_Y);
        doc.text('Qty', C_QTY, HDR_Y, { align: 'center', width: W_QTY });
        doc.text('Gross (Rs.)', C_GROSS, HDR_Y, { align: 'center', width: W_GROSS });
        doc.text('Discount', C_DISC, HDR_Y, { align: 'center', width: W_DISC });
        doc.text('Taxable (Rs.)', C_TAX, HDR_Y, { align: 'center', width: W_TAX });
        doc.text('IGST (Rs.)', C_IGST, HDR_Y, { align: 'center', width: W_IGST });
        doc.text('Total (Rs.)', C_TOTAL, HDR_Y, { align: 'center', width: W_TOTAL });

        // Line below header
        hLine(HDR_LINE, 1.1);

        // ── Item rows ─────────────────────────────────────────────────────
        let curY = HDR_LINE + 8;
        let grandIgst = 0;
        let grandTaxable = 0;
        let grandGross = 0;
        let grandQty = 0;

        if (items.length === 0) {
          doc.font('Helvetica-Oblique').fontSize(8).fillColor('#888888')
            .text('No items found for this order.', C_DESC, curY);
          curY += 18;
        }

        for (const item of items) {
          // Product name
          const productName =
            item.product?.name || item.product?.title ||
            item.product_name || item.name || item.title || 'Product';

          // Variant / attribute
          let variantInfo = '';
          if (item.variant?.title) {
            variantInfo = item.variant.title;
          } else {
            const attrs = item.selectedAttributes || item.selected_attributes;
            if (attrs && typeof attrs === 'object') {
              variantInfo = Object.entries(attrs).map(([k, v]) => `${k}: ${v}`).join(', ');
            } else if (typeof attrs === 'string' && attrs.trim()) {
              variantInfo = attrs;
            }
          }
          const sku = item.variant?.sku || item.sku || '';
          const fullTitle = variantInfo ? `${productName} (${variantInfo})` : productName;

          // Numbers
          const qty = parseInt(String(item.quantity || '1'), 10) || 1;
          const unitPrice = parseFloat(String(item.price || item.unit_price || '0')) || 0;
          const lineTotal = parseFloat(String(item.total || item.total_price || (unitPrice * qty).toString())) || 0;

          const hsnCode =
            item.hsn ||
            item.product?.hsn ||
            item.product?.category?.hsn ||
            item.product?.category?.parent?.hsn ||
            item.product?.hsn_code ||
            item.product?.hsnCode ||
            '';

          const itemRateRaw =
            item.taxRate ||
            item.tax_rate ||
            item.product?.gstRate ||
            item.product?.tax_rate ||
            item.product?.category?.gstRate ||
            item.product?.category?.tax_rate ||
            18.0;

          const itemRate = parseFloat(String(itemRateRaw)) || 18.0;

          const taxable = item.taxableAmount !== null && item.taxableAmount !== undefined
            ? parseFloat(String(item.taxableAmount))
            : (lineTotal / (1 + (itemRate / 100)));

          const taxAmount = item.taxAmount !== null && item.taxAmount !== undefined
            ? parseFloat(String(item.taxAmount))
            : (lineTotal - taxable);

          grandQty += qty;
          grandTaxable += taxable;
          grandIgst += taxAmount;
          grandGross += lineTotal;

          const taxInfoList: string[] = [];
          if (hsnCode) taxInfoList.push(`HSN: ${hsnCode}`);
          taxInfoList.push(`GST: ${itemRate.toFixed(1)}%`);
          const taxNoteText = taxInfoList.join(' | ');

          // Height measurement via PDFKit's heightOfString (set font first so measurements are exact)
          doc.font('Helvetica-Bold').fontSize(8.5);
          const titleH = doc.heightOfString(fullTitle, { width: W_DESC });

          const skuText = sku ? `SKU: ${sku}` : '';
          doc.font('Helvetica').fontSize(7.5);
          const skuH = skuText ? doc.heightOfString(skuText, { width: W_DESC }) : 0;

          doc.font('Helvetica-Oblique').fontSize(7);
          const taxNoteH = doc.heightOfString(taxNoteText, { width: W_DESC });

          const spacing = 2;
          const rowPadding = 8;
          const rowH = titleH + (skuH ? skuH + spacing : 0) + taxNoteH + spacing + rowPadding;

          if (curY + rowH > 720) { doc.addPage(); curY = 40; }

          // Description (Product Name + Variant)
          doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#0f172a')
            .text(fullTitle, C_DESC, curY, { width: W_DESC });

          let noteY = curY + titleH + spacing;

          // SKU on next line
          if (skuText) {
            doc.font('Helvetica').fontSize(7.5).fillColor('#475569')
              .text(skuText, C_DESC, noteY, { width: W_DESC });
            noteY += skuH + spacing;
          }

          // Tax note on next line
          doc.font('Helvetica-Oblique').fontSize(7).fillColor('#64748b')
            .text(taxNoteText, C_DESC, noteY, { width: W_DESC });

          // Numeric columns (centered vertically from top/bottom and horizontally from left/right)
          doc.font('Helvetica').fontSize(8.5).fillColor('#0f172a');
          const numH = doc.heightOfString('0', { width: W_QTY });
          const numY = curY + Math.max(0, (rowH - numH) / 2 - 1);

          doc.text(String(qty), C_QTY, numY, { align: 'center', width: W_QTY });
          doc.text(lineTotal.toFixed(2), C_GROSS, numY, { align: 'center', width: W_GROSS });
          doc.text('0.00', C_DISC, numY, { align: 'center', width: W_DISC });
          doc.text(taxable.toFixed(2), C_TAX, numY, { align: 'center', width: W_TAX });
          doc.text(taxAmount.toFixed(2), C_IGST, numY, { align: 'center', width: W_IGST });
          doc.text(lineTotal.toFixed(2), C_TOTAL, numY, { align: 'center', width: W_TOTAL });

          curY += rowH;

          // Thin row separator (light, like Truckage)
          doc.moveTo(L, curY - 2).lineTo(R, curY - 2).lineWidth(0.5).strokeColor('#cccccc').stroke();
        }

        // ── Vertical column separators spanning header → last row
        const tblTop = tableTopY;
        const tblBot = curY;
        const vSeps = [C_QTY, C_GROSS, C_DISC, C_TAX, C_IGST, C_TOTAL];
        for (const x of vSeps) {
          vLine(x - 1, tblTop, tblBot, 0.5, '#bbbbbb');
        }

        // ── Line below items (Truckage: 0.85)
        hLine(curY, 0.85);

        // ── Total row  (Truckage bold summary)
        curY += 7;
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#0f172a');
        doc.text('Total', C_DESC, curY);
        doc.text(String(grandQty), C_QTY, curY, { align: 'center', width: W_QTY });
        doc.text(grandGross.toFixed(2), C_GROSS, curY, { align: 'center', width: W_GROSS });
        doc.text('0.00', C_DISC, curY, { align: 'center', width: W_DISC });
        doc.text(grandTaxable.toFixed(2), C_TAX, curY, { align: 'center', width: W_TAX });
        doc.text(grandIgst.toFixed(2), C_IGST, curY, { align: 'center', width: W_IGST });
        doc.text(grandGross.toFixed(2), C_TOTAL, curY, { align: 'center', width: W_TOTAL });

        curY += 14;

        // Double-line below totals (Truckage: thick + thin)
        hLine(curY, 1.4);
        hLine(curY + 3, 0.5);

        // ════════════════════════════════════════════════════════════════
        // 4.  PAYMENT DETAILS  +  GRAND TOTAL  +  SIGNATURE
        // ════════════════════════════════════════════════════════════════
        curY += 18;

        // Left: payment block
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#0f172a')
          .text('Payment Details', L, curY);
        doc.font('Helvetica').fontSize(8).fillColor('#3b82f6');
        doc.text(`Payment Method: ${paymentMethod}`, L, curY + 14);
        // doc.text(`Payment Status: ${paymentStatus}`, L, curY + 27);
        if (transactionId) {
          doc.font('Helvetica').fontSize(8).fillColor('#333333');
          doc.text(`Transaction ID: ${transactionId}`, L, curY + 40);
        }

        // Right: subtotal + grand total
        const sumX = 310.0;
        const sumLabelW = 130;
        const sumValX = sumX + sumLabelW + 5;
        const sumValW = R - sumValX;

        doc.font('Helvetica').fontSize(8).fillColor('#333333');
        doc.text('Subtotal:', sumX, curY, { align: 'right', width: sumLabelW });
        doc.text(`Rs. ${subtotalAmount.toFixed(2)}`, sumValX, curY, { align: 'right', width: sumValW });

        let sumLineY = curY + 14;
        if (shippingFee > 0) {
          doc.text('Shipping Fee:', sumX, sumLineY, { align: 'right', width: sumLabelW });
          doc.text(`Rs. ${shippingFee.toFixed(2)}`, sumValX, sumLineY, { align: 'right', width: sumValW });
          sumLineY += 14;
        }

        doc.moveTo(sumX, sumLineY).lineTo(R, sumLineY).lineWidth(0.8).strokeColor('#000000').stroke();
        sumLineY += 10;

        // Grand Total — Truckage style: large bold
        doc.font('Helvetica-Bold').fontSize(13).fillColor('#0f172a')
          .text('Grand Total:', sumX, sumLineY, { align: 'right', width: sumLabelW });
        doc.font('Helvetica-Bold').fontSize(15).fillColor('#0f172a')
          .text(`Rs. ${totalAmount.toFixed(2)}`, sumValX, sumLineY - 1, { align: 'right', width: sumValW });

        sumLineY += 20;
        // const statusColor = paymentStatus === 'PAID' ? '#16a34a' : '#d97706';
        // doc.font('Helvetica-Bold').fontSize(8).fillColor(statusColor)
        //   .text(`Payment Status: ${paymentStatus}`, sumX, sumLineY, { align: 'right', width: sumLabelW + sumValW });

        // Signature box  — Truckage: sigX=419.5, sigY=..., sigW=136, sigH=54
        const sigTopY = sumLineY + 16;
        const sigX = 419.5;
        const sigW = 136.0;
        const sigH = 54.0;
        doc.rect(sigX, sigTopY, sigW, sigH).lineWidth(0.85).strokeColor('#b4b4b4').stroke();
        doc.font('Helvetica-Bold').fontSize(8).fillColor('#000000')
          .text(soldByName, sigX + 4, sigTopY + 5, { width: sigW - 8, align: 'center' });

        // Authorized Signature Image
        const sigPathPng = path.join(process.cwd(), 'uploads', 'signature', 'dummy-signature.png');
        const sigPathJpg = path.join(process.cwd(), 'uploads', 'signature', 'dummy-signature.jpg');
        const sigFile = fs.existsSync(sigPathPng) ? sigPathPng : (fs.existsSync(sigPathJpg) ? sigPathJpg : null);

        if (sigFile) {
          try {
            doc.image(sigFile, sigX + (sigW - 80) / 2, sigTopY + 14, {
              width: 80,
              height: 26,
              fit: [80, 26],
            });
          } catch (e) {
            // fallback if image rendering fails
          }
        }

        doc.font('Helvetica').fontSize(7.5).fillColor('#666666')
          .text('Authorized Signatory', sigX + 4, sigTopY + 42, { width: sigW - 8, align: 'center' });

        // ════════════════════════════════════════════════════════════════
        // 5.  FOOTER  (Truckage: footer at bottom of page ~759)
        // ════════════════════════════════════════════════════════════════
        const ftLineY = 759.6;
        hLine(ftLineY, 1.1);

        const ftY = ftLineY + 6;
        doc.font('Helvetica-Bold').fontSize(10).fillColor('#0f172a')
          .text(soldByName, 355.59, ftY, { align: 'right', width: 200 });
        doc.font('Helvetica-Oblique').fontSize(7).fillColor('#646464')
          .text('Thank You for shopping with us!', 355.59, ftY + 12, { align: 'right', width: 200 });

        doc.font('Helvetica-Oblique').fontSize(6.5).fillColor('#505050');
        const regdText = `Regd. office: ${soldByName}, ${soldByAddress}`;
        const regdH = doc.heightOfString(regdText, { width: 300 });
        doc.text(regdText, L, ftY + 5, { width: 300 });

        const suppY = ftY + 5 + regdH + 2;
        doc.font('Helvetica').fontSize(6.5).fillColor('#505050')
          .text(`Support: ${supportPhone} | ${supportEmail} | www.zelton.co.in`, L, suppY);

        const botLineY = Math.max(ftY + 27, suppY + 10);
        doc.moveTo(L, botLineY).lineTo(R, botLineY).lineWidth(0.85).strokeColor('#000000').stroke();

        doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#000000')
          .text('E. & O.E.', 467.7, botLineY + 6);
        doc.font('Helvetica').fontSize(7.5).fillColor('#000000')
          .text('page 1 of 1', 525.59, botLineY + 6, { align: 'right', width: 30 });

        doc.end();
      } catch (err: any) {
        this.logger.error(`Error generating PDF invoice: ${err.message}`);
        reject(err);
      }
    });
  }
}
