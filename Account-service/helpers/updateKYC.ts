export const calculateKycTier = (doc: any): number => {
  let tier = 0;

  if (doc.kra_pin_url) tier = 1;
  if (doc.kra_pin_url && doc.national_id_url) tier = 2;
  if (doc.kra_pin_url && doc.national_id_url && doc.bank_proof_url) tier = 3;
  if (doc.kra_pin_url && doc.national_id_url && doc.bank_proof_url && doc.passport_photo_url) tier = 4;

  return tier;
}