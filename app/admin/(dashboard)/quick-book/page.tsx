import { quickBook } from "@/app/admin/actions";

export const dynamic = "force-dynamic";

export default function QuickBookPage() {
  return (
    <div className="p-5 md:p-10">
      <h1 className="h2 text-text">Quick book</h1>
      <p className="lead mt-2 max-w-lg">
        Walk-in or phone booking. Creates the customer (auto-verified) and a
        confirmed session in one go. Payment defaults to in person.
      </p>

      <form action={quickBook} className="mt-8 grid max-w-2xl gap-6 sm:grid-cols-2">
        <Field label="Name" name="name" placeholder="Walk-in" />
        <Field label="Email (optional)" name="email" type="email" placeholder="for the confirmation" />
        <Field label="Phone (optional)" name="phone" type="tel" />
        <Field label="Start" name="start" type="datetime-local" required />

        <div>
          <label htmlFor="durationHours" className="font-mono text-meta uppercase tracking-meta text-text-muted">
            Duration (hours)
          </label>
          <input
            id="durationHours"
            name="durationHours"
            type="number"
            min={1}
            max={8}
            defaultValue={1}
            className="input mt-2"
          />
        </div>

        <div>
          <label htmlFor="groupSize" className="font-mono text-meta uppercase tracking-meta text-text-muted">
            People (5+ auto-adds the group surcharge)
          </label>
          <input id="groupSize" name="groupSize" type="number" min={1} max={10} defaultValue={1} className="input mt-2" />
        </div>

        <div className="flex flex-col justify-end gap-3">
          <label className="flex cursor-pointer items-center gap-3 text-sm text-text">
            <input type="checkbox" name="markPaid" className="h-5 w-5 accent-accent" />
            Mark as paid
          </label>
          <label className="flex cursor-pointer items-center gap-3 text-sm text-text">
            <input type="checkbox" name="sendEmail" className="h-5 w-5 accent-accent" />
            Email the customer (needs email)
          </label>
        </div>

        <div className="sm:col-span-2">
          <button type="submit" className="btn btn-primary">
            Create booking
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  placeholder,
  required,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label htmlFor={name} className="font-mono text-meta uppercase tracking-meta text-text-muted">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        className="input mt-2 [color-scheme:dark]"
      />
    </div>
  );
}
