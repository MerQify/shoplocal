-- Hand-authored because the development migration history cannot be reset.
CREATE TABLE "ProductAllergenDeclaration" (
    "productId" TEXT NOT NULL,
    "ingredients" TEXT NOT NULL,
    "contains" TEXT NOT NULL,
    "mayContain" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3),

    CONSTRAINT "ProductAllergenDeclaration_pkey" PRIMARY KEY ("productId")
);

ALTER TABLE "ProductAllergenDeclaration" ADD CONSTRAINT "ProductAllergenDeclaration_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
