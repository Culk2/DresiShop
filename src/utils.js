import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export function currency(value) {
  return new Intl.NumberFormat("sl-SI", {
    style: "currency",
    currency: "EUR",
  }).format(Number(value || 0));
}

export function number(value) {
  return new Intl.NumberFormat("sl-SI").format(Number(value || 0));
}

export function exportOrdersPdf(orders) {
  const doc = new jsPDF();
  doc.setFontSize(18);
  doc.text("Dresi Shop - pregled narocil", 14, 20);

  autoTable(doc, {
    startY: 30,
    head: [["Stevilka", "Kupec", "Izdelki", "Znesek", "Status", "Datum"]],
    body: orders.map((order) => [
      order.orderNumber,
      `${order.customerName} (${order.customerEmail})`,
      order.items.map((item) => `${item.productName} x ${item.quantity}`).join(", "),
      currency(order.total),
      order.status,
      new Date(order.orderDate).toLocaleString("sl-SI"),
    ]),
  });

  doc.save("dresi-shop-orders.pdf");
}
