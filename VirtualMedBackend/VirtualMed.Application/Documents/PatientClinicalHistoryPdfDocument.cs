using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using VirtualMed.Domain.Entities;
using VirtualMed.Domain.Enums;

namespace VirtualMed.Application.Documents;

internal static class PatientClinicalHistoryPdfDocument
{
    public static byte[] Generate(Patient patient, IReadOnlyList<ClinicalEncounter> encounters)
    {
        QuestPDF.Settings.License = LicenseType.Community;

        return Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Margin(40);
                page.Size(PageSizes.A4);
                page.DefaultTextStyle(x => x.FontSize(10));

                page.Header().Column(header =>
                {
                    header.Item().Text("VirtualMed").FontSize(18).SemiBold().FontColor(Colors.Blue.Darken3);
                    header.Item().Text("Historial clínico").FontSize(14).SemiBold();
                    header.Item().Text($"Generado el {DateTime.UtcNow:yyyy-MM-dd HH:mm} UTC").FontSize(9).FontColor(Colors.Grey.Medium);
                });

                page.Content().Column(main =>
                {
                    main.Spacing(12);
                    main.Item().Element(c => WritePatientBlock(c, patient));
                    main.Item().LineHorizontal(1).LineColor(Colors.Grey.Lighten2);

                    if (encounters.Count == 0)
                    {
                        main.Item().PaddingTop(8).Text("No hay encuentros clínicos registrados.").Italic().FontColor(Colors.Grey.Darken1);
                    }
                    else
                    {
                        var i = 0;
                        foreach (var enc in encounters)
                        {
                            i++;
                            main.Item().Element(c => WriteEncounterBlock(c, enc, i));
                        }
                    }
                });

                page.Footer().AlignCenter().Text(t =>
                {
                    t.Span("Página ").FontSize(8).FontColor(Colors.Grey.Medium);
                    t.CurrentPageNumber().FontSize(8).FontColor(Colors.Grey.Medium);
                    t.Span(" · Documento confidencial — uso personal").FontSize(8).FontColor(Colors.Grey.Medium);
                });
            });
        }).GeneratePdf();
    }

    private static void WritePatientBlock(IContainer container, Patient patient)
    {
        container.Column(col =>
        {
            col.Spacing(4);
            col.Item().Text("Datos del paciente").SemiBold().FontSize(12);
            col.Item().Text($"Nombre: {patient.User.FullName}");
            col.Item().Text($"Documento: {patient.Document}");
            col.Item().Text($"Fecha de nacimiento: {patient.DateOfBirth:yyyy-MM-dd}");
            col.Item().Text($"Género: {patient.Gender}");
            if (!string.IsNullOrWhiteSpace(patient.PhoneNumber))
                col.Item().Text($"Teléfono: {patient.PhoneNumber}");
            if (!string.IsNullOrWhiteSpace(patient.BloodType))
                col.Item().Text($"Grupo sanguíneo: {patient.BloodType}");
            if (!string.IsNullOrWhiteSpace(patient.Allergies))
                col.Item().Text($"Alergias: {patient.Allergies}");
        });
    }

    private static void WriteEncounterBlock(IContainer container, ClinicalEncounter enc, int index)
    {
        var doctorName = enc.Appointment.Doctor?.User?.FullName ?? "—";

        container.Border(1).BorderColor(Colors.Grey.Lighten2).Padding(12).Column(col =>
        {
            col.Spacing(6);
            col.Item().Text($"Encuentro {index} — {FormatEncounterType(enc.EncounterType)}").SemiBold().FontSize(11);
            col.Item().Text($"Fecha: {enc.StartAt:yyyy-MM-dd HH:mm}" + (enc.EndAt.HasValue ? $" — {enc.EndAt:HH:mm}" : ""))
                .FontSize(9).FontColor(Colors.Grey.Darken2);
            col.Item().Text($"Profesional: {doctorName}").FontSize(9).FontColor(Colors.Grey.Darken2);
            col.Item().Text($"Motivo de consulta: {enc.ChiefComplaint}");

            OptionalField(col, "Enfermedad actual", enc.CurrentCondition);
            OptionalField(col, "Examen físico", enc.PhysicalExam);
            OptionalField(col, "Impresión diagnóstica", enc.Assessment);
            OptionalField(col, "Plan", enc.Plan);
            OptionalField(col, "Notas", enc.Notes);

            if (enc.Diagnoses.Count > 0)
            {
                col.Item().PaddingTop(4).Text("Diagnósticos").SemiBold();
                foreach (var dx in enc.Diagnoses.OrderBy(d => d.Type))
                {
                    col.Item().Text($"• {dx.Icd10Code} — {dx.Description} ({dx.Type})").FontSize(9);
                }
            }

            if (enc.Prescriptions.Count > 0)
            {
                col.Item().PaddingTop(4).Text("Recetas").SemiBold();
                foreach (var rx in enc.Prescriptions.OrderBy(r => r.IssuedAt))
                {
                    col.Item().Text($"Receta {rx.PrescriptionNumber} — {rx.IssuedAt:yyyy-MM-dd}").FontSize(9).SemiBold();
                    foreach (var line in rx.Medications)
                    {
                        var med = line.Medication?.Name ?? "Medicamento";
                        col.Item().Text($"  - {med}: {line.Dosage}, {line.Frequency}, {line.DurationDays} día(s)."
                                        + (string.IsNullOrWhiteSpace(line.Instructions) ? "" : $" {line.Instructions}"))
                            .FontSize(9);
                    }
                }
            }
        });
    }

    private static void OptionalField(ColumnDescriptor col, string label, string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return;
        col.Item().Text($"{label}: {value}").FontSize(9);
    }

    private static string FormatEncounterType(EncounterType t) =>
        t switch
        {
            EncounterType.Consultation => "Consulta",
            EncounterType.FollowUp => "Control / seguimiento",
            EncounterType.Emergency => "Urgencia",
            EncounterType.Telehealth => "Telemedicina",
            EncounterType.Other => "Otro",
            _ => t.ToString()
        };
}
