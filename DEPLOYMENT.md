# Deployment Guide - Event Aggregator Service

## 🚀 Quick Deploy to Supabase

Your Event Aggregator Service is ready for deployment! Follow these steps to get it running in production.

### Prerequisites ✅

1. **Supabase Project**: Already set up with database schema
2. **API Keys**: Obtain from these providers:
   - [Eventbrite API](https://www.eventbrite.com/platform/api) 
   - [Meetup API](https://www.meetup.com/api/)
   - [Ticketmaster API](https://developer.ticketmaster.com/)

### Option 1: GitHub Actions Deployment (Recommended)

**Step 1: Set up GitHub Secrets**

Go to your repository Settings → Secrets and variables → Actions, then add:

```bash
SUPABASE_ACCESS_TOKEN=your_supabase_personal_access_token
SUPABASE_PROJECT_ID=uejnmldtpqgdpbxemvpv
```

**Step 2: Configure API Keys in Supabase**

In your Supabase project Settings → API → Environment variables:

```bash
EVENTBRITE_API_KEY=your_eventbrite_api_key
MEETUP_API_KEY=your_meetup_api_key  
TICKETMASTER_API_KEY=your_ticketmaster_api_key
```

**Step 3: Deploy**

Simply push to the `main` branch - GitHub Actions will automatically deploy!

```bash
git push origin main
```

### Option 2: Manual Deployment

**Step 1: Install Supabase CLI**

```bash
npm install -g supabase
```

**Step 2: Login and Link Project**

```bash
supabase login
supabase link --project-ref uejnmldtpqgdpbxemvpv
```

**Step 3: Deploy Function**

```bash
supabase functions deploy event-aggregator
```

## 🧪 Testing Your Deployment

### Manual Test

```bash
# Test the function
curl -X POST "https://uejnmldtpqgdpbxemvpv.supabase.co/functions/v1/event-aggregator" \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

### Check Logs

```bash
# View function logs
supabase functions logs event-aggregator --follow
```

### Database Verification

Check these tables in your Supabase dashboard:
- `events` - Should show new events from external sources
- `event_images` - Should contain event images
- `event_categories` - Should have auto-generated categories
- `organizers` - Should show external organizers

## ⚙️ Configuration

### Geographic Targeting

Edit these files to target your desired locations:

- **Eventbrite**: `lib/adapters/eventbrite.ts` → `defaultLocation`
- **Meetup**: `lib/adapters/meetup.ts` → `targetCities` array
- **Ticketmaster**: `lib/adapters/ticketmaster.ts` → `defaultCity`, `defaultStateCode`

### Scheduling

The function runs every 6 hours by default. To modify:

1. Edit `supabase/config.toml` → `[functions.event-aggregator.schedule]`
2. Use cron format: `0 */6 * * *` (every 6 hours)
3. Redeploy the function

### Performance Tuning

- **Rate Limiting**: Each adapter limits requests to prevent timeouts
- **Pagination**: Limited to 5 pages per source to stay within Edge Function limits
- **Error Handling**: Continues processing even if one source fails

## 📊 Monitoring

### Success Metrics

The function returns detailed stats:

```json
{
  "success": true,
  "stats": {
    "totalFetched": 150,
    "totalCreated": 45,
    "totalUpdated": 12,
    "sourceBreakdown": {
      "Eventbrite": { "fetched": 50, "created": 15, "updated": 5, "errors": 0 }
    }
  }
}
```

### Common Issues

**API Rate Limits**: 
- Solution: Reduce pagination limits in adapters
- Check: API key quotas and usage

**Timeout Errors**:
- Solution: Reduce `targetCities` array in Meetup adapter
- Check: Edge Function execution time in logs

**Database Errors**:
- Solution: Verify RLS policies allow service role operations
- Check: Foreign key constraints and table permissions

## 🔧 Maintenance

### Adding New Event Sources

1. Create new adapter in `lib/adapters/new-source.ts`
2. Implement `EventAdapter` interface
3. Add to adapters array in `index.ts`
4. Add API key to environment variables

### Data Quality

- Events are automatically deduplicated by `source_platform` + `source_event_id`
- Categories are normalized using the built-in mapping
- Organizers are auto-verified for external sources

### Backup & Recovery

- Database changes are tracked in git
- Edge Functions are version-controlled
- API keys are stored securely in Supabase environment

---

## 🆘 Support

**GitHub Issues**: [Create an issue](https://github.com/re5pectR10/events-scraper/issues)
**Documentation**: Check the README.md for detailed information

Your Event Aggregator Service is now ready to populate your events database automatically! 🎉