import { NextResponse } from "next/server";
import { google } from "googleapis";

type SyncPayload = {
  show: {
    id: string;
    title: string;
    clientName: string;
    jobNumber?: string;
    hstRate: number;
  };
  timeEntries: Array<{
    date: string;
    description: string;
    locationType: string;
    workType: string;
    startTime: string;
    endTime: string;
    hourlyRate: number;
  }>;
  expenses: Array<{
    date: string;
    category: string;
    description: string;
    amount: number;
  }>;
};

function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let key = process.env.GOOGLE_PRIVATE_KEY;

  if (!email || !key) throw new Error("Missing Google service account env vars");

  // Handle cases where hosting escapes newlines
  key = key.replace(/\\n/g, "\n");

  return new google.auth.JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

export async function POST(req: Request) {
  try {
    const sheetId = process.env.GOOGLE_SHEET_ID;
    if (!sheetId) throw new Error("Missing GOOGLE_SHEET_ID");

    const payload = (await req.json()) as SyncPayload;

    const auth = getAuth();
    const sheets = google.sheets({ version: "v4", auth });

    // 1) Append Hours rows
    const hoursRows = payload.timeEntries.map((t) => [
      payload.show.id,
      payload.show.clientName,
      payload.show.title,
      payload.show.jobNumber || "",
      t.date,
      t.description,
      t.locationType,
      t.workType,
      t.startTime,
      t.endTime,
      t.hourlyRate,
    ]);

    if (hoursRows.length) {
      await sheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: "Hours!A:Z",
        valueInputOption: "USER_ENTERED",
        requestBody: { values: hoursRows },
      });
    }

    // 2) Append Expense rows
    const expenseRows = payload.expenses.map((e) => [
      payload.show.id,
      payload.show.clientName,
      payload.show.title,
      payload.show.jobNumber || "",
      e.date,
      e.category,
      e.description,
      e.amount,
    ]);

    if (expenseRows.length) {
      await sheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: "Expenses!A:Z",
        valueInputOption: "USER_ENTERED",
        requestBody: { values: expenseRows },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Sync failed" },
      { status: 500 }
    );
  }
}
