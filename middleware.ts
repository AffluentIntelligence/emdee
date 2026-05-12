import { clerkMiddleware } from "@clerk/nextjs/server";

// All routes are publicly accessible — auth is enforced per-operation in route handlers.
// clerkMiddleware() still populates auth() / useUser() for routes that need it.
export default clerkMiddleware();

export const config = {
  matcher: ["/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)", "/(api|trpc)(.*)"],
};
