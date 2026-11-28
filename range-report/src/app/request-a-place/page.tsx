import type { Metadata } from "next";
import { RequestPlaceForm } from "@/components/request-place-form";

export const metadata: Metadata = { title: "Request a place" };

export default function Page() {
  return <RequestPlaceForm />;
}
