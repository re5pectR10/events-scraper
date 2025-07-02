import { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { StandardEvent, DatabaseEvent, SyncResult, CategoryMapping } from "../types/events.ts";

// Helper function to generate a URL-friendly slug
function generateSlug(title: string, sourceEventId: string): string {
  const baseSlug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 50);
  
  // Add source event ID to ensure uniqueness
  return `${baseSlug}-${sourceEventId}`.slice(0, 100);
}

// Helper function to extract date and time from ISO string
function extractDateTimeFromISO(isoString: string): { date: string; time: string } {
  const date = new Date(isoString);
  return {
    date: date.toISOString().split("T")[0], // YYYY-MM-DD
    time: date.toTimeString().split(" ")[0], // HH:MM:SS
  };
}

// Helper function to find or create category
async function findOrCreateCategory(
  supabase: SupabaseClient,
  categoryName: string
): Promise<string> {
  // Normalize category name using mapping
  const normalizedCategory = CategoryMapping[categoryName.toLowerCase()] || categoryName;

  // Try to find existing category
  const { data: existingCategory, error: findError } = await supabase
    .from("event_categories")
    .select("id")
    .eq("name", normalizedCategory)
    .maybeSingle();

  if (findError) {
    throw new Error(`Error finding category: ${findError.message}`);
  }

  if (existingCategory) {
    return existingCategory.id;
  }

  // Create new category if it doesn't exist
  const { data: newCategory, error: createError } = await supabase
    .from("event_categories")
    .insert({
      name: normalizedCategory,
      slug: normalizedCategory.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      description: `Auto-generated category for ${normalizedCategory} events`,
      icon: "📅",
      color: "#6b7280", // Default gray color
    })
    .select("id")
    .single();

  if (createError) {
    throw new Error(`Error creating category: ${createError.message}`);
  }

  return newCategory.id;
}

// Helper function to find or create organizer
async function findOrCreateOrganizer(
  supabase: SupabaseClient,
  organizerInfo: StandardEvent["organizerInfo"],
  sourcePlatform: string
): Promise<string> {
  // Check if organizer already exists
  const { data: existingOrganizer, error: findError } = await supabase
    .from("organizers")
    .select("id")
    .eq("business_name", organizerInfo.name)
    .maybeSingle();

  if (findError) {
    throw new Error(`Error finding organizer: ${findError.message}`);
  }

  if (existingOrganizer) {
    return existingOrganizer.id;
  }

  // Create a system user ID for external organizers
  // In a real implementation, you might want to create a special system user
  // For now, we'll use a hardcoded UUID or create a specific external organizer user
  const { data: systemUser, error: userError } =
    await supabase.auth.admin.createUser({
      email:
        organizerInfo.contact ||
        `external-${sourcePlatform}-${Date.now()}@example.com`,
      password: Math.random().toString(36).substring(2, 15),
      email_confirm: true,
      user_metadata: {
        full_name: organizerInfo.name,
        is_external_organizer: true,
        source_platform: sourcePlatform,
      },
    });

  if (userError || !systemUser.user) {
    throw new Error(
      `Error creating system user for organizer: ${userError?.message}`
    );
  }

  // Create new organizer
  const { data: newOrganizer, error: createError } = await supabase
    .from("organizers")
    .insert({
      user_id: systemUser.user.id,
      business_name: organizerInfo.name,
      contact_email: organizerInfo.contact || "",
      description:
        organizerInfo.description ||
        `External organizer from ${sourcePlatform}`,
      website: organizerInfo.website,
      verification_status: "verified", // Auto-verify external organizers
    })
    .select("id")
    .single();

  if (createError) {
    throw new Error(`Error creating organizer: ${createError.message}`);
  }

  return newOrganizer.id;
}

// Main sync function
export async function syncEventsToDatabase(
  supabase: SupabaseClient,
  events: StandardEvent[],
  sourcePlatform: string
): Promise<SyncResult> {
  const result: SyncResult = {
    created: 0,
    updated: 0,
    errors: [],
  };

  console.log(
    `Starting sync for ${events.length} events from ${sourcePlatform}`
  );

  for (const event of events) {
    try {
      // Check if event already exists
      const { data: existingEvent, error: findError } = await supabase
        .from("events")
        .select("id, slug")
        .eq("source_platform", sourcePlatform)
        .eq("source_event_id", event.sourceEventId)
        .maybeSingle();

      if (findError) {
        throw new Error(`Error checking existing event: ${findError.message}`);
      }

      // Find or create category and organizer
      const categoryId = await findOrCreateCategory(supabase, event.category);
      const organizerId = await findOrCreateOrganizer(
        supabase,
        event.organizerInfo,
        sourcePlatform
      );

      // Extract date and time components
      const startDateTime = extractDateTimeFromISO(event.startTime);
      const endDateTime = extractDateTimeFromISO(event.endTime);

      // Prepare database event object
      const dbEvent: Partial<DatabaseEvent> = {
        title: event.title,
        description: event.description,
        start_date: startDateTime.date,
        end_date: endDateTime.date,
        start_time: startDateTime.time,
        end_time: endDateTime.time,
        location_name: event.location.name || "TBD",
        location_address: event.location.address,
        location_coordinates: event.location.coordinates
          ? `(${event.location.coordinates.lng},${event.location.coordinates.lat})`
          : undefined,
        category_id: categoryId,
        organizer_id: organizerId,
        status: "published",
        capacity: event.capacity,
        featured: false,
        slug:
          existingEvent?.slug || generateSlug(event.title, event.sourceEventId),
        source_platform: sourcePlatform,
        source_event_id: event.sourceEventId,
        external_url: event.externalUrl,
        external_ticket_url: event.ticketInfo.purchaseUrl,
      };

      if (existingEvent) {
        // Update existing event
        const { error: updateError } = await supabase
          .from("events")
          .update({ ...dbEvent, updated_at: new Date().toISOString() })
          .eq("id", existingEvent.id);

        if (updateError) {
          throw new Error(`Error updating event: ${updateError.message}`);
        }

        result.updated++;
        console.log(`Updated event: ${event.title}`);

        // Handle event images for updated event
        await syncEventImages(supabase, existingEvent.id, event.images);
      } else {
        // Create new event
        const { data: newEvent, error: createError } = await supabase
          .from("events")
          .insert(dbEvent)
          .select("id")
          .single();

        if (createError) {
          throw new Error(`Error creating event: ${createError.message}`);
        }

        result.created++;
        console.log(`Created event: ${event.title}`);

        // Handle event images for new event
        await syncEventImages(supabase, newEvent.id, event.images);
      }
    } catch (error) {
      const errorMessage = `Error syncing event "${event.title}": ${error.message}`;
      console.error(errorMessage);
      result.errors.push(errorMessage);
    }
  }

  console.log(
    `Sync completed: ${result.created} created, ${result.updated} updated, ${result.errors.length} errors`
  );
  return result;
}

// Helper function to sync event images
async function syncEventImages(
  supabase: SupabaseClient,
  eventId: string,
  imageUrls: string[]
): Promise<void> {
  try {
    // Remove existing images for this event
    await supabase.from("event_images").delete().eq("event_id", eventId);

    // Add new images
    if (imageUrls.length > 0) {
      const imageData = imageUrls.map((url, index) => ({
        event_id: eventId,
        image_url: url,
        alt_text: `Event image ${index + 1}`,
        display_order: index,
        is_primary: index === 0, // First image is primary
      }));

      const { error: insertError } = await supabase
        .from("event_images")
        .insert(imageData);

      if (insertError) {
        console.error(`Error inserting event images: ${insertError.message}`);
      }
    }
  } catch (error) {
    console.error(
      `Error syncing images for event ${eventId}: ${error.message}`
    );
  }
}