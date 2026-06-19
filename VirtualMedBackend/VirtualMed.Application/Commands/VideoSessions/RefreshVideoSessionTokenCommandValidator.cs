using FluentValidation;

namespace VirtualMed.Application.Commands.VideoSessions;

public class RefreshVideoSessionTokenCommandValidator : AbstractValidator<RefreshVideoSessionTokenCommand>
{
    public RefreshVideoSessionTokenCommandValidator()
    {
        RuleFor(x => x.SessionId).NotEmpty();
    }
}
