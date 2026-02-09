"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { db } from "../../lib/db";
import { v4 as uuid } from "uuid";

export default function NewShowPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [clientName, setClientName] = useState("");
  const [jobNumber, setJobNumber] = useState("");
  const [hstRate, setHstRate] = useState(0.13);

  async function createShow() {
    const now = Date.now();
    const id = uuid();

    await db.shows.add({
      id,
      title: title.trim() || "Untitled Show",
      clientName: clientName.trim() || "Unknown Client",
      jobNumber: jobNumber.trim() || undefined,
      createdAt: now,
      updatedAt: now,
      status: "Draft",
      hstRate,
    });

    router.push(`/shows/${id}`);
  }

  return (
    <main style={{ padding: 16, maxWidth: 800, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700 }}>New Show</h1>

      <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
        <label>
          Show Title
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ width: "100%", padding: 8, marginTop: 4 }}
            placeholder="Genetech Travelling Museum"
          />
        </label>

        <label>
          Client Name
          <input
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            style={{ width: "100%", padding: 8, marginTop: 4 }}
            placeholder="Globacore Inc."
          />
        </label>

        <label>
          Job Number (optional)
          <input
            value={jobNumber}
            onChange={(e) => setJobNumber(e.target.value)}
            style={{ width: "100%", padding: 8, marginTop: 4 }}
            placeholder="XXXX"
          />
        </label>

        <label>
          HST Rate (e.g. 0.13)
          <input
            type="number"
            value={hstRate}
            step="0.01"
            onChange={(e) => setHstRate(Number(e.target.value))}
            style={{ width: "100%", padding: 8, marginTop: 4 }}
          />
        </label>

        <button
          onClick={createShow}
          style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
        >
          Create
        </button>
      </div>
    </main>
  );
}
