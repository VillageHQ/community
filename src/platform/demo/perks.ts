// The demo's perks. The real perks page frames a BuiltFirst marketplace; the demo has none, so it lists these made-up
// deals instead, labelled as demo. Every company and offer is invented.

export type DemoPerk = { company: string; offer: string; detail: string; category: string };

export const DEMO_PERKS_NOTE = "Made-up deals. A real community shows its BuiltFirst perks marketplace here.";

export const DEMO_PERKS: readonly DemoPerk[] = [
  { company: "Cloudnest", offer: "$5,000 in hosting credits", detail: "For your first year, on any plan.", category: "Infrastructure" },
  { company: "Inkwell Legal", offer: "Free incorporation review", detail: "A one-hour call on your founding documents with a startup lawyer.", category: "Legal" },
  { company: "Tallybooks", offer: "50% off bookkeeping for 6 months", detail: "Monthly books and a year-end pack for your accountant.", category: "Finance" },
  { company: "Hirewell", offer: "Your first job post free", detail: "Plus 20% off a year of the applicant tracker.", category: "Hiring" },
  { company: "Pixelpost", offer: "3 months of design tools free", detail: "For up to 10 seats.", category: "Design" },
  { company: "Brightdesk", offer: "20% off a year of support software", detail: "Shared inbox, help centre and chat.", category: "Customers" },
];
