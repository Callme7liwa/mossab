# Aura Estates Backend

Node.js/Express backend with SQLite database for caching Bridge API data.

## Quick Start

```bash
# Install dependencies
npm install

# Run initial sync from Bridge API (takes ~80 seconds)
npm run sync

# Start the server
npm start

# Or for development with auto-reload
npm run dev
```

## API Endpoints

### Properties

**GET /api/properties**

Fetch properties with optional filters.

Query parameters:
- `status` - Filter by status (comma-separated for multiple: `Active,Pending`)
- `city` - Filter by city name (e.g., `Weston`)
- `minPrice` - Minimum list price
- `maxPrice` - Maximum list price
- `minBeds` - Minimum bedrooms
- `minBaths` - Minimum bathrooms
- `limit` - Maximum results (default: 1000)

Example:
```
GET /api/properties?status=Active&city=Weston&limit=100
```

**GET /api/properties/:id**

Fetch a single property by ID.

### Statistics

**GET /api/stats**

Get aggregate statistics with optional filters.

Query parameters:
- `status` - Filter by status
- `city` - Filter by city

Returns: `totalCount`, `avgPrice`, `avgDOM`, `avgPricePerSqft`, `minPrice`, `maxPrice`, `statusCounts`, `cityCounts`

### Sync

**GET /api/sync/status**

Get last sync information and total property count.

**POST /api/sync**

Trigger a new sync from Bridge API (runs in background).

## Database

SQLite database stored at `server/properties.db`.

Tables:
- `properties` - All property data
- `sync_log` - Sync history and status

## Sync Strategy

- **Active statuses** (Active, Pending, Active Under Contract, Withdrawn): Synced in full
- **Closed properties**: Synced by year for the last 5 years to avoid API skip limits

## Environment Variables

- `PORT` - Server port (default: 3001)

## Architecture

```
Frontend (Vite/React)  →  Backend (Express)  →  SQLite
     localhost:8081          localhost:3001       properties.db
                                   ↓
                            Bridge API (sync only)
```

The frontend no longer calls Bridge API directly. All data comes from the local SQLite cache, making the app much faster and reducing API calls.
