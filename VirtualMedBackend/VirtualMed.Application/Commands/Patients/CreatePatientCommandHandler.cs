using MediatR;
using VirtualMed.Application.Interfaces;
using VirtualMed.Application.Interfaces.Services;
using VirtualMed.Domain.Entities;

namespace VirtualMed.Application.Commands.Patients;

public class CreatePatientCommandHandler : IRequestHandler<CreatePatientCommand, Guid>
{
    private readonly IPatientRepository _patientRepository;
    private readonly IUserRepository _userRepository;
    private readonly IRoleRepository _roleRepository;
    private readonly IPasswordHasher _passwordHasher;
    private readonly IApplicationDbContext _context;

    public CreatePatientCommandHandler(
        IApplicationDbContext context,
        IPatientRepository patientRepository,
        IUserRepository userRepository,
        IRoleRepository roleRepository,
        IPasswordHasher passwordHasher)
    {
        _patientRepository = patientRepository;
        _context = context;
        _userRepository = userRepository;
        _roleRepository = roleRepository;
        _passwordHasher = passwordHasher;
    }

    public async Task<Guid> Handle(
        CreatePatientCommand request,
        CancellationToken cancellationToken)
    {
        // Get the Patient role
        var patientRole = await _roleRepository.GetByNameAsync("Patient");
        if (patientRole == null)
            throw new InvalidOperationException("Patient role not found.");

        // Hash the password
        var passwordHash = _passwordHasher.Hash(request.Password);

        // Create User
        var user = new User
        {
            Id = Guid.NewGuid(),
            RoleId = patientRole.Id,
            FullName = request.FullName,
            Email = request.Email,
            PasswordHash = passwordHash,
            Status = "Pending",
            CreatedAt = DateTime.UtcNow
        };

        await _userRepository.AddAsync(user);

        // Create Patient
        var patient = new Patient
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            IdentificationType = request.IdentificationType,
            Document = request.Document,
            DateOfBirth = request.DateOfBirth,
            Gender = request.Gender,
            PhoneNumber = request.PhoneNumber,
            AcceptPrivacy = request.AcceptPrivacy,
            AuthorizeData = request.AuthorizeData,
            BloodType = string.Empty,
            Allergies = string.Empty
        };

        await _patientRepository.AddAsync(patient);

        await _context.SaveChangesAsync(cancellationToken);

        return patient.Id;
    }
}