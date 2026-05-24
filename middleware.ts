import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  const session = await auth();

  const adminRoutes = ["/admin"];
  const dashboardRoutes = ["/dashboard"];
  const fieldRoutes = ["/field"];
  
  const isAdminRoute = adminRoutes.some((route) =>
    request.nextUrl.pathname.startsWith(route)
  );
  const isDashboardRoute = dashboardRoutes.some((route) =>
    request.nextUrl.pathname.startsWith(route)
  );
  const isFieldRoute = fieldRoutes.some((route) =>
    request.nextUrl.pathname.startsWith(route)
  );

  const userRole = (session?.user as any)?.role;

  // Redirect to login if not authenticated for protected routes
  if ((isAdminRoute || isDashboardRoute || isFieldRoute) && !session?.user?.id) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Block FIELD_TECH from /admin and /dashboard
  if ((isAdminRoute || isDashboardRoute) && userRole === "FIELD_TECH") {
    return NextResponse.redirect(new URL("/field/dashboard", request.url));
  }

  // Protect /field/* - allow FIELD_TECH and ADMIN (for preview), block REALTOR and TC
  if (isFieldRoute) {
    if (!userRole || (userRole !== "FIELD_TECH" && userRole !== "ADMIN")) {
      // Block REALTOR, TC, and any other role from /field/*
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  // Admin route protection - only ADMIN role allowed
  if (isAdminRoute && userRole && userRole !== "ADMIN") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/field/:path*"],
};
