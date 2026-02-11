import { NextResponse } from "next/server";
import { google } from "googleapis";

type SyncPayload = {
  show: {
    id: string;
    title: string;        // Project
    clientName: string;   // Invoice for
    jobNumber?: string;
    hstRate: number;
    googleSheetId?: string; // stored after first sync
  };
  timeEntries: Array<{
    date: string; // YYYY-MM-DD
    description: string;
    locationType: string;
    workType: string;
    startTime: string;
    endTime: string;
    hourlyRate: number;
  }>;
  expenses: Array<{
    date: string; // YYYY-MM-DD
    category: string;
    description: string;
    amount: number;
  }>;
};

function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let key = process.env.GOOGLE_PRIVATE_KEY;

  if (!email || !key) throw new Error("Missing Google service account env vars");
  key = key.replace(/\\n/g, "\n");

  return new google.auth.JWT({
    email,
    key,
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive",
    ],
  });
}

// ---- adjust this tab name if your template tab is different ----
const INVOICE_TAB = "Invoice";

// These match your screenshot layout.
// Hours rows begin at row 18, columns B..K (we’ll write B..K and leave blanks for merged cols)
const HOURS_START_ROW = 18;
const EXP_START_ROW = 30;

// We clear a safe range so resync doesn't duplicate
const HOURS_CLEAR_RANGE = `${INVOICE_TAB}!B18:K200`;
const EXP_CLEAR_RANGE = `${INVOICE_TAB}!B30:K200`;

// Header cells (based on your screenshot). If any are off by 1 cell, we’ll adjust after first test.
const CELL_SUBMITTED_ON = `${INVOICE_TAB}!B7`;
const CELL_CLIENT_NAME = `${INVOICE_TAB}!B11`;
const CELL_PROJECT = `${INVOICE_TAB}!D13`;
const CELL_JOBNUMBER = `${INVOICE_TAB}!D14`;

function calcHours(startTime: string, endTime: string) {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  const start = sh * 60 + sm;
  const end = eh * 60 + em;
  const diff = end - start;
  if (diff <= 0) return 0;
  return Math.round((diff / 60) * 100) / 100;
}

export async function POST(req: Request) {
  try {
    const templateId = process.env.GOOGLE_TEMPLATE_SHEET_ID;
    const fallbackSheetId = process.env.GOOGLE_SHEET_ID; // not used anymore, but ok to keep
    if (!templateId && !fallbackSheetId) throw new Error("Missing GOOGLE_TEMPLATE_SHEET_ID");

    const payload = (await req.json()) as SyncPayload;

    const auth = getAuth();
    const sheets = google.sheets({ version: "v4", auth });
    const drive = google.drive({ version: "v3", auth });

    // 1) Create a new spreadsheet by copying template (Option A)
    // If you later want resync, we’ll store googleSheetId on the show and update that same sheet.
    let spreadsheetId = payload.show.googleSheetId;

    if (!spreadsheetId) {
      const copyRes = await drive.files.copy({
        fileId: templateId!,
        requestBody: {
          name: `Invoice - ${payload.show.clientName} - ${payload.show.title} - ${payload.show.id.slice(0, 6)}`,
        },
      });
      spreadsheetId = copyRes.data.id || undefined;
      if (!spreadsheetId) throw new Error("Failed to create invoice copy");
    }

    // 2) Write header fields (minimal for now)
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: "USER_ENTERED",
        data: [
          { range: CELL_SUBMITTED_ON, values: [[`Submitted on ${new Date().toLocaleDateString("en-CA")}`]] },
          { range: CELL_CLIENT_NAME, values: [[payload.show.clientName]] },
          { range: CELL_PROJECT, values: [[payload.show.title]] },
          { range: CELL_JOBNUMBER, values: [[`Job Number: ${payload.show.jobNumber || ""}`]] },
        ],
      },
    });

    // 3) Clear old table ranges (so resync overwrites cleanly)
    await sheets.spreadsheets.values.batchClear({
      spreadsheetId,
      requestBody: { ranges: [HOURS_CLEAR_RANGE, EXP_CLEAR_RANGE] },
    });

    // 4) Write Hours rows into B..K starting row 18
    const hoursRows = (payload.timeEntries || []).map((t, idx) => {
      const hrs = calcHours(t.startTime, t.endTime);
      const total = Math.round(hrs * t.hourlyRate * 100) / 100;

      // Columns B..K (10 cols):
      // B No, C Date, D Desc, E blank, F blank, G Location, H Hrs, I Rate, J Total, K blank
      return [
        idx + 1,
        t.date,
        `${t.description} - ${t.workType}`,
        "",
        "",
        t.locationType,
        hrs,
        t.hourlyRate,
        total,
        "",
      ];
    });

    if (hoursRows.length) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${INVOICE_TAB}!B${HOURS_START_ROW}:K${HOURS_START_ROW + hoursRows.length - 1}`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: hoursRows },
      });
    }

    // 5) Write Expense rows into B..K starting row 30
    const expRows = (payload.expenses || []).map((e, idx) => {
      // Columns B..K:
      // B No, C Date, D Category, E Desc, F Project&Job#, G blank, H blank, I blank, J blank, K Amount
      return [
        idx + 1,
        e.date,
        e.category,
        e.description,
        payload.show.jobNumber ? `${payload.show.title} (${payload.show.jobNumber})` : payload.show.title,
        "",
        "",
        "",
        "",
        e.amount,
      ];
    });

    if (expRows.length) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${INVOICE_TAB}!B${EXP_START_ROW}:K${EXP_START_ROW + expRows.length - 1}`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: expRows },
      });
    }

    const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
    return NextResponse.json({ ok: true, spreadsheetId, url });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Sync failed" },
      { status: 500 }
    );
  }
}
