# Event Aggregator Service

A robust, production-ready event aggregation system built for Supabase Edge Functions. This service automatically fetches events from multiple third-party APIs (Eventbrite, Meetup, Ticketmaster) and synchronizes them with your Supabase database.

## 🏗️ Architecture

The system follows a clean adapter pattern architecture:

- **Conductor (`index.ts`)**: Main orchestrator that coordinates all adapters
- **Sync Module (`lib/sync.ts`)**: Handles database synchronization with intelligent upsert logic  
- **Adapters (`lib/adapters/`)**: Source-specific modules for each API provider
- **Types (`types/events.ts`)**: Shared TypeScript interfaces and type definitions

## 📋 Features

✅ **Multi-Source Integration**: Eventbrite, Meetup, and Ticketmaster APIs  
✅ **Intelligent Sync**: Create/update logic prevents duplicates  
✅ **Automatic Scheduling**: Runs every 6 hours via cron  
✅ **Robust Error Handling**: Continues processing even if one source fails  
✅ **Comprehensive Logging**: Detailed stats and error reporting  
✅ **Production Ready**: Built with TypeScript, proper error handling, and scalability in mind

## 🚀 Quick Start

### Prerequisites

1. **Supabase Project**: Active Supabase project with database access
2. **API Keys**: Obtain API keys from:
   - [Eventbrite API](https://www.eventbrite.com/platform/api)
   - [Meetup API](https://www.meetup.com/api/)
   - [Ticketmaster API](https://developer.ticketmaster.com/)

### Environment Variables

Set these in your Supabase project settings:

```bash
EVENTBRITE_API_KEY=your_eventbrite_key_here
MEETUP_API_KEY=your_meetup_key_here
TICKETMASTER_API_KEY=your_ticketmaster_key_here
```

### Deployment with GitHub Actions

This project includes automated CI/CD deployment:

1. **Fork this repository** to your GitHub account
2. **Set up GitHub Secrets** in your repository settings:
   - `SUPABASE_ACCESS_TOKEN`: Your Supabase personal access token
   - `SUPABASE_PROJECT_ID`: Your Supabase project reference ID

3. **Push to main branch** - GitHub Actions will automatically deploy!

### Manual Deployment

1. **Install Supabase CLI**:
   ```bash
   npm install -g supabase
   ```

2. **Login and deploy**:
   ```bash
   supabase login
   supabase link --project-ref YOUR_PROJECT_ID
   supabase functions deploy event-aggregator
   ```

## 🔧 Configuration

### Location Targeting

Each adapter can be configured for different geographic areas:

- **Eventbrite**: Edit `defaultLocation` and `searchRadius` in `eventbrite.ts`
- **Meetup**: Modify `targetCities` array in `meetup.ts`
- **Ticketmaster**: Update `defaultCity`, `defaultStateCode` in `ticketmaster.ts`

## 🧪 Testing

### Manual Test

```bash
# Invoke the function manually
supabase functions invoke event-aggregator --method POST
```

### Check Logs

```bash
# View function logs
supabase functions logs event-aggregator
```

## 📊 Monitoring

The function returns comprehensive statistics:

```json
{
  "success": true,
  "stats": {
    "totalFetched": 150,
    "totalCreated": 45,
    "totalUpdated": 12,
    "sourceBreakdown": {
      "Eventbrite": {
        "fetched": 50,
        "created": 15,
        "updated": 5,
        "errors": 0
      }
    }
  },
  "errors": []
}
```

## 🛠️ Customization

### Adding New Event Sources

1. Create a new adapter in `lib/adapters/`
2. Implement the `EventAdapter` interface
3. Add to the adapters array in `index.ts`

### Modifying Data Transformation

Edit the `transformEvent` method in each adapter to adjust how external data maps to your schema.

## 🚨 Troubleshooting

### Common Issues

**API Rate Limits**: Each adapter limits requests to prevent timeout  
**Authentication Errors**: Verify API keys in Supabase environment variables  
**Database Errors**: Check RLS policies and table permissions

### Debugging

Enable verbose logging by checking the Edge Function logs in your Supabase dashboard.

## 🔒 Security

- API keys stored securely in Supabase environment variables
- Input validation and sanitization
- External organizers auto-verified with system user accounts
- RLS policies respected for all database operations

---

**Built with ❤️ using Supabase Edge Functions**