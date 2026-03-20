/**
 * Inngest Functions Registry
 *
 * All Inngest functions exported as a flat array for the serve endpoint.
 * Import this in the API route handler.
 */
import { executeFlow } from './execute-flow';
import { evaluateTriggers } from './evaluate-triggers';

export const functions = [executeFlow, evaluateTriggers];
