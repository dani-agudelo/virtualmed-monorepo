using MediatR;

namespace VirtualMed.Application.Commands.Auth;

public record CompleteTwoFactorLoginCommand(string TempTwoFactorToken, string Code) : IRequest<LoginResult>;
