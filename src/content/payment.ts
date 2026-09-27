/**
 * Rent Sync subscription payments are collected by M-Pesa **Send Money** to the
 * business phone number, NOT by Lipa na M-PESA (no till, no paybill).
 *
 * Two consequences that the copy has to respect, because they are what actually
 * happens on the payer's phone:
 *
 *   1. The recipient name Safaricom shows is the personal name on that M-Pesa
 *      account, not "Rent Sync". We cannot change it, so we tell payers to expect
 *      it rather than pretending the account is branded.
 *   2. Send Money has NO reference/account-name field that is recorded against the
 *      transaction, so the payer can leave it blank. There is therefore no reliable
 *      automatic way to tell who sent what. Activation is confirmed by the payer
 *      quoting the confirmation code from their own M-Pesa SMS, and an admin
 *      checks it against the statement before flipping the account on.
 *
 * The USSD root *334# is stable; the deeper option numbers are not documented by
 * Safaricom and do change, so only the menu path is spelled out here.
 */
export const payment = {
  method: "M-Pesa Send Money",
  /** Shown to the payer, and what they type into their phone. */
  phone: "0790 325 943",
  phoneInternational: "+254790325943",
  currency: "KES",
  /** Receive exactly this much and the account switches on. */
  activationNote:
    "We switch your account on as soon as the payment shows on our side — usually within a few hours, and same day if you pay during business hours.",
  steps: [
    "Open M-Pesa on your phone and dial *334#.",
    "Choose Send Money, then Send to New Recipient.",
    "Pick Phone Number as the recipient type.",
    "Enter 0790 325 943 as the number, then the amount for your plan.",
    "Type your M-Pesa PIN and confirm the payment.",
    "Come back to Rent Sync and enter the confirmation code from the SMS you just received.",
  ],
  /**
   * What the payer must hand over, and why. The code is the only piece of evidence
   * that ties a specific Send Money transaction to a specific account.
   */
  required: [
    "The confirmation code from your M-Pesa SMS (it looks like a long alphanumeric string)",
    "The email address you signed up to Rent Sync with",
  ],
  expectNameNote:
    "The name Safaricom shows you is the name on the receiving account, which is a personal M-Pesa name rather than a company name. That is expected.",
} as const;
