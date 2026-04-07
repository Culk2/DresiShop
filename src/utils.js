import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { seedState } from "./data";

const STORAGE_KEY = "dresi-shop-state";

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : seedState;
  } catch {
    return seedState;
  }
}

export function saveState(value) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

export function currency(value) {
  return new Intl.NumberFormat("sl-SI", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

export function number(value) {
  return new Intl.NumberFormat("sl-SI").format(value);
}

export function todayString() {
  return new Date().toISOString().slice(0, 10);
}

export function buildId(prefix) {
  return `${prefix}-${Math.floor(Math.random() * 9000 + 1000)}`;
}

export function parseImportedFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const fileName = file.name.toLowerCase();
        const content = event.target?.result;

        if (fileName.endsWith(".csv")) {
          const text = typeof content === "string" ? content : "";
          const [headerLine, ...lines] = text.split(/\r?\n/).filter(Boolean);
          const headers = headerLine.split(",").map((item) => item.trim());
          const rows = lines.map((line) => {
            const cells = line.split(",").map((item) => item.trim());
            return headers.reduce((acc, header, index) => {
              acc[header] = cells[index] ?? "";
              return acc;
            }, {});
          });
          resolve(rows);
          return;
        }

        const workbook = XLSX.read(content, { type: "array" });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(firstSheet);
        resolve(rows);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(new Error("Napaka pri branju datoteke."));

    if (file.name.toLowerCase().endsWith(".csv")) {
      reader.readAsText(file);
    } else {
      reader.readAsArrayBuffer(file);
    }
  });
}

export function exportOrdersPdf(orders) {
  const doc = new jsPDF();
  doc.setFontSize(18);
  doc.text("Dresi Shop - pregled narocil", 14, 20);
  autoTable(doc, {
    startY: 30,
    head: [["ID", "Kupec", "Izdelek", "Kolicina", "Znesek", "Status", "Datum"]],
    body: orders.map((order) => [
      order.id,
      order.customerName,
      order.productName,
      String(order.quantity),
      currency(order.total),
      order.status,
      order.createdAt,
    ]),
  });
  doc.save("narocila-dresi-shop.pdf");
}

export async function fetchClubInsights(clubName) {
  if (!clubName) {
    return null;
  }

  const response = await fetch(
    `https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=${encodeURIComponent(clubName)}`,
  );

  if (!response.ok) {
    throw new Error("Zunanji API ni dosegljiv.");
  }

  const data = await response.json();
  const team = data?.teams?.[0];

  if (!team) {
    return null;
  }

  return {
    team: team.strTeam,
    league: team.strLeague,
    stadium: team.strStadium,
    country: team.strCountry,
    founded: team.intFormedYear,
    description: team.strDescriptionEN,
    badge: team.strBadge,
  };
}
