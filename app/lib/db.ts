import Dexie, { Table } from "dexie";

export type LocationType = "On-Site" | "In-Office" | "Travel";
export type WorkType =
  | "Virtual Meeting"
  | "Travel Day"
  | "Setup"
  | "Show Day"
  | "Dismantle"
  | "Other";

export type Show = {
  id: string; // UUID
  title: string; // e.g. "Genetech Travelling Museum"
  clientName: string; // e.g. "Globacore Inc."
  jobNumber?: string; // optional
  createdAt: number; // epoch ms
  updatedAt: number; // epoch ms
  status: "Draft" | "Closed";
  hstRate: number; // 0.13 for 13%
};

export type TimeEntry = {
  id: string;
  showId: string;

  date: string; // "YYYY-MM-DD"
  description: string;
  locationType: LocationType;
  workType: WorkType;

  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
  hourlyRate: number;

  createdAt: number;
  updatedAt: number;
};

export type Expense = {
  id: string;
  showId: string;

  date: string; // "YYYY-MM-DD"
  category: "Per Diem" | "Taxi/Uber" | "Hotel" | "Parking" | "Supplies" | "Other";
  description: string;
  amount: number;

  createdAt: number;
  updatedAt: number;
};

export type Receipt = {
  id: string;
  showId: string;
  expenseId?: string;

  imageData: string; // base64 (offline-safe)
  fileName: string;

  createdAt: number;
};

class InvoiceDB extends Dexie {
  shows!: Table<Show, string>;
  timeEntries!: Table<TimeEntry, string>;
  expenses!: Table<Expense, string>;
  receipts!: Table<Receipt, string>;

  constructor() {
    super("invoicing_pwa_db");

    this.version(2).stores({
      shows: "id, status, createdAt, updatedAt, clientName",
      timeEntries: "id, showId, date, createdAt",
      expenses: "id, showId, date, createdAt",
      receipts: "id, showId, expenseId, createdAt",
    });
  }
}

export const db = new InvoiceDB();

// ---- helpers ----
export function calcHours(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  const start = sh * 60 + sm;
  const end = eh * 60 + em;
  const diff = end - start;
  if (diff <= 0) return 0;
  return Math.round((diff / 60) * 100) / 100;
}
