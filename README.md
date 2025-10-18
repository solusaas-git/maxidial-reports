# Maxi Dial Reports

A Next.js-based reporting application for call center operations. This app provides comprehensive analytics, reporting, and data visualization powered by the Adversus API.

## Features

- **Dashboard**: Overview of key metrics and statistics
- **Calls Management**: View and analyze call records with filtering by date range
- **Agents**: Monitor agent status and performance
- **Campaigns**: Track campaign performance and metrics
- **Leads**: Manage and view lead information and conversion status
- **Custom Reports**: Generate various types of reports with customizable parameters

## Tech Stack

- **Next.js 14** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first CSS framework
- **Axios** - HTTP client for API calls
- **Recharts** - Charting library (ready for data visualization)
- **date-fns** - Date manipulation utilities
- **Lucide React** - Icon library

## Getting Started

### Prerequisites

- Node.js 18+ installed
- Adversus API credentials

### Installation

1. Install dependencies:
```bash
cd nextjs-app
npm install
```

2. Configure environment variables:

Copy `.env.example` to `.env.local` and fill in your Adversus API credentials:

```env
ADVERSUS_API_URL=https://solutions.adversus.io/api
ADVERSUS_API_KEY=your_api_key_here
ADVERSUS_API_SECRET=your_api_secret_here
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Project Structure

```
nextjs-app/
├── app/                    # Next.js App Router pages
│   ├── page.tsx           # Dashboard
│   ├── calls/             # Calls page
│   ├── agents/            # Agents page
│   ├── campaigns/         # Campaigns page
│   ├── leads/             # Leads page
│   ├── reports/           # Reports page
│   └── api/               # API routes
│       └── adversus/      # Adversus API endpoints
├── components/            # Reusable React components
│   ├── Sidebar.tsx        # Navigation sidebar
│   ├── StatCard.tsx       # Statistics card component
│   ├── DataTable.tsx      # Reusable data table
│   └── DateRangePicker.tsx # Date range selector
├── lib/                   # Utility libraries
│   ├── adversus-client.ts # Adversus API client
│   └── types.ts           # TypeScript type definitions
└── public/               # Static assets
```

## API Integration

The app provides a wrapper around the Adversus API with the following endpoints:

- `GET /api/adversus/calls` - Fetch call records
- `GET /api/adversus/agents` - Fetch agent information
- `GET /api/adversus/campaigns` - Fetch campaign data
- `GET /api/adversus/leads` - Fetch lead information
- `GET /api/adversus/statistics` - Fetch statistics

### Adversus Client

The `AdversusClient` class in `lib/adversus-client.ts` provides methods to interact with the Adversus API:

```typescript
import { getAdversusClient } from '@/lib/adversus-client';

const client = getAdversusClient();
const calls = await client.getCalls({ startDate, endDate });
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint

## Customization

### Adding New Reports

To add a new report type:

1. Define the report logic in `app/reports/page.tsx`
2. Add the report type to the `reportTypes` array
3. Implement the data fetching and visualization logic

### Extending API Endpoints

To add new Adversus API endpoints:

1. Add methods to `lib/adversus-client.ts`
2. Create corresponding API routes in `app/api/adversus/`
3. Add TypeScript types in `lib/types.ts`

## Notes

- Make sure to configure your Adversus API credentials before running the app
- The app uses the Adversus API endpoints - adjust them based on your actual API documentation
- Some sample data is used for demonstration purposes until real API connections are established

## Next Steps

1. Connect to the actual Adversus API endpoints
2. Implement specific report generation logic
3. Add data visualization charts
4. Implement export functionality (CSV, PDF)
5. Add user authentication if needed
6. Implement real-time updates using WebSockets (if supported by Adversus)

## Support

For issues or questions, please refer to the [Adversus API documentation](https://solutions.adversus.io/api).

