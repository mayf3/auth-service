/**
 * @unified-auth/machine-token-provider
 *
 * Official auth-service Machine Token Provider V1.
 *
 * Exports:
 * - createMachineTokenProvider    Factory function
 * - MachineTokenProvider          Function type (Workflow SDK compatible)
 * - MachineTokenProviderConfig    Configuration interface
 * - MachineTokenError             Base error class
 * - ConfigurationError            Invalid configuration
 * - AuthenticationError           OAuth authentication failure
 * - RateLimitError                HTTP 429 rate limit
 * - ServiceError                  Transient network/server error
 * - InvalidTokenResponseError     Malformed token response
 */

export { createMachineTokenProvider } from './provider.js';
export type { MachineTokenProvider, MachineTokenProviderConfig } from './types.js';
export {
  MachineTokenError,
  ConfigurationError,
  AuthenticationError,
  RateLimitError,
  ServiceError,
  InvalidTokenResponseError,
} from './errors.js';
