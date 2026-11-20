"use client";

import { useRef, useState, useTransition } from "react";
import type { HubAsset } from "@/lib/image-hub/client";
import { MAX_IMAGE_EDGE_PX } from "@/lib/product-image";
import { convertToWebp } from "@/lib/webp-convert";

/**
 * #1671 R10/R11 — upload an image into the store's image library.
 *
 * The browser converts the file with the shared `convertToWebp` (the same routine
 * `ProductImageUploader` uses), then posts it to `/api/admin/image-library/upload`, a route
 * handler because a server action's body is capped at 1 MB. The route re-checks everything. The
 * new image arrives as "Pending review" until a store admin approves it.
 */
export function ImageLibraryUploader({ onUploaded }: { onUploaded: (asset: HubAsset) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [alt, setAlt] = useState("");
  const [licence, setLicence] = useState("");
  const [rights, setRights] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function upload() {
    const file = fileRef.current?.files?.[0];
    setError(null);
    setDone(null);
    if (!file) return setError("Choose an image first.");
    if (!title.trim()) return setError("Give the image a title.");
    if (!licence) return setError("Choose who owns the rights to this image.");
    if (!rights) return setError("Confirm you have the right to use this image.");

    startTransition(async () => {
      let blob: Blob;
      try {
        blob = await convertToWebp(file);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "That image couldn't be read.");
        return;
      }
      const form = new FormData();
      form.set("file", blob, `${file.name.replace(/\.[^.]+$/, "") || "image"}.webp`);
      form.set("title", title);
      form.set("alt", alt);
      form.set("licence", licence);
      form.set("rightsConfirmed", "true");

      const response = await fetch("/api/admin/image-library/upload", {
        method: "POST",
        body: form,
      });
      const body = (await response.json().catch(() => null)) as
        HubAsset | { error?: { message?: string } } | null;
      if (!response.ok) {
        const message =
          body && "error" in body && body.error?.message
            ? body.error.message
            : `The upload failed (${response.status}).`;
        setError(message);
        return;
      }
      onUploaded(body as HubAsset);
      setDone("Uploaded. It will appear as “Pending review” until a store admin approves it.");
      setTitle("");
      setAlt("");
      setRights(false);
      if (fileRef.current) fileRef.current.value = "";
    });
  }

  return (
    <details className="rounded-xl border border-black/10 bg-white p-4">
      <summary className="cursor-pointer text-sm font-bold text-primary">Upload an image</summary>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label
            htmlFor="library-file"
            className="mb-1 block text-xs font-semibold text-primary-muted"
          >
            Image — resized to {MAX_IMAGE_EDGE_PX}px and converted to WebP before uploading
          </label>
          <input id="library-file" ref={fileRef} type="file" accept="image/*" className="text-sm" />
        </div>
        <div>
          <label
            htmlFor="library-title"
            className="mb-1 block text-xs font-semibold text-primary-muted"
          >
            Title
          </label>
          <input
            id="library-title"
            value={title}
            maxLength={200}
            onChange={(event) => setTitle(event.target.value)}
            className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm text-primary focus:border-action focus:outline-none"
          />
        </div>
        <div>
          <label
            htmlFor="library-alt"
            className="mb-1 block text-xs font-semibold text-primary-muted"
          >
            Alt text (what the image shows)
          </label>
          <input
            id="library-alt"
            value={alt}
            maxLength={500}
            onChange={(event) => setAlt(event.target.value)}
            className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm text-primary focus:border-action focus:outline-none"
          />
        </div>
        <div>
          <label
            htmlFor="library-licence"
            className="mb-1 block text-xs font-semibold text-primary-muted"
          >
            Who owns the rights
          </label>
          <select
            id="library-licence"
            value={licence}
            onChange={(event) => setLicence(event.target.value)}
            className="w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm text-primary"
          >
            <option value="">Choose…</option>
            <option value="OWNER_SUPPLIED">We took it or own it</option>
            <option value="SUPPLIER_PERMISSION">A supplier gave written permission</option>
          </select>
        </div>
        <label className="flex items-start gap-2 self-end text-sm text-primary">
          <input
            type="checkbox"
            checked={rights}
            onChange={(event) => setRights(event.target.checked)}
            className="mt-1"
          />
          I confirm we have the right to use this image.
        </label>
      </div>
      <button
        type="button"
        onClick={upload}
        disabled={pending}
        className="mt-4 rounded-lg bg-action px-4 py-2 text-sm font-semibold text-white hover:bg-action-hover disabled:opacity-50"
      >
        {pending ? "Uploading…" : "Upload"}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
      {done && (
        <p role="status" className="mt-2 text-sm text-action">
          {done}
        </p>
      )}
    </details>
  );
}
