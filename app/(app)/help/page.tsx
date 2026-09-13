"use client";

import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { ChevronLeft, UserPlus, CalendarCheck, BellRing, Archive, ShieldCheck, FileText } from "lucide-react";

interface Section {
  icon: typeof UserPlus;
  title: string;
  body: string[];
}

const SECTIONS: Section[] = [
  {
    icon: UserPlus,
    title: "Adding a visitor",
    body: [
      "Tap \"Add new visitor\" from the Home tab whenever someone new comes along.",
      "Fill in their name and as much else as you know — email and phone are optional. Date first attended defaults to today.",
      "If you're not sure they're new, start typing their name — the app will show any close matches already on file so you don't create a duplicate.",
      "If someone's \"just visiting\" rather than a first-time attendee you'd follow up with, pick that as the reason — they'll be saved straight to Archived instead of starting the 3-week tracking.",
    ],
  },
  {
    icon: CalendarCheck,
    title: "Tracking their first 3 weeks",
    body: [
      "Open a visitor from the Active tab and tick off each week they attend, with an optional note.",
      "Once all 3 weeks are marked, the app shows a prompt asking whether to move them to Settled — this doesn't happen automatically, it always asks first.",
      "You can also tap \"Send notification\" on a visitor's page at any point to manually email the 3-week check-in to your ministry team, rather than waiting for the automatic overnight send.",
    ],
  },
  {
    icon: BellRing,
    title: "If someone stops attending",
    body: [
      "If an Active visitor hasn't attended in a while, their page shows a card asking if they should be archived — with a dropdown of common reasons (moved away, joined elsewhere, no longer responsive, etc).",
      "Choosing a reason and confirming moves them straight to Archived. If you're not ready to decide, \"Not yet\" dismisses the prompt for another week.",
    ],
  },
  {
    icon: FileText,
    title: "New submissions",
    body: [
      "Visitors can also register themselves via a public form (useful for a QR code at the welcome desk).",
      "These land in More → New submissions as \"pending\" until a welcomer reviews and confirms the details, at which point they become a normal tracked visitor.",
    ],
  },
  {
    icon: Archive,
    title: "Active, Settled and Archived",
    body: [
      "Active: still in their first 3 weeks of being tracked.",
      "Settled: completed the 3-week journey and confirmed as connected.",
      "Archived: no longer being tracked, with a reason recorded — moved away, joined another church, etc.",
      "You can filter the Home tab's summary by service (Swansea / Charlestown AM / Sunday@6) to see numbers for just one service at a time.",
    ],
  },
  {
    icon: ShieldCheck,
    title: "For admins: approving welcomers",
    body: [
      "When someone new signs up, they can log in but won't see any data until an admin approves them.",
      "Go to Admin & Settings → Users to approve or remove people, set their permission level (Welcomer or Admin), and link their login to a name on the Welcomers list.",
      "You'll also get an email whenever someone's waiting for approval, so you don't need to keep checking.",
    ],
  },
];

export default function HelpPage() {
  return (
    <div className="pb-24">
      <PageHeader
        title="How to use this app"
        subtitle="A quick guide for welcomers"
        action={
          <Link
            href="/more"
            className="w-11 h-11 rounded-button bg-white/10 flex items-center justify-center shrink-0"
          >
            <ChevronLeft className="w-5 h-5 text-secondary" />
          </Link>
        }
      />

      <div className="max-w-2xl mx-auto px-5 -mt-3 space-y-4">
        {SECTIONS.map((section) => (
          <div key={section.title} className="card p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-feature bg-primary flex items-center justify-center shrink-0">
                <section.icon className="w-4 h-4 text-secondary" strokeWidth={2} />
              </div>
              <h4 className="text-textPrimary">{section.title}</h4>
            </div>
            <div className="space-y-2">
              {section.body.map((line, i) => (
                <p key={i} className="text-body text-textSecondary">
                  {line}
                </p>
              ))}
            </div>
          </div>
        ))}

        <p className="text-small text-textSecondary text-center pt-2">
          Something not covered here? Ask whoever set up the app for you.
        </p>
      </div>
    </div>
  );
}