import type { Metadata } from "next";
import { LogView } from "@/components/log-view";

export const metadata: Metadata = { title: "My log" };

export default function Page() {
  return <LogView />;
}
