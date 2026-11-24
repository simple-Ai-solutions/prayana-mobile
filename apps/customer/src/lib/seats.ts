// Seats left on a trek's next departure, from the public
// /bookings/check-availability endpoint ({ available, booked, total }).
// Cached per activity+date for the session, and shared between the copies of
// a card (the spotlight carousel draws each card three times), so a rail
// costs one request per trek.
import { useEffect, useState } from 'react';
import { bookingAPI } from '@prayana/shared-services';

export type Seats = { available: number; booked: number; total: number };

const cache = new Map<string, Promise<Seats | null>>();

function fetchSeats(id: string, date: string): Promise<Seats | null> {
  const key = `${id}|${date}`;
  let p = cache.get(key);
  if (!p) {
    p = bookingAPI
      .checkAvailability(id, date)
      .then((res: any) => {
        const d = res?.data;
        return d && Number.isFinite(d.available) && Number.isFinite(d.total)
          ? { available: d.available, booked: d.booked || 0, total: d.total }
          : null;
      })
      .catch(() => {
        cache.delete(key); // try again next time
        return null;
      });
    cache.set(key, p);
  }
  return p;
}

export function useSeats(id?: string | null, date?: string | null): Seats | null {
  const [seats, setSeats] = useState<Seats | null>(null);
  useEffect(() => {
    if (!id || !date) return;
    let alive = true;
    fetchSeats(id, date).then((s) => alive && setSeats(s));
    return () => { alive = false; };
  }, [id, date]);
  return seats;
}

/**
 * What to say about the seats, or nothing. Only real scarcity gets a badge:
 * a few seats left, or more than half gone. A trek with plenty of room says
 * nothing rather than inventing urgency.
 */
export function seatsBadge(s: Seats | null): { text: string; tone: 'hot' | 'warm' | 'gone' } | null {
  if (!s || s.total <= 0) return null;
  if (s.available <= 0) return { text: 'Sold out', tone: 'gone' };
  if (s.available <= 8) return { text: `Only ${s.available} ${s.available === 1 ? 'seat' : 'seats'} left`, tone: 'hot' };
  if (s.booked / s.total >= 0.5) return { text: 'Filling fast', tone: 'warm' };
  return null;
}
