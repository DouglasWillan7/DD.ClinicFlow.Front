export type ClinicRole = "Secretary" | "Nurse" | "Doctor";
export type UserRole = "Admin" | ClinicRole;
export type ClinicPlan = "Solo" | "Clinic";
export type BloodType =
  | "APositive"
  | "ANegative"
  | "BPositive"
  | "BNegative"
  | "ABPositive"
  | "ABNegative"
  | "OPositive"
  | "ONegative";
export type ScheduleDay =
  | "Sunday"
  | "Monday"
  | "Tuesday"
  | "Wednesday"
  | "Thursday"
  | "Friday"
  | "Saturday";
export type AppointmentType = "InPerson" | "Teleconsultation";
export type AvailabilityDayStatus = "Available" | "NoSchedule" | "Blocked" | "Full";

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAtUtc: string;
}

export interface AuthResponse {
  userId: string;
  email: string;
  clinicId: string;
  roles: UserRole[];
  tokens: TokenPair;
  name: string | null;
  /** Contexto v2. Ausente somente em sessões legadas durante o rollout. */
  userClinicId?: string;
  clinicName?: string;
  clinicRole?: ClinicRole;
  isAdmin?: boolean;
  phone?: string;
  /** Opções seguras conhecidas no login; não contêm documento ou contatos. */
  availableClinics?: AuthV2ClinicOption[];
}

export interface AuthV2LoginRequest {
  countryCode: string;
  documentType: string;
  document: string;
  password: string;
  rememberConnection: boolean;
}

export interface AuthV2User {
  id: string;
  name: string;
}

export interface AuthV2ClinicContext {
  userClinicId: string;
  clinicId: string;
  clinicName: string;
  role: ClinicRole;
  isAdmin: boolean;
  email: string;
  phone: string;
}

export interface AuthV2ClinicOption {
  userClinicId: string;
  clinicId: string;
  clinicName: string;
  role: ClinicRole;
  isAdmin: boolean;
}

export interface AuthV2Authenticated {
  kind: "authenticated";
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAtUtc: string;
  user: AuthV2User;
  clinicContext: AuthV2ClinicContext;
}

export interface AuthV2ClinicSelectionRequired {
  kind: "clinic_selection_required";
  selectionToken: string;
  expiresAtUtc: string;
  clinics: AuthV2ClinicOption[];
}

export type AuthV2LoginOutcome =
  | AuthV2Authenticated
  | AuthV2ClinicSelectionRequired;

export interface AccountRecoveryDestination {
  kind: "email" | "sms";
  masked: string;
  selection: string;
}

export interface AccountRecoveryOptions {
  destinations: AccountRecoveryDestination[];
  supportRequired: boolean;
}

export type AccountRecoveryIdentity = Pick<
  AuthV2LoginRequest,
  "countryCode" | "documentType" | "document"
>;

export interface Clinic {
  id: string;
  name: string;
  timeZoneId: string;
  phone: string | null;
  address: string | null;
  defaultAppointmentDurationMinutes: number;
  plan: ClinicPlan;
  subscriptionStatus: "Active" | "Suspended" | "Canceled";
  maxDoctors: number | null;
  createdAtUtc: string;
}

export interface Member {
  userId: string;
  email: string;
  roles: UserRole[];
  isCreator: boolean;
  name: string | null;
  specialty: string | null;
}

export type UserClinicStatus = "Pending" | "Active" | "Suspended" | "Inactive";
export type AppointmentDurationSource =
  | "Configured"
  | "DoctorProfile"
  | "ClinicLegacyFallback";

export interface DoctorMembershipProfile {
  professionalAuthority: string | null;
  professionalRegistrationNumber: string | null;
  professionalRegistrationRegion: string | null;
  professionalRegistrationCountryCode: string | null;
  specialty: string | null;
  practiceAreas: string | null;
  bio: string | null;
  defaultAppointmentDurationMinutes: number | null;
}

/** Vínculo contextual retornado pela administração de equipe v2. */
export interface ClinicMember {
  userClinicId: string;
  userId: string;
  clinicId: string;
  displayName: string | null;
  status: UserClinicStatus;
  role: ClinicRole;
  isAdmin: boolean;
  isOwner: boolean;
  email: string | null;
  phone: string | null;
  emailConfirmedAtUtc: string | null;
  phoneConfirmedAtUtc: string | null;
  doctorProfile: DoctorMembershipProfile | null;
  defaultAppointmentDurationSource: AppointmentDurationSource | null;
  sessionVersion: number;
  createdAtUtc: string;
  updatedAtUtc: string;
}

export interface Invitation {
  id: string;
  email: string;
  roles: UserRole[];
  createdAtUtc: string;
}

export type DoctorGender = "Feminino" | "Masculino" | "Outro";

/** Item de GET /clinics/doctors: cadastro profissional completo do médico da clínica. */
export interface Doctor {
  userId: string;
  email: string;
  name: string | null;
  roles: UserRole[];
  isCreator: boolean;
  /** Já definiu senha. Enquanto for falso o médico atende mas não entra no sistema. */
  hasAccess: boolean;
  hasPendingInvitation: boolean;
  medicalLicense: string | null;
  medicalLicenseState: string | null;
  specialty: string | null;
  cpf: string | null;
  birthDate: string | null;
  phone: string | null;
  gender: DoctorGender | null;
  rqe: string | null;
  practiceAreas: string | null;
  bio: string | null;
  /** Duração própria; nula quando o médico segue a padrão da clínica. */
  slotDurationMinutes: number | null;
  healthInsurancePlanIds: string[];
  scheduleIntervals: DoctorScheduleInterval[];
}

export interface HealthInsurancePlan {
  id: string;
  name: string;
}

/** O token só volta uma vez, na resposta que emite o convite. */
export interface DoctorAccessInvite {
  email: string;
  token: string;
  expiresAtUtc: string;
}

export interface OnboardingStep {
  code: string;
  label: string;
  path: string;
  completed: boolean;
  blocked: boolean;
}

export interface OnboardingStatus {
  completed: boolean;
  completedCount: number;
  totalCount: number;
  steps: OnboardingStep[];
}

export interface CurrentUser {
  userId: string;
  email: string;
  name: string;
  roles: UserRole[];
  medicalLicense: string | null;
  medicalLicenseState: string | null;
  specialty: string | null;
}

export type AppointmentStatus =
  | "Agendada"
  | "ConfirmacaoEnviada"
  | "Confirmada"
  | "Cancelada"
  | "Realizada"
  | "NoShow";

export interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  doctorUserId: string;
  startUtc: string;
  endUtc: string;
  type: AppointmentType;
  status: AppointmentStatus;
  notes: string | null;
  createdAtUtc: string;
}

export type TranscriptionSessionStatus = "Starting" | "Recording" | "Paused" | "StopRequested" | "Draining" | "Recovering" | "Completed" | "Failed";
export type TranscriptSpeakerRole = "Unknown" | "Doctor" | "Patient";
export interface TranscriptionSession {
  id: string; appointmentId: string; startedAtUtc: string; endedAtUtc: string | null;
  status: TranscriptionSessionStatus; lastAudioSequence: number; isDegraded: boolean;
}
export interface TranscriptSegment {
  id: string; sequence: number; providerStreamNumber: number; providerSpeakerTag: number | null;
  speakerRole: TranscriptSpeakerRole; startTimeMs: number; endTimeMs: number; text: string;
}
export interface ConsultationTranscript { session: TranscriptionSession | null; segments: TranscriptSegment[]; }
export interface TranscriptionEvent {
  sessionId: string; segmentId: string | null; sequence: number; streamNumber: number; speakerTag: number | null;
  speakerRole: TranscriptSpeakerRole; startTimeMs: number; endTimeMs: number; text: string; isFinal: boolean;
}

export type SexForClinicalUse = "Feminino" | "Masculino";

export interface Patient {
  id: string;
  cpf: string;
  medicalRecordNumber: number;
  bloodType: BloodType | null;
  sexForClinicalUse: SexForClinicalUse | null;
  name: string;
  phone: string;
  birthDate: string | null;
  notes: string | null;
  doctorUserId: string;
  isActive: boolean;
  whatsappConsentAtUtc: string | null;
  createdAtUtc: string;
}

export type PatientSituation =
  | "EmAcompanhamento"
  | "NovoPaciente"
  | "ExamePendente"
  | "Inativo";

/** Item de GET /patients: cadastro + resumo de agenda/exames calculado pelo backend. */
export interface PatientListItem extends Patient {
  lastAppointmentUtc: string | null;
  nextAppointmentUtc: string | null;
  nextAppointmentType: AppointmentType | null;
  situation: PatientSituation;
}

export type BodyMeasurementType =
  | "Peso"
  | "Altura"
  | "Gordura"
  | "Braco"
  | "Antebraco"
  | "Cintura"
  | "Coxa"
  | "Panturrilha";

/** A unidade não vem no payload: é fixa por tipo (ver `measurementUnits`). */
export interface BodyMeasurement {
  type: BodyMeasurementType;
  value: number;
}

/** Uma avaliação = uma data + as grandezas medidas naquele dia. */
export interface BodyAssessment {
  id: string;
  patientId: string;
  assessedOn: string;
  createdAtUtc: string;
  measurements: BodyMeasurement[];
  /** kg/m² derivado pelo backend a partir de peso e altura; nulo quando falta um dos dois. */
  bmi: number | null;
}

export type ExamUploadStatus =
  | "Pendente"
  | "Processando"
  | "EmRevisao"
  | "Confirmado"
  | "Falhou";

export interface ExamUpload {
  id: string;
  patientId: string;
  patientName: string;
  fileName: string;
  source: "Paciente" | "Clinica";
  status: ExamUploadStatus;
  error: string | null;
  createdAtUtc: string;
}

export interface ExamGridCell {
  value: number | null;
  valueText: string;
  outOfRange: boolean;
}

/** Cells alinhadas 1:1 com `dates`; null onde não houve coleta. */
export interface ExamGridRow {
  catalogCode: string | null;
  name: string;
  unit: string | null;
  cells: Array<ExamGridCell | null>;
}

export interface ExamGrid {
  dates: string[];
  rows: ExamGridRow[];
}

export type ExamStatus =
  | "Solicitado"
  | "Pendente"
  | "Processando"
  | "Em revisão"
  | "Validado"
  | "Falhou"
  | "Cancelado";

export type ExamCategory =
  | "Não classificado"
  | "Laboratório"
  | "Imagem"
  | "Endoscopia"
  | "Cardiologia";

export type ExamSource = "Paciente" | "Clínica";
export type ExamRevisionStatus = "Rascunho" | "Validada";
export type ExamClinicalOutcome =
  | "Alterado"
  | "Sem alterações"
  | "Inconclusivo";

export type ClinicalReferenceState =
  | "normal"
  | "elevado"
  | "baixo"
  | "limítrofe"
  | "indeterminado";

export interface ExamListFilters {
  search: string;
  statuses: ExamStatus[];
  categories: ExamCategory[];
  includeCancelled: boolean;
}

export interface PatientExamCapabilities {
  canRequest: boolean;
  canAttachDocument: boolean;
}

export interface PatientExamPage {
  items: PatientExamSummary[];
  nextCursor: string | null;
  capabilities: PatientExamCapabilities;
}

export interface PatientExamSummary {
  id: string;
  patientId: string;
  name: string;
  category: ExamCategory;
  scheduledOn: string | null;
  status: ExamStatus;
  version: number;
  hasDocument: boolean;
  averageConfidence: number | null;
  createdAtUtc: string;
  updatedAtUtc: string;
}

export interface PatientExamDocument {
  fileName: string;
  contentType: "application/pdf";
  sizeBytes: number;
  source: ExamSource;
  createdAtUtc: string;
  processingAttempts: number;
}

export interface PatientExamDetailCapabilities {
  canEditRequest: boolean;
  canCancelRequest: boolean;
  canAttachDocument: boolean;
  canReprocess: boolean;
  canDiscardFailedExam: boolean;
  canDiscardExam: boolean;
  canOpenCorrection: boolean;
  canEditRevision: boolean;
  canClassify: boolean;
  canValidate: boolean;
}

export interface PatientExamStructuredResult {
  id: string;
  order: number;
  catalogCode: string | null;
  name: string;
  numericValue: number | null;
  textValue: string | null;
  unit: string | null;
  referenceText: string | null;
  outOfRangeSuggestion: boolean | null;
  confidence: number | null;
  referenceLowerBound: number | null;
  referenceUpperBound: number | null;
  referenceState: ClinicalReferenceState;
}

export interface PatientExamRevisionMetadata {
  collectedAtLocal: string | null;
  issuedOn: string | null;
  requesterName: string | null;
  requesterRegistration: string | null;
}

export interface PatientExamNarrativeSection {
  id: string;
  order: number;
  title: string;
  text: string;
  confidence: number | null;
}

export interface PatientExamStructuredFinding {
  id: string;
  order: number;
  key: string;
  value: string;
  confidence: number | null;
}

export interface PatientExamExtractionIssue {
  id: string;
  structuredResultId: string | null;
  page: number | null;
  field: string;
  reason: string;
}

export interface PatientExamRevision {
  id: string;
  number: number;
  status: ExamRevisionStatus;
  aiSuggestedOutcome: ExamClinicalOutcome | null;
  clinicalOutcome: ExamClinicalOutcome | null;
  averageConfidence: number | null;
  model: string | null;
  correctionReason: string | null;
  createdByUserId: string;
  createdAtUtc: string;
  lastEditedByUserId: string | null;
  updatedAtUtc: string | null;
  validatedByUserId: string | null;
  validatedAtUtc: string | null;
  metadata?: PatientExamRevisionMetadata | null;
  structuredResults: PatientExamStructuredResult[];
  narrativeSections: PatientExamNarrativeSection[];
  structuredFindings: PatientExamStructuredFinding[];
  extractionIssues: PatientExamExtractionIssue[];
}

export interface PatientExamDetail {
  id: string;
  patientId: string;
  doctorUserId: string;
  requestedByUserId: string | null;
  name: string;
  category: ExamCategory;
  scheduledOn: string | null;
  status: ExamStatus;
  version: number;
  error: string | null;
  createdAtUtc: string;
  updatedAtUtc: string;
  processedAtUtc: string | null;
  cancelledByUserId: string | null;
  cancelledAtUtc: string | null;
  document: PatientExamDocument | null;
  activeRevision: PatientExamRevision | null;
  draftRevision: PatientExamRevision | null;
  attemptsRemaining: number;
  capabilities: PatientExamDetailCapabilities;
}

export interface CreateExamRequest {
  name: string;
  category: ExamCategory;
  scheduledOn: string | null;
}

export interface UpdateExamRequest extends CreateExamRequest {
  expectedVersion: number;
}

export interface CancelExamRequest {
  expectedVersion: number;
}

export interface DiscardFailedExamRequest {
  expectedVersion: number;
}

export interface OpenExamRevisionRequest {
  correctionReason: string;
  expectedVersion: number;
}

export interface ClassifyExamRequest {
  category: Exclude<ExamCategory, "Não classificado">;
  expectedVersion: number;
}

export interface SaveExamRevisionRequest {
  revisionId: string;
  expectedVersion: number;
  structuredResults: PatientExamStructuredResult[];
  narrativeSections: PatientExamNarrativeSection[];
  structuredFindings: PatientExamStructuredFinding[];
  clinicalOutcome: ExamClinicalOutcome | null;
  correctionReason: string | null;
  metadata: PatientExamRevisionMetadata | null;
}

export interface ClinicalExamHistoryPoint {
  date: string;
  numericValue: number | null;
  valueText: string;
  outOfRange: boolean;
}

export interface ClinicalExamResult {
  id: string;
  catalogCode: string | null;
  name: string;
  subtitle: string | null;
  numericValue: number | null;
  valueText: string;
  unit: string | null;
  referenceText: string | null;
  detailedReferenceText: string | null;
  referenceState: ClinicalReferenceState;
  confidence: number | null;
  deltaPercent: number | null;
  history: ClinicalExamHistoryPoint[];
}

export interface ClinicalExamFinding {
  resultId: string;
  name: string;
  valueText: string;
  unit: string | null;
  referenceText: string | null;
  referenceState: ClinicalReferenceState;
  deltaPercent: number | null;
}

export interface ClinicalExamStructuredFinding {
  id: string;
  key: string;
  value: string;
  confidence: number | null;
}

export interface ClinicalExamMetadata {
  collectedAtLocal: string | null;
  issuedOn: string | null;
  validatedAtUtc: string | null;
  requesterName: string | null;
  requesterRegistration: string | null;
  validatorName: string | null;
}

export interface ClinicalExamDocument {
  fileName: string;
  sizeBytes: number;
  source: string;
  pageCount: number | null;
}

export interface ClinicalExamNote {
  id: string;
  title: string;
  text: string;
  confidence: number | null;
}

export interface ClinicalExamCapabilities {
  canOpenDocument: boolean;
  canViewHistory: boolean;
  canOpenCorrection: boolean;
}

export interface ClinicalExamReport {
  id: string;
  patientId: string;
  name: string;
  category: string;
  clinicalOutcome: string;
  version: number;
  metadata: ClinicalExamMetadata | null;
  document: ClinicalExamDocument | null;
  findings: ClinicalExamFinding[];
  structuredFindings: ClinicalExamStructuredFinding[];
  results: ClinicalExamResult[];
  notes: ClinicalExamNote[];
  capabilities: ClinicalExamCapabilities;
}

export interface ClinicalExamTrend {
  catalogCode: string | null;
  name: string;
  unit: string | null;
  referenceState: ClinicalReferenceState;
  points: ClinicalExamHistoryPoint[];
}

export interface PatientClinicalSummary {
  latestReport: ClinicalExamReport | null;
  totalFindingCount: number;
  structuredFindings: ClinicalExamStructuredFinding[];
  findings: ClinicalExamFinding[];
  trends: ClinicalExamTrend[];
  latestCollectionDate: string | null;
  capabilities: PatientExamCapabilities;
}

export interface ValidateExamRevisionRequest {
  revisionId: string;
  clinicalOutcome: ExamClinicalOutcome;
  expectedVersion: number;
}

export interface ExamConflictDetails {
  existingExamId?: string;
  currentVersion?: number;
}

export interface DoctorScheduleInterval {
  id: string;
  dayOfWeek: ScheduleDay;
  startLocal: string;
  endLocal: string;
}

export interface DoctorScheduleBlock {
  id: string;
  date: string;
  reason: string | null;
}

export interface DoctorSchedule {
  doctorUserId: string;
  slotDurationMinutes: number;
  intervals: DoctorScheduleInterval[];
  blocks: DoctorScheduleBlock[];
}

export interface AvailabilitySlot {
  startUtc: string;
  endUtc: string;
  label: string;
}

export interface AvailabilityDay {
  date: string;
  status: AvailabilityDayStatus;
  slots: AvailabilitySlot[];
}

export interface DoctorAvailability {
  doctorUserId: string;
  timeZoneId: string;
  slotDurationMinutes: number;
  days: AvailabilityDay[];
}

export interface WhatsAppConfig {
  phoneNumberId: string;
  templateName: string;
  enabled: boolean;
  hasToken: boolean;
  updatedAtUtc: string | null;
}
