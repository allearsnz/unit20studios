export const HIRE_EMAIL = "hello@allears.nz";
export const HIRE_PHONE_DISPLAY = "021 178 0355";
export const HIRE_PHONE_TEL = "+64211780355";

export function buildHireMailto(opts?: {
  product?: string;
  subject?: string;
}): string {
  const subject =
    opts?.subject ??
    (opts?.product ? `Hire enquiry: ${opts.product}` : "Hire enquiry");
  const bodyLines = [
    "Hi All Ears,",
    "",
    opts?.product
      ? `I'd like to enquire about hiring the ${opts.product}.`
      : "I'd like to enquire about hire.",
    "",
    "Dates needed:",
    "Delivery or pickup:",
    "Anything else:",
    "",
    "Thanks",
  ];
  const body = bodyLines.join("\n");
  return `mailto:${HIRE_EMAIL}?subject=${encodeURIComponent(
    subject,
  )}&body=${encodeURIComponent(body)}`;
}
