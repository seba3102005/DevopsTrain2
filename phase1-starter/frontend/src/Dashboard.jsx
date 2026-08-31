import { useEffect, useMemo, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { api } from './api';

const SENTIMENT_COLORS = { positive: '#059669', neutral: '#9ca3af', negative: '#dc2626' };

export default function Dashboard() {
  const [snapshot, setSnapshot] = useState(null);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('bookingsCount');
  const [sortDir, setSortDir] = useState('desc');

  useEffect(() => {
    api.analyticsSummary().then(setSnapshot).catch((err) => setError(err.message));
  }, []);

  const rows = useMemo(() => {
    if (!snapshot) return [];
    const filtered = snapshot.eventsTable.filter((row) =>
      row.title.toLowerCase().includes(search.toLowerCase())
    );
    return [...filtered].sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      return a[sortKey] > b[sortKey] ? dir : a[sortKey] < b[sortKey] ? -dir : 0;
    });
  }, [snapshot, search, sortKey, sortDir]);

  function toggleSort(key) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  if (error) {
    return <div className="alert alert-danger">Failed to load analytics: {error}</div>;
  }
  if (!snapshot) {
    return <p className="muted">Loading analytics…</p>;
  }

  const sentimentData = Object.entries(snapshot.sentimentTotals).map(([name, value]) => ({
    name,
    value,
  }));

  const columns = [
    ['title', 'Event'],
    ['bookingsCount', 'Bookings'],
    ['revenue', 'Revenue'],
    ['reviewCount', 'Reviews'],
    ['avgSentimentScore', 'Avg sentiment'],
  ];

  return (
    <div>
      <p className="muted" style={{ marginTop: 0 }}>
        Last generated: {new Date(snapshot.generatedAt).toLocaleString()}
      </p>

      <div className="grid-2">
        <div className="card chart-card">
          <h3 className="chart-heading">Bookings over time</h3>
          <ResponsiveContainer width="100%" height="85%">
            <LineChart data={snapshot.bookingsTimeseries}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef0f4" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6b7280' }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#6b7280' }} />
              <Tooltip />
              <Line type="monotone" dataKey="bookings" stroke="#4f46e5" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card chart-card">
          <h3 className="chart-heading">Review sentiment</h3>
          <ResponsiveContainer width="100%" height="85%">
            <PieChart>
              <Pie data={sentimentData} dataKey="value" nameKey="name" outerRadius={80}>
                {sentimentData.map((entry) => (
                  <Cell key={entry.name} fill={SENTIMENT_COLORS[entry.name] || '#9ca3af'} />
                ))}
              </Pie>
              <Legend />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card" style={{ marginTop: '1rem' }}>
        <h3 className="card-title">Events</h3>
        <input
          className="input"
          placeholder="Filter by event title…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ marginBottom: '0.9rem', maxWidth: 260 }}
        />
        <table className="data-table">
          <thead>
            <tr>
              {columns.map(([key, label]) => (
                <th key={key} onClick={() => toggleSort(key)}>
                  {label}
                  {sortKey === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.eventId}>
                <td>{row.title}</td>
                <td>{row.bookingsCount}</td>
                <td>${row.revenue}</td>
                <td>{row.reviewCount}</td>
                <td>{row.avgSentimentScore}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="muted">No events match your filter.</p>}
      </div>
    </div>
  );
}
