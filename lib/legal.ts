/** Shared studio terms + house rules. Used by the booking terms accordion,
 *  /studio/info and /terms so the wording never drifts. */

export const STUDIO_TERMS: { title: string; body: string }[] = [
  {
    title: "Booking & payment",
    body: "Sessions are booked online and confirmed by email. Payment is taken in person at the start of your session (card or cash) unless we've arranged otherwise. The price shown covers the whole room — groups of five or more add a small flat surcharge ($20+GST on a 1-hour session, $30+GST on 2 hours), shown before you confirm.",
  },
  {
    title: "First booking & ID",
    body: "You must be 16 or over to book. Your first session needs a quick photo ID check on arrival (driver licence, passport or similar) — it's about knowing who's using the gear, not your age. Once you're verified, future bookings confirm instantly.",
  },
  {
    title: "Cancellations & changes",
    body: "Plans change — just give us 24 hours' notice to cancel or move a session free of charge. Inside 24 hours we may charge for the booked time, since the room sat empty. Email studio@unit20.nz to make a change.",
  },
  {
    title: "Running late & overruns",
    body: "We hold a 15-minute buffer between sessions, so a few minutes late is fine. If you want to run on and the room's free, square it up on the night. Please leave on time out of respect for the next booking.",
  },
  {
    title: "The gear & the space",
    body: "Treat the kit like it's yours and it'll be there next time. No drinks on the decks, no smoking or vaping inside. Bring your own USBs and headphones. Tell us about any damage — honest accidents happen, hiding them doesn't.",
  },
  {
    title: "Liability",
    body: "Use the equipment sensibly and at your own risk. You're responsible for any deliberate or negligent damage to gear or the space during your session. We keep everything serviced and safe; if something isn't right, stop and let us know.",
  },
];

export const HOUSE_RULES: string[] = [
  "16+ only. Photo ID on your first visit.",
  "No smoking or vaping inside.",
  "Keep drinks away from the decks.",
  "Bring your own USBs and headphones.",
  "Leave on time for the next booking.",
  "Look after the gear and the room.",
];

export const BEFORE_YOU_COME: { title: string; body: string }[] = [
  {
    title: "Getting in",
    body: "We're at 20 Southwark Street in the central city. Come to the roller door on the street and buzz — someone will let you in for your session. Arrive a couple of minutes early for your first visit so we can run the quick ID check.",
  },
  {
    title: "What to bring",
    body: "A USB or two with your tunes (FAT32 or exFAT formatted), your own headphones, and ID if it's your first time. That's it — decks, mixer and monitoring are all set up and ready.",
  },
  {
    title: "Who can come",
    body: "The room takes up to 8 people, and everyone in the room counts. Groups of 5 or more add a flat surcharge — $20+GST on a 1-hour session, $30+GST on 2 hours — added automatically when you book. It's a practice space, not a party venue, so keep numbers to what you booked.",
  },
  {
    title: "Sound & hours",
    body: "We run 10am til midnight. It's a proper booth so you can push the monitors, but we're good neighbours — late sessions keep it sensible. Weekday daytime (Mon–Fri, 10am–4pm) is the quietest time to really dig in — and 2 hours then is just $60+GST.",
  },
];
