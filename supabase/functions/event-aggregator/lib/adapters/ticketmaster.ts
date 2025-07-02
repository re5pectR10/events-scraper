import { EventAdapter, StandardEvent } from "../../types/events.ts";

// Ticketmaster API response interfaces
interface TicketmasterEvent {
  id: string;
  name: string;
  info?: string;
  pleaseNote?: string;
  dates: {
    start: {
      dateTime?: string;
      localDate?: string;
      localTime?: string;
    };
    end?: {
      dateTime?: string;
      localDate?: string;
      localTime?: string;
    };
    timezone?: string;
  };
  url: string;
  images?: Array<{
    url: string;
    width: number;
    height: number;
    ratio: string;
    type: string;
  }>;
  _embedded?: {
    venues?: Array<{
      id: string;
      name: string;
      address?: {
        line1?: string;
        line2?: string;
      };
      city?: {
        name: string;
      };
      state?: {
        name: string;
        stateCode: string;
      };
      country?: {
        name: string;
        countryCode: string;
      };
      postalCode?: string;
      location?: {
        latitude: string;
        longitude: string;
      };
    }>;
    attractions?: Array<{
      id: string;
      name: string;
      url?: string;
    }>;
  };
  classifications?: Array<{
    primary: boolean;
    segment?: {
      id: string;
      name: string;
    };
    genre?: {
      id: string;
      name: string;
    };
    subGenre?: {
      id: string;
      name: string;
    };
  }>;
  priceRanges?: Array<{
    type: string;
    currency: string;
    min: number;
    max: number;
  }>;
  seatmap?: {
    staticUrl: string;
  };
  accessibility?: {
    info?: string;
  };
  ticketLimit?: {
    info: string;
  };
  ageRestrictions?: {
    legalAgeEnforced: boolean;
  };
  ticketing?: {
    safeTix?: {
      enabled: boolean;
    };
  };
  _links?: {
    self: {
      href: string;
    };
  };
}

interface TicketmasterResponse {
  _embedded?: {
    events: TicketmasterEvent[];
  };
  page: {
    size: number;
    totalElements: number;
    totalPages: number;
    number: number;
  };
  _links?: {
    first?: { href: string };
    self?: { href: string };
    next?: { href: string };
    last?: { href: string };
  };
}

export class TicketmasterAdapter implements EventAdapter {
  private readonly apiKey: string;
  private readonly baseUrl = "https://app.ticketmaster.com/discovery/v2";
  private readonly defaultCity = "San Francisco"; // Configure based on your target area
  private readonly defaultStateCode = "CA";
  private readonly defaultCountryCode = "US";
  private readonly searchRadius = "25";

  constructor() {
    this.apiKey = Deno.env.get("TICKETMASTER_API_KEY") || "";
    if (!this.apiKey) {
      throw new Error("TICKETMASTER_API_KEY environment variable is required");
    }
  }

  getSourceName(): string {
    return "Ticketmaster";
  }

  async fetchEvents(): Promise<StandardEvent[]> {
    console.log("Fetching events from Ticketmaster API...");

    try {
      const events: StandardEvent[] = [];
      let page = 0;
      let hasMore = true;

      while (hasMore && page < 5) {
        // Limit to 5 pages to prevent timeouts
        const response = await this.fetchTicketmasterEvents(page);

        if (response._embedded?.events) {
          for (const event of response._embedded.events) {
            try {
              const standardEvent = this.transformEvent(event);
              events.push(standardEvent);
            } catch (error) {
              console.error(
                `Error transforming Ticketmaster event ${event.id}:`,
                error.message
              );
            }
          }
        }

        hasMore = response.page.number < response.page.totalPages - 1;
        page++;
      }

      console.log(
        `Successfully fetched ${events.length} events from Ticketmaster`
      );
      return events;
    } catch (error) {
      console.error("Error fetching Ticketmaster events:", error.message);
      throw new Error(`Ticketmaster API error: ${error.message}`);
    }
  }

  private async fetchTicketmasterEvents(
    page: number
  ): Promise<TicketmasterResponse> {
    const params = new URLSearchParams({
      apikey: this.apiKey,
      city: this.defaultCity,
      stateCode: this.defaultStateCode,
      countryCode: this.defaultCountryCode,
      radius: this.searchRadius,
      unit: "miles",
      sort: "date,asc",
      page: page.toString(),
      size: "200", // Maximum allowed
      source: "ticketmaster",
      includeTest: "no",
      keyword: "", // Can be customized for specific types of events
    });

    const url = `${this.baseUrl}/events.json?${params.toString()}`;

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Ticketmaster API error: ${response.status} - ${errorText}`
      );
    }

    return await response.json();
  }

  private transformEvent(event: TicketmasterEvent): StandardEvent {
    // Build datetime strings
    let startTime: string;
    let endTime: string;

    if (event.dates.start.dateTime) {
      startTime = event.dates.start.dateTime;
    } else if (event.dates.start.localDate && event.dates.start.localTime) {
      startTime = `${event.dates.start.localDate}T${event.dates.start.localTime}`;
    } else if (event.dates.start.localDate) {
      startTime = `${event.dates.start.localDate}T19:00:00`; // Default to 7 PM
    } else {
      throw new Error("Invalid event date format");
    }

    // Calculate end time
    if (event.dates.end?.dateTime) {
      endTime = event.dates.end.dateTime;
    } else if (event.dates.end?.localDate && event.dates.end?.localTime) {
      endTime = `${event.dates.end.localDate}T${event.dates.end.localTime}`;
    } else {
      // Default to 3 hours after start time
      const startDate = new Date(startTime);
      const endDate = new Date(startDate.getTime() + 3 * 60 * 60 * 1000);
      endTime = endDate.toISOString();
    }

    // Ensure we have ISO strings
    if (!startTime.includes("T")) {
      startTime = new Date(startTime).toISOString();
    }
    if (!endTime.includes("T")) {
      endTime = new Date(endTime).toISOString();
    }

    // Build location information
    let locationAddress = "Venue TBD";
    let locationName = "TBD";
    let coordinates: { lat: number; lng: number } | undefined;

    if (event._embedded?.venues && event._embedded.venues.length > 0) {
      const venue = event._embedded.venues[0];
      locationName = venue.name;

      const addressParts = [
        venue.address?.line1,
        venue.address?.line2,
        venue.city?.name,
        venue.state?.name,
        venue.postalCode,
        venue.country?.name,
      ].filter(Boolean);

      locationAddress = addressParts.join(", ");

      if (venue.location?.latitude && venue.location?.longitude) {
        coordinates = {
          lat: parseFloat(venue.location.latitude),
          lng: parseFloat(venue.location.longitude),
        };
      }
    }

    // Get organizer information (use attraction as organizer)
    let organizerName = "Ticketmaster Event";
    let organizerWebsite: string | undefined;

    if (
      event._embedded?.attractions &&
      event._embedded.attractions.length > 0
    ) {
      organizerName = event._embedded.attractions[0].name;
      organizerWebsite = event._embedded.attractions[0].url;
    }

    const organizerInfo = {
      name: organizerName,
      contact: null as string | null,
      website: organizerWebsite,
      description: `Event organized through Ticketmaster`,
    };

    // Get ticket information
    let price: string | null = null;
    let currency = "USD";

    if (event.priceRanges && event.priceRanges.length > 0) {
      const priceRange = event.priceRanges[0];
      currency = priceRange.currency;

      if (priceRange.min === priceRange.max) {
        price = `${priceRange.min} ${currency}`;
      } else {
        price = `${priceRange.min} - ${priceRange.max} ${currency}`;
      }
    }

    const ticketInfo = {
      purchaseUrl: event.url,
      price,
      currency,
      isFree: price === null || price === "0 USD",
    };

    // Get images - prefer high quality images
    const images: string[] = [];
    if (event.images && event.images.length > 0) {
      // Sort by resolution (width * height) and take the best ones
      const sortedImages = event.images
        .filter((img) => img.url && img.width && img.height)
        .sort((a, b) => b.width * b.height - a.width * a.height)
        .slice(0, 3); // Take up to 3 best images

      images.push(...sortedImages.map((img) => img.url));
    }

    // Determine category
    let category = "Entertainment";

    if (event.classifications && event.classifications.length > 0) {
      const classification =
        event.classifications.find((c) => c.primary) ||
        event.classifications[0];

      if (classification.segment?.name) {
        const segmentName = classification.segment.name.toLowerCase();

        if (segmentName.includes("music")) {
          category = "Music";
        } else if (segmentName.includes("sports")) {
          category = "Sports";
        } else if (
          segmentName.includes("arts") ||
          segmentName.includes("theatre")
        ) {
          category = "Arts & Culture";
        } else if (segmentName.includes("film")) {
          category = "Entertainment";
        }
      }

      // Further refine with genre if available
      if (classification.genre?.name) {
        const genreName = classification.genre.name.toLowerCase();

        if (
          genreName.includes("rock") ||
          genreName.includes("pop") ||
          genreName.includes("jazz") ||
          genreName.includes("classical")
        ) {
          category = "Music";
        } else if (genreName.includes("comedy")) {
          category = "Entertainment";
        }
      }
    }

    // Build description
    let description = event.info || "No description available";
    if (event.pleaseNote) {
      description += `\n\nPlease Note: ${event.pleaseNote}`;
    }

    return {
      title: event.name,
      description,
      startTime,
      endTime,
      images,
      location: {
        address: locationAddress,
        name: locationName,
        coordinates,
      },
      organizerInfo,
      ticketInfo,
      sourcePlatform: "Ticketmaster",
      sourceEventId: event.id,
      category,
      capacity: undefined, // Ticketmaster doesn't typically expose capacity
      externalUrl: event.url,
    };
  }
}