import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyAdmin } from "@/lib/email";
import { rateLimit } from "@/lib/rate-limit";
import { site } from "@/lib/site";
import {
  ID_BUCKET,
  MAX_UPLOAD_BYTES,
  type DocType,
  documentPath,
  removeStoredDocuments,
  resolveUploadMime,
  verificationByToken,
} from "@/lib/id-verification";

export const dynamic = "force-dynamic";

const DOC_TYPES: DocType[] = ["drivers_licence", "passport"];
const DOC_LABEL: Record<DocType, string> = {
  drivers_licence: "Driver licence",
  passport: "Passport",
};

type Checked = { mime: string } | { error: string };

/**
 * Size and type, resolved together.
 *
 * The type is worked out by `resolveUploadMime` rather than read straight off
 * `File.type`, because a real phone photo turns up unlabelled often enough to
 * have been a live fault: an empty or `application/octet-stream` type got the
 * customer "that file isn't a supported type" about a perfectly ordinary
 * licence photo, with nothing in the logs but a 422 and no way for them to fix
 * it. Whatever comes back is then used for the stored `contentType` too, so the
 * bucket's own `allowed_mime_types` sees the same answer this did.
 */
function checkFile(file: File | null, label: string): Checked {
  if (!file || file.size === 0) return { error: `Please choose a ${label} image.` };
  if (file.size > MAX_UPLOAD_BYTES) {
    return {
      error: `That ${label} image is over ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)}MB — try a smaller photo.`,
    };
  }
  const mime = resolveUploadMime(file);
  if (!mime) {
    console.warn("[verify-id] unrecognised upload", {
      label,
      declaredType: file.type,
      name: file.name,
      size: file.size,
    });
    return {
      error: `That ${label} file isn't a supported type — use a photo (JPG, PNG, HEIC) or a PDF.`,
    };
  }
  return { mime };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  // Cheap brute-force guard on the token space, plus a cap on how often one
  // link can be used at all.
  //
  // Every attempt counts, including the ones we reject — so the budget has to
  // be big enough to absorb a customer fumbling with formats and file sizes,
  // twice, on a phone. At ten they could be locked out for ten minutes by their
  // own mistakes, which reads as the upload being broken. It's still nowhere
  // near enough to walk a 256-bit token space.
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!rateLimit(`verify-id:${ip}`, 25, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many attempts. Try again shortly." }, { status: 429 });
  }

  const lookup = await verificationByToken(token);
  if (!lookup.ok) {
    return NextResponse.json(
      {
        error:
          lookup.reason === "expired"
            ? "That link has expired — reply to our email and we'll send a fresh one."
            : "That link isn't valid any more.",
      },
      { status: 404 },
    );
  }
  const { verification, customer } = lookup;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Upload failed — please try again." }, { status: 400 });
  }

  const docTypeRaw = String(form.get("docType") ?? "");
  if (!DOC_TYPES.includes(docTypeRaw as DocType)) {
    return NextResponse.json({ error: "Choose a document type." }, { status: 422 });
  }
  const docType = docTypeRaw as DocType;

  const front = form.get("front") as File | null;
  const back = form.get("back") as File | null;

  const frontCheck = checkFile(front, "front");
  if ("error" in frontCheck) {
    return NextResponse.json({ error: frontCheck.error }, { status: 422 });
  }
  // Passports are one page — the back is optional there, required on a licence.
  const backRequired = docType === "drivers_licence";
  const sendingBack = backRequired || !!(back && back.size > 0);
  let backMime: string | null = null;
  if (sendingBack) {
    const backCheck = checkFile(back, "back");
    if ("error" in backCheck) {
      return NextResponse.json({ error: backCheck.error }, { status: 422 });
    }
    backMime = backCheck.mime;
  }

  const supabase = createAdminClient();

  // Write the new images before touching the row, so a failed upload leaves the
  // previous (working) submission intact rather than a half-updated record.
  const upload = async (file: File, side: "front" | "back", mime: string) => {
    const path = documentPath(customer.id, side, mime);
    const { error } = await supabase.storage
      .from(ID_BUCKET)
      .upload(path, file, { contentType: mime, upsert: false });
    if (error) throw new Error(error.message);
    return path;
  };

  let frontPath: string;
  let backPath: string | null = null;
  try {
    frontPath = await upload(front as File, "front", frontCheck.mime);
    if (back && back.size > 0 && backMime) {
      backPath = await upload(back, "back", backMime);
    }
  } catch (err) {
    console.error("[verify-id] upload failed", { customerId: customer.id, err });
    return NextResponse.json(
      { error: "We couldn't save that upload. Please try again." },
      { status: 500 },
    );
  }

  const previous = { front_path: verification.front_path, back_path: verification.back_path };

  const { error: updateError } = await supabase
    .from("id_verifications")
    .update({
      front_path: frontPath,
      back_path: backPath,
      doc_type: docType,
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", verification.id);

  if (updateError) {
    console.error("[verify-id] record update failed", { customerId: customer.id, updateError });
    return NextResponse.json(
      { error: "We couldn't save that upload. Please try again." },
      { status: 500 },
    );
  }

  // Superseded images are dead weight and a liability — bin them.
  await removeStoredDocuments(supabase, previous);

  await notifyAdmin(
    `ID uploaded — ${customer.name}`,
    [
      `${customer.name} has uploaded ID for verification.`,
      `Document: ${DOC_LABEL[docType]}${backPath ? " (front + back)" : " (front only)"}`,
      "",
      `${site.url}/admin/customers/${customer.id}`,
    ].join("\n"),
  );

  return NextResponse.json({ ok: true });
}
