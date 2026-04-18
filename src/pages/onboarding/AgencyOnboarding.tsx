import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { StepperNav } from "@/components/onboarding/StepperNav";
import { StickyActionBar } from "@/components/onboarding/StickyActionBar";
import { HeroSection } from "@/components/onboarding/HeroSection";
import { TextField, TextAreaField, SelectField, SwitchField } from "@/components/onboarding/FormField";
import { PhoneField } from "@/components/onboarding/PhoneField";
import { FileUploadField } from "@/components/onboarding/FileUploadField";
import { RepeatableCard, AddCardButton } from "@/components/onboarding/RepeatableCard";
import { GuidanceCard } from "@/components/onboarding/GuidanceCard";
import { ReferencePanel } from "@/components/onboarding/ReferencePanel";
import { ReviewSummaryCard } from "@/components/onboarding/ReviewSummaryCard";
import { Checkbox } from "@/components/ui/checkbox";
import { saveDraft, loadDraft, clearDraft, filesToSerializable, serializableToFiles } from "@/lib/onboardingStorage";
import {
  LOGO_FORMATS, BROCHURE_FORMATS, IMPORT_FILE_FORMATS,
  LOGO_EXTENSIONS, BROCHURE_EXTENSIONS, IMPORT_EXTENSIONS,
  BULK_IMPORT_MAX_BYTES,
} from "@/lib/onboardingValidation";
import { submitOnboarding, uploadFiles, getEnquiryIdFromUrl, checkSubmissionLock, AlreadySubmittedError } from "@/lib/onboardingSubmit";
import { readOnboardingPrefill } from "@/lib/onboardingPrefill";
import { AlreadySubmittedScreen } from "@/components/onboarding/AlreadySubmittedScreen";

const STEPS = [
  { number: 1, label: "Business & Primary Contact" },
  { number: 2, label: "Team Access & Permissions" },
  { number: 3, label: "Projects & Bulk Imports" },
  { number: 4, label: "Review & Submit" },
];

const BUSINESS_AREA_OPTIONS = [
  { label: "Primary Market Sales Only", value: "primary-sales", description: "Focused exclusively on selling new launch or under-construction projects directly from builders and developers." },
  { label: "Primary and Secondary Market Sales", value: "primary-secondary-sales", description: "Handles both new project sales and resale of existing properties across markets." },
  { label: "Sales and Rentals in All Markets", value: "sales-rentals-all", description: "Full-service operations covering sales and rentals across primary, secondary, and all property markets." },
  { label: "Rental Only", value: "rental-only", description: "Specialised in rental and leasing services for residential or commercial properties." },
];

const ROLE_OPTIONS = [
  { label: "Admin", value: "admin" },
  { label: "Agent", value: "agent" },
];

function createTeamMember() {
  return { id: crypto.randomUUID(), fullName: "", mobile: "", mobileCode: "+91", email: "", role: "", orgWideAccess: false, agentNetworksAccess: false };
}

function createProject() {
  return { id: crypto.randomUUID(), projectName: "", location: "", repName: "", repMobile: "", repMobileCode: "+91", repEmail: "", builderName: "", brochure: [] as File[] };
}

type TeamMember = ReturnType<typeof createTeamMember>;
type Project = ReturnType<typeof createProject>;

const validatePhone = (phone: string) => /^\d{10}$/.test(phone);

export default function AgencyOnboarding() {
  const navigate = useNavigate();
  const prefill = readOnboardingPrefill();
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lockChecking, setLockChecking] = useState(true);
  const [lockedAt, setLockedAt] = useState<string | null>(null);

  // Force light theme + Poppins font on the public onboarding form, regardless
  // of the staff app's current theme. We restore on unmount so going back to
  // the CRM keeps the user's preference.
  useEffect(() => {
    const root = document.documentElement;
    const prevClass = root.className;
    const prevFont = root.style.fontFamily;
    root.classList.remove("dark");
    root.classList.add("light");
    root.style.fontFamily = "'Poppins', system-ui, sans-serif";
    return () => {
      root.className = prevClass;
      root.style.fontFamily = prevFont;
    };
  }, []);

  useEffect(() => {
    const enquiryId = getEnquiryIdFromUrl();
    checkSubmissionLock(enquiryId)
      .then((ts) => setLockedAt(ts))
      .finally(() => setLockChecking(false));
  }, []);

  // Step 1
  const [fullName, setFullName] = useState(prefill.fullName ?? "");
  const [mobile, setMobile] = useState(prefill.phone ?? "");
  const [mobileCode, setMobileCode] = useState(prefill.mobileCode ?? "+91");
  const [email, setEmail] = useState(prefill.email ?? "");
  const [companyName, setCompanyName] = useState("");
  const [companyTagline, setCompanyTagline] = useState("");
  const [companyLogo, setCompanyLogo] = useState<File[]>([]);
  const [reraId, setReraId] = useState("");
  const [city, setCity] = useState("");
  const [businessArea, setBusinessArea] = useState("");
  const [notes, setNotes] = useState("");

  // Step 2
  const [seatsRequired, setSeatsRequired] = useState(prefill.teamSize ?? "");
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([createTeamMember()]);

  const lockFullName = false;
  const lockMobile = false;
  const lockEmail = false;
  const lockSeats = !!prefill.teamSize;

  // Step 3
  const [projects, setProjects] = useState<Project[]>([createProject()]);
  // Bulk imports (optional) — replaces the previous Lead/Property import sections.
  const [bulkImportFiles, setBulkImportFiles] = useState<File[]>([]);
  const [bulkImportNotes, setBulkImportNotes] = useState("");

  useEffect(() => {
    const draft = loadDraft("agency");
    if (draft) {
      try {
        const d = draft.data;
        setCurrentStep(draft.currentStep);
        // Locked fields (prefilled from enquiry) must not be overridden by an
        // older draft — the CRM-supplied values are authoritative.
        if (d.fullName && !lockFullName) setFullName(d.fullName);
        if (d.mobile && !lockMobile) setMobile(d.mobile);
        if (d.mobileCode && !lockMobile) setMobileCode(d.mobileCode);
        if (d.email && !lockEmail) setEmail(d.email);
        if (d.companyName) setCompanyName(d.companyName);
        if (d.companyTagline) setCompanyTagline(d.companyTagline);
        if (d.reraId) setReraId(d.reraId);
        if (d.city) setCity(d.city);
        if (d.businessArea) setBusinessArea(d.businessArea);
        if (d.notes) setNotes(d.notes);
        if (d.seatsRequired && !lockSeats) setSeatsRequired(d.seatsRequired);
        if (d.teamMembers) setTeamMembers(d.teamMembers);
        if (d.projects) setProjects(d.projects.map((p: any) => ({ ...p, brochure: [] })));
        // Restore the previously uploaded company logo so it doesn't disappear
        // when the user reopens the form from a saved draft.
        if (d.companyLogoSerialized) setCompanyLogo(serializableToFiles(d.companyLogoSerialized));
        if (d.bulkImportNotes) setBulkImportNotes(d.bulkImportNotes);
        toast.info("Draft restored. You may continue where you left off.");
      } catch { /* ignore */ }
    }
  }, []);

  const handleSaveDraft = async () => {
    // Persist company logo as base64 so it survives page reloads. Bulk import
    // files can be very large (up to 100 MB each), so we deliberately do NOT
    // serialise them — users re-attach those before final submission.
    const companyLogoSerialized = await filesToSerializable(companyLogo);
    const data = {
      fullName, mobile, mobileCode, email, companyName, companyTagline, reraId, city, businessArea, notes,
      seatsRequired, teamMembers,
      projects: projects.map(p => ({ ...p, brochure: undefined })),
      companyLogoSerialized,
      bulkImportNotes,
    };
    saveDraft("agency", data, currentStep);
    toast.success("Draft saved successfully.");
  };

  const validateStep1 = () => {
    const e: Record<string, string> = {};
    if (!fullName.trim()) e.fullName = "Please enter the full name.";
    if (!mobile.trim()) e.mobile = "Please provide a mobile number.";
    else if (!validatePhone(mobile)) e.mobile = "Please enter a 10-digit mobile number.";
    if (!email.trim()) e.email = "Please enter an email address.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "Please enter a valid email address.";
    if (!companyName.trim()) e.companyName = "Please enter the company name.";
    if (!city.trim()) e.city = "Please select the city or primary market.";
    if (!businessArea) e.businessArea = "Please select your business area.";
    setErrors(e);
    if (Object.keys(e).length > 0) {
      const firstKey = Object.keys(e)[0];
      document.querySelector(`[data-field="${firstKey}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    return Object.keys(e).length === 0;
  };

  const validateStep2 = () => {
    const e: Record<string, string> = {};
    if (!seatsRequired || parseInt(seatsRequired) < 1) e.seatsRequired = "Please enter the number of seats required.";
    teamMembers.forEach((tm, i) => {
      if (!tm.fullName.trim()) e[`tm_${i}_fullName`] = "Please enter the team member's full name.";
      if (!tm.mobile.trim()) e[`tm_${i}_mobile`] = "Please provide a mobile number.";
      else if (!validatePhone(tm.mobile)) e[`tm_${i}_mobile`] = "Please enter a 10-digit mobile number.";
      if (!tm.email.trim()) e[`tm_${i}_email`] = "Please enter an email address.";
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(tm.email)) e[`tm_${i}_email`] = "Please enter a valid email address.";
      if (!tm.role) e[`tm_${i}_role`] = "Please select a role.";
    });
    setErrors(e);
    if (Object.keys(e).length > 0) toast.error("Please complete all required team member details before continuing.");
    return Object.keys(e).length === 0;
  };

  const validateStep3 = () => {
    const e: Record<string, string> = {};
    // Per request: project fields are no longer mandatory for the agency form.
    // Only the project name is required when a project card is filled in, and
    // representative mobile (if provided) must be 10 digits. Bulk imports are
    // entirely optional.
    projects.forEach((p, i) => {
      if (p.repMobile.trim() && !validatePhone(p.repMobile)) {
        e[`proj_${i}_repMobile`] = "Please enter a 10-digit mobile number.";
      }
    });
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleContinue = () => {
    let valid = false;
    if (currentStep === 1) valid = validateStep1();
    else if (currentStep === 2) valid = validateStep2();
    else if (currentStep === 3) valid = validateStep3();
    else valid = true;
    if (valid) {
      setCompletedSteps((prev) => [...new Set([...prev, currentStep])]);
      setCurrentStep((s) => Math.min(s + 1, 4));
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleBack = () => {
    setCurrentStep((s) => Math.max(s - 1, 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async () => {
    if (!confirmed) { setErrors({ confirmed: "Please confirm the declaration before submitting." }); return; }
    if (!validateStep1()) { setCurrentStep(1); return; }
    if (!validateStep2()) { setCurrentStep(2); return; }
    if (!validateStep3()) { setCurrentStep(3); return; }

    setSubmitting(true);
    try {
      const enquiryId = getEnquiryIdFromUrl();
      const folder = `agency/${enquiryId ?? "anon"}/${Date.now()}`;
      const [logoPaths, bulkImportPaths] = await Promise.all([
        uploadFiles(companyLogo, `${folder}/logo`),
        uploadFiles(bulkImportFiles, `${folder}/bulk-imports`),
      ]);
      const projectsWithBrochures = await Promise.all(projects.map(async (p, i) => ({
        ...p,
        brochure: undefined,
        brochurePaths: await uploadFiles(p.brochure, `${folder}/project-${i + 1}-brochure`),
      })));

      const payload = {
        primary_contact: { full_name: fullName, mobile, mobile_code: mobileCode, email },
        company: { name: companyName, tagline: companyTagline, rera_id: reraId, city, business_area: businessArea, logo_paths: logoPaths },
        company_name: companyName,
        owner_name: fullName,
        owner_phone: `${mobileCode}${mobile}`,
        owner_email: email,
        city,
        rera_number: reraId,
        team: { seats_required: seatsRequired, members: teamMembers },
        team_members: teamMembers.map(tm => ({ full_name: tm.fullName, email: tm.email, phone: `${tm.mobileCode}${tm.mobile}`, role: tm.role })),
        projects: projectsWithBrochures,
        bulk_imports: { paths: bulkImportPaths, notes: bulkImportNotes },
        notes,
      };

      await submitOnboarding("AGENCY_BROKERAGE_CONSULTANCY", payload, enquiryId);
      clearDraft("agency");
      navigate("/onboarding/agency/success");
    } catch (err) {
      if (err instanceof AlreadySubmittedError) {
        setLockedAt(err.submittedAt ?? new Date().toISOString());
        setSubmitting(false);
        return;
      }
      const msg = err instanceof Error ? err.message : "Submission failed. Please try again.";
      toast.error(msg);
      setSubmitting(false);
    }
  };

  const updateTeamMember = (index: number, field: string, value: any) => {
    setTeamMembers((prev) => prev.map((tm, i) => i === index ? { ...tm, [field]: value } : tm));
  };

  const updateProject = (index: number, field: string, value: any) => {
    setProjects((prev) => prev.map((p, i) => i === index ? { ...p, [field]: value } : p));
  };

  if (lockChecking) {
    return <div className="min-h-screen bg-background flex items-center justify-center text-sm text-muted-foreground">Loading…</div>;
  }
  if (lockedAt) {
    return <AlreadySubmittedScreen submittedAt={lockedAt} tenancy="agency" />;
  }

  return (
    <div className="min-h-screen bg-background">
      <StepperNav steps={STEPS} currentStep={currentStep} completedSteps={completedSteps} onStepClick={(s) => { setCurrentStep(s); window.scrollTo({ top: 0, behavior: "smooth" }); }} />

      {currentStep === 1 && (
        <>
          <HeroSection
            title="Agency Onboarding for Terrisage CRM"
            subtitle="Share your company, team, project, and data details so we can prepare your CRM workspace accurately and efficiently."
            supportingText="Complete the onboarding in four guided steps. You may save your progress and return later if needed."
            preparationNote="Having your team list, project brochures, and any lead or property spreadsheets ready will help you complete this more quickly."
          />
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-32 space-y-10">
            <section className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-foreground">Primary Account Owner</h2>
                <p className="text-sm text-muted-foreground mt-1">This person will receive the primary account access and will be our main point of contact during onboarding, setup, and training.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div data-field="fullName"><TextField label="Full name" required value={fullName} onChange={setFullName} error={errors.fullName} /></div>
                <div data-field="mobile"><PhoneField label="Mobile number" required countryCode={mobileCode} onCountryCodeChange={setMobileCode} value={mobile} onChange={setMobile} error={errors.mobile} /></div>
                <div data-field="email" className="sm:col-span-2"><TextField label="Email address" type="email" required value={email} onChange={setEmail} error={errors.email} /></div>
              </div>
            </section>

            <section className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-foreground">Company Details</h2>
                <p className="text-sm text-muted-foreground mt-1">These details help us configure your CRM workspace and company profile correctly from the start.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div data-field="companyName"><TextField label="Company name" required value={companyName} onChange={setCompanyName} error={errors.companyName} /></div>
                <TextField label="Company tagline" value={companyTagline} onChange={setCompanyTagline} />
                <div className="sm:col-span-2">
                  <FileUploadField label="Company logo" acceptedFormats={LOGO_EXTENSIONS} acceptedMimeTypes={LOGO_FORMATS} files={companyLogo} onChange={setCompanyLogo} helperText="Upload your company logo for workspace branding." />
                </div>
                <TextField label="RERA ID" value={reraId} onChange={setReraId} />
                <div data-field="city"><TextField label="City / primary market served" required value={city} onChange={setCity} error={errors.city} /></div>
                <div data-field="businessArea"><SelectField label="Business area" required value={businessArea} onChange={setBusinessArea} options={BUSINESS_AREA_OPTIONS} error={errors.businessArea} /></div>
              </div>
            </section>

            <section className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-foreground">Additional Onboarding Notes</h2>
                <p className="text-sm text-muted-foreground mt-1">Use this space for anything we should know before setup begins, such as operating structure, key priorities, or specific requests.</p>
              </div>
              <TextAreaField label="Notes for onboarding team" value={notes} onChange={setNotes} rows={4} />
            </section>
          </motion.div>
        </>
      )}

      {currentStep === 2 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 pb-32 space-y-8">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Team Access & Permissions</h2>
            <p className="text-sm text-muted-foreground mt-1">Capture seat requirements, user accounts, roles, and permission settings.</p>
          </div>

          <div data-field="seatsRequired">
            <TextField label="Number of seats required" type="number" required value={seatsRequired} onChange={setSeatsRequired} error={errors.seatsRequired} disabled={lockSeats} helperText={lockSeats ? "Set during your enquiry. Contact the Terrisage team if you need to add more seats." : "This helps us prepare the correct number of user accounts for your initial setup."} className="max-w-xs" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <GuidanceCard title="Role Guide" defaultOpen items={[
              { term: "Admin", description: "Operational control across the organisation, including users, enquiries, team coordination, and company-wide lead and property oversight." },
              { term: "Agent", description: "Day-to-day working access for handling leads and properties, with optional broader permissions where required." },
            ]} />
            <GuidanceCard title="Agent Permissions Guide" items={[
              { term: "Organisation-wide Lead & Property Management", description: "Gives an Agent broader company-wide visibility and management capabilities across leads, enquiries, and properties." },
              { term: "Agent Networks Access", description: "Gives access to the Agent Network area for directory, invitations, and referrals." },
            ]} />
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Team Members</h3>
            {teamMembers.map((tm, idx) => (
              <RepeatableCard key={tm.id} title={`Team Member ${idx + 1}`} subtitle={tm.fullName || undefined} index={idx} onRemove={() => setTeamMembers((prev) => prev.filter((_, i) => i !== idx))} canRemove={teamMembers.length > 1}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <TextField label="Full name" required value={tm.fullName} onChange={(v) => updateTeamMember(idx, "fullName", v)} error={errors[`tm_${idx}_fullName`]} />
                  <PhoneField label="Mobile number" required countryCode={tm.mobileCode} onCountryCodeChange={(v) => updateTeamMember(idx, "mobileCode", v)} value={tm.mobile} onChange={(v) => updateTeamMember(idx, "mobile", v)} error={errors[`tm_${idx}_mobile`]} />
                  <TextField label="Email address" type="email" required value={tm.email} onChange={(v) => updateTeamMember(idx, "email", v)} error={errors[`tm_${idx}_email`]} />
                  <SelectField label="Role" required value={tm.role} onChange={(v) => updateTeamMember(idx, "role", v)} options={ROLE_OPTIONS} error={errors[`tm_${idx}_role`]} />
                </div>
                {tm.role === "agent" && (
                  <div className="space-y-3 mt-4">
                    <p className="text-sm font-medium text-foreground">Agent Permissions</p>
                    <SwitchField
                      label="Organisation-wide Lead & Property Management"
                      description="Grants view access to all company leads and properties, including unassigned items. Enables assignment and reassignment of leads, properties, and enquiries."
                      checked={tm.orgWideAccess}
                      onChange={(v) => updateTeamMember(idx, "orgWideAccess", v)}
                    />
                    <SwitchField
                      label="Agent Networks Access"
                      description="Grants access to the Agent Network module, including directory, invitations, and referrals."
                      checked={tm.agentNetworksAccess}
                      onChange={(v) => updateTeamMember(idx, "agentNetworksAccess", v)}
                    />
                  </div>
                )}
              </RepeatableCard>
            ))}
            <AddCardButton label="Add another team member" onClick={() => setTeamMembers((prev) => [...prev, createTeamMember()])} />
          </div>
        </motion.div>
      )}

      {currentStep === 3 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 pb-32 space-y-10">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Projects & Bulk Imports</h2>
            <p className="text-sm text-muted-foreground mt-1">Tell us about the projects your agency works on. Bulk imports are optional — share them now if ready, or send them later.</p>
          </div>

          <section className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-foreground">Projects You Work On <span className="text-sm font-normal text-muted-foreground">(Optional)</span></h3>
              <p className="text-sm text-muted-foreground mt-1">Add the projects your team is actively marketing, selling, renting, or managing. None of the project fields are required — share whatever you have available.</p>
            </div>
            {projects.map((proj, idx) => (
              <RepeatableCard key={proj.id} title={`Project ${idx + 1}`} subtitle={proj.projectName || undefined} index={idx} onRemove={() => setProjects((prev) => prev.filter((_, i) => i !== idx))} canRemove={projects.length > 1}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <TextField label="Project name" value={proj.projectName} onChange={(v) => updateProject(idx, "projectName", v)} error={errors[`proj_${idx}_projectName`]} />
                  <TextField label="Google Maps address / project location" value={proj.location} onChange={(v) => updateProject(idx, "location", v)} error={errors[`proj_${idx}_location`]} />
                  <TextField label="Project representative name" value={proj.repName} onChange={(v) => updateProject(idx, "repName", v)} error={errors[`proj_${idx}_repName`]} placeholder="e.g. Arjun Agnihotri" />
                  <PhoneField label="Project representative mobile number" countryCode={proj.repMobileCode} onCountryCodeChange={(v) => updateProject(idx, "repMobileCode", v)} value={proj.repMobile} onChange={(v) => updateProject(idx, "repMobile", v)} error={errors[`proj_${idx}_repMobile`]} />
                  <TextField label="Project representative email" type="email" value={proj.repEmail} onChange={(v) => updateProject(idx, "repEmail", v)} />
                  <TextField label="Builder name" value={proj.builderName} onChange={(v) => updateProject(idx, "builderName", v)} error={errors[`proj_${idx}_builderName`]} />
                </div>
                <FileUploadField label="Project brochure" acceptedFormats={BROCHURE_EXTENSIONS} acceptedMimeTypes={BROCHURE_FORMATS} files={proj.brochure} onChange={(files) => updateProject(idx, "brochure", files)} helperText="Upload the latest brochure for this project." />
              </RepeatableCard>
            ))}
            <AddCardButton label="Add another project" onClick={() => setProjects((prev) => [...prev, createProject()])} />
          </section>

          <section className="space-y-5">
            <div>
              <h3 className="text-lg font-semibold text-foreground">Bulk Imports <span className="text-sm font-normal text-muted-foreground">(Optional)</span></h3>
              <p className="text-sm text-muted-foreground mt-1">Upload any files you'd like us to import — leads, properties, contacts, or anything else. PDF, Word, Excel, CSV and image formats are supported, up to 100 MB per file.</p>
            </div>
            <FileUploadField
              label="Upload import files"
              acceptedFormats={IMPORT_EXTENSIONS}
              acceptedMimeTypes={IMPORT_FILE_FORMATS}
              files={bulkImportFiles}
              onChange={setBulkImportFiles}
              multiple
              maxSizeBytes={BULK_IMPORT_MAX_BYTES}
              helperText="Maximum file size: 100 MB."
            />
            <TextAreaField label="Import notes" value={bulkImportNotes} onChange={setBulkImportNotes} rows={3} helperText="Add any context that will help us process these imports correctly." />
          </section>
        </motion.div>
      )}

      {currentStep === 4 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 pb-32 space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Review & Submit</h2>
            <p className="text-sm text-muted-foreground mt-1">Please review your details carefully before final submission.</p>
          </div>

          <ReviewSummaryCard title="Business & Primary Contact" onEdit={() => setCurrentStep(1)} fields={[
            { label: "Full name", value: fullName, required: true },
            { label: "Mobile number", value: mobile ? `${mobileCode} ${mobile}` : undefined, required: true },
            { label: "Email address", value: email, required: true },
            { label: "Company name", value: companyName, required: true },
            { label: "Company tagline", value: companyTagline },
            { label: "RERA ID", value: reraId },
            { label: "City / primary market", value: city, required: true },
            { label: "Business area", value: BUSINESS_AREA_OPTIONS.find(a => a.value === businessArea)?.label, required: true },
          ]} />

          <ReviewSummaryCard title="Team Access & Permissions" onEdit={() => setCurrentStep(2)} fields={[
            { label: "Seats required", value: seatsRequired, required: true },
            ...teamMembers.flatMap((tm, i) => [
              { label: `Team Member ${i + 1}`, value: `${tm.fullName} — ${ROLE_OPTIONS.find(r => r.value === tm.role)?.label || "No role"}`, required: true },
            ]),
          ]} />

          {projects.map((proj, i) => (
            <ReviewSummaryCard key={proj.id} title={`Project ${i + 1}`} onEdit={() => setCurrentStep(3)} fields={[
              { label: "Project name", value: proj.projectName },
              { label: "Location", value: proj.location },
              { label: "Representative", value: proj.repName },
              { label: "Builder", value: proj.builderName },
              { label: "Brochure", value: proj.brochure.length > 0 ? `${proj.brochure.length} file(s)` : undefined },
            ]} />
          ))}

          <ReviewSummaryCard title="Bulk Imports" onEdit={() => setCurrentStep(3)} fields={[
            { label: "Files", value: bulkImportFiles.length > 0 ? `${bulkImportFiles.length} file(s)` : undefined },
            { label: "Notes", value: bulkImportNotes },
          ]} />

          {notes && (
            <ReviewSummaryCard title="Additional Notes" onEdit={() => setCurrentStep(1)} fields={[{ label: "Notes", value: notes }]} />
          )}

          <div className="bg-card border border-border rounded-lg p-5 space-y-4">
            <div className="flex items-start gap-3">
              <Checkbox id="confirm" checked={confirmed} onCheckedChange={(v) => { setConfirmed(v as boolean); setErrors((e) => ({ ...e, confirmed: "" })); }} className="mt-0.5" />
              <label htmlFor="confirm" className="text-sm text-foreground leading-relaxed cursor-pointer">
                I confirm that the information shared is accurate to the best of my knowledge and that I am authorised to submit these business details and documents for CRM onboarding.
              </label>
            </div>
            {errors.confirmed && <p className="text-sm text-destructive">{errors.confirmed}</p>}
          </div>
        </motion.div>
      )}

      <StickyActionBar
        currentStep={currentStep}
        totalSteps={4}
        onBack={handleBack}
        onSaveDraft={handleSaveDraft}
        onContinue={handleContinue}
        onSubmit={handleSubmit}
        isSubmitting={submitting}
      />
    </div>
  );
}
