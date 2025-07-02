# Product Requirements Document: V1 Event Aggregator Service

**Author:** Brainstormer
**Date:** June 26, 2025
**Version:** 1.0

### 1. Introduction & Problem Statement

To become the go-to hub for local events and activities, our platform needs a comprehensive and engaging selection of events from day one. Without an initial offering, we face a "chicken-and-egg" problem: we can't attract users without events, and we can't attract organizers without users.

This document outlines the requirements for a backend service, the **Event Aggregator**, which will solve this problem by automatically fetching, standardizing, and storing event data from major third-party providers. This ensures our platform is vibrant and valuable from the moment a user first visits.

### 2. Goals & Objectives

The primary goal of this project is to build an automated, scalable pipeline to populate our events database.

- **Content Goal:** To ingest and maintain a rich database of local events, ensuring users have a diverse selection of activities to browse.
- **Technical Goal:** To build the service on our existing Supabase stack, creating a low-maintenance, cost-effective, and scalable architecture.
- **Business Goal:** To accelerate user acquisition by providing immediate value and to create a foundational dataset that makes our platform the most comprehensive discovery tool in our target markets.

### 3. Features & Requirements

#### **Functional Requirements (FR)**

- **FR1: Multi-Source API Integration:** The service must fetch event data via API from the following initial providers:
  - Eventbrite
  - Meetup
  - Ticketmaster
- **FR2: Adapter-Based Architecture:** The system must use an "Adapter" pattern. Each data source will have its own dedicated module responsible for handling API-specific authentication, requests, and data transformation.
- **FR3: Standardized Data Transformation:** All incoming data, regardless of the source, must be transformed into our platform's standard `Event` object structure, which is compatible with the Supabase `events` table.
- **FR4: Scheduled Execution:** The entire aggregation process must run automatically on a recurring schedule. The initial schedule will be set to **every 6 hours**.
- **FR5: Intelligent Data Synchronization:** The service must intelligently sync data with our Supabase database:
  - **Create:** If an event from a source API does not exist in our database, it must be created.
  - **Update:** If an event already exists (identified by a unique ID from the source platform), its details (time, description, etc.) must be updated to reflect the latest information.
- **FR6: Robust Logging:** The service must produce clear, structured logs for each run, detailing:
  - The number of events fetched from each source.
  - The number of events created vs. updated.
  - Any errors encountered (e.g., API failures, data validation issues).

#### **Non-Functional Requirements (NFR)**

- **NFR1: Infrastructure:** The service **must** be deployed as a **Supabase Edge Function**.
- **NFR2: Security:** All third-party API keys, tokens, and other secrets must be stored securely as environment variables in the Supabase project, not hardcoded in the application.
- **NFR3: Scalability:** The architecture must be modular. Adding a new event source (e.g., a fourth API) should only require creating a new adapter file, with minimal changes to the core conductor logic.
- **NFR4: Performance:** A single run of the aggregator should complete within the execution limits of Supabase Edge Functions (currently 15 minutes).

### 4. Data Model: The Standard `Event` Object

All adapters must return an array of objects in the following standard format. This structure is designed to map directly to the `events` and related tables in our Supabase schema.

```javascript
{
  title: string,
  description: string,
  startTime: ISO_8601_string,
  endTime: ISO_8601_string,
  images: string[], // URLs for images to be stored in event_images
  location: {
    address: string,
    // other relevant location fields
  },
  organizerInfo: { // To be linked or stored in the 'organizers' table
    name: string,
    contact: string | null
  },
  ticketInfo: {
    purchaseUrl: string, // Direct link to the external purchase page
    price: string | null,
    currency: string | null
  },
  sourcePlatform: string, // e.g., "Eventbrite", "Meetup"
  sourceEventId: string, // The unique event ID from the source platform
  category: string // e.g., "Music", "Art", "Sports"
}
```