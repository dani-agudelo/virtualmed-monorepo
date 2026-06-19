using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using VirtualMed.Api.Authorization;
using VirtualMed.Api.Models.VitalSigns;
using VirtualMed.Application.Commands.VitalSigns;
using VirtualMed.Application.Queries.Patients;
using VirtualMed.Application.Commands.RiskScores;
using VirtualMed.Application.Queries.RiskScores;
using VirtualMed.Application.Queries.VitalSigns;
using VirtualMed.Api.Models.RiskScores;
using VirtualMed.Domain.Enums;

namespace VirtualMed.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PatientsController : ControllerBase
{
    private readonly IMediator _mediator;

    public PatientsController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpGet("search")]
    [Authorize]
    [RequirePermission("Patient", "Read")]
    public async Task<IActionResult> Search(
        [FromQuery] string? q,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var result = await _mediator.Send(new SearchPatientsQuery(q, page, pageSize));
        return Ok(result);
    }

    [HttpGet("export/fhir")]
    [Authorize]
    [RequirePermission("ClinicalEncounter", "Read")]
    public async Task<IActionResult> ExportFhirBundle([FromQuery] Guid? patientId)
    {
        var json = await _mediator.Send(new ExportPatientFhirBundleQuery(patientId));
        var fileName = $"patient-clinical-history-{DateTime.UtcNow:yyyyMMdd_HHmm}.fhir.json";
        var bytes = System.Text.Encoding.UTF8.GetBytes(json);
        return File(bytes, "application/fhir+json", fileName);
    }

    [HttpGet("export/history/pdf")]
    [Authorize]
    [RequirePermission("ClinicalEncounter", "Read")]
    public async Task<IActionResult> ExportClinicalHistoryPdf([FromQuery] Guid? patientId)
    {
        var pdf = await _mediator.Send(new ExportPatientClinicalHistoryPdfQuery(patientId));
        var fileName = $"historial-clinico-{DateTime.UtcNow:yyyyMMdd_HHmm}.pdf";
        return File(pdf, "application/pdf", fileName);
    }

    [HttpPost("me/vital-readings")]
    [Authorize]
    [RequirePermission("VitalSign", "Create")]
    public async Task<IActionResult> RecordMyVitalReadings([FromBody] RecordVitalSignReadingsRequest body)
    {
        var result = await _mediator.Send(new RecordVitalSignReadingCommand(null, body.Readings));
        return Ok(result);
    }

    [HttpPost("{patientId:guid}/vital-readings")]
    [Authorize]
    [RequirePermission("VitalSign", "Create")]
    public async Task<IActionResult> RecordPatientVitalReadings(
        Guid patientId,
        [FromBody] RecordVitalSignReadingsRequest body)
    {
        var result = await _mediator.Send(new RecordVitalSignReadingCommand(patientId, body.Readings));
        return Ok(result);
    }

    [HttpGet("me/vital-readings")]
    [Authorize]
    [RequirePermission("VitalSign", "Read")]
    public async Task<IActionResult> ListMyVitalReadings(
        [FromQuery] DateTime? fromUtc,
        [FromQuery] DateTime? toUtc,
        [FromQuery] VitalSignType[]? types,
        [FromQuery] VitalReadingSource? source,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] bool includeSummary = false)
    {
        var result = await _mediator.Send(new ListVitalSignReadingsQuery(
            null, fromUtc, toUtc, types, source, page, pageSize, includeSummary));
        return Ok(result);
    }

    [HttpGet("{patientId:guid}/vital-readings")]
    [Authorize]
    [RequirePermission("VitalSign", "Read")]
    public async Task<IActionResult> ListPatientVitalReadings(
        Guid patientId,
        [FromQuery] DateTime? fromUtc,
        [FromQuery] DateTime? toUtc,
        [FromQuery] VitalSignType[]? types,
        [FromQuery] VitalReadingSource? source,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] bool includeSummary = false)
    {
        var result = await _mediator.Send(new ListVitalSignReadingsQuery(
            patientId, fromUtc, toUtc, types, source, page, pageSize, includeSummary));
        return Ok(result);
    }

    [HttpGet("me/alert-thresholds")]
    [Authorize]
    [RequirePermission("AlertThreshold", "Read")]
    public async Task<IActionResult> ListMyAlertThresholds()
    {
        var result = await _mediator.Send(new ListAlertThresholdsQuery(null));
        return Ok(result);
    }

    [HttpPost("me/alert-thresholds")]
    [Authorize]
    [RequirePermission("AlertThreshold", "Create")]
    public async Task<IActionResult> CreateMyAlertThreshold([FromBody] SetAlertThresholdRequest body)
    {
        var id = await _mediator.Send(new SetAlertThresholdCommand(
            null, null, body.VitalSignType, body.MinValue, body.MaxValue, body.IsActive, body.AlertLevel));
        return CreatedAtAction(nameof(ListMyAlertThresholds), new { id });
    }

    [HttpPut("me/alert-thresholds/{id:guid}")]
    [Authorize]
    [RequirePermission("AlertThreshold", "Update")]
    public async Task<IActionResult> UpdateMyAlertThreshold(Guid id, [FromBody] SetAlertThresholdRequest body)
    {
        var thresholdId = await _mediator.Send(new SetAlertThresholdCommand(
            null, id, body.VitalSignType, body.MinValue, body.MaxValue, body.IsActive, body.AlertLevel));
        return Ok(new { id = thresholdId });
    }

    [HttpDelete("me/alert-thresholds/{id:guid}")]
    [Authorize]
    [RequirePermission("AlertThreshold", "Delete")]
    public async Task<IActionResult> DeleteMyAlertThreshold(Guid id)
    {
        await _mediator.Send(new DeleteAlertThresholdCommand(id, null));
        return NoContent();
    }

    [HttpGet("me/alerts")]
    [Authorize]
    [RequirePermission("Alert", "Read")]
    public async Task<IActionResult> ListMyAlerts(
        [FromQuery] bool? unreadOnly,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        var result = await _mediator.Send(new ListHealthAlertsQuery(null, unreadOnly, page, pageSize));
        return Ok(result);
    }

    [HttpPost("me/risk-scores/calculate")]
    [Authorize]
    [RequirePermission("RiskScore", "Create")]
    public async Task<IActionResult> CalculateMyCardiovascularRisk(
        [FromBody] CalculateCardiovascularRiskRequest? body)
    {
        var result = await _mediator.Send(new CalculateCardiovascularRiskScoreCommand(
            null,
            body?.Overrides));
        return Ok(result);
    }

    [HttpPost("{patientId:guid}/risk-scores/calculate")]
    [Authorize]
    [RequirePermission("RiskScore", "Create")]
    public async Task<IActionResult> CalculatePatientCardiovascularRisk(
        Guid patientId,
        [FromBody] CalculateCardiovascularRiskRequest? body)
    {
        var result = await _mediator.Send(new CalculateCardiovascularRiskScoreCommand(
            patientId,
            body?.Overrides));
        return Ok(result);
    }

    [HttpGet("me/risk-scores")]
    [Authorize]
    [RequirePermission("RiskScore", "Read")]
    public async Task<IActionResult> ListMyRiskScores(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var result = await _mediator.Send(new ListRiskScoresQuery(null, page, pageSize));
        return Ok(result);
    }

    [HttpGet("{patientId:guid}/risk-scores")]
    [Authorize]
    [RequirePermission("RiskScore", "Read")]
    public async Task<IActionResult> ListPatientRiskScores(
        Guid patientId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var result = await _mediator.Send(new ListRiskScoresQuery(patientId, page, pageSize));
        return Ok(result);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult> GetById(Guid id)
    {
        var result = await _mediator.Send(new GetPatientByIdQuery(id));
        if (result == null)
            return NotFound();
        return Ok(result);
    }
}
