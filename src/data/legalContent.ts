// ============================================================
// ZAPP Donuts ERP - Legal document content
// ============================================================
//
// Verbatim legal text supplied by ZAPP Donuts (UBERDELI CORP.),
// received 2026-07-12. Kept in sync with docs/legal/*.md.
//
// Rendered read-only inside <LegalDocModal> (opened from the
// clickable links / agreement checkbox on the registration forms).
// Bodies are plain text rendered with `whitespace-pre-line`, so keep
// blank lines between paragraphs and use "•  " for bullets.

export type LegalDocKey = 'consignment' | 'privacy' | 'terms';

export interface LegalDoc {
  key: LegalDocKey;
  /** Short label used on links / checkbox. */
  label: string;
  /** Full title shown in the modal header. */
  title: string;
  /** e.g. "Last Updated: July 2026" — shown under the title. */
  meta?: string;
  body: string;
}

const CONSIGNMENT_BODY = `This ZAPP Donuts Consignment Display Agreement ("Agreement") is entered into by and between ZAPP DONUTS (UBERDELI CORP.), represented by its Authorized Partner Distributor, and the applicant ("Zapp Store Partner").

By clicking "I Agree" and submitting the online application through the official ZAPP Donuts website, the Zapp Store Partner acknowledges that they have read, understood, and voluntarily agree to be legally bound by all the terms and conditions of this Agreement.

1. Nature of Agreement
The Distributor agrees to supply ZAPP Donuts to the Zapp Store Partner on a consignment basis.
Ownership of all donuts shall remain with ZAPP DONUTS (UBERDELI CORP.) until sold and fully paid.
The Store Partner shall display, promote, and sell the products only at the approved business location.

2. Security Deposit
The Store Partner agrees to pay a refundable Security Deposit of Two Thousand Pesos (₱2,000.00) for the use of the official ZAPP Donuts display shelf.
The Security Deposit:
•  is not a purchase of the display shelf;
•  is not rental payment;
•  shall remain the property of ZAPP DONUTS throughout the duration of this Agreement.

3. Contract Duration
This Agreement shall remain valid for one (1) year from the date of the Store Grand Opening.
Renewal shall be subject to the approval of both parties.

4. Commission
The Store Partner shall earn fifteen percent (15%) commission based on the official gross selling price of every donut successfully sold.

5. Delivery Schedule
Deliveries shall be made every other day based on the agreed delivery schedule.
Unsold donuts from the previous delivery shall first be counted and verified before new stocks are released.

5-A. Request to Hold Delivery
If the Store Partner wishes to suspend or temporarily hold deliveries due to store closure, renovation, holidays, or any similar reason, the Distributor must be notified at least two (2) calendar days before the scheduled delivery.
Requests made less than two (2) calendar days before delivery may be declined if products have already been prepared, scheduled, or dispatched.
Failure to provide the required notice shall result in the scheduled delivery being deemed accepted and considered sold, provided the delivery could not be completed due to reasons attributable to the Store Partner.
The corresponding value of the scheduled delivery shall remain payable.

5-B. Required Donut Drop Box
The Store Partner shall allow the Distributor to install and maintain an official ZAPP Donuts Drop Box outside the store whenever the store is closed during scheduled delivery hours.
The Store Partner acknowledges that deliveries may begin as early as 12:00 Midnight.
When the store is closed, deliveries may be left inside the designated Drop Box.
If the Store Partner fails to provide or maintain the required Drop Box, causing the scheduled delivery to be returned to the production plant, such delivery shall be deemed accepted and considered sold.
The corresponding value of the products shall be charged to the Store Partner.
Failure to maintain the required Drop Box shall constitute a violation of this Agreement.
The Distributor shall not be liable for missed deliveries, returned products, delivery delays, or additional delivery expenses caused by the Store Partner's failure to comply with this requirement.

6. Consignment Payment Terms
The Store Partner agrees to:
•  Pay all consignment balances within forty-eight (48) hours from delivery.
•  Pay using GCash or any payment method designated by the Distributor.
Failure to pay shall constitute Default in Payment, authorizing the Distributor to:
•  Suspend deliveries;
•  Pull out all products and display equipment;
•  Terminate this Agreement immediately.
Any unpaid balance shall earn 2% interest per month, or the maximum rate permitted by applicable law, until fully paid.
Failure to settle payment seven (7) calendar days after the due date shall constitute a material breach of this Agreement. The Distributor may pursue all available legal remedies to recover unpaid amounts.

7. Reporting Requirements
For every delivery, the Store Partner shall submit the required reports.
Upon Receiving Delivery (Beginning Count)
•  Photo of the Delivery Receipt (DR);
•  Photo showing all delivered donuts;
•  Photo of the Delivery Receipt indicating each donut flavor and quantity delivered;
•  Photos must be submitted immediately after receiving the delivery.
Before Pull-Out (Ending Count)
•  Photo of the Delivery Receipt showing the Ending Donut Count;
•  Photo of all unsold donuts;
•  Every unsold donut must be cut halfway to clearly show the filling for verification;
•  Beginning Count, Total Sold, and Ending Count must reconcile with the submitted inventory report.

8. Liability for Display Shelf
The display shelf shall remain the exclusive property of ZAPP DONUTS.
The Store Partner shall not:
•  transfer;
•  lend;
•  relocate;
•  alter;
•  modify; or
•  use the display shelf for any purpose other than selling ZAPP Donuts.
Any damage, theft, misuse, or loss shall be charged to the Store Partner.

9. Violations
Failure to comply with this Agreement shall result in:
First Violation
•  Written Warning
Second Violation
•  Temporary Suspension of Deliveries
Third Violation
•  Immediate termination of this Agreement
•  Pull-out of all products and display equipment
•  Forfeiture of the ₱2,000 Security Deposit if the one-year contract has not yet been completed.

10. Termination
The Distributor may immediately terminate this Agreement for:
•  repeated violations;
•  failure to remit payment;
•  fraudulent reporting;
•  falsified documents;
•  unauthorized relocation of display equipment;
•  business closure;
•  material breach of this Agreement.

11. Security Deposit Refund
The Security Deposit shall be refundable only after:
•  completion of the one-year contract;
•  full payment of all outstanding balances;
•  return of the display shelf in good condition, normal wear and tear excepted.
Refunds shall be processed within thirty (30) days after clearance.
If this Agreement is terminated before the completion of one year due to the Store Partner's voluntary withdrawal or violation of this Agreement, the Security Deposit shall be forfeited.

12. Ownership of Products
All donuts delivered under this Agreement remain the exclusive property of ZAPP DONUTS (UBERDELI CORP.) until sold and fully paid.

12-A. Inventory Accountability
The Store Partner shall be fully accountable for all products listed in the Delivery Receipt.
Any unexplained shortage, missing product, or inventory discrepancy not supported by the required reports shall be deemed sold and charged to the Store Partner.

12-B. Official Selling Price
The Store Partner shall sell all ZAPP Donuts only at the official selling prices prescribed by ZAPP DONUTS.
No discounts, price reductions, promotions, or bundled offers shall be allowed without prior written approval from the Distributor.

13. Right of Inspection
The Distributor may inspect the display shelf, inventory, Delivery Receipts, reports, and related records during reasonable business hours to verify compliance with this Agreement.

14. Fraud and Misrepresentation
Submission of false reports, falsified photographs, altered inventory records, fake government-issued IDs, fake proof of billing, or any fraudulent information shall constitute a material breach of this Agreement.
The Distributor reserves the right to immediately terminate this Agreement and pursue any available civil or criminal remedies under applicable Philippine laws.

15. Collection Costs
If collection or legal action becomes necessary due to unpaid obligations, the Store Partner agrees to pay reasonable collection costs, attorney's fees equivalent to twenty-five percent (25%) of the total amount due, court costs, and other legal expenses, if recoverable under applicable law.

16. Governing Law and Venue
This Agreement shall be governed by the laws of the Republic of the Philippines.
Any legal action arising from this Agreement shall be filed exclusively before the proper courts of Naga City, Camarines Sur, to the extent permitted by law.

17. Entire Agreement
This Agreement constitutes the complete agreement between the parties and supersedes all previous oral or written agreements regarding the ZAPP Donuts consignment partnership.
Any amendment shall be effective only if made in writing by the Distributor.

18. Identity Verification
The applicant agrees to submit:
•  a valid government-issued identification card;
•  a recent proof of residential address; and
•  any additional verification documents reasonably required by the Distributor.
The applicant certifies that all submitted documents are authentic, complete, and belong to the applicant or the applicant's duly authorized representative.
Submission of falsified or misleading documents shall be sufficient ground for rejection or termination of this Agreement.

19. Electronic Acceptance
By checking the "I Agree" checkbox and submitting the online application, the Store Partner:
•  confirms that all information submitted is true and correct;
•  confirms that they have read and understood this Agreement;
•  confirms that they have the authority to enter into this Agreement on behalf of the business;
•  voluntarily accepts all obligations contained herein.
The Store Partner acknowledges that this electronic acceptance shall have the same legal force and effect as a handwritten signature, to the fullest extent permitted by the laws of the Republic of the Philippines.`;

const PRIVACY_BODY = `ZAPP DONUTS (UBERDELI CORP.) ("ZAPP Donuts", "we", "our", or "us") respects your privacy and is committed to protecting your personal information in accordance with the Data Privacy Act of 2012 (Republic Act No. 10173) and its applicable rules and regulations.

This Privacy Notice explains how we collect, use, store, disclose, and protect your personal information when you apply to become a ZAPP Donuts Store Partner through our website.

1. Information We Collect
As part of the application process, we may collect the following information:
Personal Information
•  Full Name
•  Date of Birth
•  Mobile Number
•  Email Address
•  Residential Address
•  Business Address
•  Store Name
•  Government-issued Identification Card
•  Proof of Residential Address (Proof of Billing)
•  Selfie or identity verification photo (required)
•  Signature or electronic acceptance records
•  Other information voluntarily provided during the application process
Technical Information
When you use our website, we may automatically collect:
•  IP Address
•  Browser Information
•  Device Information
•  Operating System
•  Date and Time of Access
•  Website Activity Logs
•  Electronic Acceptance Records

2. Purpose of Collection
We collect and process your personal information for the following purposes:
•  Processing your application as a ZAPP Donuts Store Partner
•  Identity verification
•  Fraud prevention
•  Contract administration
•  Delivery coordination
•  Payment verification
•  Collection of unpaid obligations
•  Customer support
•  Compliance with applicable laws and regulations
•  Internal record keeping
•  Protection of our legal rights and business interests
We collect only the information reasonably necessary to achieve these purposes.

3. Sharing of Information
Your personal information may be shared only when necessary with:
•  Authorized employees of ZAPP DONUTS
•  Authorized Partner Distributors
•  Payment service providers
•  Delivery partners
•  Legal counsel
•  Government agencies when required by law
•  Service providers engaged by ZAPP DONUTS under appropriate confidentiality obligations
We do not sell your personal information to third parties.

4. Data Security
We implement reasonable administrative, organizational, physical, and technical safeguards to protect your personal information against unauthorized access, disclosure, alteration, misuse, loss, or destruction.
Only authorized personnel with a legitimate business purpose are permitted to access your information.

5. Data Retention
We retain your personal information only for as long as necessary to:
•  Evaluate your application;
•  Manage your partnership with ZAPP Donuts;
•  Comply with legal, regulatory, accounting, and tax requirements;
•  Resolve disputes;
•  Enforce contractual obligations.
When your information is no longer required, it will be securely deleted, anonymized, or otherwise disposed of in accordance with applicable laws and company policies.

6. Your Rights
Subject to applicable law, you may have the right to:
•  Be informed about the processing of your personal information;
•  Request access to your personal information;
•  Request correction of inaccurate or incomplete information;
•  Request deletion or blocking of personal information where legally appropriate;
•  Object to certain types of processing where permitted by law;
•  Withdraw consent, where processing is based solely on consent, subject to legal and contractual limitations.
Requests may be subject to identity verification and other legal requirements.

7. Cookies and Website Logs
Our website may use cookies and similar technologies to:
•  Maintain website functionality;
•  Improve user experience;
•  Analyze website usage;
•  Enhance website security.
You may configure your browser to refuse cookies; however, doing so may affect certain website features.

8. Electronic Records
By submitting your application through our website, you acknowledge that electronic records, electronic communications, timestamps, IP logs, and electronic acceptance records may be retained as evidence of your transactions with ZAPP DONUTS.

9. Changes to this Privacy Notice
ZAPP DONUTS may update this Privacy Notice from time to time to reflect changes in our business operations, legal obligations, or data processing practices.
The updated version shall be posted on our website with the revised effective date.

10. Contact Us
If you have questions regarding this Privacy Notice or the processing of your personal information, you may contact us through the official ZAPP Donuts support channels available on our website.

Consent
By checking the consent checkbox and submitting your application, you acknowledge that you have read and understood this Privacy Notice and consent to the collection, use, processing, storage, and disclosure of your personal information for the purposes described above, subject to applicable Philippine laws.`;

const TERMS_BODY = `Welcome to www.zappdonuts.com website ("Website"). This Website is owned and operated by ZAPP DONUTS (AUTHORIZED DISTRIBUTOR).

By accessing, browsing, registering, or using this Website, you acknowledge that you have read, understood, and agree to be bound by these Website Terms of Use.

If you do not agree with these Terms, please do not use this Website.

1. Purpose of the Website
This Website is provided for the following purposes:
•  Application for ZAPP Donuts Store Partnership;
•  Submission of required documents;
•  Electronic acceptance of agreements;
•  Management of partner information;
•  Payment processing (remittance of sales);
•  Access to partner-related services and information.

2. Eligibility
You represent that:
•  You are at least eighteen (18) years of age;
•  You have the legal capacity to enter into contracts;
•  The information you submit is accurate and complete;
•  You are authorized to act on behalf of the business you represent, if applicable.

3. User Responsibilities
By using this Website, you agree to:
•  Provide truthful, complete, and accurate information;
•  Keep your account credentials confidential;
•  Maintain the security of your account;
•  Promptly update any inaccurate or outdated information;
•  Comply with all applicable laws and regulations.
You are responsible for all activities conducted under your account.

4. Prohibited Activities
Users shall not:
•  Submit false or misleading information;
•  Upload forged, altered, or fraudulent documents;
•  Use another person's identity;
•  Attempt unauthorized access to the Website or its systems;
•  Interfere with the operation or security of the Website;
•  Upload viruses, malware, or harmful code;
•  Copy, reproduce, modify, distribute, or exploit Website content without written permission;
•  Use the Website for unlawful or fraudulent purposes.
Violation of these Terms may result in suspension or permanent termination of access.

5. Electronic Transactions
The Website may facilitate electronic applications, document submissions, and electronic acceptance of agreements.
Electronic records, timestamps, IP logs, device information, and electronic acceptance records may be retained as evidence of transactions conducted through this Website.

6. Identity Verification
ZAPP DONUTS may require users to submit:
•  Government-issued identification;
•  Proof of residential address;
•  Selfie verification;
•  Additional supporting documents.
Failure to complete identity verification may result in rejection of the application or suspension of services.

7. Intellectual Property
All Website content, including but not limited to logos, trademarks, trade names, software, graphics, text, photographs, videos, product designs, documents, and other materials, are owned by or licensed to ZAPP DONUTS and are protected by applicable intellectual property laws.
No content may be copied, reproduced, distributed, published, or used without prior written permission from ZAPP DONUTS.

8. Availability of the Website
While we strive to keep the Website available at all times, we do not guarantee uninterrupted or error-free access.
The Website may be temporarily unavailable due to maintenance, software updates, technical failures, internet interruptions, security incidents, or circumstances beyond our reasonable control.

9. Limitation of Liability
To the extent permitted by applicable law, ZAPP DONUTS shall not be liable for:
•  temporary Website interruptions;
•  internet connectivity issues;
•  delays caused by third-party service providers;
•  loss of data resulting from user error;
•  unauthorized access resulting from the user's failure to secure account credentials;
•  indirect, incidental, or consequential damages arising from the use of the Website.
Nothing in these Terms excludes liability where such exclusion is prohibited by law.

10. Suspension or Termination
ZAPP DONUTS reserves the right to suspend or terminate access to the Website without prior notice if a user violates these Terms, submits fraudulent information or documents, engages in unlawful activity, compromises Website security, or abuses the services provided through the Website.

11. Third-Party Services
The Website may integrate with third-party providers such as payment gateways, messaging services, or identity verification services.
Use of such third-party services may also be subject to their respective terms and privacy policies.

12. Privacy
The collection and processing of personal information are governed by the ZAPP DONUTS Privacy Notice, which forms an integral part of these Terms.

13. Modifications
ZAPP DONUTS may modify these Website Terms of Use at any time.
Updated versions shall become effective upon publication on this Website unless otherwise stated.
Continued use of the Website after any update constitutes acceptance of the revised Terms.

14. Governing Law
These Website Terms of Use shall be governed by the laws of the Republic of the Philippines.

15. Dispute Resolution and Venue
Any dispute arising from the use of this Website shall be governed by Philippine law.
To the extent permitted by applicable law, legal actions shall be filed before the proper courts of Naga City, Camarines Sur.

16. Contact Information
Questions regarding these Website Terms of Use may be directed through the official ZAPP DONUTS communication channels provided on this Website.

Acceptance
By accessing or using this Website, creating an account, or clicking any "I Agree", "Submit", or similar confirmation button where applicable, you acknowledge that you have read, understood, and agree to be bound by these Website Terms of Use.`;

export const LEGAL_DOCS: Record<LegalDocKey, LegalDoc> = {
  consignment: {
    key: 'consignment',
    label: 'Consignment Agreement',
    title: 'ZAPP Donuts Consignment Display Agreement',
    body: CONSIGNMENT_BODY,
  },
  privacy: {
    key: 'privacy',
    label: 'Privacy Notice',
    title: 'ZAPP Donuts Privacy Notice',
    meta: 'Last Updated: July 2026',
    body: PRIVACY_BODY,
  },
  terms: {
    key: 'terms',
    label: 'Terms and Conditions',
    title: 'ZAPP Donuts Website Terms of Use',
    meta: 'Last Updated: July 2026',
    body: TERMS_BODY,
  },
};
