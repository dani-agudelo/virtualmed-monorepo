using FluentValidation;
using Microsoft.EntityFrameworkCore;
using VirtualMed.Application.Interfaces;

namespace VirtualMed.Application.Commands.VideoSessions;

public class CreateVideoSessionCommandValidator : AbstractValidator<CreateVideoSessionCommand>
{
    public CreateVideoSessionCommandValidator(IApplicationDbContext context)
    {
        RuleFor(x => x.AppointmentId)
            .NotEmpty()
            .MustAsync(async (id, ct) => await context.Set<Domain.Entities.Appointment>().AnyAsync(a => a.Id == id, ct))
            .WithMessage("Appointment not found.");
    }
}
