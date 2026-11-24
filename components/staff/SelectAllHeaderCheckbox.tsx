"use client";

import { useEffect, useState } from "react";
import { BULK_PRODUCTS_FORM_ID } from "@/lib/product-restriction-form";

export function SelectAllHeaderCheckbox() {
  const [isChecked, setIsChecked] = useState(false);

  useEffect(() => {
    const handleCheckboxChange = () => {
      const boxes = document.querySelectorAll<HTMLInputElement>(
        `input[type="checkbox"][name="productId"][form="${BULK_PRODUCTS_FORM_ID}"]`,
      );
      if (boxes.length === 0) {
        setIsChecked(false);
        return;
      }
      const allChecked = Array.from(boxes).every((box) => box.checked);
      setIsChecked(allChecked);
    };

    document.addEventListener("change", handleCheckboxChange);
    handleCheckboxChange();
    return () => document.removeEventListener("change", handleCheckboxChange);
  }, []);

  const toggleAll = (checked: boolean) => {
    setIsChecked(checked);
    const boxes = document.querySelectorAll<HTMLInputElement>(
      `input[type="checkbox"][name="productId"][form="${BULK_PRODUCTS_FORM_ID}"]`,
    );
    boxes.forEach((box) => {
      if (box.checked !== checked) {
        box.checked = checked;
        box.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
  };

  return (
    <input
      id="select-all-header"
      type="checkbox"
      checked={isChecked}
      onChange={(e) => toggleAll(e.target.checked)}
      aria-label="Select all products on this page"
      className="h-4 w-4 rounded border-black/20 text-action focus:ring-action cursor-pointer"
    />
  );
}
