/** Public app URL — works on Render without manual NEXTAUTH_URL if unset. */
export function getAppUrl() {
  return (
    process.env.NEXTAUTH_URL ??
    process.env.AUTH_URL ??
    process.env.RENDER_EXTERNAL_URL ??
    "http://localhost:3000"
  );
}
