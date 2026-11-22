"use client";

import { useState, useTransition } from "react";
import {
  fetchProductAllergenDraft,
  hideProductAllergenForm,
  saveProductAllergenForm,
} from "@/features/admin/product-allergen-declarations";
import type { AllergenDraft } from "@/lib/product-allergen-declaration";

const fields = [
  { key: "ingredients", label: "Ingredients", max: 6000 },
  { key: "contains", label: "Contains", max: 1200 },
  { key: "mayContain", label: "May contain", max: 1200 },
] as const;

export function ProductAllergenForm({
  productId,
  barcode,
  saved,
}: {
  productId: string;
  barcode: string | null;
  saved: (AllergenDraft & { source: string; verifiedAt: Date | null }) | null;
}) {
  const [draft, setDraft] = useState<AllergenDraft>(
    saved ?? { ingredients: "", contains: "", mayContain: "" },
  );
  const [source, setSource] = useState(saved?.source ?? "");
  const [confirmed, setConfirmed] = useState(false);
  const [published, setPublished] = useState(!!saved?.verifiedAt);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function lookup() {
    startTransition(async () => {
      const result = await fetchProductAllergenDraft(productId);
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      const { productName, ...suggestion } = result.draft;
      setDraft(suggestion);
      setSource("");
      setConfirmed(false);
      setMessage(
        `Open Food Facts draft${productName ? ` for ${productName}` : ""}. Check the current label before saving.`,
      );
    });
  }

  return (
    <section className="mt-6 rounded-2xl border border-black/10 bg-white p-5">
      <h2 className="text-lg font-bold">Ingredients and allergens</h2>
      <p className="my-2 text-sm text-primary-muted">
        {published
          ? "A verified declaration is visible to shoppers."
          : "No verified declaration is visible to shoppers."}
      </p>
      <form
        action={(form) =>
          startTransition(async () => {
            const result = await saveProductAllergenForm(productId, form);
            setMessage(result.message);
            if (result.ok) {
              setPublished(true);
              setConfirmed(false);
            }
          })
        }
        className="space-y-3"
      >
        {barcode && (
          <button
            type="button"
            disabled={pending}
            onClick={lookup}
            className="rounded-lg border px-3 py-2 text-sm"
          >
            Look up saved barcode
          </button>
        )}
        {fields.map(({ key, label, max }) => (
          <label key={key} className="block text-sm">
            {label}
            <textarea
              name={key}
              value={draft[key]}
              maxLength={max}
              rows={key === "ingredients" ? 3 : 2}
              onChange={(event) => {
                setDraft({ ...draft, [key]: event.target.value });
                setConfirmed(false);
              }}
              className="mt-1 block w-full rounded-lg border border-black/20 p-2"
            />
          </label>
        ))}
        <label className="block text-sm">
          Verification source
          <input
            name="source"
            value={source}
            required
            maxLength={300}
            onChange={(event) => {
              setSource(event.target.value);
              setConfirmed(false);
            }}
            className="mt-1 block w-full rounded-lg border border-black/20 p-2"
          />
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input
            name="confirmed"
            value="yes"
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
            required
          />
          I checked this declaration against the current packaging or supplier specification.
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white"
          >
            Save verified declaration
          </button>
          {published && (
            <button
              type="button"
              disabled={pending}
              className="rounded-lg border px-3 py-2 text-sm"
              onClick={() =>
                startTransition(async () => {
                  const result = await hideProductAllergenForm(productId);
                  setMessage(result.message);
                  if (result.ok) {
                    setPublished(false);
                    setConfirmed(false);
                  }
                })
              }
            >
              Hide declaration
            </button>
          )}
        </div>
        {message && (
          <p role="status" className="text-sm">
            {message}
          </p>
        )}
      </form>
    </section>
  );
}
