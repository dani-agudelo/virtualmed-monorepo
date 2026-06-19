import { UserRole } from "../constants/userRole";
import { IdentificationType } from "../constants/identificationType";
import { AppointmentStatus } from "@/constants/appointmentStatus";
import { UserStatus } from "@/constants/userStatus";
import { PatientGender } from "@/constants/patientGender";
import { DiagnosisType } from "@/constants/diagnosisType";
import { EncounterType } from "@/constants/encounterType";
import { VideoSessionStatus } from "@/constants/videoSessionStatus";
import { MessageType } from "@/constants/messageType";

export interface User {
  sub: string;
  email: string;
  role: UserRole;
  fullName: string;
  status: UserStatus;
  email_verified: boolean;
  two_factor_enabled: boolean;
  permission: string[];
  // Legacy fields for compatibility
  firstName?: string;
  lastName?: string;
}

// ============================================
// PATIENT TYPES
// ============================================
export interface Patient extends User {
  document: string;
  identificationType: IdentificationType;
  dateOfBirth: string;
  gender: string;
  bloodType?: string;
  allergies?: string[];
  phoneNumber?: string;
  acceptPrivacy?: boolean;
  authorizeData?: boolean;
}

export interface EmergencyContact {
  name: string;
  relationship: string;
  phoneNumber: string;
}

// ============================================
// DOCTOR TYPES
// ============================================
export interface Doctor extends User {
  professionalLicense: string;
  consultationFee: number;
  languages: string[];
  biography?: string;
  rating?: number;
  totalConsultations?: number;
  verified: boolean;
}

// ============================================
// AUTH TYPES
// ============================================
export interface LoginRequest {
  email: string;
  password: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

export interface MessageResponse {
  message: string;
}

export interface PatientRegisterRequest {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  identificationType: IdentificationType | undefined;
  document: string;
  dateOfBirth: string;
  gender: PatientGender;
  phoneNumber?: string;
  acceptPrivacy: boolean;
  authorizeData: boolean;
}

export interface PatientRegisterResponse {
  patientId: string;
}

export interface PatientSearchItem {
  id: string;
  fullName: string;
  document: string;
  // Compatibilidad con backend que pueda retornar camelCase o lowercase
  fullname?: string;
}

export interface PatientSearch {
  items: PatientSearchItem[];
  page: number;
  pageSize: number;
  totalCount: number;
}

export interface PatientDetail {
  id: string;
  userId: string;
  identificationType: string;
  fullName: string;
  document: string;
  dateOfBirth: string;
  gender: string;
  bloodType: string;
  allergies: string;
  phoneNumber: string;
  acceptPrivacy: boolean;
  authorizeData: boolean;
}

export interface DoctorSearch {
  items: [
    {
      id: string,
      fullName: string,
      professionalLicense: string
    }
  ],
  page: number,
  pageSize: number,
  totalCount: number
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
}

export interface AuthResponseWith2FA {
  requiresTwoFactor: boolean;
  tempTwoFactorToken: string;
}

export interface Login2FARequest {
  code: string;
  tempTwoFactorToken: string;
}

export interface DoctorRegisterRequest {
  fullName: string;
  email: string;
  password: string;
  professionalLicense: string;
  specialty: string;
  supportingDocument: File | null;
}

export interface DoctorResponse {
  doctorId: string;
}

// ============================================
// 2FA TYPES
// ============================================
export interface Enable2FAResponse {
  otpauthUri: string;
  secret: string;
  recoveryCodes: string[];
}

export interface Verify2FARequest {
  code: string;
}

// ============================================
// APPOINTMENT TYPES
// ============================================
export interface Appointment {
  patientId: string;
  doctorId: string | null; // Puede ser null, el backend asignará el doctor basado en el token
  scheduledAt: string;
  durationMinutes: number;
  reason: string | null;
  status: AppointmentStatus;
}

export interface AppointmentGetResponse {
  id: string;
  patientId: string;
  doctorId: string | null; // Puede ser null, el backend asignará el doctor basado en el token
  doctorFullName: string;
  patientFullName: string;
  scheduledAt: string;
  durationMinutes: number;
  reason: string | null;
  status: AppointmentStatus;
  hasClinicalEncounter: boolean;
  createdAt: string;
  updatedAt: string;
  videoSessionId?: string | null;
}

export interface AppointmentResponse {
  appointmentId: string;
}

export interface AppointmentDetail extends AppointmentGetResponse {}

export interface ClinicalEncounterDiagnosis {
  id?: string;
  icd10Code: string;
  description: string;
  type: DiagnosisType | string;
}

export interface ClinicalEncounterPrescriptionMedication {
  medicationId?: string | null;
  medicationName: string;
  dosage: string;
  frequency: string;
  durationDays: number;
  instructions?: string | null;
}

export interface ClinicalEncounterPrescription {
  id?: string;
  prescriptionNumber?: string;
  issuedAt: string;
  validUntil: string;
  medications: ClinicalEncounterPrescriptionMedication[];
}

export interface PatientClinicalEncounter {
  id: string;
  appointmentId: string;
  patientId: string;
  doctorId: string;
  encounterType: EncounterType | number | string;
  startAt: string;
  endAt: string;
  chiefComplaint: string;
  currentCondition?: string | null;
  physicalExam?: string | null;
  assessment?: string | null;
  plan?: string | null;
  notes?: string | null;
  recordingUrl?: string | null;
  diagnoses: ClinicalEncounterDiagnosis[];
  prescriptions: ClinicalEncounterPrescription[];
}

// AUDIT LOG TYPES
// ============================================
export type AuditOperationCode = 'I' | 'U' | 'D';

export interface AuditLog {
  occurredAt: string;
  tableName: string;
  operation: AuditOperationCode | string;
  rowPk: string;
  oldData?: string | null;
  newData?: string | null;
  appUserId?: string | null;
}

// ============================================
// VITAL SIGNS TYPES
// ============================================
export type VitalSignType =
  | 'HeartRate'
  | 'Steps'
  | 'BloodPressureSystolic'
  | 'BloodPressureDiastolic'
  | 'Weight'
  | 'Glucose'
  | 'SpO2';

export type VitalReadingSource = 'Manual' | 'Simulated';

export interface VitalReading {
  id: string;
  patientId: string;
  vitalSignType: VitalSignType;
  value: number;
  unit: string;
  readingAt: string;
  source: VitalReadingSource;
  createdAt: string;
}

export interface VitalReadingSummary {
  id: string;
  value: number;
  unit: string;
  readingAt: string;
  source: VitalReadingSource;
}

export interface VitalReadingsPage {
  items: VitalReading[];
  page: number;
  pageSize: number;
  totalCount: number;
}

export interface VitalReadingsResponse {
  page: VitalReadingsPage;
  latestByType: Partial<Record<VitalSignType, VitalReadingSummary>>;
  averages7d: Partial<Record<VitalSignType, number>>;
}

export interface VitalReadingInput {
  type: VitalSignType;
  value: number;
  unit?: string;
  readingAt?: string;
  notes?: string;
}

export interface VitalReadingsBatchRequest {
  readings: VitalReadingInput[];
}

export interface VitalReadingsSyncRequest {
  patientId?: string | null;
  readings: VitalReadingInput[];
}

export type AlertLevel = 'Low' | 'Medium' | 'High';

export interface AlertThreshold {
  id: string;
  patientId?: string;
  vitalSignType: VitalSignType;
  minValue: number;
  maxValue: number;
  isActive: boolean;
  alertLevel: AlertLevel;
  createdAt?: string;
  updatedAt?: string;
}

export interface AlertThresholdInput {
  vitalSignType: VitalSignType;
  minValue: number;
  maxValue: number;
  isActive: boolean;
  alertLevel: AlertLevel;
}

export type AlertSeverity = 'Info' | 'Warning' | 'Critical';

export interface HealthAlert {
  id: string;
  patientId: string;
  vitalSignReadingId?: string;
  alertType: string;
  message: string;
  severity: AlertSeverity;
  isRead: boolean;
  occurredAt: string;
}

export interface HealthAlertsResponse {
  items: HealthAlert[];
  page: number;
  pageSize: number;
  totalCount: number;
}

// ============================================
// RISK SCORE TYPES
// ============================================
export interface CardiovascularRiskOverridesInput {
  smoker: 0 | 1;
  physicalActivityLevel: 0 | 1;
  systolicBp: number;
  diastolicBp: number;
  bmi: number;
  familyHistoryCvd?: 0 | 1 | null;
  cholesterolTotal?: 1 | 2 | 3 | null;
  glucoseMgDl?: 1 | 2 | 3 | null;
}

export interface CalculateCardiovascularRiskRequest {
  overrides: CardiovascularRiskOverridesInput;
}

export interface RiskScore {
  id: string;
  patientId: string;
  score: number;
  riskLevel: string;
  modelVersion: string;
  disclaimerVersion: string;
  calculatedAt: string;
}

export interface RiskScoresResponse {
  items: RiskScore[];
  page: number;
  pageSize: number;
  totalCount: number;
}

export interface AuditLogFilters {
  tableName?: string;
  operation?: AuditOperationCode;
  from?: string;
  to?: string;
}

export interface AuditLogsResponse {
  items: AuditLog[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
}

// ============================================
// CLINICAL ENCOUNTER TYPES
// ============================================
export interface DiagnosisInput {
  icd10Code: string;
  description: string;
  type: DiagnosisType;
}

export interface Diagnosis extends DiagnosisInput {
  id: string;
}

export interface ClinicalEncounter {
  appointmentId: string;
  encounterType: EncounterType;
  startAt: string;
  endAt: string;
  chiefComplaint: string;
  currentCondition?: string | null;
  physicalExam?: string | null,
  assessment?: string | null,
  plan?: string | null,
  notes?: string | null,
  recordingUrl?: string | null,
  isLocked?: boolean;
  diagnoses: Array<DiagnosisInput>
}

export interface ClinicalEncounterResponse {
  id: string;  
}

export interface DetailedClinicalEncounter extends Omit<ClinicalEncounter, 'diagnoses'> {
  id: string;
  patientId: string;
  doctorId: string;
  diagnoses: Array<Diagnosis>;
  prescriptions?: Array<{
    id: string;
    prescriptionNumber: string;
    issuedAt: string;
    validUntil: string;
    medications: Array<Medication>;
  }> | null;
}

export interface Prescription {
  encounterId: string,
  issuedAt: string,
  validUntil: string,
  doctorSignatureHash?: string | null,
  lines: Array<Medication>
}

export interface Medication {
  medicationId?: string | null, // El ID del medicamento se asignará en el backend
  medicationName: string,
  dosage: string,
  frequency: string,
  durationDays: number,
  instructions?: string | null
}

// ============================================
// VIDEO SESSION TYPES
// ============================================
export interface VideoSession {
  sessionId: string;
  appointmentId: string;
  patientId: string;
  doctorId: string;
  status: VideoSessionStatus;
  roomToken: string;
  tokenExpiresAt: string;
  startedAt: string;
  endedAt: string;
  endReason?: string | null;
}

export interface VideoChatMessage {
  id: string;
  videoSessionId: string; //uuid de sessionId publico
  senderId: string;
  message: string;
  sentAt: string;
  messageType: MessageType;
}

export interface ChatSource {
  fileName: string;
  pageLabel: string;
  score?: number | null;
}

export interface ChatMessage {
  id: string;
  role: 'User' | 'Assistant' | 'System';
  content: string;
  sources?: ChatSource[] | null;
  createdAt: string;
}

export interface ChatConversationResponse {
  id: string;
  patientId: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
}

export interface SendChatMessageResponse {
  userMessage: ChatMessage;
  assistantMessage: ChatMessage;
}

export type RagDocumentStatus = 'Pending' | 'Ingesting' | 'Indexed' | 'Failed';

export interface RagDocument {
  id: string;
  fileName: string;
  status: RagDocumentStatus;
  fileSizeBytes: number;
  indexedNodeCount?: number | null;
  errorMessage?: string | null;
  createdAt: string;
  indexedAt?: string | null;
}

export interface UploadRagDocumentResponse {
  document: RagDocument;
  message: string;
}

export interface IceServer {
  urls: string[];
  username?: string;
  credential?: string;
}

export interface IceCredentials {
  sessionId: string;
  roomToken: string;
  tokenExpiresAt: string;
  iceServers: [IceServer];
}
