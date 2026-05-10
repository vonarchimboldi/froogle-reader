import { NextResponse } from "next/server";

const corsHeaders = {
  "Access-Control-Allow-Origin": process.env.API_ALLOWED_ORIGIN || "*",
  "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

export function apiJson(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      ...corsHeaders,
      ...init?.headers
    }
  });
}

export function handleOptions() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders
  });
}

export function unauthorized() {
  return apiJson({ error: "Please sign in to continue." }, { status: 401 });
}
