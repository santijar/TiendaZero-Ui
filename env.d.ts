/// <reference types="vite/client" />

interface ImportMetaEnv {
  // The platform admin's host (platform.localhost in development). Unset means this build has no platform tool.
  readonly VITE_PLATFORM_HOST?: string
}
