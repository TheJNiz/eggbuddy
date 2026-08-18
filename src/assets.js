// Public-dir assets referenced from JS aren't rewritten by the bundler, so they
// need BASE_URL prepended by hand to survive being served from a subpath.
export const asset = (path) => `${import.meta.env.BASE_URL}${path}`
