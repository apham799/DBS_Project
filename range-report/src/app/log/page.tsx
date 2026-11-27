import type { Metadata } from "next";
import { LogView } from "@/components/log-view";

export const metadata: Metadata = { title: "My Log" };

export default function Page() {
  return <LogView />;
}
