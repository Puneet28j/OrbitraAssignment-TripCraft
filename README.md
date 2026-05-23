# 🪐 Orbitra (TripCraft) — AI Travel Itinerary Planner

Orbitra is a premium, state-of-the-art AI-powered travel planning platform. It allows users to upload their travel documents—such as flights, hotel bookings, tickets, and reservations—or describe their plans using prompts. Orbitra automatically parses files, runs local optical character recognition (OCR) on images, extracts key metadata, and builds high-fidelity, interactive, day-by-day travel itineraries using advanced AI models.

---

## ✨ Features

- 🔐 **Secure JWT Authentication**: Clean login, registration, and logout flows with a robust token rotation mechanism (using secure cookies, access, and refresh tokens).
- 📁 **Smart File Uploader & Live Queue**: Drag-and-drop interface powered by React Dropzone. Files are securely uploaded to Cloudinary, with a responsive upload queue showing processing status in real-time.
- 🤖 **Hybrid Parsing (OCR + PDF Extractions)**: Extracted content from PDFs (using `pdf-parse`) and images (using local OCR via `tesseract.js` with offline language training models).
- 🧠 **Resilient AI Generation**: Structured day-by-day travel itinerary generation powered by AI models via **OpenRouter** (featuring automatic failover chains e.g., DeepSeek, Gemma, and Nemotron).
- 🗺️ **Premium Interactive Dashboard**: Dynamic timeline layout, day docks, item previews, status badges, and slick transition animations that scale perfectly from desktop down to mobile viewports.
- 🔗 **Secure Itinerary Sharing**: Instant shareable links with auto-generated secure tokens, allowing anyone (even unregistered users) to view your beautiful itineraries.

---

## 🛠️ Tech Stack

### Frontend
- **Core Framework**: React 19 + TypeScript + Vite
- **Styling & UI**: Tailwind CSS (v4) + shadcn/ui components (Radix primitives)
- **State Management & Queries**: React Query (TanStack Query v5) & React Hook Form
- **Routing**: React Router DOM (v7)
- **Utilities**: Axios, Zod (validation), Lucide Icons, Sonner (toasts)

### Backend
- **Core Platform**: Node.js + Express (TypeScript compiled via tsx)
- **Database**: MongoDB + Mongoose ODM
- **AI Processing**: OpenRouter Client (with multi-model fallback redundancy)
- **Media Storage**: Cloudinary SDK
- **OCR & Document Extraction**: `tesseract.js` (OCR on images) + `pdf-parse` (PDF raw text extraction) + `sharp` (image processing)
- **Logging & Security**: Pino / Pino HTTP logger, Helmet (security headers), Express Rate Limit

---

## 📂 Project Architecture

The project is structured as a monorepo containing distinct Backend and Frontend projects:

```
Orbitra/
├── Backend/                    # Node.js + Express + TypeScript API
│   ├── src/
│   │   ├── config/             # Database and Cloudinary configuration
│   │   ├── models/             # Mongoose schemas (User, Itinerary, Document, RefreshToken)
│   │   ├── modules/            # Domain-specific route/controller modules
│   │   │   ├── ai/             # OpenRouter integration and itinerary generation
│   │   │   ├── auth/           # Authentication and registration logic
│   │   │   ├── itinerary/      # Itinerary CRUD and sharing routes
│   │   │   └── upload/         # Media upload and background parsing
│   │   ├── shared/             # Logger, Middlewares, OCR, and global utilities
│   │   │   └── openrouter/     # Model fallback chains & prompt templates
│   │   ├── types/              # TypeScript global type overrides
│   │   ├── app.ts              # Express app setup (Middlewares, routes, error handling)
│   │   └── server.ts           # Server entry point
│   ├── eng.traineddata         # Offline language training data for Tesseract OCR
│   ├── tsconfig.json           # Backend compiler options
│   └── package.json            # Backend scripts & dependencies
│
├── Frontend/                   # React + TypeScript + Vite Client
│   ├── src/
│   │   ├── api/                # API client (Axios) and endpoint mappings
│   │   ├── assets/             # Images, SVGs, and brand assets
│   │   ├── components/         # Reusable UI/feature components
│   │   │   ├── auth/           # Login & Registration forms
│   │   │   ├── common/         # Protected routes, loader states, errors, fallback layouts
│   │   │   ├── dashboard/      # Trip cards, lists, dashboard widgets
│   │   │   ├── itinerary/      # Day-by-day timelines, share dialogues, section layouts
│   │   │   ├── layout/         # Headers, bottom navs, page shells
│   │   │   ├── ui/             # Radix + Tailwind base components (Buttons, Dialogs, etc.)
│   │   │   └── upload/         # Drag-and-drop zones, file cards, progress panels
│   │   ├── context/            # Global context providers (AuthContext)
│   │   ├── hooks/              # Custom query and mutation hooks (React Query)
│   │   ├── lib/                # UI utilities (Tailwind merges, formatting, Zod schemas)
│   │   ├── pages/              # Page components (Dashboard, History, Login, Upload, Itinerary)
│   │   ├── routes/             # App router configuration
│   │   ├── services/           # Api service classes (Auth, Upload, Itinerary)
│   │   ├── main.tsx            # React application entry point
│   │   └── index.css           # Global typography and theme configurations
│   ├── vite.config.ts          # Vite bundling settings
│   └── package.json            # Frontend scripts & dependencies
│
└── .gitignore                  # Unified repository-wide Git ignore rules
```

---

## 🚀 Getting Started

### Prerequisites
Make sure you have the following installed on your machine:
- **Node.js** (v18.x or higher)
- **npm** or **yarn**
- **MongoDB** (running locally or a remote MongoDB Atlas URI)

---

### 1. Setup Backend
1. Open your terminal and navigate to the backend directory:
   ```bash
   cd Backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create your local environment file:
   ```bash
   cp .env.example .env
   ```
4. Fill in your secrets in the newly created `.env` file:
   - Configure your `MONGODB_URI`.
   - Set up secure, random strings for `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` (at least 32 characters long).
   - Enter your Cloudinary credentials (`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`).
   - Obtain an API key from [OpenRouter AI](https://openrouter.ai/keys) and set `OPENROUTER_API_KEY`.
5. Start the backend development server:
   ```bash
   npm run dev
   ```
   The backend API will start running at `http://localhost:5000`.

---

### 2. Setup Frontend
1. In a new terminal window, navigate to the frontend directory:
   ```bash
   cd Frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
   The frontend application will start running at `http://localhost:5173`. Open this URL in your browser to launch **Orbitra**!

---

## 🛡️ Security & Performance Features

- **Rate Limiting**: Protects authentication, file upload, and itinerary generation endpoints from brute-force attacks.
- **Strict Validation**: Double-validated incoming payloads via **Zod** on both the frontend client and the backend server.
- **OpenRouter Fallback Protocol**: If the primary AI model is congested or rate-limited, the system automatically routes the generation to alternative high-performance models instantly.
- **Local OCR Offloading**: Utilizes multi-threaded worker pools to process files locally, keeping server overhead minimal.

---

## 📄 License
This project is licensed under the ISC License. See the [Backend/package.json](Backend/package.json) file for details.
