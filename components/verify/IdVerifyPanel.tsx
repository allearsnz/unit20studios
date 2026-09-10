"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Check, Loader2, Mail } from "lucide-react";
import { IdUploadForm } from "./IdUploadForm";
import { ON_PAGE_GRACE_MS, clearIdToken, readIdToken } from "@/lib/id-handoff";

/**
 * The ID check, asked for at the only moment we know the customer is present:
 * the second their booking lands.
 *
 * The old flow emailed a link and hoped. It's the last step of a booking, so it
 * arrives when someone has already put their phone down — and a link that isn't
 * used doesn't just sit there, it eventually costs them the slot (the cleanup
 * cron releases unverified bookings). So the form is here, on the page they are
 * already looking at, with their licence still on the desk.
 *
 * The email hasn't gone anywhere; it's just been demoted to a fallback, and
 * this component is what asks for it:
 *
 *   - five minutes on this page without finishing, or
 *   - the tab goes away first.
 *
 * Both hit the same idempotent endpoint with the token already in hand, so the
 * link that arrives is the same one this form is using. Somebody who leaves the
 * page open and comes back to it half an hour later still finds a working form.
 *
 * None of that is load-bearing on its own — browsers get killed, JS gets
 * blocked, phones sleep. `sweepUnsentIdLinks()` on the server is the guarantee;
 * this is just the part that makes it prompt.
 */

/** Don't treat a React remount (or StrictMode's double-invoke in dev) as the
 *  customer walking away. */
const LEFT_THE_PAGE_AFTER_MS = 10_000;

/** The token is written once, before this page ever renders, and only this
 *  component clears it — so there is nothing to subscribe to. */
const subscribeNever = () => () => {};

type Props = {
  friendlyId: string;
  /** True when a link has already been emailed — changes the fallback copy from
   *  "we'll send you one" to "check your inbox". */
  alreadyEmailed: boolean;
};

export function IdVerifyPanel({ friendlyId, alreadyEmailed }: Props) {
  const [uploaded, setUploaded] = useState(false);
  const [emailState, setEmailState] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  const [cleared, setCleared] = useState(false);
  const [linkDied, setLinkDied] = useState(false);
  const [recovery, setRecovery] = useState<"sending" | "sent" | "failed">("sending");

  // sessionStorage is browser-only, so the server and the hydrating client both
  // have to render as though there's no token — `undefined` is that third
  // state, and it renders nothing rather than flashing the "we'll email you"
  // fallback at someone who's about to be handed a form. Read through
  // `useSyncExternalStore` rather than an effect so there's no extra render
  // pass and no hydration mismatch to paper over.
  const stored = useSyncExternalStore(
    subscribeNever,
    () => readIdToken(friendlyId),
    () => undefined,
  );
  const token = cleared ? null : stored;

  const sentRef = useRef(false);
  const mountedAtRef = useRef(0);
  const uploadedRef = useRef(false);
  const deadRef = useRef(false);

  /** Ask for the email. At most once per page — the timer, the beacon and the
   *  button all funnel through here. */
  const askForEmail = useCallback(
    (leaving: boolean) => {
      if (!token || sentRef.current || uploadedRef.current || deadRef.current) return;
      sentRef.current = true;
      const url = `/api/verify-id/${encodeURIComponent(token)}/send`;
      if (leaving) {
        // The page is going. `sendBeacon` is the only thing that reliably
        // survives it; there's no response to read and nothing to do with one.
        try {
          navigator.sendBeacon(url);
        } catch {
          // Nothing to fall back to at this point — the server sweep has it.
        }
        return;
      }
      setEmailState("sending");
      fetch(url, { method: "POST", keepalive: true })
        .then((r) => setEmailState(r.ok ? "sent" : "failed"))
        .catch(() => {
          sentRef.current = false;
          setEmailState("failed");
        });
    },
    [token],
  );

  useEffect(() => {
    if (!token || uploaded) return;
    mountedAtRef.current = Date.now();
    const armedAt = mountedAtRef.current;

    const timer = window.setTimeout(() => askForEmail(false), ON_PAGE_GRACE_MS);

    const onPageHide = () => askForEmail(true);
    const onVisibility = () => {
      // Backgrounded tabs get their timers throttled to nothing, so check the
      // clock rather than trusting the timeout. Switching away briefly — to the
      // camera roll, mid-upload — is not leaving, so the grace period still has
      // to have run out.
      if (document.visibilityState === "hidden" && Date.now() - armedAt >= ON_PAGE_GRACE_MS) {
        askForEmail(true);
      }
    };

    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibility);
      // Navigated off within the site: same thing as closing the tab, as long
      // as they were actually here long enough for it to have been a decision.
      if (Date.now() - armedAt >= LEFT_THE_PAGE_AFTER_MS) askForEmail(true);
    };
  }, [token, uploaded, askForEmail]);

  const onUploaded = useCallback(() => {
    uploadedRef.current = true;
    setUploaded(true);
    // Done with it — no reason to leave a live upload token in the tab.
    clearIdToken(friendlyId);
    setCleared(true);
  }, [friendlyId]);

  /**
   * The server says the token in this tab is gone — replaced by a newer one, or
   * expired.
   *
   * Retrying can't fix that, and leaving it in `sessionStorage` means every
   * reload of this page rebuilds the same form over the same dead token: the
   * customer sees an upload form, uses it, gets an error, tries again, and gets
   * the same error forever. Bin it and fall through to the email path, which
   * mints a fresh link against the booking reference.
   */
  const onTokenDead = useCallback(() => {
    deadRef.current = true;
    clearIdToken(friendlyId);
    setCleared(true);
    setLinkDied(true);
    // Ask for the replacement here and now rather than leaving a button for
    // someone who has just been told their upload didn't work. This runs from
    // an event handler — the upload's own response — so there's no effect and
    // no extra render pass involved.
    setRecovery("sending");
    fetch(`/api/bookings/${encodeURIComponent(friendlyId)}/id-link`, { method: "POST" })
      .then((r) => setRecovery(r.ok ? "sent" : "failed"))
      .catch(() => setRecovery("failed"));
  }, [friendlyId]);

  if (uploaded) {
    return (
      <div className="mt-10 border border-accent/40 bg-accent/[0.06] p-7">
        <div className="flex items-start gap-4">
          <Check className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden />
          <div>
            <h2 className="font-display text-h3 font-semibold text-text">
              ID received — that&apos;s everything.
            </h2>
            <p className="lead mt-2 text-sm">
              We&apos;ll check it over and email your confirmation shortly.
              Nothing else to do.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Still hydrating — we don't know yet whether this tab has the token.
  if (token === undefined) return null;

  // The token this tab was holding has been retired — an admin resent the link,
  // or the server sweep posted one. Retrying the form can only fail the same
  // way, so say what happened and put the replacement in their inbox.
  if (linkDied) {
    return (
      <div className="mt-10 border border-border bg-bg-elev p-7">
        <p className="eyebrow mb-3">Last step · ID check</p>
        <h2 className="font-display text-h3 font-semibold text-text">
          That upload link had already been replaced.
        </h2>
        <p className="lead mt-3 text-sm">
          Your booking is fine and nothing you did caused it — a newer link had
          been issued, and issuing one retires the last. The newest is always
          the one that works.
        </p>
        {recovery === "sent" ? (
          <p className="mt-6 flex items-center gap-2 text-sm text-text-muted">
            <Check className="h-4 w-4 shrink-0 text-accent" aria-hidden />
            We&apos;ve emailed you a fresh one — open that and the same form
            will be waiting.
          </p>
        ) : recovery === "sending" ? (
          <p className="mt-6 flex items-center gap-2 text-sm text-text-muted">
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
            Emailing you a fresh one…
          </p>
        ) : (
          <>
            <p className="mt-6 text-sm text-danger">
              We couldn&apos;t send the replacement just then.
            </p>
            <ResendButton friendlyId={friendlyId} label="Email me a fresh link" />
          </>
        )}
      </div>
    );
  }

  // No token in this tab — they've come back to the page later, or from the
  // email. The form can't be offered here, so offer the link instead.
  if (!token) {
    return (
      <div className="mt-10 border border-border bg-bg-elev p-7">
        <p className="eyebrow mb-3">Last step · ID check</p>
        <h2 className="font-display text-h3 font-semibold text-text">
          Send us your ID and you&apos;re booked.
        </h2>
        <p className="lead mt-3 text-sm">
          {alreadyEmailed
            ? "We've emailed you a one-off upload link — check your inbox (and your spam folder). It takes a minute: a photo of your driver licence or passport."
            : "We're sending you a one-off upload link now. It takes a minute: a photo of your driver licence or passport."}
        </p>
        <ResendButton
          friendlyId={friendlyId}
          label={alreadyEmailed ? "Send the link again" : "Email me the link"}
        />
      </div>
    );
  }

  return (
    <div className="mt-10 border border-accent/40 bg-accent/[0.04] p-7">
      <p className="eyebrow mb-3">Last step · ID check</p>
      <h2 className="font-display text-h3 font-semibold text-text">
        Do it now and you&apos;re done.
      </h2>
      <p className="lead mt-3 text-sm">
        A one-off check before your first session — a clear phone photo of the{" "}
        <strong className="text-text">front and back</strong> of your driver
        licence, or the photo page of your passport. It takes a minute, and it
        never has to happen again.
      </p>

      <IdUploadForm token={token} onSubmitted={onUploaded} onTokenDead={onTokenDead} />

      <div className="mt-8 border-t border-border pt-6">
        {emailState === "sent" ? (
          <p className="flex items-center gap-2 text-sm text-text-muted">
            <Mail className="h-4 w-4 shrink-0 text-accent" aria-hidden />
            Sent — the link&apos;s in your inbox. This form still works too.
          </p>
        ) : (
          <>
            <p className="text-sm text-text-muted">
              Haven&apos;t got your ID to hand? We&apos;ll email you the link in
              a few minutes if you don&apos;t finish here — or ask for it now.
            </p>
            <button
              type="button"
              onClick={() => askForEmail(false)}
              disabled={emailState === "sending"}
              className="btn btn-secondary mt-4"
            >
              {emailState === "sending" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Sending…
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4" aria-hidden />
                  Email me the link instead
                </>
              )}
            </button>
            {emailState === "failed" ? (
              <p className="mt-3 text-sm text-danger">
                That didn&apos;t send — you can still upload here, or email
                studio@unit20.nz.
              </p>
            ) : null}
          </>
        )}
      </div>

      <p className="mt-8 border-t border-border pt-6 text-sm text-text-muted">
        Your documents are stored privately, are only ever seen by us, and are
        deleted as soon as your ID is approved. We use them for the age and
        identity check and nothing else.
      </p>
    </div>
  );
}

function ResendButton({ friendlyId, label }: { friendlyId: string; label: string }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "failed">("idle");

  const send = async () => {
    setState("sending");
    try {
      const res = await fetch(`/api/bookings/${encodeURIComponent(friendlyId)}/id-link`, {
        method: "POST",
      });
      setState(res.ok ? "sent" : "failed");
    } catch {
      setState("failed");
    }
  };

  if (state === "sent") {
    return (
      <p className="mt-6 flex items-center gap-2 text-sm text-text-muted">
        <Check className="h-4 w-4 shrink-0 text-accent" aria-hidden />
        On its way — check your inbox. The newest link is the one that works.
      </p>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={send}
        disabled={state === "sending"}
        className="btn btn-secondary mt-6"
      >
        {state === "sending" ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Sending…
          </>
        ) : (
          <>
            <Mail className="h-4 w-4" aria-hidden />
            {label}
          </>
        )}
      </button>
      {state === "failed" ? (
        <p className="mt-3 text-sm text-danger">
          That didn&apos;t send. Email studio@unit20.nz and we&apos;ll sort it.
        </p>
      ) : null}
    </>
  );
}
