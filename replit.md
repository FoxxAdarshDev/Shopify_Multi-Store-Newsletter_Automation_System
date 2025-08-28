# Newsletter Manager Dashboard

## Overview

A full-stack newsletter management dashboard specifically designed for Shopify stores. The application enables businesses to create and deploy customizable newsletter popup campaigns, manage subscribers, and integrate with Shopify for discount code distribution. Built with a modern tech stack featuring React frontend, Express backend, PostgreSQL database, and comprehensive email automation.

## User Preferences

Preferred communication style: Simple, everyday language.

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
- **Neon Database**: Serverless PostgreSQL with connection pooling
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