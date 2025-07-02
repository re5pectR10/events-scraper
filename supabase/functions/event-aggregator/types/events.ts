// Standard Event interface as defined in the PRD
export interface StandardEvent {
  title: string;
  description: string;
  startTime: string; // ISO_8601_string
  endTime: string; // ISO_8601_string
  images: string[]; // URLs for images to be stored in event_images
  location: {
    address: string;
    name?: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
  };
  organizerInfo: {
    name: string;
    contact: string | null;
    website?: string;
    description?: string;
  };
  ticketInfo: {
    purchaseUrl: string; // Direct link to the external purchase page
    price: string | null;
    currency: string | null;
    isFree?: boolean;
  };
  sourcePlatform: string; // e.g., "Eventbrite", "Meetup"
  sourceEventId: string; // The unique event ID from the source platform
  category: string; // e.g., "Music", "Art", "Sports"
  capacity?: number;
  externalUrl?: string; // Link to the original event page
}

// Database Event interface (matches our Supabase schema)
export interface DatabaseEvent {
  id?: string;
  title: string;
  description: string;
  start_date: string; // date
  end_date: string; // date
  start_time: string; // time
  end_time?: string; // time
  location_name: string;
  location_address: string;
  location_coordinates?: string; // PostGIS point
  category_id: string; // UUID reference to event_categories
  organizer_id: string; // UUID reference to organizers
  status?: "draft" | "published" | "cancelled" | "completed";
  capacity?: number;
  featured?: boolean;
  slug: string;
  source_platform?: string;
  source_event_id?: string;
  external_url?: string;
  external_ticket_url?: string;
  created_at?: string;
  updated_at?: string;
}

// Sync result interface
export interface SyncResult {
  created: number;
  updated: number;
  errors: string[];
}

// Adapter interface that all adapters must implement
export interface EventAdapter {
  getSourceName(): string;
  fetchEvents(): Promise<StandardEvent[]>;
}

// Category mapping for common event categories
export const CategoryMapping: { [key: string]: string } = {
  // Music & Entertainment
  music: "Music",
  concerts: "Music",
  entertainment: "Entertainment",
  comedy: "Entertainment",
  theater: "Entertainment",
  "performing-arts": "Entertainment",

  // Arts & Culture
  arts: "Arts & Culture",
  culture: "Arts & Culture",
  museums: "Arts & Culture",
  galleries: "Arts & Culture",
  exhibitions: "Arts & Culture",

  // Sports & Fitness
  sports: "Sports",
  fitness: "Sports",
  running: "Sports",
  cycling: "Sports",
  yoga: "Sports",

  // Business & Professional
  business: "Business",
  networking: "Business",
  professional: "Business",
  conference: "Business",
  workshop: "Business",

  // Technology
  technology: "Technology",
  tech: "Technology",
  coding: "Technology",
  programming: "Technology",

  // Food & Drink
  food: "Food & Drink",
  drinks: "Food & Drink",
  restaurants: "Food & Drink",
  cooking: "Food & Drink",

  // Default fallback
  other: "Other",
  miscellaneous: "Other",
};