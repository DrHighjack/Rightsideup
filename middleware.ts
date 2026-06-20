import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { authLimiter, registerLimiter, couponLimiter, apiLimiter, getIdentifier } from "@/lib/ratelimit";

export async function middleware(request: NextRequest) {
  const session = await auth();
  const pathname = request.nextUrl.pathname;
  const ip = request.ip || request.headers.get("x-forwarded-for") || "unknown";
  const userId = (session?.user as any)?.id;

  // Apply rate limiting to API routes
  if (pathname.startsWith("/api/")) {
    // Auth/Login endpoint - 5 per 15 minutes per IP
    if (pathname.includes("/api/auth/callback/credentials")) {
      try {
        const identifier = getIdentifier(ip);
        const { success } = await authLimiter.limit(identifier);
        if (!success) {
          return NextResponse.json(
            { error: "Too many requests, please try again later" },
            { status: 429 }
          );
        }
      } catch (error) {
        console.error("Auth rate limiter error:", error);
        // Allow request if rate limiter fails
      }
    }

    // Register endpoint - 3 per hour per IP
    if (pathname === "/api/auth/register") {
      try {
        const identifier = getIdentifier(ip);
        const { success } = await registerLimiter.limit(identifier);
        if (!success) {
          return NextResponse.json(
            { error: "Too many requests, please try again later" },
            { status: 429 }
          );
        }
      } catch (error) {
        console.error("Register rate limiter error:", error);
      }
    }

    // Coupon endpoints - 10 per hour per user
    if (pathname.includes("/api/coupons")) {
      if (userId) {
        try {
          const identifier = getIdentifier(undefined, userId);
          const { success } = await couponLimiter.limit(identifier);
          if (!success) {
            return NextResponse.json(
              { error: "Too many requests, please try again later" },
              { status: 429 }
            );
          }
        } catch (error) {
          console.error("Coupon rate limiter error:", error);
        }
      }
    }

    // General API endpoints - 100 per minute per user (if authenticated)
    if (userId && !pathname.includes("/api/auth")) {
      try {
        const identifier = getIdentifier(undefined, userId);
        const { success } = await apiLimiter.limit(identifier);
        if (!success) {
          return NextResponse.json(
            { error: "Too many requests, please try again later" },
            { status: 429 }
          );
        }
      } catch (error) {
        console.error("API rate limiter error:", error);
      }
    }
  }

  // Page route protection (original logic)
  const adminRoutes = ["/admin"];
  const dashboardRoutes = ["/dashboard"];
  const brokerageRoutes = ["/brokerage"];
  const fieldRoutes = ["/field"];
  
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

  const userRole = (session?.user as any)?.role;

  // Redirect to login if not authenticated for protected routes
  if ((isAdminRoute || isDashboardRoute || isBrokerageRoute || isFieldRoute) && !session?.user?.id) {
    return NextResponse.redirect(new URL("/login", request.url));
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
  matcher: ["/dashboard/:path*", "/admin/:path*", "/brokerage/:path*", "/field/:path*", "/api/:path*"],
};
