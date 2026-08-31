import uuid
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .ai_client import analyze_review
from .db import get_db
from .events import publish_booking_created
from .models import BookingRequest, ReviewRequest

app = FastAPI(title="booking-service")

# seeded bug: no service exposed CORS headers, so the browser blocked every
# request from the frontend (localhost:3000) to this service (localhost:8083)
# as a different origin. Phase 1 has no gateway to front this, so each
# service must allow the frontend's origin itself.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/api/bookings")
async def create_booking(payload: BookingRequest):
    db = get_db()
    booking = {
        "id": str(uuid.uuid4()),
        "userId": payload.userId,
        "eventId": payload.eventId,
        "status": "confirmed",
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    db.bookings.insert_one(dict(booking))
    publish_booking_created(booking)
    return booking


@app.get("/api/bookings")
def list_bookings():
    db = get_db()
    bookings = list(db.bookings.find({}, {"_id": 0}))
    return bookings


@app.post("/api/bookings/{booking_id}/review")
async def submit_review(booking_id: str, payload: ReviewRequest):
    db = get_db()
    booking = db.bookings.find_one({"id": booking_id})
    if not booking:
        raise HTTPException(status_code=404, detail="booking not found")

    analysis = await analyze_review(payload.text)

    review = {
        "id": str(uuid.uuid4()),
        "bookingId": booking_id,
        "eventId": booking["eventId"],
        "text": payload.text,
        "sentiment": analysis.get("sentiment", "neutral"),
        "summary": analysis.get("summary", payload.text[:80]),
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    db.reviews.insert_one(dict(review))
    db.bookings.update_one({"id": booking_id}, {"$set": {"reviewed": True}})

    review.pop("_id", None)
    return review


@app.get("/api/reviews")
def list_reviews():
    db = get_db()
    reviews = list(db.reviews.find({}, {"_id": 0}))
    return reviews