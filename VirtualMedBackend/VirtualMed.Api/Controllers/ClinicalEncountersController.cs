using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using VirtualMed.Api.Authorization;
using VirtualMed.Api.Models.ClinicalEncounters;
using VirtualMed.Application.Commands.ClinicalEncounters;
using VirtualMed.Application.Queries.ClinicalEncounters;
using VirtualMed.Domain.Enums;

namespace VirtualMed.Api.Controllers;

[ApiController]
[Route("api/clinical-encounters")]
[Authorize]
public class ClinicalEncountersController : ControllerBase
{
    private readonly IMediator _mediator;

    public ClinicalEncountersController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpPost]
    [RequirePermission("ClinicalEncounter", "Create")]
    public async Task<IActionResult> Create([FromBody] CreateClinicalEncounterCommand command)
    {
        var id = await _mediator.Send(command);
        return CreatedAtAction(nameof(GetById), new { id }, new { id });
    }

    /// <summary>
    /// Lista encuentros clínicos (filtros por query; paciente/médico resueltos desde el token).
    /// </summary>
    [HttpGet]
    [RequirePermission("ClinicalEncounter", "Read")]
    public async Task<IActionResult> List(
        [FromQuery] Guid? patientId,
        [FromQuery] Guid? doctorId,
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromQuery] EncounterType? encounterType)
    {
        var result = await _mediator.Send(new ListClinicalEncountersQuery(patientId, doctorId, from, to, encounterType));
        return Ok(result);
    }

    [HttpGet("{id:guid}")]
    [RequirePermission("ClinicalEncounter", "Read")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await _mediator.Send(new GetClinicalEncounterByIdQuery(id));
        return Ok(result);
    }

    [HttpPut("{id:guid}")]
    [RequirePermission("ClinicalEncounter", "Update")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateClinicalEncounterBody body)
    {
        IReadOnlyCollection<UpdateClinicalEncounterDiagnosisItem>? dx = null;
        if (body.Diagnoses is not null)
        {
            dx = body.Diagnoses
                .Select(d => new UpdateClinicalEncounterDiagnosisItem(d.Icd10Code, d.Description, d.Type))
                .ToList();
        }

        await _mediator.Send(new UpdateClinicalEncounterCommand(
            id,
            body.EncounterType,
            body.StartAt,
            body.EndAt,
            body.ChiefComplaint,
            body.CurrentCondition,
            body.PhysicalExam,
            body.Assessment,
            body.Plan,
            body.Notes,
            body.RecordingUrl,
            body.IsLocked,
            dx));

        return NoContent();
    }
}

