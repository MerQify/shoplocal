"use client";

import { useState, useRef, type DragEvent, type KeyboardEvent } from "react";
import { Icon } from "@/components/icons/Icon";
import { inputClass } from "@/lib/form-classes";

export interface DualListboxTransferPickerProps {
  /** All verified destination mailboxes available to choose from. */
  verifiedAddresses: readonly string[];
  /** Any destination mailboxes pending Cloudflare verification. */
  pendingAddresses?: readonly string[];
  /** Initially selected destination mailbox(es). */
  initialSelected?: readonly string[];
  /** The form input name for the comma-separated output. Default "forwardTo". */
  name?: string;
  /** Whether at least one destination must be selected. */
  required?: boolean;
}

export function DualListboxTransferPicker({
  verifiedAddresses,
  pendingAddresses = [],
  initialSelected = [],
  name = "forwardTo",
  required = true,
}: DualListboxTransferPickerProps) {
  // Normalize initial selections
  const normalizedInitial = initialSelected
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);

  const [selected, setSelected] = useState<string[]>(() => [...new Set(normalizedInitial)]);
  const [checkedAvailable, setCheckedAvailable] = useState<string[]>([]);
  const [checkedSelected, setCheckedSelected] = useState<string[]>([]);
  const [isDragOverSelected, setIsDragOverSelected] = useState(false);
  const [isDragOverAvailable, setIsDragOverAvailable] = useState(false);
  const [customEmail, setCustomEmail] = useState("");
  const [customEmailError, setCustomEmailError] = useState<string | null>(null);

  const customInputRef = useRef<HTMLInputElement>(null);

  // Available items are verified addresses that are NOT already selected
  const availableItems = verifiedAddresses
    .map((s) => s.trim().toLowerCase())
    .filter((addr) => !selected.includes(addr));

  // Transfer helpers
  const moveToSelected = (emails: string[]) => {
    const toAdd = emails.map((s) => s.trim().toLowerCase()).filter((s) => s.length > 0);
    setSelected((prev) => [...new Set([...prev, ...toAdd])]);
    setCheckedAvailable((prev) => prev.filter((addr) => !toAdd.includes(addr)));
  };

  const moveToAvailable = (emails: string[]) => {
    const toRemove = emails.map((s) => s.trim().toLowerCase());
    setSelected((prev) => prev.filter((addr) => !toRemove.includes(addr)));
    setCheckedSelected((prev) => prev.filter((addr) => !toRemove.includes(addr)));
  };

  const addAllAvailable = () => {
    moveToSelected(availableItems);
  };

  const clearAllSelected = () => {
    setSelected([]);
    setCheckedSelected([]);
  };

  const handleAddCustomEmail = () => {
    const trimmed = customEmail.trim().toLowerCase();
    if (!trimmed) return;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      setCustomEmailError("Enter a valid email address.");
      return;
    }
    setCustomEmailError(null);
    moveToSelected([trimmed]);
    setCustomEmail("");
    if (customInputRef.current) {
      customInputRef.current.focus();
    }
  };

  const handleCustomKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddCustomEmail();
    }
  };

  // Drag and drop handlers
  const handleDragStart = (
    e: DragEvent<HTMLLIElement>,
    email: string,
    source: "available" | "selected",
  ) => {
    e.dataTransfer.setData("text/plain", email);
    e.dataTransfer.setData("source", source);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOverSelected = (e: DragEvent<HTMLUListElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setIsDragOverSelected(true);
  };

  const handleDragLeaveSelected = () => {
    setIsDragOverSelected(false);
  };

  const handleDropOnSelected = (e: DragEvent<HTMLUListElement>) => {
    e.preventDefault();
    setIsDragOverSelected(false);
    const email = e.dataTransfer.getData("text/plain");
    const source = e.dataTransfer.getData("source");
    if (email && source === "available") {
      moveToSelected([email]);
    }
  };

  const handleDragOverAvailable = (e: DragEvent<HTMLUListElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setIsDragOverAvailable(true);
  };

  const handleDragLeaveAvailable = () => {
    setIsDragOverAvailable(false);
  };

  const handleDropOnAvailable = (e: DragEvent<HTMLUListElement>) => {
    e.preventDefault();
    setIsDragOverAvailable(false);
    const email = e.dataTransfer.getData("text/plain");
    const source = e.dataTransfer.getData("source");
    if (email && source === "selected") {
      moveToAvailable([email]);
    }
  };

  const forwardToValue = selected.join(", ");

  return (
    <div className="space-y-3" data-dual-listbox-picker>
      <input type="hidden" name={name} value={forwardToValue} />

      <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
        {/* Left Box: Available */}
        <div className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-3 py-2 text-xs font-semibold text-primary">
            <span>Available Mailboxes</span>
            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-primary-muted font-normal">
              {availableItems.length}
            </span>
          </div>

          <ul
            onDragOver={handleDragOverAvailable}
            onDragLeave={handleDragLeaveAvailable}
            onDrop={handleDropOnAvailable}
            className={`min-h-[140px] max-h-[220px] overflow-y-auto divide-y divide-slate-100 p-1 text-xs transition-colors ${
              isDragOverAvailable ? "bg-action-tint/30 ring-2 ring-action ring-inset" : ""
            }`}
            data-available-list
          >
            {availableItems.length === 0 ? (
              <li className="p-4 text-center text-primary-muted italic">
                {verifiedAddresses.length === 0
                  ? "No verified team mailboxes in Cloudflare."
                  : "All available mailboxes are selected."}
              </li>
            ) : (
              availableItems.map((addr) => {
                const isChecked = checkedAvailable.includes(addr);
                return (
                  <li
                    key={addr}
                    draggable
                    onDragStart={(e) => handleDragStart(e, addr, "available")}
                    onDoubleClick={() => moveToSelected([addr])}
                    className={`flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 cursor-grab active:cursor-grabbing hover:bg-slate-50 transition-colors ${
                      isChecked ? "bg-action-tint/50" : ""
                    }`}
                    title="Drag and drop, double click, or use buttons to transfer"
                    data-available-item={addr}
                  >
                    <label className="flex min-w-0 items-center gap-2 cursor-pointer flex-1">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          setCheckedAvailable((prev) =>
                            e.target.checked ? [...prev, addr] : prev.filter((x) => x !== addr),
                          );
                        }}
                        className="rounded border-slate-300 text-action focus:ring-action"
                      />
                      <span className="truncate font-medium text-primary">{addr}</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => moveToSelected([addr])}
                      className="rounded p-1 text-primary-muted hover:bg-slate-200 hover:text-action transition-colors"
                      title="Add to forward recipients"
                      aria-label={`Add ${addr}`}
                    >
                      <Icon name="arrow-right" className="h-3.5 w-3.5" />
                    </button>
                  </li>
                );
              })
            )}

            {pendingAddresses.length > 0 && (
              <li className="p-2 border-t border-slate-200 bg-amber-50/50">
                <p className="text-[11px] font-semibold text-amber-800 mb-1">
                  Awaiting verification:
                </p>
                <ul className="space-y-0.5">
                  {pendingAddresses.map((p) => (
                    <li
                      key={p}
                      className="text-[11px] text-amber-700 truncate"
                      title="Verify in Cloudflare before adding"
                    >
                      • {p}
                    </li>
                  ))}
                </ul>
              </li>
            )}
          </ul>

          <div className="border-t border-slate-100 bg-slate-50 px-2 py-1.5 text-right">
            <button
              type="button"
              onClick={addAllAvailable}
              disabled={availableItems.length === 0}
              className="text-xs font-semibold text-action hover:underline disabled:opacity-40 disabled:no-underline"
            >
              Add all →
            </button>
          </div>
        </div>

        {/* Center: Action Buttons */}
        <div className="flex flex-row justify-center gap-2 sm:flex-col sm:justify-center">
          <button
            type="button"
            onClick={() => moveToSelected(checkedAvailable)}
            disabled={checkedAvailable.length === 0}
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white p-2 text-primary shadow-sm hover:bg-slate-50 disabled:opacity-40 transition-colors"
            title="Move checked to Forward To"
            aria-label="Move checked to Forward To"
          >
            <Icon name="arrow-right" className="h-4 w-4 hidden sm:block" />
            <Icon name="chevron-down" className="h-4 w-4 sm:hidden" />
          </button>
          <button
            type="button"
            onClick={() => moveToAvailable(checkedSelected)}
            disabled={checkedSelected.length === 0}
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white p-2 text-primary shadow-sm hover:bg-slate-50 disabled:opacity-40 transition-colors"
            title="Remove checked from Forward To"
            aria-label="Remove checked from Forward To"
          >
            <Icon name="arrow-left" className="h-4 w-4 hidden sm:block" />
            <Icon name="chevron-up" className="h-4 w-4 sm:hidden" />
          </button>
        </div>

        {/* Right Box: Selected */}
        <div className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-3 py-2 text-xs font-semibold text-primary">
            <span>Forward To (Recipients)</span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                selected.length > 0 ? "bg-action-tint text-action" : "bg-danger-tint text-danger"
              }`}
            >
              {selected.length} selected
            </span>
          </div>

          <ul
            onDragOver={handleDragOverSelected}
            onDragLeave={handleDragLeaveSelected}
            onDrop={handleDropOnSelected}
            className={`min-h-[140px] max-h-[220px] overflow-y-auto divide-y divide-slate-100 p-1 text-xs transition-colors ${
              isDragOverSelected ? "bg-action-tint/30 ring-2 ring-action ring-inset" : ""
            }`}
            data-selected-list
          >
            {selected.length === 0 ? (
              <li className="p-4 text-center text-primary-muted italic">
                No recipients selected.
                <br />
                <span className="text-[11px]">Drag mailboxes here or click Add →</span>
              </li>
            ) : (
              selected.map((addr) => {
                const isChecked = checkedSelected.includes(addr);
                return (
                  <li
                    key={addr}
                    draggable
                    onDragStart={(e) => handleDragStart(e, addr, "selected")}
                    onDoubleClick={() => moveToAvailable([addr])}
                    className={`flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 cursor-grab active:cursor-grabbing hover:bg-slate-50 transition-colors ${
                      isChecked ? "bg-action-tint/50" : ""
                    }`}
                    title="Drag and drop or double click to remove"
                    data-selected-item={addr}
                  >
                    <label className="flex min-w-0 items-center gap-2 cursor-pointer flex-1">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          setCheckedSelected((prev) =>
                            e.target.checked ? [...prev, addr] : prev.filter((x) => x !== addr),
                          );
                        }}
                        className="rounded border-slate-300 text-action focus:ring-action"
                      />
                      <span className="truncate font-medium text-primary">{addr}</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => moveToAvailable([addr])}
                      className="rounded p-1 text-primary-muted hover:bg-danger-tint hover:text-danger transition-colors"
                      title="Remove recipient"
                      aria-label={`Remove ${addr}`}
                    >
                      <Icon name="x" className="h-3.5 w-3.5" />
                    </button>
                  </li>
                );
              })
            )}
          </ul>

          <div className="border-t border-slate-100 bg-slate-50 px-2 py-1.5 text-right">
            <button
              type="button"
              onClick={clearAllSelected}
              disabled={selected.length === 0}
              className="text-xs font-semibold text-danger hover:underline disabled:opacity-40 disabled:no-underline"
            >
              Clear all
            </button>
          </div>
        </div>
      </div>

      {/* Add custom / other email */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
        <label
          className="block text-xs font-semibold text-primary mb-1"
          htmlFor="custom-mailbox-input"
        >
          Add other mailbox directly
        </label>
        <div className="flex gap-2">
          <input
            ref={customInputRef}
            id="custom-mailbox-input"
            type="email"
            value={customEmail}
            onChange={(e) => {
              setCustomEmail(e.target.value);
              if (customEmailError) setCustomEmailError(null);
            }}
            onKeyDown={handleCustomKeyDown}
            placeholder="e.g. team.member@gmail.com"
            className={inputClass}
          />
          <button
            type="button"
            onClick={handleAddCustomEmail}
            className="shrink-0 inline-flex items-center gap-1 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-primary border border-slate-300 shadow-sm hover:bg-slate-50 transition-colors"
          >
            <Icon name="plus" className="h-3.5 w-3.5" />
            Add to recipients
          </button>
        </div>
        {customEmailError && (
          <p className="mt-1 text-xs text-danger font-medium">{customEmailError}</p>
        )}
        <p className="mt-1 text-[11px] text-primary-muted">
          Note: Cloudflare only delivers to mailboxes verified in Cloudflare Email Routing.
        </p>
      </div>

      {required && selected.length === 0 && (
        <p className="text-xs font-medium text-danger" role="alert">
          Please select at least one forward recipient.
        </p>
      )}
    </div>
  );
}
