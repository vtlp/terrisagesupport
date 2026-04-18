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
import { saveDraft, loadDraft, clearDraft } from "@/lib/onboardingStorage";
import {
  LOGO_FORMATS, BROCHURE_FORMATS, IMPORT_FILE_FORMATS,
  LOGO_EXTENSIONS, BROCHURE_EXTENSIONS, IMPORT_EXTENSIONS,
} from "@/lib/onboardingValidation";
import { submitOnboarding, uploadFiles, getEnquiryIdFromUrl, checkSubmissionLock, AlreadySubmittedError } from "@/lib/onboardingSubmit";
import { readOnboardingPrefill } from "@/lib/onboardingPrefill";
import { AlreadySubmittedScreen } from "@/components/onboarding/AlreadySubmittedScreen";

const STEPS = [
  { number: 1, label: "Business & Primary Contact" },
  { number: 2, label: "Team Access & Permissions" },
  { number: 3, label: "Projects & Lead Files" },
  { number: 4, label: "Review & Submit" },
];

const PROPERTY_TYPE_FOCUS_OPTIONS = [
  { label: "Apartments", value: "apartments" },
  { label: "Villas", value: "villas" },
  { label: "Plots", value: "plots" },
  { label: "Mix", value: "mix" },
];

const PROJECT_PROPERTY_TYPE_OPTIONS = [
  { label: "Apartments", value: "apartments" },
  { label: "Villas", value: "villas" },
  { label: "Residential Plots", value: "residential-plots" },
];

const ROLE_OPTIONS = [
  { label: "Admin", value: "admin" },
  { label: "Agent", value: "agent" },
];

function createTeamMember() {
  return { id: crypto.randomUUID(), fullName: "", mobile: "", mobileCode: "+91", email: "", role: "", orgWideAccess: false };
}

function createProject() {
  return { id: crypto.randomUUID(), projectName: "", location: "", contactName: "", contactMobile: "", contactMobileCode: "+91", contactEmail: "", brochure: [] as File[], additionalNotes: "", propertyType: "" };
}

type TeamMember = ReturnType<typeof createTeamMember>;
type Project = ReturnType<typeof createProject>;

const validatePhone = (phone: string) => /^\d{10}$/.test(phone);

export default function BuilderOnboarding() {
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
  const [headOfficeCity, setHeadOfficeCity] = useState("");
  const [propertyTypeFocus, setPropertyTypeFocus] = useState("");
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
  const [leadFile, setLeadFile] = useState<File[]>([]);
  const [leadSheetLink, setLeadSheetLink] = useState("");
  const [leadFileNotes, setLeadFileNotes] = useState("");

  useEffect(() => {
    const draft = loadDraft("builder");
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
        if (d.headOfficeCity) setHeadOfficeCity(d.headOfficeCity);
        if (d.propertyTypeFocus) setPropertyTypeFocus(d.propertyTypeFocus);
        if (d.notes) setNotes(d.notes);
        if (d.seatsRequired && !lockSeats) setSeatsRequired(d.seatsRequired);
        if (d.teamMembers) setTeamMembers(d.teamMembers);
        if (d.projects) setProjects(d.projects.map((p: any) => ({ ...p, brochure: [] })));
        if (d.leadSheetLink) setLeadSheetLink(d.leadSheetLink);
        if (d.leadFileNotes) setLeadFileNotes(d.leadFileNotes);
        toast.info("Draft restored. You may continue where you left off.");
      } catch { /* ignore */ }
    }
  }, []);

  const getFormData = () => ({
    fullName, mobile, mobileCode, email, companyName, companyTagline, reraId, headOfficeCity, propertyTypeFocus, notes,
    seatsRequired, teamMembers,
    projects: projects.map(p => ({ ...p, brochure: undefined })),
    leadSheetLink, leadFileNotes,
  });

  const handleSaveDraft = () => {
    saveDraft("builder", getFormData(), currentStep);
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
    if (!headOfficeCity.trim()) e.headOfficeCity = "Please enter the head office city.";
    if (!propertyTypeFocus) e.propertyTypeFocus = "Please select your property type focus.";
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
    projects.forEach((p, i) => {
      if (!p.projectName.trim()) e[`proj_${i}_projectName`] = "Please enter the project name.";
      if (!p.location.trim()) e[`proj_${i}_location`] = "Please enter the project location.";
      if (!p.contactName.trim()) e[`proj_${i}_contactName`] = "Please enter the contact person's name.";
      if (!p.contactMobile.trim()) e[`proj_${i}_contactMobile`] = "Please provide a mobile number.";
      else if (!validatePhone(p.contactMobile)) e[`proj_${i}_contactMobile`] = "Please enter a 10-digit mobile number.";
      if (!p.propertyType) e[`proj_${i}_propertyType`] = "Please select the property type.";
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
      const folder = `builder/${enquiryId ?? "anon"}/${Date.now()}`;
      const [logoPaths, leadPaths] = await Promise.all([
        uploadFiles(companyLogo, `${folder}/logo`),
        uploadFiles(leadFile, `${folder}/leads`),
      ]);
      const projectsWithBrochures = await Promise.all(projects.map(async (p, i) => ({
        ...p,
        brochure: undefined,
        brochurePaths: await uploadFiles(p.brochure, `${folder}/project-${i + 1}-brochure`),
      })));

      const payload = {
        primary_contact: { full_name: fullName, mobile, mobile_code: mobileCode, email },
        company: { name: companyName, tagline: companyTagline, rera_id: reraId, head_office_city: headOfficeCity, property_type_focus: propertyTypeFocus, logo_paths: logoPaths },
        company_name: companyName,
        owner_name: fullName,
        owner_phone: `${mobileCode}${mobile}`,
        owner_email: email,
        city: headOfficeCity,
        rera_number: reraId,
        team: { seats_required: seatsRequired, members: teamMembers },
        team_members: teamMembers.map(tm => ({ full_name: tm.fullName, email: tm.email, phone: `${tm.mobileCode}${tm.mobile}`, role: tm.role })),
        projects: projectsWithBrochures,
        lead_import: { paths: leadPaths, sheet_link: leadSheetLink, notes: leadFileNotes },
        notes,
      };

      await submitOnboarding("BUILDER_DEVELOPER", payload, enquiryId);
      clearDraft("builder");
      navigate("/onboarding/builder/success");
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
    return <AlreadySubmittedScreen submittedAt={lockedAt} tenancy="builder" />;
  }

  return (
    <div className="min-h-screen bg-background">
      <StepperNav steps={STEPS} currentStep={currentStep} completedSteps={completedSteps} onStepClick={(s) => { setCurrentStep(s); window.scrollTo({ top: 0, behavior: "smooth" }); }} />

      {currentStep === 1 && (
        <>
          <HeroSection
            title="Builder Onboarding for Terrisage CRM"
            subtitle="Share your company, team, project, and lead details so we can prepare your CRM workspace accurately and efficiently."
            supportingText="Complete the onboarding in four guided steps. Keeping your project brochures and lead files ready will help speed up setup."
            preparationNote="Having your project brochures and any lead spreadsheets ready will help you complete this more quickly."
          />
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-32 space-y-10">
            <section className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-foreground">Primary Account Owner</h2>
                <p className="text-sm text-muted-foreground mt-1">This person will receive the main account access and will be our primary point of contact during setup and onboarding.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div data-field="fullName"><TextField label="Full name" required value={fullName} onChange={setFullName} error={errors.fullName} disabled={lockFullName} helperText={lockFullName ? "Provided by the Terrisage team — contact us if this needs to change." : undefined} /></div>
                <div data-field="mobile"><PhoneField label="Mobile number" required countryCode={mobileCode} onCountryCodeChange={setMobileCode} value={mobile} onChange={setMobile} error={errors.mobile} disabled={lockMobile} helperText={lockMobile ? "Provided by the Terrisage team." : undefined} /></div>
                <div data-field="email" className="sm:col-span-2"><TextField label="Email address" type="email" required value={email} onChange={setEmail} error={errors.email} disabled={lockEmail} helperText={lockEmail ? "Provided by the Terrisage team — contact us if this needs to change." : undefined} /></div>
              </div>
            </section>

            <section className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-foreground">Company Details</h2>
                <p className="text-sm text-muted-foreground mt-1">These details help us prepare your company profile and configure your workspace more accurately.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div data-field="companyName"><TextField label="Company name" required value={companyName} onChange={setCompanyName} error={errors.companyName} /></div>
                <TextField label="Company tagline" value={companyTagline} onChange={setCompanyTagline} />
                <div className="sm:col-span-2">
                  <FileUploadField label="Company logo" acceptedFormats={LOGO_EXTENSIONS} acceptedMimeTypes={LOGO_FORMATS} files={companyLogo} onChange={setCompanyLogo} helperText="Upload your company logo for workspace branding." />
                </div>
                <TextField label="RERA ID" value={reraId} onChange={setReraId} />
                <div data-field="headOfficeCity"><TextField label="Head office city" required value={headOfficeCity} onChange={setHeadOfficeCity} error={errors.headOfficeCity} /></div>
                <div data-field="propertyTypeFocus"><SelectField label="Property type focus" required value={propertyTypeFocus} onChange={setPropertyTypeFocus} options={PROPERTY_TYPE_FOCUS_OPTIONS} error={errors.propertyTypeFocus} /></div>
              </div>
              <TextAreaField label="Notes for onboarding team" value={notes} onChange={setNotes} rows={4} helperText="Use this space for anything we should know before setup begins." />
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
              { term: "Admin", description: "Broad operational access for managing users, enquiries, teams, and company-wide activity." },
              { term: "Agent", description: "Day-to-day working access for leads and properties, with optional wider company scope where needed." },
            ]} />
            <GuidanceCard title="Agent Permissions Guide" items={[
              { term: "Organisation-wide Lead & Property Management", description: "Gives an Agent broader company-wide access across leads, properties, enquiries, and related allocation actions." },
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
                      description="Gives an Agent broader company-wide access across leads, properties, enquiries, and related allocation actions."
                      checked={tm.orgWideAccess}
                      onChange={(v) => updateTeamMember(idx, "orgWideAccess", v)}
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
            <h2 className="text-2xl font-bold text-foreground">Projects & Lead Files</h2>
            <p className="text-sm text-muted-foreground mt-1">Capture the projects you develop and gather the lead files required for import preparation.</p>
          </div>

          <section className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-foreground">Project Details</h3>
              <p className="text-sm text-muted-foreground mt-1">The brochure is especially important for builder onboarding because it helps us understand project structure, positioning, inventory context, and configuration details.</p>
            </div>
            {projects.map((proj, idx) => (
              <RepeatableCard key={proj.id} title={`Project ${idx + 1}`} subtitle={proj.projectName || undefined} index={idx} onRemove={() => setProjects((prev) => prev.filter((_, i) => i !== idx))} canRemove={projects.length > 1}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <TextField label="Project name" required value={proj.projectName} onChange={(v) => updateProject(idx, "projectName", v)} error={errors[`proj_${idx}_projectName`]} />
                  <TextField label="Google Maps address / project location" required value={proj.location} onChange={(v) => updateProject(idx, "location", v)} error={errors[`proj_${idx}_location`]} />
                  <TextField label="Project contact person name" required value={proj.contactName} onChange={(v) => updateProject(idx, "contactName", v)} error={errors[`proj_${idx}_contactName`]} />
                  <PhoneField label="Project contact person mobile number" required countryCode={proj.contactMobileCode} onCountryCodeChange={(v) => updateProject(idx, "contactMobileCode", v)} value={proj.contactMobile} onChange={(v) => updateProject(idx, "contactMobile", v)} error={errors[`proj_${idx}_contactMobile`]} />
                  <TextField label="Project contact person email" type="email" value={proj.contactEmail} onChange={(v) => updateProject(idx, "contactEmail", v)} />
                  <SelectField label="Property type" required value={proj.propertyType} onChange={(v) => updateProject(idx, "propertyType", v)} options={PROJECT_PROPERTY_TYPE_OPTIONS} error={errors[`proj_${idx}_propertyType`]} />
                </div>
                <div className="mt-2 p-4 bg-accent/10 border border-accent/30 rounded-lg">
                  <FileUploadField label="Project brochure (Optional)" acceptedFormats={BROCHURE_EXTENSIONS} acceptedMimeTypes={BROCHURE_FORMATS} files={proj.brochure} onChange={(files) => updateProject(idx, "brochure", files)} helperText="Upload the latest brochure if available. You can also share it later — not required to submit this form." />
                </div>
                <TextAreaField label="Additional project notes" value={proj.additionalNotes} onChange={(v) => updateProject(idx, "additionalNotes", v)} rows={2} />
              </RepeatableCard>
            ))}
            <AddCardButton label="Add another project" onClick={() => setProjects((prev) => [...prev, createProject()])} />
          </section>

          <section className="space-y-5">
            <div>
              <h3 className="text-lg font-semibold text-foreground">Lead Import Files <span className="text-sm font-normal text-muted-foreground">(Optional)</span></h3>
              <p className="text-sm text-muted-foreground mt-1">If you have lead data ready, share it now or send it later — none of these files are required to submit this form. Recommended fields: name, contact number, budget, project interested, notes.</p>
            </div>
            <FileUploadField label="Upload lead file" acceptedFormats={IMPORT_EXTENSIONS} acceptedMimeTypes={IMPORT_FILE_FORMATS} files={leadFile} onChange={setLeadFile} multiple />
            <TextField label="Google Sheet link" type="url" value={leadSheetLink} onChange={setLeadSheetLink} placeholder="https://docs.google.com/spreadsheets/..." />
            <TextAreaField label="Lead file notes" value={leadFileNotes} onChange={setLeadFileNotes} rows={2} />
            <ReferencePanel title="Expected Lead Fields" fields={["Name", "Contact number", "Budget", "Project interested (project name)", "Notes"]} />
            <div className="bg-muted/40 border border-border rounded-lg px-4 py-3 text-sm text-muted-foreground">
              ℹ️ Property import is not part of this builder onboarding form. Project brochures and details above will be used to guide project setup.
            </div>
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
            { label: "Head office city", value: headOfficeCity, required: true },
            { label: "Property type focus", value: PROPERTY_TYPE_FOCUS_OPTIONS.find(b => b.value === propertyTypeFocus)?.label, required: true },
          ]} />

          <ReviewSummaryCard title="Team Access & Permissions" onEdit={() => setCurrentStep(2)} fields={[
            { label: "Seats required", value: seatsRequired, required: true },
            ...teamMembers.flatMap((tm, i) => [
              { label: `Team Member ${i + 1}`, value: `${tm.fullName} — ${ROLE_OPTIONS.find(r => r.value === tm.role)?.label || "No role"}`, required: true },
            ]),
          ]} />

          {projects.map((proj, i) => (
            <ReviewSummaryCard key={proj.id} title={`Project ${i + 1}`} onEdit={() => setCurrentStep(3)} fields={[
              { label: "Project name", value: proj.projectName, required: true },
              { label: "Location", value: proj.location, required: true },
              { label: "Contact person", value: proj.contactName, required: true },
              { label: "Property type", value: PROJECT_PROPERTY_TYPE_OPTIONS.find(o => o.value === proj.propertyType)?.label, required: true },
              { label: "Brochure", value: proj.brochure.length > 0 ? `${proj.brochure.length} file(s)` : undefined },
              { label: "Additional notes", value: proj.additionalNotes },
            ]} />
          ))}

          <ReviewSummaryCard title="Lead Import" onEdit={() => setCurrentStep(3)} fields={[
            { label: "Lead file(s)", value: leadFile.length > 0 ? `${leadFile.length} file(s)` : undefined },
            { label: "Google Sheet link", value: leadSheetLink },
            { label: "Notes", value: leadFileNotes },
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

      <StickyActionBar currentStep={currentStep} totalSteps={4} onBack={handleBack} onSaveDraft={handleSaveDraft} onContinue={handleContinue} onSubmit={handleSubmit} isSubmitting={submitting} />
    </div>
  );
}
