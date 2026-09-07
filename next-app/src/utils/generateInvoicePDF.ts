import jsPDF from "jspdf";

export interface OrderInvoiceData {
  id: number;
  order_number?: string;
  orderNumber?: string;
  status?: string;
  payment_method?: string;
  paymentMethod?: string;
  payment_status?: string;
  paymentStatus?: string;
  transaction_id?: string | null;
  transactionId?: string | null;
  subtotal?: number | string;
  shipping_fee?: number | string;
  shippingFee?: number | string;
  tax?: number | string;
  total?: number | string;
  shipping_address?: string;
  shippingAddress?: string;
  billing_address?: string;
  billingAddress?: string;
  created_at?: string;
  createdAt?: string;
  delivered_at?: string;
  deliveredAt?: string;
  user?: {
    name?: string;
    email?: string;
    phone?: string;
    phone_number?: string;
    contact?: string;
  };
  order_items?: any[];
  orderItems?: any[];
}

export const generateInvoicePDF = async (
  order: OrderInvoiceData,
  settings?: Record<string, string> | null
) => {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const rawIdStr = String(order.id || "1").replace(/\D/g, "") || "1";
  const orderNum = order.order_number || order.orderNumber || `ORD-${rawIdStr}`;
  const formattedOrderId = orderNum.startsWith("ORD-")
    ? orderNum
    : `OD${rawIdStr.padStart(6, "0")}`;

  const txnId = order.transaction_id || order.transactionId;
  const invoiceNum = txnId ? `INV-${txnId}` : `INV-${rawIdStr.padStart(6, "0")}`;

  // Sold By settings
  const soldByName = settings?.sold_by_name?.trim() || "Rahul Singh";
  const soldByAddress =
    settings?.sold_by_address?.trim() ||
    "Home no. 129 naib colony near army gate village kanwla, AMBALA, HARYANA, 134003, IN";
  const soldByPan = settings?.pan_no?.trim() || settings?.pan?.trim() || "EDKPS7525H";
  const gstinValue = settings?.gstin?.trim() || "06EDKPS7525H1Z3";
  const supportPhone = settings?.support_phone?.trim() || "9996646857";
  const supportEmail = settings?.support_email?.trim() || "zelton456@gmail.com";

  const formatDateStr = (dateStr?: string | null) => {
    if (!dateStr) return new Date().toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "2-digit", year: "numeric" }).replace(/\//g, "-");
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return new Date().toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "2-digit", year: "numeric" }).replace(/\//g, "-");
    return d.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "2-digit", year: "numeric" }).replace(/\//g, "-");
  };

  const orderDate = formatDateStr(order.created_at || order.createdAt);
  const invoiceDate = formatDateStr(order.delivered_at || order.deliveredAt || order.created_at || order.createdAt);

  const customerName = order.user?.name || "Valued Customer";
  const customerEmail = order.user?.email || "";
  const customerPhone = order.user?.phone || order.user?.phone_number || order.user?.contact || "";

  let rawAddr = order.shipping_address || order.shippingAddress || "N/A";
  let shippingAddr = rawAddr;
  try {
    if (typeof rawAddr === 'string' && rawAddr.trim().startsWith('{')) {
      const p = JSON.parse(rawAddr.trim());
      shippingAddr = [p.add, p.city, [p.state, p.pin].filter(Boolean).join(' '), p.country].filter(Boolean).join(', ');
    }
  } catch (e) {
    shippingAddr = String(rawAddr);
  }

  const rawTotal = typeof order.total === "number" ? order.total : parseFloat((order.total as any) || "0") || 0;
  const rawSubtotal = typeof order.subtotal === "number" ? order.subtotal : parseFloat((order.subtotal as any) || "0") || rawTotal;
  const rawShipping = typeof order.shipping_fee === "number" ? order.shipping_fee : parseFloat((order.shippingFee as any) || "0") || 0;

  const paymentMeth = (order.payment_method || order.paymentMethod || "cash_on_delivery") === "cash_on_delivery" ? "Cash on Delivery (COD)" : "Online Payment";
  const paymentStat = (order.payment_status || order.paymentStatus || "pending").toUpperCase();

  const itemsList = order.order_items || order.orderItems || [];

  // 1. Title Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(0, 0, 0);
  doc.text("Tax Invoice", 105, 14, { align: "center" });

  // 2. Sold By Section (Left)
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(`Sold By: ${soldByName} ,`, 14, 22);

  doc.setFontSize(7.5);
  doc.setFont("helvetica", "italic");
  doc.text(`Ship-from Address: ${soldByAddress}`, 14, 26, { maxWidth: 85 });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text(`PAN: ${soldByPan}   |   GSTIN - ${gstinValue}`, 14, 37);

  // 3. Brand Header / Logo (Top Right)
  const logoX = 145;
  const logoY = 15;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(15, 23, 42);
  doc.text("Zelton", logoX + 20, logoY + 9.5);

  // Invoice Number Box
  const invBoxX = 135;
  const invBoxY = 30;
  const invBoxW = 61;
  const invBoxH = 7;
  doc.setDrawColor(150, 150, 150);
  doc.setLineWidth(0.3);
  doc.rect(invBoxX, invBoxY, invBoxW, invBoxH);
  doc.setFontSize(8);
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.text("Invoice Number", invBoxX + 2, invBoxY + 4.8);
  doc.setFont("helvetica", "normal");
  doc.text(invoiceNum, invBoxX + 26, invBoxY + 4.8);

  // Top Divider Line
  doc.setLineWidth(0.4);
  doc.line(14, 42, 196, 42);

  // 4. Order Details & Billing Address (Dynamic Y Height)
  let currentY = 48;
  doc.setFontSize(8.5);

  // Order Details (Left)
  doc.setFont("helvetica", "bold");
  doc.text(`Order ID: ${formattedOrderId}`, 14, currentY);
  doc.text(`Order Date: ${orderDate}`, 14, currentY + 5);
  doc.text(`Invoice Date: ${invoiceDate}`, 14, currentY + 10);
  doc.text(`Payment: ${paymentMeth}`, 14, currentY + 15);
  let leftHeight = 20;
  if (txnId) {
    doc.text(`Txn ID: ${txnId}`, 14, currentY + 20);
    leftHeight = 25;
  }

  // Billing / Shipping Address (Right)
  const billX = 100;
  doc.setFont("helvetica", "bold");
  doc.text("Shipping / Billing Address", billX, currentY);

  doc.setFont("helvetica", "normal");
  doc.text(`Customer: ${customerName}`, billX, currentY + 5);
  let rightSubY = currentY + 10;
  if (customerPhone) {
    doc.text(`Phone: ${customerPhone}`, billX, rightSubY);
    rightSubY += 5;
  }
  if (customerEmail) {
    doc.text(`Email: ${customerEmail}`, billX, rightSubY);
    rightSubY += 5;
  }

  const addressLines = doc.splitTextToSize(`Address: ${shippingAddr}`, 90);
  doc.text(addressLines, billX, rightSubY);
  const rightHeight = (rightSubY - currentY) + (addressLines.length * 4);

  // Dynamically position table header line safely below address!
  currentY = currentY + Math.max(leftHeight, rightHeight) + 6;
  doc.setLineWidth(0.5);
  doc.line(14, currentY, 196, currentY);

  // 5. Table Headers
  currentY += 5;
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);

  doc.text("Description", 14, currentY);
  doc.text("Qty", 95, currentY, { align: "center" });
  doc.text("Gross (Rs.)", 120, currentY, { align: "center" });
  doc.text("Discount", 145, currentY, { align: "center" });
  doc.text("Taxable (Rs.)", 170, currentY, { align: "center" });
  doc.text("Total (Rs.)", 196, currentY, { align: "right" });

  currentY += 4;
  doc.setLineWidth(0.4);
  doc.line(14, currentY, 196, currentY);

  // 6. Table Items
  currentY += 5;
  itemsList.forEach((item: any) => {
    const prodName =
      item.product?.name ||
      item.product?.title ||
      item.product_name ||
      item.name ||
      item.title ||
      "Product Item";

    const sku = item.variant?.sku || item.sku || "";
    let variantText = "";
    if (item.variant?.title) {
      variantText = item.variant.title;
    } else if (item.selected_attributes || item.selectedAttributes) {
      const attrs = item.selected_attributes || item.selectedAttributes;
      if (typeof attrs === "object" && attrs !== null) {
        variantText = Object.entries(attrs).map(([k, v]) => `${k}: ${v}`).join(", ");
      } else if (typeof attrs === "string") {
        variantText = attrs;
      }
    }

    const fullTitle = variantText ? `${prodName} (${variantText})` : prodName;

    const qty = parseInt(item.quantity || "1", 10) || 1;
    const itemPrice = typeof item.price === "number" ? item.price : parseFloat(item.price || "0") || 0;
    const itemTotal = typeof item.total === "number" ? item.total : parseFloat(item.total || (itemPrice * qty).toString()) || 0;

    const hsnCode =
      item.hsn ||
      item.product?.hsn ||
      item.product?.category?.hsn ||
      item.product?.category?.parent?.hsn ||
      item.product?.hsn_code ||
      item.product?.hsnCode ||
      "";

    const itemRateRaw =
      item.taxRate ||
      item.tax_rate ||
      item.product?.gstRate ||
      item.product?.tax_rate ||
      item.product?.category?.gstRate ||
      item.product?.category?.tax_rate ||
      18.0;

    const itemRate = parseFloat(String(itemRateRaw)) || 18.0;

    const taxableVal = item.taxableAmount || item.taxable_amount
      ? parseFloat(item.taxableAmount || item.taxable_amount).toFixed(2)
      : (itemTotal / (1 + (itemRate / 100))).toFixed(2);

    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    const titleLines = doc.splitTextToSize(fullTitle, 75);
    doc.text(titleLines, 14, currentY);

    let subY = currentY + (titleLines.length * 4);

    if (sku) {
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(71, 85, 105);
      doc.text(`SKU: ${sku}`, 14, subY);
      subY += 3.5;
    }

    const taxInfoParts: string[] = [];
    if (hsnCode) taxInfoParts.push(`HSN: ${hsnCode}`);
    taxInfoParts.push(`Includes ${itemRate.toFixed(1)}% GST`);
    const taxNoteText = taxInfoParts.join(" · ");

    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);
    doc.text(taxNoteText, 14, subY);
    subY += 3.5;

    const blockHeight = subY - currentY;

    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(15, 23, 42);
    doc.text(String(qty), 95, currentY, { align: "center" });
    doc.text(itemPrice.toFixed(2), 120, currentY, { align: "center" });
    doc.text("0.00", 145, currentY, { align: "center" });
    doc.text(taxableVal, 170, currentY, { align: "center" });
    doc.text(itemTotal.toFixed(2), 196, currentY, { align: "right" });

    currentY += blockHeight + 4;
  });

  // Line below items
  doc.setLineWidth(0.3);
  doc.line(14, currentY, 196, currentY);

  // 7. Totals & Grand Total Row
  currentY += 6;
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 23, 42);
  doc.text("Subtotal:", 145, currentY);
  doc.text(`Rs. ${rawSubtotal.toFixed(2)}`, 196, currentY, { align: "right" });

  if (rawShipping > 0) {
    currentY += 5;
    doc.text("Shipping Fee:", 145, currentY);
    doc.text(`Rs. ${rawShipping.toFixed(2)}`, 196, currentY, { align: "right" });
  }

  currentY += 6;
  doc.setLineWidth(0.5);
  doc.line(135, currentY, 196, currentY);

  currentY += 6;
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text("Grand Total:", 140, currentY);
  doc.setFontSize(14);
  doc.text(`Rs. ${rawTotal.toFixed(2)}`, 196, currentY, { align: "right" });

  currentY += 5;
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(paymentStat === "PAID" ? 22 : 217, paymentStat === "PAID" ? 163 : 119, paymentStat === "PAID" ? 74 : 6);
  doc.text(`Status: ${paymentStat}`, 196, currentY, { align: "right" });

  // Signature Section
  currentY += 6;
  const sigX = 145;
  const sigY = currentY;
  const sigW = 51;
  const sigH = 19;

  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);
  doc.rect(sigX, sigY, sigW, sigH, "S");
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(soldByName, sigX + sigW / 2, sigY + 4, { align: "center", maxWidth: sigW - 2 });

  try {
    doc.addImage("/dummy-signature.png", "PNG", sigX + (sigW - 28) / 2, sigY + 5, 28, 9.5);
  } catch (e) {
    // fallback if image not loaded
  }

  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text("Authorized Signatory", sigX + sigW / 2, sigY + 16.5, { align: "center" });

  // Bottom Line
  currentY = 265;
  doc.setLineWidth(0.4);
  doc.line(14, currentY, 196, currentY);

  // 8. Footer
  const footerY = 270;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(soldByName, 196, footerY, { align: "right" });
  doc.setFontSize(7);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(100, 100, 100);
  doc.text("Thank You for shopping with us!", 196, footerY + 3.5, { align: "right" });

  doc.setFontSize(6.5);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(80, 80, 80);
  doc.text(`Regd. office: ${soldByName} , ${soldByAddress}`, 14, footerY + 2);
  doc.setFont("helvetica", "normal");
  doc.text(`Contact Support: ${supportPhone} || ${supportEmail} || www.zelton.co.in`, 14, footerY + 6);

  doc.setLineWidth(0.3);
  doc.line(14, footerY + 8.5, 196, footerY + 8.5);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(0, 0, 0);
  doc.text("E. & O.E.", 165, footerY + 12);
  doc.setFont("helvetica", "normal");
  doc.text("page 1 of 1", 196, footerY + 12, { align: "right" });

  // Trigger Download
  doc.save(`Tax_Invoice_${invoiceNum}.pdf`);
};
