# DROPS UTM - Frontend

Next.js 15 frontend application for the DROPS UTM system.

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **UI Components**: shadcn/ui
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **Server State**: TanStack React Query
- **Real-time**: Socket.io Client
- **Maps**: Mapbox GL JS

## Getting Started

### Prerequisites

- Node.js 20+
- npm 10+

### Installation

From the project root:

```bash
npm install
```

### Development

```bash
# From project root
npm run dev:frontend

# Or from this directory
npm run dev
```

The app runs at [http://localhost:3000](http://localhost:3000).

### Environment Variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Required variables:

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Backend API URL |
| `NEXT_PUBLIC_WS_URL` | WebSocket server URL |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Mapbox GL access token |

## Project Structure

```
src/
├── app/                  # Next.js App Router pages
│   ├── dashboard/        # Dashboard pages
│   ├── layout.tsx        # Root layout
│   ├── page.tsx          # Landing page
│   └── providers.tsx     # Client providers (React Query)
├── components/
│   ├── layout/           # Layout components (sidebar, etc.)
│   └── ui/               # shadcn/ui components
├── hooks/                # Custom React hooks
├── lib/                  # Utilities, API client, socket
├── store/                # Zustand stores
└── types/                # Re-exported shared types
```

## Building

```bash
npm run build
```

## Linting

```bash
npm run lint
```
