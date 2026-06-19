using MockQueryable.Moq;
using Moq;
using VirtualMed.Application.Common.Exceptions;
using VirtualMed.Application.Exceptions;
using VirtualMed.Application.Interfaces;
using VirtualMed.Application.Queries.Doctors;
using VirtualMed.Domain.Entities;
using VirtualMed.Domain.Enums;

namespace VirtualMed.Tests.Application.Doctors;

public class GetDoctorAvailabilityQueryHandlerTests
{
    [Fact]
    public async Task Handle_WhenPatient_ThrowsForbiddenException()
    {
        var doctorId = Guid.NewGuid();
        var (context, _) = BuildContext(doctorId, []);
        var currentUser = new Mock<ICurrentUserService>(MockBehavior.Strict);
        currentUser.SetupGet(x => x.UserId).Returns(Guid.NewGuid());
        currentUser.SetupGet(x => x.Role).Returns("Patient");

        var handler = new GetDoctorAvailabilityQueryHandler(context.Object, currentUser.Object);
        var from = DateTime.UtcNow.AddHours(20);
        var query = new GetDoctorAvailabilityQuery(
            doctorId,
            from,
            from.AddDays(1),
            30,
            30);

        await Assert.ThrowsAsync<ForbiddenException>(() => handler.Handle(query, CancellationToken.None));
    }

    [Fact]
    public async Task Handle_WhenDoctorQueriesOtherDoctor_ThrowsForbiddenException()
    {
        var doctorId = Guid.NewGuid();
        var otherId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var doctors = new List<Doctor>
        {
            new() { Id = doctorId, UserId = userId, ProfessionalLicense = "X" },
            new() { Id = otherId, UserId = Guid.NewGuid(), ProfessionalLicense = "Y" }
        };
        var doctorDbSet = doctors.BuildMockDbSet();
        var appointmentsDbSet = new List<Appointment>().BuildMockDbSet();

        var context = new Mock<IApplicationDbContext>(MockBehavior.Strict);
        context.Setup(x => x.Set<Doctor>()).Returns(doctorDbSet.Object);
        context.Setup(x => x.Set<Appointment>()).Returns(appointmentsDbSet.Object);

        var currentUser = new Mock<ICurrentUserService>(MockBehavior.Strict);
        currentUser.SetupGet(x => x.UserId).Returns(userId);
        currentUser.SetupGet(x => x.Role).Returns("Doctor");

        var handler = new GetDoctorAvailabilityQueryHandler(context.Object, currentUser.Object);
        var from = DateTime.UtcNow.AddHours(20);
        var query = new GetDoctorAvailabilityQuery(
            otherId,
            from,
            from.AddDays(1),
            30,
            30);

        await Assert.ThrowsAsync<ForbiddenException>(() => handler.Handle(query, CancellationToken.None));
    }

    [Fact]
    public async Task Handle_WhenAdminAndNoBusy_ReturnsSlotsRespecting12HourRule()
    {
        var doctorId = Guid.NewGuid();
        var (context, _) = BuildContext(doctorId, []);
        var currentUser = new Mock<ICurrentUserService>(MockBehavior.Strict);
        currentUser.SetupGet(x => x.UserId).Returns(Guid.NewGuid());
        currentUser.SetupGet(x => x.Role).Returns("Admin");

        var handler = new GetDoctorAvailabilityQueryHandler(context.Object, currentUser.Object);
        var from = DateTime.UtcNow.AddHours(13);
        from = new DateTime(from.Year, from.Month, from.Day, from.Hour, 0, 0, DateTimeKind.Utc);
        var to = from.AddHours(4);

        var result = await handler.Handle(
            new GetDoctorAvailabilityQuery(doctorId, from, to, 60, 30),
            CancellationToken.None);

        Assert.Equal(doctorId, result.DoctorId);
        Assert.Equal(30, result.AppointmentDurationMinutes);
        Assert.True(result.AvailableSlotsUtc.Count >= 3);
        Assert.All(result.AvailableSlotsUtc, s => Assert.True(s >= DateTime.UtcNow.AddHours(12)));
    }

    [Fact]
    public async Task Handle_WhenOverlappingScheduledAppointment_OmitsConflictingStarts()
    {
        var doctorId = Guid.NewGuid();
        var from = DateTime.UtcNow.AddHours(20);
        from = new DateTime(from.Year, from.Month, from.Day, from.Hour, 0, 0, DateTimeKind.Utc);
        var to = from.AddHours(3);

        var blockStart = from.AddMinutes(30);
        var busy = new Appointment
        {
            Id = Guid.NewGuid(),
            DoctorId = doctorId,
            PatientId = Guid.NewGuid(),
            ScheduledAt = blockStart,
            DurationMinutes = 60,
            Status = AppointmentStatus.Confirmed,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        var (context, _) = BuildContext(doctorId, [busy]);
        var currentUser = new Mock<ICurrentUserService>(MockBehavior.Strict);
        currentUser.SetupGet(x => x.UserId).Returns(Guid.NewGuid());
        currentUser.SetupGet(x => x.Role).Returns("Admin");

        var handler = new GetDoctorAvailabilityQueryHandler(context.Object, currentUser.Object);
        var result = await handler.Handle(
            new GetDoctorAvailabilityQuery(doctorId, from, to, 30, 30),
            CancellationToken.None);

        Assert.DoesNotContain(blockStart, result.AvailableSlotsUtc);
        Assert.Contains(from, result.AvailableSlotsUtc);
    }

    [Fact]
    public async Task Handle_WhenOnlyCancelledOverlap_IncludesSlot()
    {
        var doctorId = Guid.NewGuid();
        var from = DateTime.UtcNow.AddHours(20);
        from = new DateTime(from.Year, from.Month, from.Day, from.Hour, 0, 0, DateTimeKind.Utc);
        var slot = from.AddMinutes(30);

        var busy = new Appointment
        {
            Id = Guid.NewGuid(),
            DoctorId = doctorId,
            PatientId = Guid.NewGuid(),
            ScheduledAt = slot,
            DurationMinutes = 60,
            Status = AppointmentStatus.Cancelled,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        var (context, _) = BuildContext(doctorId, [busy]);
        var currentUser = new Mock<ICurrentUserService>(MockBehavior.Strict);
        currentUser.SetupGet(x => x.UserId).Returns(Guid.NewGuid());
        currentUser.SetupGet(x => x.Role).Returns("Admin");

        var handler = new GetDoctorAvailabilityQueryHandler(context.Object, currentUser.Object);
        var result = await handler.Handle(
            new GetDoctorAvailabilityQuery(doctorId, from, from.AddHours(2), 30, 30),
            CancellationToken.None);

        Assert.Contains(slot, result.AvailableSlotsUtc);
    }

    [Fact]
    public async Task Handle_WhenDoctorNotFound_ThrowsBusinessRuleException()
    {
        var doctorId = Guid.NewGuid();
        var doctors = new List<Doctor>().BuildMockDbSet();
        var appointmentsDbSet = new List<Appointment>().BuildMockDbSet();
        var context = new Mock<IApplicationDbContext>(MockBehavior.Strict);
        context.Setup(x => x.Set<Doctor>()).Returns(doctors.Object);
        context.Setup(x => x.Set<Appointment>()).Returns(appointmentsDbSet.Object);

        var currentUser = new Mock<ICurrentUserService>(MockBehavior.Strict);
        currentUser.SetupGet(x => x.UserId).Returns(Guid.NewGuid());
        currentUser.SetupGet(x => x.Role).Returns("Admin");

        var handler = new GetDoctorAvailabilityQueryHandler(context.Object, currentUser.Object);
        var from = DateTime.UtcNow.AddDays(1);
        var ex = await Assert.ThrowsAsync<BusinessRuleException>(() => handler.Handle(
            new GetDoctorAvailabilityQuery(doctorId, from, from.AddDays(1), 15, 30),
            CancellationToken.None));

        Assert.Equal("DOCTOR_NOT_FOUND", ex.ErrorCode);
    }

    private static (Mock<IApplicationDbContext> Context, Guid DoctorId) BuildContext(
        Guid doctorId,
        List<Appointment> appointments)
    {
        var doctors = new List<Doctor>
        {
            new() { Id = doctorId, UserId = Guid.NewGuid(), ProfessionalLicense = "LIC-1" }
        };
        var doctorDbSet = doctors.BuildMockDbSet();
        var appointmentsDbSet = appointments.BuildMockDbSet();

        var context = new Mock<IApplicationDbContext>(MockBehavior.Strict);
        context.Setup(x => x.Set<Doctor>()).Returns(doctorDbSet.Object);
        context.Setup(x => x.Set<Appointment>()).Returns(appointmentsDbSet.Object);
        return (context, doctorId);
    }
}
