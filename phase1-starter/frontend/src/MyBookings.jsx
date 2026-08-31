import { useEffect, useState } from 'react';
import { api } from './api';

function SentimentBadge({ sentiment }) {
  const cls =
    sentiment === 'positive' ? 'badge-positive' : sentiment === 'negative' ? 'badge-negative' : 'badge-neutral';
  return <span className={`badge ${cls}`}>{sentiment}</span>;
}

export default function MyBookings({ userId }) {
  const [bookings, setBookings] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reviewText, setReviewText] = useState({});
  const [reviewResult, setReviewResult] = useState({});
  const [submitting, setSubmitting] = useState({});

  function load() {
    setLoading(true);
    api
      .myBookings()
      .then((all) => setBookings(all.filter((b) => b.userId === userId)))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, [userId]);

  async function submitReview(bookingId) {
    const text = (reviewText[bookingId] || '').trim();
    if (!text) return;
    setSubmitting((s) => ({ ...s, [bookingId]: true }));
    try {
      const review = await api.review(bookingId, text);
      setReviewResult((r) => ({ ...r, [bookingId]: review }));
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting((s) => ({ ...s, [bookingId]: false }));
    }
  }

  if (loading) return <p className="muted">Loading your bookings…</p>;
  if (error) return <div className="alert alert-danger">Failed to load bookings: {error}</div>;
  if (bookings.length === 0) {
    return <p className="center-note">You haven't booked anything yet — try the Catalog tab.</p>;
  }

  return (
    <div>
      {bookings.map((b) => {
        const result = reviewResult[b.id];
        return (
          <div key={b.id} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span className="event-title">Event #{b.eventId}</span>
              <span className="muted">{b.status}</span>
            </div>
            <p className="muted" style={{ margin: '0.25rem 0 0.9rem' }}>
              Booking {b.id}
            </p>

            {result ? (
              <div className="alert alert-success">
                <div style={{ marginBottom: '0.3rem' }}>
                  <SentimentBadge sentiment={result.sentiment} />
                </div>
                {result.summary}
              </div>
            ) : (
              <div>
                <textarea
                  className="input"
                  rows={2}
                  placeholder="Leave a review…"
                  value={reviewText[b.id] || ''}
                  onChange={(e) => setReviewText((t) => ({ ...t, [b.id]: e.target.value }))}
                  style={{ marginBottom: '0.6rem' }}
                />
                <button
                  className="btn btn-primary"
                  onClick={() => submitReview(b.id)}
                  disabled={submitting[b.id]}
                >
                  {submitting[b.id] ? 'Submitting…' : 'Submit review'}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
