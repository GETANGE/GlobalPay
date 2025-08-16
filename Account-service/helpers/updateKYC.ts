export const calculateKycTier = (doc: any): number => {
  const docs = [
    doc.kra_pin_url,
    doc.national_id_url,
    doc.bank_proof_url,
    doc.passport_photo_url
  ];

  // Count how many of the fields are truthy (non-empty)
  const filledDocs = docs.filter(Boolean).length;

  // Tier is equal to the number of documents provided
  return filledDocs;
}