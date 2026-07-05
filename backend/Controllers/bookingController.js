const Booking = require("../Models/Booking");
const Room = require("../Models/Room");
const User = require('../Models/User');
const sendEmail = require('../Services/emailService');
const auditLog = require('../Services/auditLogService'); // ✅ ADD
const {
  bookingConfirmationTemplate,
  cancellationTemplate,
} = require('../Utils/emailTemplates');
const { calculatePrice } = require('../Services/pricingService');
const GuestProfile = require('../Models/GuestProfile');
const QRCode = require('qrcode');

// ========================
// Helper: check karo ke ek room in exact dates ke liye
// pehle se kisi confirmed/pending booking se conflict to nahi karta
// (room.status ek single flag hai jo "aaj" ka haal batata hai,
// isliye future date-range booking ke liye asal Bookings collection
// check karna zaroori hai)
// ========================
const isRoomAvailableForDates = async (roomId, checkInDate, checkOutDate, excludeBookingId = null) => {
  const query = {
    roomId,
    bookingStatus: { $in: ["pending", "confirmed", "checked_in"] },
    checkInDate: { $lt: checkOutDate },
    checkOutDate: { $gt: checkInDate },
  };
  if (excludeBookingId) query._id = { $ne: excludeBookingId };

  const conflict = await Booking.findOne(query);
  return !conflict;
};

// ========================
// CREATE BOOKING
// ========================
const createBooking = async (req, res) => {
  try {
    const {
      roomId, guestName, guestPhone, guestEmail,
      checkInDate, checkOutDate, guests, specialRequests,
      totalAmount, bookingStatus, paymentMethod, paymentStatus,
    } = req.body;

    const room = await Room.findById(roomId);
    if (!room) return res.status(404).json({ message: "Room not found" });

    // Sirf maintenance/inactive rooms ko turant reject karo — baqi cheez date-overlap se decide hogi
    if (["maintenance", "inactive"].includes(room.status)) {
      return res.status(400).json({ message: "Room is currently unavailable (maintenance)." });
    }

    // Asal availability check — in dates ke liye koi conflicting booking to nahi
    const available = await isRoomAvailableForDates(roomId, checkInDate, checkOutDate);
    if (!available) {
      return res.status(400).json({ message: "Room is already booked for the selected dates." });
    }

   const days = Math.ceil((new Date(checkOutDate) - new Date(checkInDate)) / (1000 * 60 * 60 * 24));
    let amount = totalAmount;
    if (!amount) {
      const pricing = await calculatePrice(room.price, room.type, checkInDate);
      amount = days * pricing.finalPrice;
    }

    let finalPaymentStatus = paymentMethod === "online" ? "paid" : (paymentStatus || "pending");
    let finalBookingStatus = finalPaymentStatus === "paid" ? "confirmed" : (bookingStatus || "pending");

    // Room ka status sirf tab "occupied/reserved" karo agar check-in AAJ ya guzar chuki tareekh hai
    // (future dates ke liye room ka "current" status nahi badalna chahiye, warna doosri dates
    // ke liye booking galat tarike se blocked ho jayegi)
    const isCheckInTodayOrPast = new Date(checkInDate) <= new Date();
    let finalRoomStatus = room.status;
    if (isCheckInTodayOrPast) {
      finalRoomStatus = finalPaymentStatus === "paid" ? "occupied" : "reserved";
    }

    const booking = await Booking.create({
      userId: req.body.userId || req.user?._id,
      roomId, guestName: guestName || "", guestPhone: guestPhone || "",
      guestEmail: guestEmail || "", checkInDate, checkOutDate, guests,
      totalAmount: amount, specialRequests,
      bookingStatus: finalBookingStatus,
      paymentMethod, paymentStatus: finalPaymentStatus,
    });

    if (booking.userId) await User.findByIdAndUpdate(booking.userId, { $push: { bookings: booking._id } });
    if (finalRoomStatus !== room.status) {
      await Room.findByIdAndUpdate(roomId, { status: finalRoomStatus });
    }

    // ✅ AUDIT LOG
    await auditLog.log(req, {
      action: 'BOOKING_CREATED',
      targetModel: 'Booking',
      targetId: booking._id,
      description: `New booking created — Room ${room.roomNumber} for ${guestName || 'Guest'}`,
      metadata: {
        roomNumber: room.roomNumber,
        guestName: guestName,
        checkIn: checkInDate,
        checkOut: checkOutDate,
        totalAmount: amount,
        paymentMethod,
      },
    });
  // Loyalty points redeem karo (agar request mein aaye)
    let discountAmount = 0;
    if (booking.userId && req.body.redeemPoints > 0) {
      const profile = await GuestProfile.findOne({ userId: booking.userId });
      if (profile && profile.loyaltyPoints >= req.body.redeemPoints) {
        discountAmount = req.body.redeemPoints * 10;
        await GuestProfile.findByIdAndUpdate(profile._id, {
          $inc: { loyaltyPoints: -req.body.redeemPoints }
        });
        // Booking amount update karo
        await Booking.findByIdAndUpdate(booking._id, {
          totalAmount: Math.max(0, booking.totalAmount - discountAmount),
          discountAmount,
          redeemedPoints: req.body.redeemPoints,
        });
      }
    }

    // Loyalty points earn karo — PKR 100 = 1 point
    if (booking.userId) {
      const finalAmount = booking.totalAmount - discountAmount;
      const pointsEarned = Math.floor(finalAmount / 100);
      await GuestProfile.findOneAndUpdate(
        { userId: booking.userId },
        {
          $inc: { loyaltyPoints: pointsEarned },
          $setOnInsert: { userId: booking.userId }
        },
        { upsert: true, new: true }
      );
    }
// Real-time notification
    const io = req.app.get('io');
    if (io) {
      io.to('hotel_room').emit('new_notification', {
        type: 'booking',
        title: '📋 New Booking',
        message: `Room ${room.roomNumber} booked by ${guestName || 'Guest'}`,
        severity: 'success',
        timestamp: new Date(),
      });
    }
    // Send emails
    await sendEmail({
      to: booking.guestEmail,
      subject: booking.bookingStatus === 'confirmed' ? 'Booking Confirmed' : 'Booking Received',
      html: bookingConfirmationTemplate({
        name: booking.guestName, roomNo: room.roomNumber,
        checkInDate: booking.checkInDate, checkOutDate: booking.checkOutDate,
        totalPrice: booking.totalAmount, paymentMethod: booking.paymentMethod,
        paymentStatus: booking.paymentStatus, bookingStatus: booking.bookingStatus,
      }),
    });

    await sendEmail({
      to: 'adminhotel@gmail.com',
      subject: 'New Booking Received',
      html: `<h2>New Booking Alert</h2>
        <p><strong>Guest:</strong> ${booking.guestName}</p>
        <p><strong>Room:</strong> ${room.roomNumber}</p>
        <p><strong>Check-In:</strong> ${booking.checkInDate}</p>
        <p><strong>Check-Out:</strong> ${booking.checkOutDate}</p>
        <p><strong>Total:</strong> Rs. ${booking.totalAmount}</p>
        <p><strong>Payment:</strong> ${booking.paymentStatus}</p>`,
    });

    res.status(201).json({ message: "Booking created successfully", booking });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ========================
// MY BOOKINGS
// ========================
const getMyBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ userId: req.user._id })
      .populate("roomId", "name roomNumber type price status images")
      .sort({ createdAt: -1 });
    res.status(200).json(bookings);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ========================
// GET BOOKINGS BY USER ID
// ========================
const getBookingsByUserId = async (req, res) => {
  try {
    const bookings = await Booking.find({ userId: req.params.id })
      .populate("roomId", "name roomNumber type price status images")
      .sort({ createdAt: -1 });
    res.status(200).json(bookings);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ========================
// ALL BOOKINGS (Admin)
// ========================
const getAllBookings = async (req, res) => {
  try {
    const bookings = await Booking.find()
      .populate("userId", "name email phone")
      .populate("roomId", "name roomNumber type price status")
      .sort({ createdAt: -1 });
    res.status(200).json(bookings);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ========================
// UPDATE BOOKING STATUS
// ========================
const updateBookingStatus = async (req, res) => {
  try {
    const { bookingStatus, paymentStatus } = req.body;

    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    const previousStatus = booking.bookingStatus;

    if (bookingStatus === "cancelled" && booking.bookingStatus !== "cancelled") {
      await Room.findByIdAndUpdate(booking.roomId, { status: "available" });
      const room = await Room.findById(booking.roomId);
      await sendEmail({
        to: booking.guestEmail,
        subject: 'Booking Cancelled',
        html: cancellationTemplate({
          name: booking.guestName, roomNo: room?.roomNumber,
          checkInDate: booking.checkInDate, checkOutDate: booking.checkOutDate,
        }),
      });
    }

    if (bookingStatus === "completed" && booking.bookingStatus !== "completed") {
      await Room.findByIdAndUpdate(booking.roomId, { status: "available" });
    }

    // Pending se confirmed hone par confirmation email bhejo
    // (jaise reception par cash payment collect hone ke baad admin status update kare)
    if (bookingStatus === "confirmed" && booking.bookingStatus !== "confirmed") {
      const room = await Room.findById(booking.roomId);
      await sendEmail({
        to: booking.guestEmail,
        subject: 'Booking Confirmed',
        html: bookingConfirmationTemplate({
          name: booking.guestName, roomNo: room?.roomNumber,
          checkInDate: booking.checkInDate, checkOutDate: booking.checkOutDate,
          totalPrice: booking.totalAmount, paymentMethod: booking.paymentMethod,
          paymentStatus: paymentStatus || booking.paymentStatus, bookingStatus: 'confirmed',
        }),
      });
    }

    const updatedBooking = await Booking.findByIdAndUpdate(
      req.params.id,
      { ...(bookingStatus && { bookingStatus }), ...(paymentStatus && { paymentStatus }) },
      { new: true }
    );

    // ✅ AUDIT LOG
    await auditLog.log(req, {
      action: bookingStatus === 'cancelled' ? 'BOOKING_CANCELLED' : 'BOOKING_UPDATED',
      targetModel: 'Booking',
      targetId: booking._id,
      description: `Booking status changed: ${previousStatus} → ${bookingStatus || previousStatus}`,
      metadata: { previousStatus, newStatus: bookingStatus, paymentStatus },
      severity: bookingStatus === 'cancelled' ? 'warning' : 'info',
    });

    res.status(200).json({ message: "Booking updated successfully", booking: updatedBooking });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ========================
// CHECK-IN
// ========================
const checkInBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).populate('roomId', 'roomNumber');
    if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });
    if (!["confirmed", "pending"].includes(booking.bookingStatus)) {
      return res.status(400).json({ success: false, message: "Only confirmed or pending bookings can be checked in" });
    }

    booking.bookingStatus = "checked_in";
    await booking.save();
    await Room.findByIdAndUpdate(booking.roomId, { status: "occupied" });

    // ✅ AUDIT LOG
    await auditLog.log(req, {
      action: 'BOOKING_CHECKED_IN',
      targetModel: 'Booking',
      targetId: booking._id,
      description: `Guest ${booking.guestName} checked in — Room ${booking.roomId?.roomNumber}`,
      metadata: { guestName: booking.guestName, roomId: booking.roomId },
    });

    const io = req.app.get('io');
    if (io) {
      io.to('hotel_room').emit('room_status_updated', {
        roomId: booking.roomId,
        status: 'occupied',
      });
    }
    res.status(200).json({ success: true, message: "Guest checked in successfully", booking });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ========================
// CHECK-OUT
// ========================
const checkOutBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).populate('roomId', 'roomNumber');
    if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });
    if (booking.bookingStatus !== "checked_in") {
      return res.status(400).json({ success: false, message: "Only checked-in guests can checkout" });
    }
    if (booking.paymentStatus !== "paid") {
      return res.status(400).json({ success: false, message: "Payment is pending. Please collect payment before checkout." });
    }

    booking.bookingStatus = "checked_out";
    await booking.save();
    await Room.findByIdAndUpdate(booking.roomId, { status: "cleaning" });

    // ✅ AUDIT LOG
    await auditLog.log(req, {
      action: 'BOOKING_CHECKED_OUT',
      targetModel: 'Booking',
      targetId: booking._id,
      description: `Guest ${booking.guestName} checked out — Room sent to cleaning`,
      metadata: { guestName: booking.guestName, roomId: booking.roomId },
    });

    const io = req.app.get('io');
    if (io) {
      io.to('hotel_room').emit('room_status_updated', {
        roomId: booking.roomId,
        status: 'cleaning',
      });
    }
    res.status(200).json({ success: true, message: "Guest checked out successfully", booking });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ========================
// COMPLETE BOOKING
// ========================
const completeBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });
    if (booking.bookingStatus !== "checked_out") {
      return res.status(400).json({ success: false, message: "Booking must be checked out first" });
    }

    booking.bookingStatus = "completed";
    await booking.save();
    await Room.findByIdAndUpdate(booking.roomId, { status: "available" });

    // ✅ AUDIT LOG
    await auditLog.log(req, {
      action: 'BOOKING_UPDATED',
      targetModel: 'Booking',
      targetId: booking._id,
      description: `Booking completed — Room marked available`,
    });

    res.status(200).json({ success: true, message: "Booking completed successfully", booking });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ========================
// UPDATE PAYMENT STATUS
// ========================
const updatePaymentStatus = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });

    booking.paymentStatus = "paid";
    if (booking.bookingStatus === "pending") booking.bookingStatus = "confirmed";
    await booking.save();
    await Room.findByIdAndUpdate(booking.roomId, { status: "occupied" });

    // ✅ AUDIT LOG
    await auditLog.log(req, {
      action: 'PAYMENT_RECEIVED',
      targetModel: 'Booking',
      targetId: booking._id,
      description: `Payment marked as paid for booking — Rs. ${booking.totalAmount}`,
      metadata: { amount: booking.totalAmount, guestName: booking.guestName },
    });

    res.status(200).json({ success: true, message: "Payment marked as paid", booking });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
// Generate QR Code for booking
const generateBookingQR = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.bookingId)
      .populate('roomId', 'roomNumber type')
      .populate('userId', 'name email');

    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    // QR data
    const qrData = JSON.stringify({
      bookingId: booking._id,
      guestName: booking.guestName || booking.userId?.name,
      roomNumber: booking.roomId?.roomNumber,
      checkIn: booking.checkInDate,
      checkOut: booking.checkOutDate,
      action: 'CHECK_IN',
    });

    const qrCode = await QRCode.toDataURL(qrData);

    res.status(200).json({ success: true, qrCode, booking });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// QR self check-in
const qrCheckIn = async (req, res) => {
  try {
    const { bookingId } = req.body;

    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    if (!['confirmed', 'pending'].includes(booking.bookingStatus)) {
      return res.status(400).json({ success: false, message: `Booking is already ${booking.bookingStatus}` });
    }

    // Check-in date check
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkInDate = new Date(booking.checkInDate);
    checkInDate.setHours(0, 0, 0, 0);

    if (checkInDate > today) {
      return res.status(400).json({
        success: false,
        message: `Check-in date is ${new Date(booking.checkInDate).toLocaleDateString('en-PK')}. You cannot check in early.`
      });
    }

    booking.bookingStatus = 'checked_in';
    await booking.save();
    await Room.findByIdAndUpdate(booking.roomId, { status: 'occupied' });

    // Audit log
    await auditLog.log(req, {
      action: 'BOOKING_CHECKED_IN',
      targetModel: 'Booking',
      targetId: booking._id,
      description: `Self check-in via QR code — Booking ${booking._id}`,
    });

    // Real-time notification
    const io = req.app.get('io');
    if (io) {
      io.to('hotel_room').emit('room_status_updated', {
        roomId: booking.roomId,
        status: 'occupied',
      });
      io.to('hotel_room').emit('new_notification', {
        type: 'booking',
        title: '📱 QR Self Check-in',
        message: `${booking.guestName} checked in via QR — Room ${booking.roomId?.roomNumber || ''}`,
        severity: 'success',
        timestamp: new Date(),
      });
    }

    res.status(200).json({ success: true, message: 'Check-in successful! Welcome to the hotel.', booking });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


// ========================
// DOWNLOAD INVOICE (PDF) — Guest apni khud ki booking ka invoice
// ========================
const downloadInvoice = async (req, res) => {
  try {
    const PDFDocument = require('pdfkit');

    const booking = await Booking.findById(req.params.id).populate('roomId', 'roomNumber type price');
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    // Security check: guest sirf apni khud ki booking ka invoice dekh sake
    // Admin/manager/receptionist kisi ki bhi dekh sakte hain
    const staffRolesAllowed = ['admin', 'manager', 'receptionist'];
    const isOwner = booking.userId && booking.userId.toString() === req.user._id.toString();
    const isStaff = staffRolesAllowed.includes(req.user.role);

    if (!isOwner && !isStaff) {
      return res.status(403).json({ message: 'Access denied. This is not your booking.' });
    }

    // Sirf paid/confirmed bookings ka hi invoice bane
    if (booking.paymentStatus !== 'paid') {
      return res.status(400).json({ message: 'Invoice sirf paid bookings ke liye available hai.' });
    }

    const room = booking.roomId;
    const invoiceNumber = `INV-${booking._id.toString().slice(-8).toUpperCase()}`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Invoice-${invoiceNumber}.pdf`);

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    doc.pipe(res);

    // ── Header ──
    doc
      .fillColor('#4f46e5')
      .fontSize(24)
      .text('🏨 Hotel Management System', { align: 'left' })
      .moveDown(0.2);

    doc
      .fillColor('#333')
      .fontSize(10)
      .text('123 Hotel Street, Karachi, Pakistan', { align: 'left' })
      .text('Email: adminhotel@gmail.com', { align: 'left' })
      .moveDown(1.5);

    // ── Invoice title & meta ──
    doc
      .fillColor('#000')
      .fontSize(18)
      .text('INVOICE', { align: 'right' });

    doc
      .fontSize(10)
      .fillColor('#555')
      .text(`Invoice Number: ${invoiceNumber}`, { align: 'right' })
      .text(`Date Issued: ${new Date().toLocaleDateString()}`, { align: 'right' })
      .moveDown(1.5);

    // ── Divider ──
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#ddd').stroke();
    doc.moveDown(1);

    // ── Guest info ──
    doc.fillColor('#000').fontSize(12).text('Billed To:', { underline: true });
    doc.fontSize(11).fillColor('#333')
      .text(`Name: ${booking.guestName || 'N/A'}`)
      .text(`Email: ${booking.guestEmail || 'N/A'}`)
      .text(`Phone: ${booking.guestPhone || 'N/A'}`)
      .moveDown(1);

    // ── Booking details table ──
    doc.fillColor('#000').fontSize(12).text('Booking Details:', { underline: true }).moveDown(0.5);

    const rows = [
      ['Room Number', room?.roomNumber || 'N/A'],
      ['Room Type', room?.type || 'N/A'],
      ['Check-In Date', new Date(booking.checkInDate).toLocaleDateString()],
      ['Check-Out Date', new Date(booking.checkOutDate).toLocaleDateString()],
      ['Guests', String(booking.guests)],
      ['Payment Method', booking.paymentMethod?.toUpperCase() || 'N/A'],
      ['Payment Status', booking.paymentStatus?.toUpperCase() || 'N/A'],
    ];

    if (booking.discountAmount > 0) {
      rows.push(['Loyalty Discount', `- Rs. ${booking.discountAmount}`]);
    }

    rows.forEach(([label, value]) => {
      doc
        .fontSize(10)
        .fillColor('#666')
        .text(label, 50, doc.y, { continued: true, width: 250 })
        .fillColor('#111')
        .text(value, { align: 'right' });
    });

    doc.moveDown(1);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#ddd').stroke();
    doc.moveDown(1);

    // ── Total ──
    doc
      .fontSize(14)
      .fillColor('#4f46e5')
      .text(`Total Paid: Rs. ${booking.totalAmount}`, { align: 'right' })
      .moveDown(2);

    // ── Footer ──
    doc
      .fontSize(9)
      .fillColor('#999')
      .text('Thank you for choosing our hotel. This is a system-generated invoice.', { align: 'center' });

    doc.end();
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ========================
// GET ROOM'S BOOKED DATES (for calendar) — public, no auth needed
// Guest ko room booking page par yahi dikhega ke kaunse dates available nahi
// ========================
const getRoomBookedDates = async (req, res) => {
  try {
    const { id } = req.params;

    const bookings = await Booking.find({
      roomId: id,
      bookingStatus: { $in: ["pending", "confirmed", "checked_in"] },
      checkOutDate: { $gte: new Date() }, // guzri hui bookings zaroori nahi
    }).select("checkInDate checkOutDate -_id");

    const bookedRanges = bookings.map((b) => ({
      checkIn: b.checkInDate,
      checkOut: b.checkOutDate,
    }));

    res.status(200).json({ bookedRanges });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

module.exports = {
  createBooking, getMyBookings, getBookingsByUserId,
  getAllBookings, updateBookingStatus, checkInBooking,
  checkOutBooking, completeBooking, updatePaymentStatus,
  generateBookingQR, qrCheckIn, downloadInvoice,
  getRoomBookedDates,
};
