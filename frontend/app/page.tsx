import type { Metadata } from "next";
import { LandingPage } from "@/app/components/landing/LandingPage";

export const metadata: Metadata = {
  title: "Incident management for engineering teams",
  description:
    "IncidentFlow helps engineering teams declare production incidents, move them through an enforced lifecycle, and keep an audit trail for post-mortems.",
};

export default function HomePage() {
  return <LandingPage />;
}
