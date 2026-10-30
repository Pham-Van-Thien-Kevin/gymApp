"use client";
// Client Component: zodra je de meldingen bekeken hebt, markeren we ze als
// gelezen (na het tonen, zodat je eerst nog ziet welke nieuw waren).
import { useEffect } from "react";
import { markAllNotificationsRead } from "./actions";

export function MarkAllRead() {
  useEffect(() => {
    void markAllNotificationsRead();
  }, []);
  return null;
}
