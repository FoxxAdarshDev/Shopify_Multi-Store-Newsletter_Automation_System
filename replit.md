# Newsletter Manager Dashboard

## Overview

A full-stack newsletter management dashboard specifically designed for Shopify stores. The application enables businesses to create and deploy customizable newsletter popup campaigns, manage subscribers, and integrate with Shopify for discount code distribution. Built with a modern tech stack featuring React frontend, Express backend, PostgreSQL database, and comprehensive email automation.

**Status**: Fully operational in Replit environment with resolved session suppression and optimized API polling.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

**September 12, 2025**
- ✅ **Fixed Critical Session Suppression Bug**: Resolved race condition where `backgroundCleanupCheck()` was incorrectly clearing sessionStorage that should prevent popups from showing during the same browsing session. Users can now close popups and navigate between pages on the same domain without popups reappearing.
- ✅ **Eliminated Excessive API Polling**: Removed aggressive React Query polling intervals (10-15 seconds) that were causing redundant HEAD /api calls. Polling removed from subscribers page and integration verification.
- ✅ **Optimized Client-Side Performance**: Fixed temporal dead zone errors and improved popup script reliability.
- ✅ **Configured Replit Environment**: Set up proper workflow configuration with webview output on port 5000 and deployment settings for autoscale.
- ✅ **Fixed Shopify Token Encryption**: Resolved "crypto2.createCipher is not a function" error by updating deprecated crypto methods to modern `createCipheriv`/`createDecipheriv` with proper IV usage and key management.
- ✅ **Fixed Exit Intent Popup Logic**: Corrected exit intent functionality to work when display trigger is set to "exit-intent" and when "Show popup on exit intent if user didn't subscribe initially" feature is enabled. Exit intent now properly detects mouse movement towards browser UI and triggers popup on user exit attempts.

## Brand Guidelines

**Foxx Bioprocess Internal Tools**
- Primary Brand Color: #0071b9 (Blue)
- Secondary Brand Color: #00c68c (Green)
- Logo: Foxx Bioprocess with tagline
- Application Title: "Foxx Internal Tools - Newsletter Management Dashboard"

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript for type safety
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack Query for server state management and caching
- **UI Components**: Radix UI primitives with custom Shadcn/ui components
- **Styling**: Tailwind CSS with CSS custom properties for theming
- **Build Tool**: Vite for fast development and optimized builds

The frontend follows a page-based architecture with dedicated routes for dashboard, store management, popup builder, subscribers, integration, and settings. Components are organized into reusable UI primitives and feature-specific modules.

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ESM modules
- **Database Layer**: Drizzle ORM for type-safe database operations
- **API Design**: RESTful API endpoints with consistent error handling
- **File Structure**: Modular service-based architecture separating concerns

The backend implements a service layer pattern with dedicated services for email handling, Shopify integration, and popup script generation. All database operations are abstracted through a storage interface for maintainability.

### Database Schema
- **Primary Tables**: users, stores, popup_configs, subscribers, email_settings
- **Relationships**: Foreign key constraints ensuring data integrity
- **Features**: UUID primary keys, automatic timestamps, JSONB for flexible configuration storage
- **Migration Strategy**: Drizzle Kit for schema management and migrations

The schema supports multi-tenant architecture where users can manage multiple Shopify stores, each with customizable popup configurations and subscriber lists.

### Authentication & Authorization
- Session-based authentication using Express sessions
- PostgreSQL session store for persistence
- User-scoped data access with foreign key relationships
- Demo user implementation for development/testing

## External Dependencies

### Database & Infrastructure
- **Render PostgreSQL**: Production PostgreSQL database with SSL connection
- **Session Storage**: PostgreSQL-backed session management via connect-pg-simple

### Third-Party Integrations
- **Shopify API**: Store verification and discount code validation using REST Admin API
- **Email Service**: Nodemailer with SMTP configuration for transactional emails
- **Frontend Services**: Replit-specific development tools and error handling

### Development & Deployment
- **Package Manager**: npm with lock file for reproducible builds
- **Development Server**: Vite dev server with Express API proxy
- **Production Build**: esbuild for backend bundling, Vite for frontend optimization
- **Environment**: Node.js ESM with development/production configuration switching

### UI & Styling Dependencies
- **Component Library**: Comprehensive Radix UI primitive collection
- **Styling**: Tailwind CSS with PostCSS processing
- **Icons**: Lucide React icon library
- **Animations**: Class Variance Authority for component variants
- **Form Handling**: React Hook Form with Zod validation schemas

The application is designed for deployment on platforms supporting Node.js with PostgreSQL, with environment-based configuration for database connections and external service integrations.

## Database Management

### Adding New Database Fields

When adding new fields to existing database tables, follow this process:

#### 1. Update Schema Definition
First, update the table schema in `shared/schema.ts`:
```typescript
export const popupConfigs = pgTable("popup_configs", {
  // existing fields...
  newField: boolean("new_field_name").default(false).notNull(),
});
```

#### 2. Database Migration Approaches

**Primary Method: Drizzle Kit Push**
```bash
npm run db:push --force
```
- Configured in `drizzle.config.ts` with SSL settings for Replit PostgreSQL
- May fail with SSL/TLS connection issues in some environments

**Fallback Method: Direct SQL Approach**
If `npm run db:push` fails, use direct SQL through existing database connection:

```javascript
// Create temporary script using existing db connection
import { db } from './server/db.ts';
import { sql } from 'drizzle-orm';

await db.execute(sql`
  ALTER TABLE table_name 
  ADD COLUMN new_field_name BOOLEAN DEFAULT false NOT NULL
`);
```

**Why Other Approaches Fail:**
- External psql/SQL tools fail due to SSL/TLS requirements
- Drizzle Kit may have connection issues with Replit's PostgreSQL setup
- Direct database connection through app's existing connection works reliably

#### 3. Handle Missing Columns Gracefully

Update storage layer to handle missing columns during transition:
```typescript
async getConfig() {
  try {
    return await db.select().from(table);
  } catch (error) {
    if (error.message.includes('column does not exist')) {
      // Use fallback query with default values
      return await db.execute(sql`
        SELECT *, false as new_field FROM table
      `);
    }
    throw error;
  }
}
```

#### 4. Verification Process
1. Check current table structure
2. Add the missing column  
3. Verify column exists in database
4. Test application with new field
5. Remove fallback code once confirmed working

This approach ensures zero-downtime database updates and maintains application stability during schema changes.