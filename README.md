# 🛡️ SafePulse — Privacy-First Family Safety & Location Sharing App

SafePulse is a mobile-first safety tracking web application designed to enable secure real-time location sharing, geofence-based arrival/departure alerts (Safe Zones), and SOS emergency signaling. Engineered with a privacy-first approach, it features temporary sharing sessions, highly configurable location access controls, and instant emergency dispatch options.

---

## 🚀 Tech Stack

### Frontend
- **Framework:** React 19 + [Vite](file:///c:/Users/Shruti%20Chedge/Downloads/SafePulse/frontend/vite.config.js)
- **Styling:** Tailwind CSS
- **Routing:** React Router DOM v7
- **Maps & Location:** Leaflet + React Leaflet for interactive map visualizations
- **Real-Time Integration:** Socket.io-client for instantaneous location streaming
- **Animations:** Framer Motion for premium fluid UI transitions

### Backend
- **Framework:** Node.js + Express
- **Database:** MongoDB (via Mongoose ODM) for user profile, logs, and geofence configuration
- **Real-Time Engine:** Socket.io server-side implementation for tracking sync
- **Authentication:** Firebase Admin SDK ready / JWT Auth
- **Entry Point:** [backend/server.js](file:///c:/Users/Shruti%20Chedge/Downloads/SafePulse/backend/server.js)

---

## 📂 Project Structure

The codebase is organized as a monorepo split into frontend and backend applications:

```text
SafePulse/
├── backend/                  # Node.js + Express backend service
│   ├── config/               # Database and API configurations
│   ├── models/               # MongoDB schema models (User, Geofence, etc.)
│   ├── routes/               # Express API endpoints
│   ├── sockets/              # Socket.io tracking event handlers
│   ├── server.js             # Main server entry file
│   └── package.json          # Backend package dependencies
├── frontend/                 # React frontend application
│   ├── src/
│   │   ├── pages/            # Page components (Home, SOS, Contacts, etc.)
│   │   ├── components/       # Reusable UI widgets and layout modules
│   │   └── main.jsx          # Frontend entry point
│   ├── index.html            # HTML layout shell
│   └── package.json          # Frontend package dependencies
└── .gitignore                # Root gitignore configuration
```

---

## 🌟 Core Features

1. **Live Location Tracking:** Updates GPS positioning seamlessly with visual tracking representations on an interactive map.
2. **Arrival/Departure Alerts (Safe Zones):** Define circular regions (e.g., Home, Office, College) with customizable radii to trigger instant alerts upon entering or exiting.
3. **Emergency SOS Signal:** Trigger a loud alarm and push critical alert states (battery status, exact coordinates) directly to registered emergency contacts.
4. **Temporary Sharing Sessions:** Generate secure, unique, and expiring links to share tracking status without requiring registration or installation from the observer.

For a full breakdown of goals, functional requirements, and screen workflows, refer to the [SafePulse Product Requirements Document (PRD)](file:///c:/Users/Shruti%20Chedge/Downloads/SafePulse/frontend/SafePulse_prd.txt).

---

## ⚙️ Installation & Setup

### Prerequisites
Make sure you have [Node.js](https://nodejs.org) (v18+) and [npm](https://npmjs.com) installed.

### 1. Backend Setup
Navigate to the backend directory, install packages, set up environment variables, and run in development mode:
```bash
cd backend
npm install
```

Create a [backend/.env](file:///c:/Users/Shruti%20Chedge/Downloads/SafePulse/backend/.env) file with the following variables:
```env
PORT=5000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
FRONTEND_URL=http://localhost:5173
```

Start the backend server in development mode (using nodemon):
```bash
npm run dev
```

### 2. Frontend Setup
Navigate to the frontend directory, install packages, configure environment variables, and launch:
```bash
cd ../frontend
npm install
```

Create a [frontend/.env](file:///c:/Users/Shruti%20Chedge/Downloads/SafePulse/frontend/.env) file with:
```env
VITE_API_URL=http://localhost:5000
```

Start the Vite development web server:
```bash
npm run dev
```

The web application will launch locally at `http://localhost:5173`.

---

## 📄 Key Project Files

- **Root Git Configuration:** [.gitignore](file:///c:/Users/Shruti%20Chedge/Downloads/SafePulse/.gitignore)
- **Backend Configuration:** [backend/package.json](file:///c:/Users/Shruti%20Chedge/Downloads/SafePulse/backend/package.json)
- **Frontend Configuration:** [frontend/package.json](file:///c:/Users/Shruti%20Chedge/Downloads/SafePulse/frontend/package.json)
- **Database Connection:** [backend/config/db.js](file:///c:/Users/Shruti%20Chedge/Downloads/SafePulse/backend/config/db.js)
- **Live SOS Socket System:** [backend/sockets/tracking.js](file:///c:/Users/Shruti%20Chedge/Downloads/SafePulse/backend/sockets/tracking.js)
