/**
 * Centralized constants for Phase 1 single-tenant deployment.
 * Phase 2 will resolve these dynamically from auth context / studio settings.
 */

/**
 * Default studio ID for Phase 1 single-tenant deployment.
 * Phase 2 will resolve this dynamically from auth context.
 */
export const DEFAULT_STUDIO_ID = '11111111-1111-1111-1111-111111111111'

/**
 * Studio website URL — used in email templates and links.
 * Override via NEXT_PUBLIC_STUDIO_URL env var for other deployments.
 */
export const STUDIO_URL = process.env.NEXT_PUBLIC_STUDIO_URL || 'https://thesaunaguys.com'

/**
 * Glofox namespace identifier for API calls.
 * Override via GLOFOX_NAMESPACE env var for other studios.
 */
export const GLOFOX_NAMESPACE = process.env.GLOFOX_NAMESPACE || 'thesaunaguys'

/**
 * Default from address for shipping labels (EasyPost).
 * Override individual fields via STUDIO_SHIP_* env vars.
 */
export const STUDIO_SHIP_FROM = {
  name: process.env.STUDIO_SHIP_NAME || 'The Sauna Guys',
  street1: process.env.STUDIO_SHIP_STREET1 || '123 Main St',
  city: process.env.STUDIO_SHIP_CITY || 'Tampa',
  state: process.env.STUDIO_SHIP_STATE || 'FL',
  zip: process.env.STUDIO_SHIP_ZIP || '33601',
  country: process.env.STUDIO_SHIP_COUNTRY || 'US',
}
