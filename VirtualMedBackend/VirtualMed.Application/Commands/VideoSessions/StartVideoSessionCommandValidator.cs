using FluentValidation;

namespace VirtualMed.Application.Commands.VideoSessions;

public class StartVideoSessionCommandValidator : AbstractValidator<StartVideoSessionCommand>
{
    public StartVideoSessionCommandValidator()
    {
        RuleFor(x => x.SessionId).NotEmpty();
    }
}
