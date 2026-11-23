export function requireWorkOSLauncher() {
  return Response.json(
    {
      error:
        "Open this installation through its authenticated WorkOS launcher.",
    },
    { status: 403, headers: { "cache-control": "no-store" } },
  );
}
