import { useEffect, useState } from 'react';
import { api } from './api';
import Auth from './Auth';
import Dashboard from './Dashboard';
import MyBookings from './MyBookings';
import './styles.css';

const SESSION_KEY = 'eventhub_session';

export default function App() {
  const [session, setSession] = useState(() => {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  });
  const [tab, setTab] = useState('catalog');
  const [catalog, setCatalog] = useState([]);
  const [error, setError] = useState(null);
  const [bookingMsg, setBookingMsg] = useState(null);

  useEffect(() => {
    api.catalog().then(setCatalog).catch((err) => setError(err.message));
  }, []);

  function handleAuthenticated(newSession) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(newSession));
    setSession(newSession);
  }

  function handleLogout() {
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
    setTab('catalog');
  }

  async function handleBook(eventId) {
    setBookingMsg(null);
    try {
      const booking = await api.book(session.userId, eventId);
      setBookingMsg({ type: 'success', text: `Booked! Confirmation: ${booking.id}` });
    } catch (err) {
      setBookingMsg({ type: 'danger', text: `Booking failed: ${err.message}` });
    }
  }

  return (
    <div className="app-shell">
      <div className="topbar">
        <div className="brand">
          <span className="brand-mark">EH</span>
          EventHub
        </div>
        {session && (
          <div className="session-info">
            <span>{session.email}</span>
            <button className="btn btn-ghost" onClick={handleLogout}>
              Log out
            </button>
          </div>
        )}
      </div>

      {!session ? (
        <Auth onAuthenticated={handleAuthenticated} />
      ) : (
        <>
          <div className="nav-tabs">
            <button className="tab-btn" disabled={tab === 'catalog'} onClick={() => setTab('catalog')}>
              Catalog
            </button>
            <button className="tab-btn" disabled={tab === 'bookings'} onClick={() => setTab('bookings')}>
              My Bookings
            </button>
            <button className="tab-btn" disabled={tab === 'dashboard'} onClick={() => setTab('dashboard')}>
              Dashboard
            </button>
          </div>

          {tab === 'catalog' && (
            <div className="card">
              {error && <div className="alert alert-danger">Failed to load catalog: {error}</div>}
              {bookingMsg && <div className={`alert alert-${bookingMsg.type}`}>{bookingMsg.text}</div>}
              <ul className="event-list">
                {catalog.map((event) => (
                  <li key={event.id} className="event-row">
                    <span>
                      <span className="event-title">{event.title}</span>
                      <span className="event-price">${event.price}</span>
                    </span>
                    <button className="btn btn-primary" onClick={() => handleBook(event.id)}>
                      Book
                    </button>
                  </li>
                ))}
              </ul>
              {catalog.length === 0 && !error && <p className="muted">Loading events…</p>}
            </div>
          )}

          {tab === 'bookings' && <MyBookings userId={session.userId} />}

          {tab === 'dashboard' && <Dashboard />}
        </>
      )}
    </div>
  );
}
