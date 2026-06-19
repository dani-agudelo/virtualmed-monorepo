using FluentValidation;
using VirtualMed.Application.Interfaces;

namespace VirtualMed.Application.Commands.Patients;

public class CreatePatientCommandValidator : AbstractValidator<CreatePatientCommand>
{
    private readonly IUserRepository _userRepository;
    private readonly IPatientRepository _patientRepository;

    public CreatePatientCommandValidator(IUserRepository userRepository, IPatientRepository patientRepository)
    {
        _userRepository = userRepository;
        _patientRepository = patientRepository;

        RuleFor(x => x.FullName)
            .NotEmpty().WithMessage("Full name is required.")
            .MaximumLength(100).WithMessage("Full name must not exceed 100 characters.");

        RuleFor(x => x.Email)
            .NotEmpty().WithMessage("Email is required.")
            .EmailAddress().WithMessage("Email format is invalid.")
            .MustAsync(async (email, ct) => !await _userRepository.EmailExistsAsync(email))
            .WithMessage("Email already exists.");

        RuleFor(x => x.Password)
            .NotEmpty().WithMessage("Password is required.")
            .MinimumLength(8).WithMessage("Password must be at least 8 characters.")
            .Matches("[A-Z]").WithMessage("Password must contain at least one uppercase letter.")
            .Matches("[a-z]").WithMessage("Password must contain at least one lowercase letter.")
            .Matches("[0-9]").WithMessage("Password must contain at least one digit.");

        RuleFor(x => x.ConfirmPassword)
            .NotEmpty().WithMessage("Confirm password is required.")
            .Equal(x => x.Password).WithMessage("Passwords do not match.");

        RuleFor(x => x.Document)
            .NotEmpty().WithMessage("Document number is required.")
            .MaximumLength(20).WithMessage("Document number must not exceed 20 characters.")
            .MustAsync(async (documentNumber, ct) => !await _patientRepository.DocumentNumberExistsAsync(documentNumber))
            .WithMessage("Document number already exists.");

        RuleFor(x => x.DateOfBirth)
            .NotEmpty().WithMessage("Date of birth is required.")
            .LessThanOrEqualTo(DateOnly.FromDateTime(DateTime.UtcNow)).WithMessage("Date of birth cannot be in the future.");

        RuleFor(x => x.Gender)
            .NotEmpty().WithMessage("Gender is required.")
            .Must(x => x == "male" || x == "female" || x == "other").WithMessage("Gender must be 'male', 'female', or 'other'.");

        RuleFor(x => x.PhoneNumber)
            .MaximumLength(20).WithMessage("Phone number must not exceed 20 characters.")
            .When(x => !string.IsNullOrEmpty(x.PhoneNumber));

        RuleFor(x => x.AcceptPrivacy)
            .Must(x => x).WithMessage("You must accept the privacy policy.");

        RuleFor(x => x.AuthorizeData)
            .Must(x => x).WithMessage("You must authorize data processing.");
    }
}