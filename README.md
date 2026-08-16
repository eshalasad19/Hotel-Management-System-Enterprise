# 🏨 Hotel Management System

A full-stack Hotel Management System built with the MERN Stack (MongoDB, Express.js, React.js, Node.js). It gives hotel administrators and guests a complete platform for room bookings, restaurant ordering, payments, housekeeping, maintenance, guest relationship management, and real-time operations tracking.

**Live:** [hms.payasguest.com](https://hms.payasguest.com)

---

## 🚀 Features

### 👤 Guest Features
- Registration, Login & Two-Factor Authentication (2FA)
- Browse Available Rooms & Room Details
- Online Room Booking with Availability Calendar
- Restaurant Menu Browsing & Food Ordering
- Hotel Service Requests
- QR Code Check-In
- PDF Invoice Download
- Feedback Submission
- Profile Management
- Real-Time Notifications
- Contact Us & FAQs

### 🛠️ Admin Features
- Live Dashboard with Analytics (Recharts)
- Room Management
- Booking Management with Availability Overlap Prevention
- Check-In / Check-Out Tracking
- User & Guest CRM Management
- Hotel Services & Restaurant Menu Management
- Restaurant Order Management
- Housekeeping & Maintenance Request Management
- Payment & Transaction Records
- Dynamic Pricing Rules
- Feedback & FAQ Management
- Audit Logs
- Role-Based Access Control (Admin, Manager, Receptionist, Housekeeping, Maintenance, Kitchen)
- Settings Management
- Real-Time Notifications via Socket.IO

---

## 🏗️ Tech Stack

### Frontend
- React 19
- React Router DOM v7
- Bootstrap 5 + Bootstrap Icons
- Framer Motion
- Recharts (analytics/charts)
- Axios
- Socket.IO Client
- html5-qrcode (QR check-in)

### Backend
- Node.js + Express 5
- MongoDB Atlas + Mongoose
- JWT Authentication (access + refresh tokens)
- Speakeasy (2FA / TOTP)
- Socket.IO (real-time notifications)
- Nodemailer (branded HTML email templates)
- PDFKit (invoice generation)
- Multer (file uploads)
- node-cron (scheduled jobs)
- Security: Helmet, express-rate-limit, express-mongo-sanitize, xss-clean, hpp, CORS

### Database
- MongoDB Atlas

---

## 📂 Project Structure

```
Hotel-Management-System
│
├── frontend
│   ├── src
│   │   ├── Component
│   │   │   ├── Admin
│   │   │   └── User
│   │   ├── Layouts
│   │   ├── api
│   │   ├── services       # socket.io client setup
│   │   └── Utils
│   └── .env                # REACT_APP_API_URL, REACT_APP_SERVER_URL
│
├── backend
│   ├── Controllers
│   ├── Models
│   ├── Routes
│   ├── Middleware           # auth, security
│   ├── Config
│   ├── Public                # compiled frontend build (served by Express)
│   ├── Uploads                # room images, documents
│   ├── Index.js
│   └── .env
│
└── README.md
```

---

## 📋 Core Modules

| Module | Highlights |
|---|---|
| **Room** | Add/Edit/Delete, availability calendar, image uploads |
| **Booking** | Create, manage, check-in/out, date-overlap validation |
| **Restaurant** | Menu management, online ordering |
| **Hotel Services** | Service catalog, guest service requests |
| **Housekeeping** | Cleaning task tracking |
| **Maintenance** | Maintenance request tracking |
| **Payment** | Transaction records, PDF invoices |
| **Pricing** | Dynamic pricing rules |
| **Guest CRM** | Guest profiles, walk-in vs online guest type |
| **Feedback** | Reviews & ratings |
| **Audit Log** | Admin action tracking |
| **Notifications** | Real-time via Socket.IO |

---

## 🔐 Authentication & Security

- JWT-based auth with refresh tokens
- Two-Factor Authentication (Speakeasy TOTP)
- Role-based route protection (`admin`, `manager`, `receptionist`, `housekeeping`, `maintenance`, `kitchen`, `guest`)
- Rate limiting, input sanitization, XSS/HPP protection, secure headers (Helmet)

---

## ⚙️ Installation (Local Development)

### 1️⃣ Clone Repository
```bash
git clone https://github.com/eshalasad19/Hotel-Management-System-Enterprise.git
cd Hotel-Management-System-Enterprise
```

### 2️⃣ Backend Setup
```bash
cd backend
npm install
npm start
```

### 3️⃣ Frontend Setup
```bash
cd frontend
npm install
npm start
```

---

## 🌐 Environment Variables

### Backend (`backend/.env`)
```env
PORT=5001
MONGO_URI=your_mongodb_atlas_connection_string
JWT_SECRET=your_jwt_secret
JWT_REFRESH_SECRET=your_jwt_refresh_secret
JWT_EXPIRES_IN=1d
EMAIL_USER=your_gmail_address
EMAIL_PASS=your_gmail_app_password
ALLOWED_ORIGINS=https://your-frontend-domain.com
FRONTEND_URL=https://your-frontend-domain.com
NODE_ENV=production
```

### Frontend (`frontend/.env`)
```env
# Must be the FULL backend URL including /api — a relative path will
# cause double-prefixed requests (/api/api/...) once bundled into the build.
REACT_APP_API_URL=https://your-backend-domain.com/api
REACT_APP_SERVER_URL=https://your-backend-domain.com
```

---

## 🚀 Deployment

Currently deployed on **Hostinger** (Node.js hosting, GitHub auto-deployment):

- Backend (Express, root directory `backend`) runs as the Node.js app and also **serves the compiled frontend** from `backend/Public`.
- To deploy a new frontend build:
  1. Update `frontend/.env` with the correct `REACT_APP_API_URL`
  2. `npm run build` inside `frontend`
  3. Replace the contents of `backend/Public` with the new `frontend/build` output
  4. Commit & push to `master` — Hostinger auto-deploys, or trigger manually via **Redeploy** in the Hostinger dashboard

---

## 📊 Future Enhancements

- Online Payment Gateway Integration
- Multi-Hotel / Multi-Property Support
- Mobile Application
- AI-Based Room & Upsell Recommendations
- Advanced Reporting & Export

---

## 👩‍💻 Author

**Eshal Asad**
[GitHub](https://github.com/eshalasad19) · [LinkedIn](https://linkedin.com/in/eshal-asad)

---

## 📄 License

This project is developed for educational and portfolio purposes.
