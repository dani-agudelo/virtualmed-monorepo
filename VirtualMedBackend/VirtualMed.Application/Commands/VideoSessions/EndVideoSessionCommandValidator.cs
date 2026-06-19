using FluentValidation;

namespace VirtualMed.Application.Commands.VideoSessions;

public class EndVideoSessionCommandValidator : AbstractValidator<EndVideoSessionCommand>
{
    public EndVideoSessionCommandValidator()
    {
        RuleFor(x => x.SessionId).NotEmpty();
        RuleFor(x => x.EndReason)
            .MaximumLength(1000)
            .When(x => !string.IsNullOrWhiteSpace(x.EndReason));
    }
}
