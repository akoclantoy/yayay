export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { ensureDemoUsers } = await import("@/lib/bootstrap-users");
    await ensureDemoUsers().catch((error) => {
      console.error("[bootstrap-users]", error);
    });
  }
}
