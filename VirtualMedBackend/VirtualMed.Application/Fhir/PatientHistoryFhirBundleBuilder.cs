using Hl7.Fhir.Model;
using VirtualMed.Domain.Enums;
using DomainPatient = VirtualMed.Domain.Entities.Patient;
using DomainEncounter = VirtualMed.Domain.Entities.ClinicalEncounter;
using DomainDiagnosis = VirtualMed.Domain.Entities.Diagnosis;
using DomainPrescription = VirtualMed.Domain.Entities.Prescription;
using DomainPrescriptionMedication = VirtualMed.Domain.Entities.PrescriptionMedication;

namespace VirtualMed.Application.Fhir;

internal static class PatientHistoryFhirBundleBuilder
{
    private const string VirtualMedPatientIdSystem = "http://virtualmed.local/fhir/sid/patient-id";
    private const string VirtualMedDocumentSystem = "http://virtualmed.local/fhir/sid/national-id";
    private const string Icd10System = "http://hl7.org/fhir/sid/icd-10";
    private const string ActCodeSystem = "http://terminology.hl7.org/CodeSystem/v3-ActCode";

    public static Bundle Build(DomainPatient patient, IReadOnlyList<DomainEncounter> encounters)
    {
        var bundle = new Bundle
        {
            Type = Bundle.BundleType.Collection,
            Timestamp = DateTimeOffset.UtcNow,
            Meta = new Meta
            {
                LastUpdated = DateTimeOffset.UtcNow,
                Tag =
                [
                    new Coding
                    {
                        System = "http://virtualmed.local/fhir/tag",
                        Code = "virtualmed-export",
                        Display = "VirtualMed clinical history export"
                    }
                ]
            }
        };

        var patientId = patient.Id.ToString();
        var fhirPatient = BuildPatientResource(patient, patientId);
        AddEntry(bundle, fhirPatient, $"urn:uuid:{patient.Id}");

        foreach (var enc in encounters)
        {
            var encounterRef = enc.Id.ToString();
            AddEntry(bundle, BuildEncounter(enc, patientId, encounterRef), $"urn:uuid:{enc.Id}");

            foreach (var dx in enc.Diagnoses)
                AddEntry(bundle, BuildCondition(dx, patientId, encounterRef), $"urn:uuid:{dx.Id}");

            foreach (var rx in enc.Prescriptions)
            {
                foreach (var line in rx.Medications)
                {
                    var medReqId = ComposeMedicationRequestId(rx.Id, line.MedicationId);
                    AddEntry(
                        bundle,
                        BuildMedicationRequest(rx, line, patientId, encounterRef, medReqId),
                        $"urn:uuid:{medReqId}");
                }
            }
        }

        return bundle;
    }

    private static void AddEntry(Bundle bundle, Resource resource, string fullUrl)
    {
        bundle.Entry.Add(new Bundle.EntryComponent
        {
            FullUrl = fullUrl,
            Resource = resource
        });
    }

    private static Patient BuildPatientResource(DomainPatient patient, string patientId)
    {
        var p = new Patient
        {
            Id = patientId,
            Identifier =
            [
                new Identifier { System = VirtualMedPatientIdSystem, Value = patientId },
                new Identifier
                {
                    System = VirtualMedDocumentSystem,
                    Type = new CodeableConcept
                    {
                        Text = patient.IdentificationType?.ToString() ?? "Document"
                    },
                    Value = patient.Document
                }
            ],
            Name = [new HumanName { Text = patient.User.FullName }],
            BirthDate = patient.DateOfBirth.ToString("yyyy-MM-dd"),
            Gender = MapAdministrativeGender(patient.Gender)
        };

        if (!string.IsNullOrWhiteSpace(patient.PhoneNumber))
        {
            p.Telecom =
            [
                new ContactPoint
                {
                    System = ContactPoint.ContactPointSystem.Phone,
                    Value = patient.PhoneNumber,
                    Use = ContactPoint.ContactPointUse.Mobile
                }
            ];
        }

        return p;
    }

    private static Encounter BuildEncounter(DomainEncounter enc, string patientId, string encounterId)
    {
        var e = new Encounter
        {
            Id = encounterId,
            Status = Encounter.EncounterStatus.Finished,
            Class = new Coding
            {
                System = ActCodeSystem,
                Code = "AMB",
                Display = "ambulatory"
            },
            Subject = new ResourceReference($"Patient/{patientId}"),
            Period = new Period
            {
                Start = enc.StartAt.ToString("O"),
                End = enc.EndAt?.ToString("O")
            },
            Type =
            [
                new CodeableConcept
                {
                    Text = $"EncounterType: {enc.EncounterType}"
                }
            ]
        };

        if (!string.IsNullOrWhiteSpace(enc.ChiefComplaint))
        {
            e.ReasonCode =
            [
                new CodeableConcept { Text = enc.ChiefComplaint }
            ];
        }

        return e;
    }

    private static Condition BuildCondition(DomainDiagnosis dx, string patientId, string encounterId)
    {
        return new Condition
        {
            Id = dx.Id.ToString(),
            Subject = new ResourceReference($"Patient/{patientId}"),
            Encounter = new ResourceReference($"Encounter/{encounterId}"),
            Code = new CodeableConcept
            {
                Coding =
                [
                    new Coding
                    {
                        System = Icd10System,
                        Code = dx.Icd10Code,
                        Display = dx.Description
                    }
                ],
                Text = dx.Description
            },
            RecordedDate = dx.CreatedAt.ToString("O"),
            ClinicalStatus = new CodeableConcept
            {
                Coding =
                [
                    new Coding
                    {
                        System = "http://terminology.hl7.org/CodeSystem/condition-clinical",
                        Code = MapClinicalStatus(dx.Type),
                        Display = dx.Type.ToString()
                    }
                ]
            }
        };
    }

    private static string MapClinicalStatus(DiagnosisType type) =>
        type switch
        {
            DiagnosisType.Primary => "active",
            DiagnosisType.Secondary => "active",
            DiagnosisType.Differential => "unconfirmed",
            DiagnosisType.RuledOut => "resolved",
            _ => "active"
        };

    private static MedicationRequest BuildMedicationRequest(
        DomainPrescription rx,
        DomainPrescriptionMedication line,
        string patientId,
        string encounterId,
        Guid medReqId)
    {
        var dosageText = $"{line.Dosage}; {line.Frequency}; {line.DurationDays} día(s).";
        if (!string.IsNullOrWhiteSpace(line.Instructions))
            dosageText += " " + line.Instructions;

        return new MedicationRequest
        {
            Id = medReqId.ToString(),
            Status = MedicationRequest.MedicationrequestStatus.Active,
            Intent = MedicationRequest.MedicationRequestIntent.Order,
            Subject = new ResourceReference($"Patient/{patientId}"),
            Encounter = new ResourceReference($"Encounter/{encounterId}"),
            Medication = new CodeableConcept { Text = line.Medication.Name },
            AuthoredOn = rx.IssuedAt.ToString("O"),
            DosageInstruction =
            [
                new Dosage { Text = dosageText.Trim() }
            ]
        };
    }

    private static Guid ComposeMedicationRequestId(Guid prescriptionId, Guid medicationId)
    {
        Span<byte> bytes = stackalloc byte[16];
        prescriptionId.TryWriteBytes(bytes);
        var medBytes = medicationId.ToByteArray();
        for (var i = 0; i < 16; i++)
            bytes[i] ^= medBytes[i];
        return new Guid(bytes);
    }

    private static AdministrativeGender? MapAdministrativeGender(string gender)
    {
        var g = gender.Trim().ToLowerInvariant();
        if (g is "male" or "m" or "masculino" or "hombre")
            return AdministrativeGender.Male;
        if (g is "female" or "f" or "femenino" or "mujer")
            return AdministrativeGender.Female;
        if (g is "other" or "otro" or "non-binary" or "no binario")
            return AdministrativeGender.Other;
        if (g is "unknown" or "desconocido" or "")
            return AdministrativeGender.Unknown;
        return AdministrativeGender.Unknown;
    }
}
