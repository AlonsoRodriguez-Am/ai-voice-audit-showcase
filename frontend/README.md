# AI Voice Audit - Frontend

React 19 + TypeScript + Vite 8 frontend for the AI Voice Audit platform.

## 🛠️ Tech Stack

- **React 19.2.5** - UI library with latest features
- **TypeScript 6.0.2** - Type-safe JavaScript
- **Vite 8.0.10** - Fast build tool and dev server
- **Tailwind CSS 4.2.4** - Utility-first CSS framework
- **React Router 7.14.2** - Client-side routing
- **TanStack Query 5.100.7** - Data fetching and caching
- **Recharts 3.8.1** - Charting library for dashboards
- **lucide-react 1.14.0** - Icon library
- **react-hot-toast 2.5.1** - Toast notifications

## 📁 Project Structure

```
frontend/
├── src/
│   ├── api/              # API client setup (axios instance)
│   ├── assets/           # Static assets (images, icons)
│   ├── components/       # Reusable UI components
│   │   ├── ui/          # Basic UI primitives (Button, Input, Modal, etc.)
│   │   ├── charts/      # Chart components (TrendLineChart, etc.)
│   │   └── ...          # Feature components (Layout, MetricsCards, etc.)
│   ├── context/          # React contexts (AuthContext)
│   ├── pages/            # Page components (Dashboard, Evaluation, LOB, etc.)
│   ├── App.tsx           # Main app component with routing
│   ├── main.tsx          # Entry point
│   └── index.css         # Global styles with Tailwind
├── public/               # Public static files
├── package.json          # Dependencies and scripts
├── vite.config.ts        # Vite configuration
├── tsconfig.json         # TypeScript configuration
└── tailwind.config.js    # Tailwind CSS configuration
```

## 🚀 Getting Started

### Prerequisites
- Node.js 20+
- npm or yarn

### Installation

```bash
cd frontend
npm install
```

### Development

```bash
npm run dev
```

Access the development server at `http://localhost:5173`.

### Building for Production

```bash
npm run build
```

The build output will be in the `dist/` directory.

### Preview Production Build

```bash
npm run preview
```

## 📄 Pages

- **Dashboard** (`/dashboard`) - Main analytics dashboard with metrics and charts
- **Evaluations** (`/evaluations`) - List and manage call evaluations
- **Evaluation Detail** (`/evaluations/:id`) - Review and edit individual evaluation
- **Line of Business** (`/lobs`) - Manage LOBs and their criteria
- **LOB Settings** (`/lobs/:id/settings`) - Configure LLM and evaluation settings
- **Users** (`/users`) - User management (admin/manager only)
- **Login** (`/login`) - Authentication page

## 🔧 API Integration

The frontend connects to the FastAPI backend running on `http://localhost:5000` (local) or `http://localhost:5001` (Docker).

API client configuration is in `src/api/client.ts`.

## 🎨 Styling

- **Tailwind CSS 4** with custom configuration
- **clsx** and **tailwind-merge** for conditional classes
- Custom component classes in `src/components/ui/`

## 🧪 Testing

```bash
npm run test
```

Tests are set up with Vitest and React Testing Library.

## 📦 Key Dependencies

### UI & Interaction
- `react-router-dom` - Routing
- `lucide-react` - Icons
- `react-hot-toast` - Notifications
- `clsx`, `tailwind-merge` - Class utilities

### Data & Charts
- `@tanstack/react-query` - Server state management
- `recharts` - Charts and visualizations
- `axios` - HTTP client

### Export
- `jspdf`, `jspdf-autotable` - PDF generation
- `xlsx` - Excel export
- `file-saver` - File downloads

## 🔒 Authentication

JWT tokens are managed via `AuthContext` (`src/context/AuthContext.tsx`):
- Tokens stored in localStorage
- Automatic injection via axios interceptors
- Protected routes via `ProtectedRoute` component

## 📝 Notes

- All API calls should go through the configured axios instance
- Use TanStack Query for data fetching with proper caching
- Follow existing component patterns in `src/components/ui/`
- Ensure responsive design with Tailwind classes
