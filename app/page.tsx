"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "./lib/db";

export default function HomePage() {
  const shows = useLiveQuery(
    async () => db.shows.orderBy("updatedAt").reverse().toArray(),
    []
  );

  return (
    <main style={{ padding: 16, maxWidth: 800, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700 }}>Shows (Invoices)</h1>

      <div style={{ marginTop: 12 }}>
        <Link href="/shows/new">+ New Show</Link>
      </div>

      <div style={{ marginTop: 16 }}>
        {!shows?.length && <p>No shows yet. Create one.</p>}

        {shows?.map((s) => (
          <div
            key={s.id}
            style={{
              border: "1px solid #ddd",
              borderRadius: 10,
              padding: 12,
              marginTop: 10,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <strong>{s.title}</strong>
              <span>{s.status}</span>
            </div>
            <div style={{ opacity: 0.8 }}>{s.clientName}</div>
            {s.jobNumber && <div style={{ opacity: 0.8 }}>Job: {s.jobNumber}</div>}
            <div style={{ marginTop: 8 }}>
              <Link href={`/shows/${s.id}`}>Open</Link>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
