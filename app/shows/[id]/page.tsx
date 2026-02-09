"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { db, calcHours, LocationType, WorkType } from "../../lib/db";
import { v4 as uuid } from "uuid";
import Link from "next/link";

export default function ShowDetailPage() {
  const params = useParams<{ id: string }>();
  const showId = params.id;
  async function syncToGoogleSheets() {
  if (!show) return;

  const payload = {
    show: {
      id: show.id,
      title: show.title,
      clientName: show.clientName,
      jobNumber: show.jobNumber,
      hstRate: show.hstRate,
    },
    timeEntries: timeEntries || [],
    expenses: expenses || [],
  };

  const res = await fetch("/api/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!data.ok) {
    alert("Sync failed: " + data.error);
    return;
  }

  alert("Synced to Google Sheets ✅");
}


  const show = useLiveQuery(async () => db.shows.get(showId), [showId]);
  const timeEntries = useLiveQuery(
    async () => db.timeEntries.where("showId").equals(showId).sortBy("date"),
    [showId]
  );
  const expenses = useLiveQuery(
    async () => db.expenses.where("showId").equals(showId).sortBy("date"),
    [showId]
  );
  const receipts = useLiveQuery(
    async () => db.receipts.where("showId").equals(showId).toArray(),
    [showId]
  );

  // --- form state (time entry) ---
  const today = new Date().toISOString().slice(0, 10);
  const [tDate, setTDate] = useState(today);
  const [tDesc, setTDesc] = useState("");
  const [tLoc, setTLoc] = useState<LocationType>("On-Site");
  const [tType, setTType] = useState<WorkType>("Show Day");
  const [tStart, setTStart] = useState("09:00");
  const [tEnd, setTEnd] = useState("17:00");
  const [tRate, setTRate] = useState(60);

  // --- form state (expense) ---
  const [eDate, setEDate] = useState(today);
  const [eCat, setECat] = useState<
    "Per Diem" | "Taxi/Uber" | "Hotel" | "Parking" | "Supplies" | "Other"
  >("Per Diem");
  const [eDesc, setEDesc] = useState("");
  const [eAmt, setEAmt] = useState(0);

  const totals = useMemo(() => {
    const hoursSubtotal =
      (timeEntries || []).reduce((sum, te) => {
        const hrs = calcHours(te.startTime, te.endTime);
        return sum + hrs * te.hourlyRate;
      }, 0) || 0;

    const expensesSubtotal =
      (expenses || []).reduce((sum, ex) => sum + ex.amount, 0) || 0;

    const subtotal = hoursSubtotal + expensesSubtotal;
    const hst = show ? subtotal * show.hstRate : 0;
    const grand = subtotal + hst;

    return {
      hoursSubtotal,
      expensesSubtotal,
      subtotal,
      hst,
      grand,
    };
  }, [timeEntries, expenses, show]);

  async function addTimeEntry() {
    if (!show) return;
    const now = Date.now();

    await db.timeEntries.add({
      id: uuid(),
      showId,
      date: tDate,
      description: tDesc.trim() || "Work",
      locationType: tLoc,
      workType: tType,
      startTime: tStart,
      endTime: tEnd,
      hourlyRate: tRate,
      createdAt: now,
      updatedAt: now,
    });

    await db.shows.update(showId, { updatedAt: Date.now() });
    setTDesc("");
  }

  async function addExpense() {
    if (!show) return;
    const now = Date.now();

    await db.expenses.add({
      id: uuid(),
      showId,
      date: eDate,
      category: eCat,
      description: eDesc.trim() || eCat,
      amount: Number(eAmt) || 0,
      createdAt: now,
      updatedAt: now,
    });

    await db.shows.update(showId, { updatedAt: Date.now() });
    setEDesc("");
    setEAmt(0);
  }

  async function deleteTimeEntry(id: string) {
    await db.timeEntries.delete(id);
    await db.shows.update(showId, { updatedAt: Date.now() });
  }

  async function deleteExpense(id: string) {
    await db.expenses.delete(id);
    await db.shows.update(showId, { updatedAt: Date.now() });
  }

  async function handleReceiptUpload(file: File) {
    const reader = new FileReader();

    reader.onload = async () => {
      const base64 = reader.result as string;

      await db.receipts.add({
        id: crypto.randomUUID(),
        showId,
        imageData: base64,
        fileName: file.name,
        createdAt: Date.now(),
      });

      await db.shows.update(showId, { updatedAt: Date.now() });
    };

    reader.readAsDataURL(file);
  }

  if (!show) {
    return (
      <main style={{ padding: 16 }}>
        <p>Loading…</p>
        <Link href="/">← Back</Link>
      </main>
    );
  }

  return (
    <main style={{ padding: 16, maxWidth: 900, margin: "0 auto" }}>
      <Link href="/">← Back</Link>

      <h1 style={{ fontSize: 22, fontWeight: 800, marginTop: 10 }}>
        {show.title}
      </h1>
      <div style={{ opacity: 0.85 }}>{show.clientName}</div>
      {show.jobNumber && <div style={{ opacity: 0.85 }}>Job: {show.jobNumber}</div>}

      {/* Totals */}
      <section
        style={{
          marginTop: 14,
          border: "1px solid #ddd",
          borderRadius: 12,
          padding: 12,
        }}
      >
        <strong>Totals</strong>
        <div style={{ marginTop: 6 }}>
          Hours subtotal: ${totals.hoursSubtotal.toFixed(2)}
        </div>
        <div>Expenses subtotal: ${totals.expensesSubtotal.toFixed(2)}</div>
        <div>Subtotal: ${totals.subtotal.toFixed(2)}</div>
        <div>
          HST ({(show.hstRate * 100).toFixed(0)}%): ${totals.hst.toFixed(2)}
        </div>
        <div style={{ fontWeight: 800, marginTop: 6 }}>
          Grand total: ${totals.grand.toFixed(2)}
        </div>
      </section>

      {/* Add Time Entry */}
      <section style={{ marginTop: 18 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Add Time Entry</h2>

        <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
          <label>
            Date
            <input
              type="date"
              value={tDate}
              onChange={(e) => setTDate(e.target.value)}
              style={{ width: "100%", padding: 8, marginTop: 4 }}
            />
          </label>

          <label>
            Description
            <input
              value={tDesc}
              onChange={(e) => setTDesc(e.target.value)}
              style={{ width: "100%", padding: 8, marginTop: 4 }}
              placeholder="Day 1 - Setup"
            />
          </label>

          <label>
            Location
            <select
              value={tLoc}
              onChange={(e) => setTLoc(e.target.value as LocationType)}
              style={{ width: "100%", padding: 8, marginTop: 4 }}
            >
              <option>On-Site</option>
              <option>In-Office</option>
              <option>Travel</option>
            </select>
          </label>

          <label>
            Work Type
            <select
              value={tType}
              onChange={(e) => setTType(e.target.value as WorkType)}
              style={{ width: "100%", padding: 8, marginTop: 4 }}
            >
              <option>Virtual Meeting</option>
              <option>Travel Day</option>
              <option>Setup</option>
              <option>Show Day</option>
              <option>Dismantle</option>
              <option>Other</option>
            </select>
          </label>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label>
              Start
              <input
                type="time"
                value={tStart}
                onChange={(e) => setTStart(e.target.value)}
                style={{ width: "100%", padding: 8, marginTop: 4 }}
              />
            </label>
            <label>
              End
              <input
                type="time"
                value={tEnd}
                onChange={(e) => setTEnd(e.target.value)}
                style={{ width: "100%", padding: 8, marginTop: 4 }}
              />
            </label>
          </div>

          <label>
            Hourly Rate
            <input
              type="number"
              value={tRate}
              onChange={(e) => setTRate(Number(e.target.value))}
              style={{ width: "100%", padding: 8, marginTop: 4 }}
            />
          </label>

          <button
            onClick={addTimeEntry}
            style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
          >
            Add Time
          </button>
        </div>

        {/* Time entries list */}
        <div style={{ marginTop: 12 }}>
          <h3 style={{ fontWeight: 700 }}>Time Entries</h3>
          {!timeEntries?.length && <p>No time entries yet.</p>}
          {timeEntries?.map((te) => {
            const hrs = calcHours(te.startTime, te.endTime);
            const total = hrs * te.hourlyRate;
            return (
              <div
                key={te.id}
                style={{
                  border: "1px solid #eee",
                  borderRadius: 10,
                  padding: 10,
                  marginTop: 8,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <strong>{te.date}</strong>
                  <button onClick={() => deleteTimeEntry(te.id)}>Delete</button>
                </div>
                <div style={{ opacity: 0.85 }}>{te.description}</div>
                <div style={{ opacity: 0.85 }}>
                  {te.locationType} • {te.workType}
                </div>
                <div style={{ marginTop: 6 }}>
                  {te.startTime}–{te.endTime} = {hrs.toFixed(2)} hrs @ ${te.hourlyRate}/hr
                </div>
                <div style={{ fontWeight: 700 }}>Line total: ${total.toFixed(2)}</div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Add Expense */}
      <section style={{ marginTop: 22 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Add Expense</h2>

        <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
          <label>
            Date
            <input
              type="date"
              value={eDate}
              onChange={(e) => setEDate(e.target.value)}
              style={{ width: "100%", padding: 8, marginTop: 4 }}
            />
          </label>

          <label>
            Category
            <select
              value={eCat}
              onChange={(e) => setECat(e.target.value as any)}
              style={{ width: "100%", padding: 8, marginTop: 4 }}
            >
              <option>Per Diem</option>
              <option>Taxi/Uber</option>
              <option>Hotel</option>
              <option>Parking</option>
              <option>Supplies</option>
              <option>Other</option>
            </select>
          </label>

          <label>
            Description
            <input
              value={eDesc}
              onChange={(e) => setEDesc(e.target.value)}
              style={{ width: "100%", padding: 8, marginTop: 4 }}
              placeholder="Uber to venue"
            />
          </label>

          <label>
            Amount
            <input
              type="number"
              value={eAmt}
              onChange={(e) => setEAmt(Number(e.target.value))}
              style={{ width: "100%", padding: 8, marginTop: 4 }}
            />
          </label>

          <button
            onClick={addExpense}
            style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
          >
            Add Expense
          </button>
        </div>

        {/* Expenses list */}
        <div style={{ marginTop: 12 }}>
          <h3 style={{ fontWeight: 700 }}>Expenses</h3>
          {!expenses?.length && <p>No expenses yet.</p>}
          {expenses?.map((ex) => (
            <div
              key={ex.id}
              style={{
                border: "1px solid #eee",
                borderRadius: 10,
                padding: 10,
                marginTop: 8,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <strong>{ex.date}</strong>
                <button onClick={() => deleteExpense(ex.id)}>Delete</button>
              </div>
              <div style={{ opacity: 0.85 }}>
                {ex.category} • {ex.description}
              </div>
              <div style={{ fontWeight: 700 }}>${ex.amount.toFixed(2)}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Receipts */}
      <section style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Receipts</h2>

        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => {
            if (e.target.files?.[0]) {
              handleReceiptUpload(e.target.files[0]);
              e.target.value = "";
            }
          }}
          style={{ marginTop: 10 }}
        />

        <button
  onClick={syncToGoogleSheets}
  style={{ marginTop: 10, padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
>
  Sync to Google Sheets
</button>


        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
            gap: 10,
            marginTop: 12,
          }}
        >
          {!receipts?.length && <p>No receipts yet.</p>}

          {receipts?.map((r) => (
            <img
              key={r.id}
              src={r.imageData}
              alt="receipt"
              style={{
                width: "100%",
                borderRadius: 8,
                border: "1px solid #ddd",
              }}
            />
          ))}
        </div>
      </section>
    </main>
  );
}
