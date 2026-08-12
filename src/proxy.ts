import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return NextResponse.next({ request });

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data } = await supabase.auth.getClaims();
  const publicPaths = ["/join", "/sign-in", "/auth/set-password", "/auth/confirm", "/api/invitations", "/s/"];
  const isPublic = publicPaths.some((path) => request.nextUrl.pathname.startsWith(path));
  if (!data?.claims && !isPublic) {
    const signIn = request.nextUrl.clone();
    signIn.pathname = "/sign-in";
    signIn.search = "";
    return NextResponse.redirect(signIn);
  }
  if (data?.claims && ["/join", "/sign-in"].includes(request.nextUrl.pathname)) {
    const closet = request.nextUrl.clone();
    closet.pathname = "/";
    closet.search = "";
    return NextResponse.redirect(closet);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
