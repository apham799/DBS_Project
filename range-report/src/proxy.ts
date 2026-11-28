import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { placeById } from "@/data/places";
import { isAddedId } from "@/lib/added-places";

// Clerk reads the session on every request. Pages are open; the data is protected
// where it lives, by row-level security in Supabase: no signed-in token, no rows.
//
// Unknown places get a real 404 here, before rendering. Places golfers asked
// for (added-…) live in the database, so their pages decide for themselves. The place page calls
// notFound() too, but inside <Suspense> (so the page shell streams instantly),
// and by then a 200 status has already been sent.
export default clerkMiddleware((_auth, req) => {
  const match = req.nextUrl.pathname.match(/^\/places\/([^/]+)(?:\/report)?\/?$/);
  const id = match && decodeURIComponent(match[1]);
  if (id && !placeById(id) && !isAddedId(id)) {
    // A path with no route renders the app's not-found page, with status 404.
    return NextResponse.rewrite(new URL("/_unknown-place", req.url));
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
