export const contact = {
  /** Display form — local Kenyan number. */
  phone: "0790 325 943",
  /**
   * Dialable form. Kenyan local numbers are 0 + 7 + 8 digits; the leading 0 is
   * dropped for the +254 country code so the tel: link works off-network.
   */
  phoneHref: "tel:+254790325943",
  email: "rubyrentsyncafrica@gmail.com",
  emailHref: "mailto:rubyrentsyncafrica@gmail.com",
  /** WhatsApp deep link — same number, no plus, per wa.me convention. */
  whatsappHref: "https://wa.me/254790325943",
  region: "Kenya",
} as const;
