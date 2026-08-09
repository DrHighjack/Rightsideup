import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function middleware(request: NextRequest) {
  const session = await auth();
  const pathname = request.nextUrl.pathname;
  const hasSessionToken = Boolean(session?.user?.id);

  // Page route protection (original logic)
  const adminRoutes = ["/admin"];
  const dashboardRoutes = ["/dashboard"];
  const brokerageRoutes = ["/brokerage"];
  const fieldRoutes = ["/field"];
  const tcRoutes = ["/tc"];
  
  const isAdminRoute = adminRoutes.some((route) =>
    pathname.startsWith(route)
  );
  const isDashboardRoute = dashboardRoutes.some((route) =>
    pathname.startsWith(route)
  );
  const isBrokerageRoute = brokerageRoutes.some((route) =>
    pathname.startsWith(route)
  );
  const isFieldRoute = fieldRoutes.some((route) =>
    pathname.startsWith(route)
  );
  const isTcRoute = tcRoutes.some((route) =>
    pathname === route || pathname.startsWith(`${route}/`)
  );

  const userRole = (session?.user as any)?.role;

  // Redirect to login if not authenticated for protected routes
  if ((isAdminRoute || isDashboardRoute || isBrokerageRoute || isFieldRoute || isTcRoute) && !hasSessionToken) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (isTcRoute && userRole !== "TC") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Block FIELD_TECH from /admin and /dashboard
  if ((isAdminRoute || isDashboardRoute || isBrokerageRoute) && userRole === "FIELD_TECH") {
    return NextResponse.redirect(new URL("/field/dashboard", request.url));
  }

  // Brokerage accounts can only access /brokerage and API routes.
  if ((isAdminRoute || isDashboardRoute || isFieldRoute) && userRole === "BROKERAGE") {
    return NextResponse.redirect(new URL("/brokerage", request.url));
  }

  // Protect /brokerage/* - BROKERAGE only.
  if (isBrokerageRoute && userRole && userRole !== "BROKERAGE") {
    if (userRole === "ADMIN" || userRole === "SALESMEN") {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
    if (userRole === "FIELD_TECH") {
      return NextResponse.redirect(new URL("/field/dashboard", request.url));
    }
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Protect /field/* - allow FIELD_TECH and ADMIN (for preview), block REALTOR and TC
  if (isFieldRoute) {
    if (!userRole || (userRole !== "FIELD_TECH" && userRole !== "ADMIN")) {
      // Block REALTOR, TC, and any other role from /field/*
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  // Admin route protection - ADMIN and SALESMEN allowed
  if (isAdminRoute && userRole && !["ADMIN", "SALESMEN"].includes(userRole)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/brokerage/:path*", "/field/:path*", "/tc/:path*"],
};
