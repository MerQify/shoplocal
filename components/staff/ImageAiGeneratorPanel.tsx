"use client";

import { useState, useTransition } from "react";
import {
  generateAiImageAction,
  listProductsForAiPromptAction,
} from "@/features/admin/image-library";
import { buildProductStudioPrompt } from "@/lib/ai-image-prompts";
import type { AiPromptProductCandidate } from "@/lib/image-hub-service";
import type { HubAsset } from "@/lib/image-hub/client";

export interface ImageAiGeneratorPanelProps {
  onGenerated: (asset: HubAsset) => void;
}

export function ImageAiGeneratorPanel({ onGenerated }: ImageAiGeneratorPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [productQuery, setProductQuery] = useState("");
  const [candidates, setCandidates] = useState<AiPromptProductCandidate[]>([]);
  const [searchingProducts, startProductSearch] = useTransition();
  const [selectedProduct, setSelectedProduct] = useState<AiPromptProductCandidate | null>(null);
  const [prompt, setPrompt] = useState("");
  const [title, setTitle] = useState("");
  const [generating, startGenerating] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function handleSearchProducts(e: React.FormEvent) {
    e.preventDefault();
    const q = productQuery.trim();
    setError(null);
    startProductSearch(async () => {
      const items = await listProductsForAiPromptAction(q);
      setCandidates(items);
    });
  }

  function handleSelectProduct(prod: AiPromptProductCandidate) {
    setSelectedProduct(prod);
    setPrompt(buildProductStudioPrompt(prod.name, prod.categoryName));
    setTitle(prod.name);
    setError(null);
  }

  function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) {
      setError("Please enter or generate a prompt first.");
      return;
    }

    setError(null);
    setSuccess(null);

    startGenerating(async () => {
      const res = await generateAiImageAction({
        prompt: trimmedPrompt,
        title: title.trim() || undefined,
        productId: selectedProduct?.id,
      });

      if (!res.ok) {
        setError(res.message);
        return;
      }

      setSuccess(`Generated and imported "${res.value.title}" as Pending Review.`);
      onGenerated(res.value);
    });
  }

  return (
    <div className="rounded-xl border border-black/10 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-primary">Generate Photos with Workers AI</h2>
          <p className="mt-0.5 text-xs text-primary-muted">
            Create studio commercial product photography for active or inactive products lacking
            photos. Images are metred against your store&apos;s daily AI budget and land in the
            library as Pending Review.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="rounded-lg border border-black/15 bg-surface-muted px-3 py-1.5 text-xs font-semibold text-primary hover:bg-black/5 focus:outline-none"
        >
          {isOpen ? "Hide AI generator" : "Generate with AI →"}
        </button>
      </div>

      {isOpen && (
        <div className="mt-4 space-y-4 border-t border-black/5 pt-4">
          {/* Step 1: Optional Product Autofill */}
          <div className="rounded-lg border border-black/10 bg-surface-muted/40 p-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-primary-muted">
              Step 1: Choose a catalogue product (Optional)
            </h3>
            <p className="mt-0.5 text-xs text-primary-muted">
              Select any active or inactive product to automatically draft an optimized studio
              prompt.
            </p>

            <form onSubmit={handleSearchProducts} className="mt-2.5 flex gap-2">
              <input
                type="text"
                value={productQuery}
                onChange={(e) => setProductQuery(e.target.value)}
                placeholder="Search products by name (e.g. Lamb, Basmati, Milk)..."
                className="flex-1 rounded-lg border border-black/15 bg-white px-3 py-1.5 text-xs text-primary placeholder:text-primary-subtle focus:border-action focus:outline-none"
              />
              <button
                type="submit"
                disabled={searchingProducts}
                className="rounded-lg border border-black/15 bg-white px-3 py-1.5 text-xs font-semibold text-primary hover:bg-black/5 disabled:opacity-50"
              >
                {searchingProducts ? "Searching…" : "Search"}
              </button>
            </form>

            {candidates.length > 0 && (
              <div className="mt-2.5 max-h-48 overflow-y-auto rounded-lg border border-black/10 bg-white p-1">
                <div className="space-y-0.5">
                  {candidates.map((prod) => (
                    <button
                      key={prod.id}
                      type="button"
                      onClick={() => handleSelectProduct(prod)}
                      className={`flex w-full items-center justify-between rounded px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-black/5 ${
                        selectedProduct?.id === prod.id ? "bg-black/5 font-semibold" : ""
                      }`}
                    >
                      <span className="truncate text-primary">
                        {prod.name}
                        {prod.categoryName && (
                          <span className="ml-1.5 text-[11px] text-primary-muted font-normal">
                            ({prod.categoryName})
                          </span>
                        )}
                      </span>
                      <span className="ml-2 flex-shrink-0">
                        {prod.isActive ? (
                          <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800 border border-emerald-200">
                            Active
                          </span>
                        ) : (
                          <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900 border border-amber-300">
                            Inactive
                          </span>
                        )}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selectedProduct && (
              <div className="mt-2 flex items-center justify-between text-xs text-primary-muted">
                <span>
                  Selected: <strong className="text-primary">{selectedProduct.name}</strong> (
                  {selectedProduct.isActive ? "Active" : "Inactive"})
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedProduct(null)}
                  className="text-xs text-action underline hover:text-action-hover"
                >
                  Clear selection
                </button>
              </div>
            )}
          </div>

          {/* Step 2: Prompt and Generation */}
          <form onSubmit={handleGenerate} className="space-y-3">
            <div>
              <label
                htmlFor="ai-title"
                className="mb-1 block text-xs font-semibold text-primary-muted"
              >
                Asset Title
              </label>
              <input
                id="ai-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Halal Lamb Chops Pack"
                className="w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm text-primary placeholder:text-primary-subtle focus:border-action focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="ai-prompt"
                className="mb-1 block text-xs font-semibold text-primary-muted"
              >
                Prompt for Cloudflare Flux-1 Schnell
              </label>
              <textarea
                id="ai-prompt"
                rows={3}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Studio product photograph of [item], clean plain white background, professional lighting, crisp focus, centered, 4k"
                className="w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-xs text-primary placeholder:text-primary-subtle focus:border-action focus:outline-none"
              />
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-800">
                {error}
              </div>
            )}

            {success && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-xs text-emerald-800">
                {success}
              </div>
            )}

            <div className="flex items-center justify-end gap-2">
              <button
                type="submit"
                disabled={generating || !prompt.trim()}
                className="rounded-lg bg-action px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-action-hover focus:outline-none disabled:opacity-50"
              >
                {generating ? "Generating studio photo…" : "Generate Photo"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
