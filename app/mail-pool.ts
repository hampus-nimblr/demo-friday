export type Verdict = "spam" | "phishing" | "legit";

export type MailTemplate = {
  id: string;
  sender: string;
  address: string;
  initials: string;
  subject: string;
  preview: string;
  body: string[];
  /** Shown as a visible URL chip when present. */
  link?: string;
  verdict: Verdict;
  /** Points at the decisive signal without naming the answer. */
  hint: string;
};

export const VERDICTS: { id: Verdict; label: string; key: string }[] = [
  { id: "spam", label: "Spam", key: "1" },
  { id: "phishing", label: "Phishing", key: "2" },
  { id: "legit", label: "Legit", key: "3" },
];

const curatedMailPool: MailTemplate[] = [
  {
    id: "p-01",
    sender: "IT Service Desk",
    address: "it-support@nimblrsecurlty.com",
    initials: "IT",
    subject: "Action required: password expires in 2 hours",
    preview:
      "Your credentials expire today. Confirm them now to avoid losing access.",
    body: [
      "Your network credentials expire in 2 hours. Employees who do not confirm will lose access to email and shared drives until a helpdesk ticket is processed.",
      "Confirm your password at the link below to keep your account active.",
    ],
    link: "https://nimblrsecurlty.com/account/verify",
    verdict: "phishing",
    hint: "Read the sender domain character by character.",
  },
  {
    id: "p-02",
    sender: "Ana Reyes",
    address: "ana.reyes@nimblrsecurity.com",
    initials: "AR",
    subject: "Q3 drill results, need your sign-off",
    preview:
      "Click-through dropped to 4.1%. Report rate is up to 61%. Board sees it Tuesday.",
    body: [
      "Click-through dropped to 4.1% across all departments, down from 9.6% in Q2. Report rate is up to 61%, which is the number I care about.",
      "Support is the outlier at 11%. Full breakdown is on the shared drive. I need your sign-off before it goes to the board Tuesday.",
    ],
    verdict: "legit",
    hint: "Check whether this continues a thread you already know about.",
  },
  {
    id: "p-03",
    sender: "CRYPTO WEALTH DAILY",
    address: "no-reply@wealthsignals-daily.biz",
    initials: "CW",
    subject: "🚀 Turn 500 into 50,000 by September",
    preview:
      "Our AI signal engine called 41 of the last 43 moves. Seats close midnight.",
    body: [
      "Our proprietary AI signal engine called 41 of the last 43 major moves. Members are averaging returns most funds cannot touch.",
      "Only 12 seats remain in this cohort. Registration closes at midnight.",
    ],
    link: "https://wealthsignals-daily.biz/join",
    verdict: "spam",
    hint: "Ask who sent this and whether they know you at all.",
  },
  {
    id: "p-04",
    sender: "Marcus Hale",
    address: "marcus@nimblrsecurity.com",
    initials: "MH",
    subject: "Slides for the Friday demo",
    preview: "Eleven slides, down from thirty-one. The demo does the talking.",
    body: [
      "Eleven slides, down from thirty-one. The demo itself does the talking, so the deck only frames the problem and lands the numbers.",
      "I moved the architecture diagram to an appendix. Nobody in that room asks about queues.",
    ],
    verdict: "legit",
    hint: "Weigh the ask: does this message want anything from you?",
  },
  {
    id: "p-05",
    sender: "Microsoft 365",
    address: "security@microsoft-account-alerts.net",
    initials: "MS",
    subject: "Unusual sign-in from Lagos, Nigeria",
    preview:
      "We blocked a sign-in attempt. Review this activity within 24 hours or your account locks.",
    body: [
      "We blocked a sign-in attempt to your account from Lagos, Nigeria at 03:14 UTC on a Windows device.",
      "If this was not you, review the activity within 24 hours. Accounts not reviewed in that window are locked automatically.",
    ],
    link: "https://microsoft-account-alerts.net/review-activity",
    verdict: "phishing",
    hint: "Real vendors alert you from their own domain, not a lookalike one.",
  },
  {
    id: "p-06",
    sender: "Build pipeline",
    address: "builds@nimblrsecurity.com",
    initials: "BP",
    subject: "Build 4181 passed on main",
    preview: "312 tests, 0 failures. Staging deploy finished in 1m 48s.",
    body: [
      "Build 4181 passed on main. 312 tests, 0 failures, 1 skipped.",
      "Staging deploy finished in 1m 48s. Preview is live at staging.nimblrsecurity.com.",
    ],
    verdict: "legit",
    hint: "Automated notices from your own systems have no call to action.",
  },
  {
    id: "p-07",
    sender: "Hampus Olsson",
    address: "h.olsson.ceo@gmail.com",
    initials: "HO",
    subject: "quick favour — are you at your desk?",
    preview:
      "In back-to-back meetings. Need you to handle something discreetly. Don't call.",
    body: [
      "I'm in back-to-back meetings all morning and can't take calls. I need you to handle something discreetly for me.",
      "Are you at your desk? Reply here and I'll send the details. Keep this between us until it's done.",
    ],
    verdict: "phishing",
    hint: "Note which mailbox an internal colleague is writing from.",
  },
  {
    id: "p-08",
    sender: "SEO Growth Partners",
    address: "outreach@rank-first-global.co",
    initials: "SG",
    subject: "I noticed your site is not ranking",
    preview:
      "We audited nimblrsecurity.com and found 47 critical errors. Free report attached.",
    body: [
      "I ran an audit on your site and found 47 critical SEO errors holding back your rankings. My team can fix all of them within 30 days.",
      "Reply YES and I'll send the full report. If you're not the right person, please forward this to your marketing lead.",
    ],
    verdict: "spam",
    hint: "Unsolicited pitch, mass-mailed, no specific harm intended.",
  },
  {
    id: "p-09",
    sender: "DHL Express",
    address: "tracking@dhl-parcel-redelivery.com",
    initials: "DH",
    subject: "Parcel held — customs fee of 2.99 EUR unpaid",
    preview:
      "Your shipment is on hold. Pay the outstanding fee to release delivery.",
    body: [
      "Shipment 7741-9920-3311 is being held at our depot. An outstanding customs charge of 2.99 EUR must be settled before we can release it.",
      "Pay now to schedule redelivery. Unclaimed parcels return to sender after 5 days.",
    ],
    link: "https://dhl-parcel-redelivery.com/pay/7741992033",
    verdict: "phishing",
    hint: "A trivial fee is a cheap price for your card number.",
  },
  {
    id: "p-10",
    sender: "Priya Nair",
    address: "priya@nimblrsecurity.com",
    initials: "PN",
    subject: "Re: Onboarding copy, second pass",
    preview:
      'I cut the word "leverage" everywhere it appeared, which was ten times.',
    body: [
      'Second pass attached. I cut the word "leverage" everywhere it appeared, which was ten times.',
      'One open question: the empty state says "No messages found." That tells people nothing they can act on.',
    ],
    verdict: "legit",
    hint: "Re: threads with specific in-house detail rarely come from strangers.",
  },
  {
    id: "p-11",
    sender: "Wellness Rewards",
    address: "prizes@employee-perk-center.info",
    initials: "WR",
    subject: "You have been selected for a 500 EUR wellness grant",
    preview: "Claim your employee benefit before it is reallocated on Friday.",
    body: [
      "Congratulations. You have been selected to receive a 500 EUR wellness grant as part of this quarter's employee benefit allocation.",
      "Complete the short claim form to receive your funds. Unclaimed grants are reallocated on Friday.",
    ],
    link: "https://employee-perk-center.info/claim",
    verdict: "phishing",
    hint: "Benefits arrive through HR systems, never through a claim form you've never seen.",
  },
  {
    id: "p-12",
    sender: "Facilities",
    address: "facilities@nimblrsecurity.com",
    initials: "FA",
    subject: "Elevator B is out until Thursday",
    preview: "Use Elevator A or the north stairwell. Deliveries to the loading bay.",
    body: [
      "Elevator B is out of service for a control board replacement and returns Thursday afternoon.",
      "Deliveries above the third floor should be routed to the loading bay.",
    ],
    verdict: "legit",
    hint: "Nothing to click, nothing to confirm, nothing to pay.",
  },
  {
    id: "p-13",
    sender: "Adobe Sign",
    address: "echosign@adobe-secure-docs.com",
    initials: "AS",
    subject: "Tomas Lind has shared a document with you",
    preview: "Contract_Redlines_Final.pdf is waiting for your signature.",
    body: [
      "Tomas Lind has shared Contract_Redlines_Final.pdf with you and requested your signature.",
      "Sign in with your work email to view the document. The link expires in 48 hours.",
    ],
    link: "https://adobe-secure-docs.com/sign/8812",
    verdict: "phishing",
    hint: "It names a real colleague — check the service domain, not the name.",
  },
  {
    id: "p-14",
    sender: "Nordic Office Supplies",
    address: "campaigns@nordicofficesupplies.se",
    initials: "NO",
    subject: "Summer clearance: 40% off ergonomic chairs",
    preview: "Our warehouse sale runs through Sunday. Unsubscribe at the bottom.",
    body: [
      "Our summer clearance runs through Sunday. Ergonomic chairs, standing desks, and monitor arms are 40% off while stock lasts.",
      "You are receiving this because you requested a catalogue in 2024. Unsubscribe at the bottom of this email.",
    ],
    verdict: "spam",
    hint: "Commercial noise with a working unsubscribe is a nuisance, not an attack.",
  },
  {
    id: "p-15",
    sender: "Sofia Berg",
    address: "sofia@nimblrsecurity.com",
    initials: "SB",
    subject: "Lunch moved to 12:30",
    preview: "The 12:00 slot collided with the all-hands. Same place.",
    body: ["The 12:00 slot collided with the all-hands, so I pushed us to 12:30."],
    verdict: "legit",
    hint: "Short, mundane, and costs you nothing to be wrong about — but be right anyway.",
  },
  {
    id: "p-16",
    sender: "Payroll Notification",
    address: "payroll@nimblrsecurity-hr.com",
    initials: "PA",
    subject: "Your July payslip correction",
    preview:
      "An error was found in your July payment. Verify your bank details to receive the adjustment.",
    body: [
      "An error was identified in your July salary payment. An adjustment of 412 EUR has been approved.",
      "Verify your bank account details so we can release the correction with the August run.",
    ],
    link: "https://nimblrsecurity-hr.com/payroll/verify",
    verdict: "phishing",
    hint: "A hyphen and an extra word can turn your domain into someone else's.",
  },
  {
    id: "p-17",
    sender: "Conference Invites",
    address: "invitations@globaltechsummit-expo.net",
    initials: "CI",
    subject: "Speaker invitation: Global Tech Summit 2026",
    preview:
      "We would be honoured to have you keynote. Registration fee applies to speakers.",
    body: [
      "Our committee reviewed your profile and would be honoured to have you keynote at this year's summit in Dubai.",
      "Speakers cover a discounted registration fee of 890 USD. Confirm your slot within 7 days.",
    ],
    verdict: "spam",
    hint: "Real speaking invitations do not bill the speaker.",
  },
  {
    id: "p-18",
    sender: "Tomas Lind",
    address: "tomas.lind@lindpartners.se",
    initials: "TL",
    subject: "Contract redlines — need your read by Friday",
    preview: "Their counsel pushed back on clause 8.3. Two options in the margin.",
    body: [
      "Their counsel pushed back on clause 8.3, the 24-month data retention window. They want 12.",
      "I left two options in the margin. I prefer A. I need your read before Friday close.",
    ],
    verdict: "legit",
    hint: "External sender, but the domain matches the firm you already work with.",
  },
  {
    id: "p-19",
    sender: "Google Workspace",
    address: "no-reply@storage-quota-alerts.com",
    initials: "GW",
    subject: "Your storage is 99% full — messages will bounce",
    preview: "Free up space or upgrade now. Incoming mail is being rejected.",
    body: [
      "Your mailbox has reached 99% of its storage quota. Incoming messages will be rejected until space is available.",
      "Upgrade your quota now to keep receiving mail.",
    ],
    link: "https://storage-quota-alerts.com/upgrade",
    verdict: "phishing",
    hint: "Manufactured urgency plus a domain that belongs to no vendor you use.",
  },
  {
    id: "p-20",
    sender: "Accounts",
    address: "accounts-noreply@nimblrsecurity.com",
    initials: "AC",
    subject: "Invoice 2026-07-118 is ready",
    preview: "4,280 EUR due 21 August. No action needed if paid by transfer.",
    body: [
      "Invoice 2026-07-118 for July is ready. Amount due is 4,280 EUR, payable by 21 August.",
      "No action is needed if you pay by standing transfer.",
    ],
    verdict: "legit",
    hint: "Internal domain, no link, and it explicitly asks for nothing.",
  },
  {
    id: "p-21",
    sender: "Dating Connect",
    address: "matches@singles-near-you-now.top",
    initials: "DC",
    subject: "Elena, 28, viewed your profile 3 times",
    preview: "She is 2 km away and waiting for your message. View her photos.",
    body: [
      "Elena viewed your profile three times this week. She is 2 km from your location and has sent you a message.",
      "View her photos and reply before your free access expires.",
    ],
    link: "https://singles-near-you-now.top/elena",
    verdict: "spam",
    hint: "You do not have a profile on anything that would send this.",
  },
  {
    id: "p-22",
    sender: "PostNord",
    address: "delivery@postnnord.se",
    initials: "PN",
    subject: "Your parcel is waiting for a delivery choice",
    preview: "Choose a pickup point before 18:00 to avoid return to sender.",
    body: [
      "We were unable to deliver your parcel today. Choose a pickup point or a new delivery time before 18:00.",
      "Confirm your selection using BankID to avoid the parcel being returned to sender.",
    ],
    link: "https://postnnord.se/choose-delivery",
    verdict: "phishing",
    hint: "The sender domain has an extra n: postnnord.se is not postnord.se.",
  },
  {
    id: "p-23",
    sender: "BankID Support",
    address: "notice@bankid-verifier.se",
    initials: "BI",
    subject: "New security certificate available",
    preview: "Your BankID needs a quick security update before your next payment.",
    body: [
      "A new security certificate is available for your BankID. Install it before your next payment or identification.",
      "Open the secure update page and identify yourself to continue.",
    ],
    link: "https://bankid-verifier.se/update",
    verdict: "phishing",
    hint: "BankID does not ask you to identify yourself through a random update link.",
  },
  {
    id: "p-24",
    sender: "Nordic Freight AB",
    address: "billing@nordicfreight-ab.se",
    initials: "NF",
    subject: "Invoice NF-88419 — updated payment details",
    preview: "Please use the new account number for this month's freight invoice.",
    body: [
      "Our bank details have changed due to a system migration. Please use the account number in the attached payment instruction for invoice NF-88419.",
      "The invoice amount and due date are unchanged. Contact your usual representative if you have questions.",
    ],
    verdict: "phishing",
    hint: "A sudden bank-account change should be verified through a known contact, not the email.",
  },
  {
    id: "p-25",
    sender: "Microsoft 365",
    address: "no-reply@rnicrosoft.com",
    initials: "MS",
    subject: "Monthly licence assignment report",
    preview: "Your August licence assignment report is ready to review.",
    body: [
      "The August licence assignment report is ready. There are no actions required unless your team has changed roles.",
      "You can review the report in the admin centre at your convenience.",
    ],
    link: "https://rnicrosoft.com/admin/report",
    verdict: "phishing",
    hint: "The domain begins with rn, which can look like an m at a glance.",
  },
  {
    id: "p-26",
    sender: "PostNord",
    address: "no-reply@postnord.se",
    initials: "PN",
    subject: "Delivery status: package sent to service point",
    preview: "Your shipment is ready for collection at ICA Nära S:t Eriksplan.",
    body: [
      "Your shipment has been delivered to ICA Nära S:t Eriksplan and will be held for seven days.",
      "No payment or action is required. Bring valid identification when collecting your parcel.",
    ],
    verdict: "legit",
    hint: "It looks suspicious, but the domain is correct and it asks for neither money nor credentials.",
  },
  {
    id: "p-27",
    sender: "International Claims Office",
    address: "agent@unclaimed-funds-claim.net",
    initials: "IC",
    subject: "Urgent: 4,800,000 USD inheritance awaiting release",
    preview: "A relative has named you as beneficiary. Send a processing fee to begin.",
    body: [
      "You have been named as the beneficiary of an unclaimed inheritance. Our office can release the funds within five business days.",
      "Reply with your details and pay the 95 USD document processing fee to begin the claim.",
    ],
    verdict: "spam",
    hint: "Unexpected money plus an upfront fee is an advance-fee scam.",
  },
  {
    id: "p-28",
    sender: "Prize Centre",
    address: "winner@free-iphone-now.click",
    initials: "PC",
    subject: "FREE IPHONE — you were selected today!",
    preview: "Complete the winner survey in the next ten minutes to claim your prize.",
    body: [
      "Congratulations! Your email address was selected to receive a brand-new iPhone.",
      "Complete the short winner survey within ten minutes to reserve your prize.",
    ],
    link: "https://free-iphone-now.click/claim",
    verdict: "spam",
    hint: "A prize you never entered is just unsolicited junk trying to get a click.",
  },
];

const phishingDrills = [
  ["Microsoft 365", "security@rnicrosoft.com", "Shared document needs your review", "A lookalike domain swaps rn for m."],
  ["PostNord", "delivery@postnnord.se", "Choose a new delivery time", "The real domain is postnord.se, with one n."],
  ["BankID", "support@bankid-verify.se", "Security update required", "BankID does not send identification links from this domain."],
  ["DHL", "tracking@dhl-parcel-status.net", "Parcel held for a small customs fee", "A delivery notice should come from the carrier's own domain."],
  ["Nimblr IT", "helpdesk@nimblr-secure-login.com", "Password expiration notice", "Our internal mail comes from nimblrsecurity.com."],
  ["Adobe Sign", "notice@adobe-documents-secure.com", "Document waiting for signature", "The sender domain is not Adobe's service domain."],
  ["Payroll", "payroll@nimblrsecurity-payments.com", "Salary adjustment ready", "Payroll never asks for bank details through an email link."],
  ["Google Workspace", "alert@google-storage-quota.com", "Mailbox limit reached", "Urgency plus an unrelated domain is a credential trap."],
  ["Nordea", "verify@nordea-account-check.se", "New payment awaiting approval", "Verify banking notifications in the official app, not a link."],
  ["DocuSign", "envelope@docusign-review.net", "Contract envelope expires today", "The service name is real; the sender domain is not."],
];

const legitDrills = [
  ["Maja Andersson", "maja.andersson@nimblrsecurity.com", "Notes from the customer workshop", "A normal internal follow-up with specific context."],
  ["Nimblr Facilities", "facilities@nimblrsecurity.com", "Fire drill on Tuesday at 10:30", "A routine internal notice without a risky ask."],
  ["GitHub", "noreply@github.com", "Pull request review requested", "The domain is correct and the notification matches normal work."],
  ["PostNord", "no-reply@postnord.se", "Shipment ready at service point", "The correct domain and no payment request make this legitimate."],
  ["Lina Pettersson", "lina.pettersson@nimblrsecurity.com", "Re: August planning session", "Specific thread context is consistent with a real colleague."],
  ["Nimblr Accounts", "accounts@nimblrsecurity.com", "Monthly cost-centre report", "A familiar internal report has no credential or payment request."],
  ["Slack", "feedback@slack.com", "Weekly workspace activity", "A regular service digest from the real service domain."],
  ["Tomas Lind", "tomas.lind@lindpartners.se", "Re: Contract clause 8.3", "An external sender can still be legitimate when the relationship and domain match."],
  ["Build pipeline", "builds@nimblrsecurity.com", "Deployment completed successfully", "A normal automated system notice without an urgent action."],
  ["Nimblr HR", "hr@nimblrsecurity.com", "Benefits enrolment reminder", "The internal sender and established process make this a real reminder."],
];

const spamDrills = [
  ["SEO Fast Track", "offers@rank-rocket.biz", "Your website can rank #1 this month", "An unsolicited sales pitch is spam, even without a direct credential theft attempt."],
  ["Crypto Signals", "daily@coin-forecast.top", "Turn 200 EUR into a passive income", "Impossible returns and a cold outreach are classic junk mail."],
  ["Conference Bureau", "speakers@global-vision-expo.net", "You were selected as a featured speaker", "A vague invitation with a paid registration is an unsolicited pitch."],
  ["Prize Centre", "winner@instant-rewards.click", "You have won a brand-new phone", "You cannot win a contest you never entered."],
  ["Office Deals", "deals@bulk-supplies-mailer.com", "Final hours: 70% off everything", "A generic promotional blast is spam, not a personal request."],
  ["Dating Connect", "matches@nearby-singles.top", "Someone viewed your profile", "An unexpected service account message is commercial junk."],
  ["AI Growth Lab", "team@hypergrowth-mail.co", "Your competitors already use this AI trick", "Pressure-filled marketing copy is unsolicited promotional mail."],
  ["Travel Rewards", "rewards@fly-for-free-now.info", "Claim your unused airline points", "A vague reward from an unknown sender is spam."],
  ["Wellness Club", "offers@employee-perks-today.com", "Exclusive employee discount unlocked", "A generic offer from an unknown benefits provider is promotional noise."],
  ["Business Directory", "listing@european-biz-index.net", "Confirm your company listing", "Unsolicited directory listings are a common marketing tactic."],
];

function generateTrainingMail(verdict: Verdict, index: number): MailTemplate {
  const tier = (index % 5) + 1;
  const source =
    verdict === "phishing"
      ? phishingDrills[index % phishingDrills.length]
      : verdict === "legit"
        ? legitDrills[index % legitDrills.length]
        : spamDrills[index % spamDrills.length];
  const [sender, address, subject, hint] = source;
  const reference = String(1000 + index * 37);

  return {
    id: `drill-${verdict}-${tier}-${index}`,
    sender,
    address,
    initials: sender.split(" ").map((word) => word[0]).join("").slice(0, 2).toUpperCase(),
    subject: `${subject} — ref ${reference}`,
    preview:
      verdict === "legit"
        ? "This is a routine notification with details relevant to your work."
        : verdict === "phishing"
          ? "Review the details and complete the requested action as soon as possible."
          : "A special offer is waiting for you. Limited availability applies.",
    body:
      verdict === "legit"
        ? [
            "Hello, this is a standard update related to an existing service, project, or internal process.",
            "No urgent action is required. Please review it when convenient.",
          ]
        : verdict === "phishing"
          ? [
              "We noticed an issue that requires your attention. Complete the requested review to avoid interruption.",
              "Use the secure link below to continue the process.",
            ]
          : [
              "We have selected you for a special offer designed to improve your results immediately.",
              "Act now to keep this opportunity from expiring.",
            ],
    link: verdict === "legit" ? undefined : `https://${address.split("@")[1]}/ref/${reference}`,
    verdict,
    hint,
  };
}

const generatedMailPool = (["phishing", "legit", "spam"] as const).flatMap((verdict) =>
  Array.from({ length: 40 }, (_, index) => generateTrainingMail(verdict, index)),
);

export const mailPool: MailTemplate[] = [...curatedMailPool, ...generatedMailPool];
