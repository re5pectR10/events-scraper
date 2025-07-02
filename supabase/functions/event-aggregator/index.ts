import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { syncEventsToDatabase } from "./lib/sync.ts";
import { EventbriteAdapter } from "./lib/adapters/eventbrite.ts";
import { MeetupAdapter } from "./lib/adapters/meetup.ts";
import { TicketmasterAdapter } from "./lib/adapters/ticketmaster.ts";
import { StandardEvent } from "./types/events.ts";

interface AggregatorRunResult {
  success: boolean;
  stats: {
    totalFetched: number;
    totalCreated: number;
    totalUpdated: number;
    sourceBreakdown: {
      [source: string]: {
        fetched: number;
        created: number;
        updated: number;
        errors: number;
      };
    };
  };
  errors: string[];
}

Deno.serve(async (req: Request) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    console.log("Starting Event Aggregator run...");

    const result: AggregatorRunResult = {
      success: true,
      stats: {
        totalFetched: 0,
        totalCreated: 0,
        totalUpdated: 0,
        sourceBreakdown: {},
      },
      errors: [],
    };

    // Initialize adapters
    const adapters = [
      new EventbriteAdapter(),
      new MeetupAdapter(),
      new TicketmasterAdapter(),
    ];

    // Process each adapter
    for (const adapter of adapters) {
      const sourceName = adapter.getSourceName();
      console.log(`Processing ${sourceName}...`);

      try {
        // Fetch events from the adapter
        const events: StandardEvent[] = await adapter.fetchEvents();
        console.log(`Fetched ${events.length} events from ${sourceName}`);

        // Sync events to database
        const syncResult = await syncEventsToDatabase(
          supabaseClient,
          events,
          sourceName
        );

        // Update stats
        result.stats.totalFetched += events.length;
        result.stats.totalCreated += syncResult.created;
        result.stats.totalUpdated += syncResult.updated;

        result.stats.sourceBreakdown[sourceName] = {
          fetched: events.length,
          created: syncResult.created,
          updated: syncResult.updated,
          errors: 0,
        };

        console.log(
          `${sourceName}: ${syncResult.created} created, ${syncResult.updated} updated`
        );
      } catch (error) {
        const errorMessage = `Error processing ${sourceName}: ${error.message}`;
        console.error(errorMessage);
        result.errors.push(errorMessage);

        result.stats.sourceBreakdown[sourceName] = {
          fetched: 0,
          created: 0,
          updated: 0,
          errors: 1,
        };

        // Don't fail the entire run because of one adapter
        result.success = false;
      }
    }

    console.log("Event Aggregator run completed");
    console.log(
      `Total stats: ${result.stats.totalFetched} fetched, ${result.stats.totalCreated} created, ${result.stats.totalUpdated} updated`
    );

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: result.success ? 200 : 207, // 207 Multi-Status for partial success
    });
  } catch (error) {
    console.error("Critical error in Event Aggregator:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        stats: {
          totalFetched: 0,
          totalCreated: 0,
          totalUpdated: 0,
          sourceBreakdown: {},
        },
        errors: [error.message],
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});