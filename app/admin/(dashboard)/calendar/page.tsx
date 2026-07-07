import { CalendarClock } from "lucide-react";
import { site } from "@/lib/site";
import { CopyButton } from "@/components/admin/CopyButton";

export const dynamic = "force-dynamic";

export default function CalendarPage() {
  const token = process.env.CALENDAR_FEED_TOKEN;

  if (!token) {
    return (
      <div className="p-5 md:p-10">
        <h1 className="h2 text-text">Calendar</h1>
        <p className="lead mt-2 max-w-xl">
          Subscribe to a live feed of studio bookings from your own calendar.
        </p>
        <div className="card mt-8 max-w-xl border-danger/40 p-6">
          <h2 className="eyebrow mb-2 text-danger">Feed disabled</h2>
          <p className="text-sm text-text-muted">
            The calendar feed is turned off until a secret token is set. Add an
            environment variable named{" "}
            <code className="mono text-text">CALENDAR_FEED_TOKEN</code> in your
            Vercel project settings (Settings → Environment Variables) with a
            long, unguessable value, then redeploy. This token protects the feed
            since calendar apps can&apos;t send login details.
          </p>
        </div>
      </div>
    );
  }

  const httpsUrl = `${site.url}/api/calendar/feed?token=${encodeURIComponent(token)}`;
  const webcalUrl = httpsUrl.replace(/^https?:\/\//, "webcal://");

  return (
    <div className="p-5 md:p-10">
      <h1 className="h2 text-text">Calendar</h1>
      <p className="lead mt-2 max-w-xl">
        Subscribe to a live feed of confirmed and completed studio bookings from
        your own Google or Apple calendar. It refreshes automatically.
      </p>

      <section className="card mt-8 max-w-2xl p-6">
        <h2 className="eyebrow mb-1 flex items-center gap-2">
          <CalendarClock className="h-4 w-4" aria-hidden /> Subscribe URL
        </h2>
        <p className="mb-4 text-sm text-text-muted">
          Keep this URL private — anyone with it can see the booking feed.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            readOnly
            value={httpsUrl}
            className="input mono w-full text-xs sm:text-sm"
            aria-label="Calendar subscribe URL"
          />
          <CopyButton value={httpsUrl} />
        </div>
        <p className="mt-4 text-sm text-text-muted">
          On a Mac or iPhone you can open the feed directly:{" "}
          <a href={webcalUrl} className="text-accent underline underline-offset-4">
            add to Apple Calendar
          </a>
          .
        </p>
      </section>

      <div className="mt-8 grid max-w-2xl gap-6 md:grid-cols-2">
        <section className="card p-6">
          <h2 className="eyebrow mb-3">Google Calendar</h2>
          <ol className="list-decimal space-y-1.5 pl-5 text-sm text-text-muted">
            <li>Open Google Calendar on the web.</li>
            <li>
              In the left sidebar, next to <span className="text-text">Other calendars</span>,
              click <span className="text-text">+</span> → <span className="text-text">From URL</span>.
            </li>
            <li>Paste the subscribe URL above and click Add calendar.</li>
            <li>It appears under Other calendars and syncs automatically.</li>
          </ol>
        </section>

        <section className="card p-6">
          <h2 className="eyebrow mb-3">Apple Calendar</h2>
          <ol className="list-decimal space-y-1.5 pl-5 text-sm text-text-muted">
            <li>
              Use the <span className="text-text">add to Apple Calendar</span> link above, or:
            </li>
            <li>
              In the Calendar app, choose <span className="text-text">File → New Calendar Subscription</span>.
            </li>
            <li>Paste the subscribe URL and click Subscribe.</li>
            <li>Set the auto-refresh interval, then click OK.</li>
          </ol>
        </section>
      </div>
    </div>
  );
}
