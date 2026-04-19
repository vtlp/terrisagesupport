// Shared lookup data — single source of truth for tags, cities, portals, sources

export interface LookupItem {
  id: string;
  value: string;
}

export const defaultSources: LookupItem[] = [
  { id: 'S1', value: 'Call (Direct)' },
  { id: 'S2', value: 'Landing Page' },
  { id: 'S3', value: 'Meta Ads' },
  { id: 'S4', value: 'Champion / Partner' },
  { id: 'S5', value: 'CP Request (Projects)' },
];

export const defaultTags: LookupItem[] = [
  { id: 'T1', value: 'export' },
  { id: 'T2', value: 'integration' },
  { id: 'T3', value: 'billing' },
  { id: 'T4', value: 'onboarding' },
  { id: 'T5', value: 'login' },
  { id: 'T6', value: 'performance' },
  { id: 'T7', value: 'mobile' },
  { id: 'T8', value: 'data-import' },
  { id: 'T9', value: 'leads' },
  { id: 'T10', value: 'google' },
];

// Top 10 most popular cities first, then remaining tier-1/tier-2 alphabetically
export const defaultMarkets: LookupItem[] = [
  // Top 10
  { id: 'M1', value: 'Mumbai' },
  { id: 'M2', value: 'Delhi' },
  { id: 'M3', value: 'Bangalore' },
  { id: 'M4', value: 'Hyderabad' },
  { id: 'M5', value: 'Pune' },
  { id: 'M6', value: 'Chennai' },
  { id: 'M7', value: 'Kolkata' },
  { id: 'M8', value: 'Ahmedabad' },
  { id: 'M9', value: 'Jaipur' },
  { id: 'M10', value: 'Lucknow' },
  // Remaining tier-1 & tier-2 (alphabetical)
  { id: 'M11', value: 'Agra' },
  { id: 'M12', value: 'Ajmer' },
  { id: 'M13', value: 'Aligarh' },
  { id: 'M14', value: 'Allahabad (Prayagraj)' },
  { id: 'M15', value: 'Amravati' },
  { id: 'M16', value: 'Amritsar' },
  { id: 'M17', value: 'Anand' },
  { id: 'M18', value: 'Aurangabad (Sambhajinagar)' },
  { id: 'M19', value: 'Bareilly' },
  { id: 'M20', value: 'Belgaum (Belagavi)' },
  { id: 'M21', value: 'Bhilai' },
  { id: 'M22', value: 'Bhopal' },
  { id: 'M23', value: 'Bhubaneswar' },
  { id: 'M24', value: 'Bikaner' },
  { id: 'M25', value: 'Chandigarh' },
  { id: 'M26', value: 'Coimbatore' },
  { id: 'M27', value: 'Cuttack' },
  { id: 'M28', value: 'Dehradun' },
  { id: 'M29', value: 'Dhanbad' },
  { id: 'M30', value: 'Durgapur' },
  { id: 'M31', value: 'Erode' },
  { id: 'M32', value: 'Faridabad' },
  { id: 'M33', value: 'Ghaziabad' },
  { id: 'M34', value: 'Goa (Panaji)' },
  { id: 'M35', value: 'Gorakhpur' },
  { id: 'M36', value: 'Guntur' },
  { id: 'M37', value: 'Gurgaon (Gurugram)' },
  { id: 'M38', value: 'Guwahati' },
  { id: 'M39', value: 'Gwalior' },
  { id: 'M40', value: 'Hubli-Dharwad' },
  { id: 'M41', value: 'Imphal' },
  { id: 'M42', value: 'Indore' },
  { id: 'M43', value: 'Jabalpur' },
  { id: 'M44', value: 'Jalandhar' },
  { id: 'M45', value: 'Jammu' },
  { id: 'M46', value: 'Jamshedpur' },
  { id: 'M47', value: 'Jodhpur' },
  { id: 'M48', value: 'Kanpur' },
  { id: 'M49', value: 'Kochi' },
  { id: 'M50', value: 'Kota' },
  { id: 'M51', value: 'Kozhikode (Calicut)' },
  { id: 'M52', value: 'Ludhiana' },
  { id: 'M53', value: 'Madurai' },
  { id: 'M54', value: 'Mangalore (Mangaluru)' },
  { id: 'M55', value: 'Meerut' },
  { id: 'M56', value: 'Moradabad' },
  { id: 'M57', value: 'Mysore (Mysuru)' },
  { id: 'M58', value: 'Nagpur' },
  { id: 'M59', value: 'Nashik' },
  { id: 'M60', value: 'Navi Mumbai' },
  { id: 'M61', value: 'Nellore' },
  { id: 'M62', value: 'Noida' },
  { id: 'M63', value: 'Patna' },
  { id: 'M64', value: 'Pondicherry (Puducherry)' },
  { id: 'M65', value: 'Raipur' },
  { id: 'M66', value: 'Rajkot' },
  { id: 'M67', value: 'Ranchi' },
  { id: 'M68', value: 'Rohtak' },
  { id: 'M69', value: 'Rourkela' },
  { id: 'M70', value: 'Salem' },
  { id: 'M71', value: 'Sangli' },
  { id: 'M72', value: 'Shimla' },
  { id: 'M73', value: 'Siliguri' },
  { id: 'M74', value: 'Solapur' },
  { id: 'M75', value: 'Srinagar' },
  { id: 'M76', value: 'Surat' },
  { id: 'M77', value: 'Thane' },
  { id: 'M78', value: 'Thiruvananthapuram' },
  { id: 'M79', value: 'Tiruchirappalli (Trichy)' },
  { id: 'M80', value: 'Tirupati' },
  { id: 'M81', value: 'Udaipur' },
  { id: 'M82', value: 'Ujjain' },
  { id: 'M83', value: 'Vadodara' },
  { id: 'M84', value: 'Varanasi' },
  { id: 'M85', value: 'Vijayawada' },
  { id: 'M86', value: 'Visakhapatnam' },
  { id: 'M87', value: 'Warangal' },
];

export const defaultPortals: LookupItem[] = [
  { id: 'P1', value: 'MagicBricks' },
  { id: 'P2', value: '99acres' },
  { id: 'P3', value: 'Housing.com' },
  { id: 'P4', value: 'NoBroker' },
  { id: 'P5', value: 'CommonFloor' },
  { id: 'P6', value: 'Square Yards' },
];

// Helper to get city names as a simple string array
export const getCityOptions = (): string[] => defaultMarkets.map(m => m.value);
export const getTagOptions = (): string[] => defaultTags.map(t => t.value);

// Shared business area options (Agency onboarding + Account overview)
export const BUSINESS_AREA_OPTIONS = [
  { label: "Primary Market Sales Only", value: "primary-sales", description: "Focused exclusively on selling new launch or under-construction projects directly from builders and developers." },
  { label: "Primary and Secondary Market Sales", value: "primary-secondary-sales", description: "Handles both new project sales and resale of existing properties across markets." },
  { label: "Sales and Rentals in All Markets", value: "sales-rentals-all", description: "Full-service operations covering sales and rentals across primary, secondary, and all property markets." },
  { label: "Rental Only", value: "rental-only", description: "Specialised in rental and leasing services for residential or commercial properties." },
];

// Shared property type focus options (Builder onboarding + Account overview)
export const PROPERTY_TYPE_FOCUS_OPTIONS = [
  { label: "Apartments", value: "apartments" },
  { label: "Villas", value: "villas" },
  { label: "Plots", value: "plots" },
  { label: "Mix", value: "mix" },
];
