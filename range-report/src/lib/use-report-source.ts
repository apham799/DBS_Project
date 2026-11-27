"use client";

import { useSyncExternalStore } from "react";
import { isReportSource, type ReportSource } from "./report-source";

// The "Reports from" choice, remembered in this browser (localStorage) and
// shared by every component that reads it: change it on Home and a place page
// agrees, even in another tab. The server (and the first render) always says
// "everyone", so prerendered HTML never depends on someone's setting.

const KEY = "range-report:reports-from";
const EVENT = "range-report:reports-from-changed";

function read(): ReportSource {
  try {
    const v = localStorage.getItem(KEY);
    return isReportSource(v) ? v : "everyone";
  } catch {
    return "everyone";
  }
}

function subscribe(onChange: () => void) {
  const onStorage = (e: StorageEvent) => e.key === KEY && onChange();
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

export function setReportSource(source: ReportSource) {
  localStorage.setItem(KEY, source);
  window.dispatchEvent(new Event(EVENT));
}

export function useReportSource(): ReportSource {
  return useSyncExternalStore(subscribe, read, () => "everyone");
}
