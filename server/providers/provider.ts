import type { Journey, JourneyInput } from '../../shared/contracts.js';

// This boundary runs only in the Node backend. Never import providers into src/.
export interface RecommendationProvider {
  createJourney(input: JourneyInput): Promise<Journey>;
}
export class ProviderUnavailableError extends Error {}
