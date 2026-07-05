// Test-only stand-in for the "server-only" package.
//
// The real package unconditionally throws when its default export is
// resolved, relying on bundlers to swap in an empty module via the
// "react-server" package.json export condition during a real Next.js build.
// Vitest runs in plain Node, so it always resolves "default" and would throw
// on every import of a file that starts with `import "server-only"`. This
// stub is aliased in vitest.config.ts so those imports become a no-op,
// matching how Next.js itself neutralizes the guard in a server context.
export {};
