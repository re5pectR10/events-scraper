import { EventAdapter, StandardEvent } from "../../types/events.ts";

// Meetup API response interfaces
interface MeetupEvent {
  id: string;
  name: string;
  description: string;
  dateTime: string;
  endTime?: string;
  duration?: number; // in milliseconds
  eventUrl: string;
  going: number;
  maxTickets?: number;
  images?: Array<{
    id: string;
    baseUrl: string;
  }>;
  venue?: {
    id: string;
    name: string;
    address: string;
    city: string;
    state: string;
    country: string;
    lat: number;
    lng: number;
  };
  group: {
    id: string;
    name: string;
    urlname: string;
    description?: string;
    link: string;
  };
  topics?: Array<{
    id: string;
    name: string;
  }>;
  isFree: boolean;
  feeAmount?: number;
  feeCurrency?: string;
  rsvpState?: string;
}

interface MeetupResponse {
  data?: {
    groupByUrlname?: {
      unifiedEvents?: {
        edges: Array<{
          node: MeetupEvent;
        }>;
        pageInfo: {
          hasNextPage: boolean;
          endCursor: string;
        };
      };
    };
    keywordSearch?: {
      edges: Array<{
        node: {
          id: string;
          urlname: string;
          name: string;
          membersCount: number;
        };
      }>;
      pageInfo: {
        hasNextPage: boolean;
        endCursor: string;
      };
    };
  };
  errors?: Array<{
    message: string;
    extensions?: {
      code: string;
    };
  }>;
}

export class MeetupAdapter implements EventAdapter {
  private readonly apiKey: string;
  private readonly baseUrl = "https://api.meetup.com/gql";
  private readonly targetCities = ["san-francisco", "new-york", "los-angeles"]; // Configure based on your target area

  constructor() {
    this.apiKey = Deno.env.get("MEETUP_API_KEY") || "";
    if (!this.apiKey) {
      throw new Error("MEETUP_API_KEY environment variable is required");
    }
  }

  getSourceName(): string {
    return "Meetup";
  }

  async fetchEvents(): Promise<StandardEvent[]> {
    console.log("Fetching events from Meetup API...");

    try {
      const events: StandardEvent[] = [];

      // For each target city/area, fetch popular groups and their events
      for (const city of this.targetCities) {
        try {
          const cityEvents = await this.fetchMeetupEventsForLocation(city);
          events.push(...cityEvents);
        } catch (error) {
          console.error(
            `Error fetching Meetup events for ${city}:`,
            error.message
          );
        }
      }

      // Remove duplicates based on event ID
      const uniqueEvents = events.filter(
        (event, index, self) =>
          index ===
          self.findIndex((e) => e.sourceEventId === event.sourceEventId)
      );

      console.log(
        `Successfully fetched ${uniqueEvents.length} unique events from Meetup`
      );
      return uniqueEvents;
    } catch (error) {
      console.error("Error fetching Meetup events:", error.message);
      throw new Error(`Meetup API error: ${error.message}`);
    }
  }

  private async fetchMeetupEventsForLocation(
    location: string
  ): Promise<StandardEvent[]> {
    // First, get popular groups in the location
    const groupsQuery = `
      query GetGroups($first: Int!, $after: String) {
        keywordSearch(first: $first, after: $after, filter: {
          query: "${location}",
          source: GROUPS,
          lat: 37.7749,
          lon: -122.4194,
          radius: 25
        }) {
          edges {
            node {
              ... on Group {
                id
                urlname
                name
                membersCount
              }
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `;

    const groupsResponse = await this.executeGraphQLQuery(groupsQuery, {
      first: 50,
      after: null,
    });

    if (!groupsResponse.data?.keywordSearch?.edges) {
      return [];
    }

    const events: StandardEvent[] = [];

    // For each group, fetch their upcoming events
    for (const groupEdge of groupsResponse.data.keywordSearch.edges.slice(
      0,
      10
    )) {
      // Limit to 10 groups per location
      const group = groupEdge.node;

      try {
        const groupEvents = await this.fetchEventsForGroup(group.urlname);
        events.push(...groupEvents);
      } catch (error) {
        console.error(
          `Error fetching events for group ${group.urlname}:`,
          error.message
        );
      }
    }

    return events;
  }

  private async fetchEventsForGroup(
    groupUrlname: string
  ): Promise<StandardEvent[]> {
    const eventsQuery = `
      query GetGroupEvents($urlname: String!, $first: Int!) {
        groupByUrlname(urlname: $urlname) {
          id
          name
          description
          link
          unifiedEvents(input: {first: $first}) {
            edges {
              node {
                id
                title
                description
                dateTime
                endTime
                duration
                eventUrl
                going
                maxTickets
                images {
                  id
                  baseUrl
                }
                venue {
                  id
                  name
                  address
                  city
                  state
                  country
                  lat
                  lng
                }
                group {
                  id
                  name
                  urlname
                  description
                  link
                }
                topics {
                  id
                  name
                }
                isFree
                feeAmount
                feeCurrency
              }
            }
          }
        }
      }
    `;

    const response = await this.executeGraphQLQuery(eventsQuery, {
      urlname: groupUrlname,
      first: 20,
    });

    if (!response.data?.groupByUrlname?.unifiedEvents?.edges) {
      return [];
    }

    const events: StandardEvent[] = [];

    for (const eventEdge of response.data.groupByUrlname.unifiedEvents.edges) {
      try {
        const standardEvent = this.transformEvent(eventEdge.node);
        events.push(standardEvent);
      } catch (error) {
        console.error(
          `Error transforming Meetup event ${eventEdge.node.id}:`,
          error.message
        );
      }
    }

    return events;
  }

  private async executeGraphQLQuery(
    query: string,
    variables: any
  ): Promise<MeetupResponse> {
    const response = await fetch(this.baseUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        variables,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Meetup API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();

    if (result.errors && result.errors.length > 0) {
      throw new Error(`Meetup GraphQL error: ${result.errors[0].message}`);
    }

    return result;
  }

  private transformEvent(event: MeetupEvent): StandardEvent {
    // Calculate end time if not provided
    let endTime = event.endTime;
    if (!endTime && event.duration) {
      const startDate = new Date(event.dateTime);
      const endDate = new Date(startDate.getTime() + event.duration);
      endTime = endDate.toISOString();
    } else if (!endTime) {
      // Default to 2 hours if no duration provided
      const startDate = new Date(event.dateTime);
      const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000);
      endTime = endDate.toISOString();
    }

    // Build location information
    let locationAddress = "Online Event";
    let locationName = "Online";
    let coordinates: { lat: number; lng: number } | undefined;

    if (event.venue) {
      locationName = event.venue.name;
      locationAddress = `${event.venue.address}, ${event.venue.city}, ${event.venue.state}, ${event.venue.country}`;
      coordinates = {
        lat: event.venue.lat,
        lng: event.venue.lng,
      };
    }

    // Get organizer information
    const organizerInfo = {
      name: event.group.name,
      contact: null as string | null,
      website: event.group.link,
      description: event.group.description,
    };

    // Get ticket information
    const ticketInfo = {
      purchaseUrl: event.eventUrl,
      price: event.isFree
        ? "Free"
        : event.feeAmount
        ? `${event.feeAmount}`
        : null,
      currency: event.feeCurrency || "USD",
      isFree: event.isFree,
    };

    // Get images
    const images: string[] = [];
    if (event.images && event.images.length > 0) {
      images.push(...event.images.map((img) => img.baseUrl));
    }

    // Determine category from topics
    let category = "Other";
    if (event.topics && event.topics.length > 0) {
      const topicName = event.topics[0].name.toLowerCase();

      if (
        topicName.includes("tech") ||
        topicName.includes("programming") ||
        topicName.includes("software")
      ) {
        category = "Technology";
      } else if (
        topicName.includes("business") ||
        topicName.includes("networking") ||
        topicName.includes("entrepreneur")
      ) {
        category = "Business";
      } else if (
        topicName.includes("art") ||
        topicName.includes("creative") ||
        topicName.includes("design")
      ) {
        category = "Arts & Culture";
      } else if (
        topicName.includes("fitness") ||
        topicName.includes("sport") ||
        topicName.includes("health")
      ) {
        category = "Sports";
      } else if (
        topicName.includes("food") ||
        topicName.includes("cooking") ||
        topicName.includes("wine")
      ) {
        category = "Food & Drink";
      } else if (
        topicName.includes("music") ||
        topicName.includes("concert") ||
        topicName.includes("dance")
      ) {
        category = "Music";
      }
    }

    return {
      title: event.name,
      description: event.description || "No description available",
      startTime: event.dateTime,
      endTime,
      images,
      location: {
        address: locationAddress,
        name: locationName,
        coordinates,
      },
      organizerInfo,
      ticketInfo,
      sourcePlatform: "Meetup",
      sourceEventId: event.id,
      category,
      capacity: event.maxTickets,
      externalUrl: event.eventUrl,
    };
  }
}