import { NextRequest } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

// Proxy catch-all al backend. CRÍTICO: reenviar x-device-id en todos los
// métodos; sin él los productos se guardan sin dueño y el inventario sale vacío.
async function proxy(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const url = `${BACKEND_URL}/${path.join("/")}${req.nextUrl.search}`;

  const headers = new Headers();
  const deviceId = req.headers.get("x-device-id");
  if (deviceId) headers.set("x-device-id", deviceId);

  const contentType = req.headers.get("content-type") ?? "";
  let body: BodyInit | undefined;
  if (req.method !== "GET" && req.method !== "HEAD") {
    if (contentType.includes("multipart/form-data")) {
      // NO reenviar content-type: fetch regenera el boundary correcto solo.
      body = await req.formData();
    } else {
      headers.set("content-type", contentType || "application/json");
      body = await req.text();
    }
  }

  const res = await fetch(url, { method: req.method, headers, body });
  return new Response(await res.arrayBuffer(), {
    status: res.status,
    headers: { "content-type": res.headers.get("content-type") ?? "application/json" },
  });
}

export const GET = proxy;
export const POST = proxy;
export const DELETE = proxy;
export const PUT = proxy;
export const PATCH = proxy;
