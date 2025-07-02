import { EventAdapter, StandardEvent } from "../../types/events.ts";

// Eventbrite API response interfaces
interface EventbriteEvent {
  id: string;
  name: {
    text: string;
  };
  description: {
    text: string;
  };
  start: {
    timezone: string;
    local: string;
    utc: string;
  };
  end: {
    timezone: string;
    local: string;
    utc: string;
  };
  url: string;
  logo?: {
    url: string;
  };
  venue?: {
    id: string;
    name: string;
    address: {
      address_1?: string;
      address_2?: string;
      city?: string;
      region?: string;
      postal_code?: string;
      country?: string;
      latitude?: string;
      longitude?: string;
    };
  };
  organizer?: {
    id: string;
    name: string;
    description?: {
      text: string;
    };
    url?: string;
  };
  category?: {
    id: string;
    name: string;
  };
  capacity?: number;
  is_free: boolean;
  ticket_availability?: {
    minimum_ticket_price?: {
      currency: string;
      display: string;
      value: number;
    };
  };
}

interface EventbriteResponse {
  events: EventbriteEvent[];
  pagination: {
    page_number: number;
    page_size: number;
    page_count: number;
    object_count: number;
    has_more_items: boolean;
  };
}

export class EventbriteAdapter implements EventAdapter {
  private readonly apiKey: string;
  private readonly baseUrl = "https://www.eventbriteapi.com/v3";
  private readonly defaultLocation = "San Francisco, CA"; // Configure based on your target area
  private readonly searchRadius = "25mi";

  constructor() {
    this.apiKey = Deno.env.get("EVENTBRITE_API_KEY") || "";
    if (!this.apiKey) {
      throw new Error("EVENTBRITE_API_KEY environment variable is required");
    }
  }

  getSourceName(): string {
    return "Eventbrite";
  }

  async fetchEvents(): Promise<StandardEvent[]> {
    console.log("Fetching events from Eventbrite API...");

    try {
      const events: StandardEvent[] = [];
      let page = 1;
      let hasMore = true;

      while (hasMore && page <= 5) {
        // Limit to 5 pages to prevent timeouts
        const response = await this.fetchEventbriteEvents(page);

        for (const event of response.events) {
          try {
            const standardEvent = await this.transformEvent(event);
            events.push(standardEvent);
          } catch (error) {
            console.error(
              `Error transforming Eventbrite event ${event.id}:`,
              error.message
            );
          }
        }

        hasMore = response.pagination.has_more_items;
        page++;
      }

      console.log(
        `Successfully fetched ${events.length} events from Eventbrite`
      );
      return events;
    } catch (error) {
      console.error("Error fetching Eventbrite events:", error.message);
      throw new Error(`Eventbrite API error: ${error.message}`);
    }
  }

  private async fetchEventbriteEvents(
    page: number
  ): Promise<EventbriteResponse> {
    const params = new URLSearchParams({
      "location.address": this.defaultLocation,
      "location.within": this.searchRadius,
      sort_by: "date",
      page: page.toString(),
      expand: "venue,organizer,category,ticket_availability",
      status: "live",
      time_filter: "current_future",
    });

    const url = `${this.baseUrl}/events/search/?${params.toString()}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Eventbrite API error: ${response.status} - ${errorText}`
      );
    }

    return await response.json();
  }

  private async transformEvent(event: EventbriteEvent): Promise<StandardEvent> {
    // Build location information
    let locationAddress = "Online Event";
    let locationName = "Online";
    let coordinates: { lat: number; lng: number } | undefined;

    if (event.venue) {
      locationName = event.venue.name;
      const addr = event.venue.address;

      if (addr) {
        const addressParts = [
          addr.address_1,
          addr.address_2,
          addr.city,
          addr.region,
          addr.postal_code,
          addr.country,
        ].filter(Boolean);

        locationAddress = addressParts.join(", ");

        if (addr.latitude && addr.longitude) {
          coordinates = {
            lat: parseFloat(addr.latitude),
            lng: parseFloat(addr.longitude),
          };
        }
      }
    }

    // Get organizer information
    const organizerInfo = {
      name: event.organizer?.name || "Unknown Organizer",
      contact: null as string | null,
      website: event.organizer?.url,
      description: event.organizer?.description?.text,
    };

    // Get ticket information
    const ticketInfo = {
      purchaseUrl: event.url,
      price: event.is_free
        ? "Free"
        : event.ticket_availability?.minimum_ticket_price?.display || null,
      currency:
        event.ticket_availability?.minimum_ticket_price?.currency || "USD",
      isFree: event.is_free,
    };

    // Get images
    const images: string[] = [];
    if (event.logo?.url) {
      images.push(event.logo.url);
    }

    // Determine category
    const category = event.category?.name || "Other";

    return {
      title: event.name.text,
      description: event.description.text || "No description available",
      startTime: event.start.utc,
      endTime: event.end.utc,
      images,
      location: {
        address: locationAddress,
        name: locationName,
        coordinates,
      },
      organizerInfo,
      ticketInfo,
      sourcePlatform: "Eventbrite",
      sourceEventId: event.id,
      category,
      capacity: event.capacity,
      externalUrl: event.url,
    };
  }
}