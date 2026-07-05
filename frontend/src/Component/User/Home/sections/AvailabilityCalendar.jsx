import React, { useEffect, useState } from "react";
import axios from "axios";

const BASE_URL = (process.env.REACT_APP_API_URL || "http://localhost:5001/api");

// Helper: date ko "YYYY-MM-DD" string mein convert karo (local timezone safe)
const toDateStr = (d) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * AvailabilityCalendar
 * Props:
 *  - roomId: room jiske liye availability check karni hai
 *  - checkInDate / checkOutDate: "YYYY-MM-DD" strings (parent form se)
 *  - onChange: (checkInDate, checkOutDate) => void
 */
export default function AvailabilityCalendar({ roomId, checkInDate, checkOutDate, onChange }) {
  const [bookedRanges, setBookedRanges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewDate, setViewDate] = useState(new Date()); // jis month ko dikha rahe hain
  const [selectingCheckout, setSelectingCheckout] = useState(false);

  useEffect(() => {
    const fetchAvailability = async () => {
      try {
        setLoading(true);
        const res = await axios.get(`${BASE_URL}/bookings/room/${roomId}/booked-dates`);
        setBookedRanges(res.data.bookedRanges || []);
      } catch (err) {
        console.log("Availability fetch error:", err);
      } finally {
        setLoading(false);
      }
    };
    if (roomId) fetchAvailability();
  }, [roomId]);

  const isDateBooked = (dateObj) => {
    const dateStr = toDateStr(dateObj);
    return bookedRanges.some((range) => {
      const inDate = toDateStr(new Date(range.checkIn));
      const outDate = toDateStr(new Date(range.checkOut));
      // Checkout din khud booked nahi hota (guest usi din chala jata hai, naya guest aa sakta hai)
      return dateStr >= inDate && dateStr < outDate;
    });
  };

  const isPastDate = (dateObj) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return dateObj < today;
  };

  // Agar checkIn select ho chuka hai, to check karo ke range mein koi booked date to nahi (checkout select karte waqt)
  const isRangeBlocked = (fromStr, toStr) => {
    return bookedRanges.some((range) => {
      const inDate = toDateStr(new Date(range.checkIn));
      const outDate = toDateStr(new Date(range.checkOut));
      return fromStr < outDate && toStr > inDate;
    });
  };

  const handleDayClick = (dateObj) => {
    if (isPastDate(dateObj) || isDateBooked(dateObj)) return;
    const dateStr = toDateStr(dateObj);

    if (!selectingCheckout) {
      // Naya check-in select ho raha hai
      onChange(dateStr, "");
      setSelectingCheckout(true);
    } else {
      if (dateStr <= checkInDate) {
        // Agar checkout, checkin se pehle ya barabar hai, to isko naya checkin bana do
        onChange(dateStr, "");
        return;
      }
      if (isRangeBlocked(checkInDate, dateStr)) {
        // Beech mein koi booked date aa gayi — checkin ko reset karke yehi naya checkin bana do
        onChange(dateStr, "");
        return;
      }
      onChange(checkInDate, dateStr);
      setSelectingCheckout(false);
    }
  };

  const goToPrevMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  };
  const goToNextMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  };

  const renderMonth = () => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const startWeekday = firstDay.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells = [];
    for (let i = 0; i < startWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

    return cells;
  };

  const cells = renderMonth();
  const today = new Date();
  const minNavDate = new Date(today.getFullYear(), today.getMonth(), 1);
  const canGoPrev = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1) > minNavDate;

  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, background: "#fff" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <button
          type="button"
          onClick={goToPrevMonth}
          disabled={!canGoPrev}
          style={{
            border: "none", background: "none", fontSize: 18, cursor: canGoPrev ? "pointer" : "not-allowed",
            color: canGoPrev ? "#333" : "#ccc",
          }}
        >
          <i className="fa-solid fa-chevron-left"></i>
        </button>
        <strong style={{ fontSize: 15 }}>
          {MONTH_NAMES[viewDate.getMonth()]} {viewDate.getFullYear()}
        </strong>
        <button
          type="button"
          onClick={goToNextMonth}
          style={{ border: "none", background: "none", fontSize: 18, cursor: "pointer", color: "#333" }}
        >
          <i className="fa-solid fa-chevron-right"></i>
        </button>
      </div>

      {loading ? (
        <div className="text-center text-muted py-4" style={{ fontSize: 13 }}>Loading availability...</div>
      ) : (
        <>
          {/* Weekday headers */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: 6 }}>
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
              <div key={d} style={{ textAlign: "center", fontSize: 11, color: "#999", fontWeight: 600 }}>{d}</div>
            ))}
          </div>

          {/* Days grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
            {cells.map((dateObj, idx) => {
              if (!dateObj) return <div key={idx}></div>;

              const dateStr = toDateStr(dateObj);
              const booked = isDateBooked(dateObj);
              const past = isPastDate(dateObj);
              const isCheckIn = dateStr === checkInDate;
              const isCheckOut = dateStr === checkOutDate;
              const inRange = checkInDate && checkOutDate && dateStr > checkInDate && dateStr < checkOutDate;

              let bg = "#fff";
              let color = "#333";
              let cursor = "pointer";

              if (past || booked) {
                bg = "#f3f4f6";
                color = "#c1c1c1";
                cursor = "not-allowed";
              }
              if (inRange) {
                bg = "rgba(201,169,110,0.15)";
              }
              if (isCheckIn || isCheckOut) {
                bg = "linear-gradient(135deg, #c9a96e, #a67c40)";
                color = "#fff";
              }

              return (
                <div
                  key={idx}
                  onClick={() => handleDayClick(dateObj)}
                  title={booked ? "Not available" : ""}
                  style={{
                    textAlign: "center", padding: "8px 0", borderRadius: 8,
                    fontSize: 13, background: bg, color, cursor,
                    fontWeight: isCheckIn || isCheckOut ? 700 : 400,
                    textDecoration: booked && !past ? "line-through" : "none",
                  }}
                >
                  {dateObj.getDate()}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div style={{ display: "flex", gap: 14, marginTop: 14, fontSize: 11, color: "#777", flexWrap: "wrap" }}>
            <span><span style={{ display: "inline-block", width: 10, height: 10, background: "#f3f4f6", borderRadius: 3, marginRight: 4 }}></span>Unavailable</span>
            <span><span style={{ display: "inline-block", width: 10, height: 10, background: "linear-gradient(135deg,#c9a96e,#a67c40)", borderRadius: 3, marginRight: 4 }}></span>Selected</span>
          </div>

          <p style={{ fontSize: 12, color: "#999", marginTop: 10, marginBottom: 0 }}>
            {!checkInDate
              ? "Select your check-in date"
              : !checkOutDate
              ? "Now select your check-out date"
              : `${checkInDate} → ${checkOutDate}`}
          </p>
        </>
      )}
    </div>
  );
}
