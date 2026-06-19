using MockQueryable.Moq;
using Moq;
using VirtualMed.Application.Exceptions;
using VirtualMed.Application.Interfaces;
using VirtualMed.Application.Queries.Doctors;
using VirtualMed.Domain.Entities;

namespace VirtualMed.Tests.Application.Doctors;

public class GetMyDoctorAvailabilityQueryHandlerTests
{
    [Fact]
    public async Task Handle_WhenAdmin_ThrowsForbiddenException()
    {
        var doctorId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var (context, _) = BuildContext(doctorId, userId, []);
        var currentUser = new Mock<ICurrentUserService>(MockBehavior.Strict);
        currentUser.SetupGet(x => x.UserId).Returns(userId);
        currentUser.SetupGet(x => x.Role).Returns("Admin");

        var handler = new GetMyDoctorAvailabilityQueryHandler(context.Object, currentUser.Object);
        var from = DateTime.UtcNow.AddHours(20);
        var query = new GetMyDoctorAvailabilityQuery(from, from.AddDays(1), 30, 30);

        await Assert.ThrowsAsync<ForbiddenException>(() => handler.Handle(query, CancellationToken.None));
    }

    [Fact]
    public async Task Handle_WhenDoctor_UsesProfileId_ReturnsSlots()
    {
        var doctorId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var (context, _) = BuildContext(doctorId, userId, []);
        var currentUser = new Mock<ICurrentUserService>(MockBehavior.Strict);
        currentUser.SetupGet(x => x.UserId).Returns(userId);
        currentUser.SetupGet(x => x.Role).Returns("Doctor");

        var handler = new GetMyDoctorAvailabilityQueryHandler(context.Object, currentUser.Object);
        var from = DateTime.UtcNow.AddHours(13);
        from = new DateTime(from.Year, from.Month, from.Day, from.Hour, 0, 0, DateTimeKind.Utc);
        var to = from.AddHours(4);

        var result = await handler.Handle(new GetMyDoctorAvailabilityQuery(from, to, 60, 30), CancellationToken.None);

        Assert.Equal(doctorId, result.DoctorId);
        Assert.True(result.AvailableSlotsUtc.Count >= 3);
    }

    [Fact]
    public async Task Handle_WhenSpecialist_UsesProfileId_ReturnsSlots()
    {
        var doctorId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var (context, _) = BuildContext(doctorId, userId, []);
        var currentUser = new Mock<ICurrentUserService>(MockBehavior.Strict);
        currentUser.SetupGet(x => x.UserId).Returns(userId);
        currentUser.SetupGet(x => x.Role).Returns("Specialist");

        var handler = new GetMyDoctorAvailabilityQueryHandler(context.Object, currentUser.Object);
        var from = DateTime.UtcNow.AddHours(13);
        from = new DateTime(from.Year, from.Month, from.Day, from.Hour, 0, 0, DateTimeKind.Utc);
        var to = from.AddHours(4);

        var result = await handler.Handle(new GetMyDoctorAvailabilityQuery(from, to, 60, 30), CancellationToken.None);

        Assert.Equal(doctorId, result.DoctorId);
    }

    [Fact]
    public async Task Handle_WhenNoDoctorProfile_ThrowsForbiddenException()
    {
        var doctors = new List<Doctor>().BuildMockDbSet();
        var appointmentsDbSet = new List<Appointment>().BuildMockDbSet();
        var context = new Mock<IApplicationDbContext>(MockBehavior.Strict);
        context.Setup(x => x.Set<Doctor>()).Returns(doctors.Object);
        context.Setup(x => x.Set<Appointment>()).Returns(appointmentsDbSet.Object);

        var currentUser = new Mock<ICurrentUserService>(MockBehavior.Strict);
        currentUser.SetupGet(x => x.UserId).Returns(Guid.NewGuid());
        currentUser.SetupGet(x => x.Role).Returns("Doctor");

        var handler = new GetMyDoctorAvailabilityQueryHandler(context.Object, currentUser.Object);
        var from = DateTime.UtcNow.AddHours(20);
        var query = new GetMyDoctorAvailabilityQuery(from, from.AddDays(1), 30, 30);

        await Assert.ThrowsAsync<ForbiddenException>(() => handler.Handle(query, CancellationToken.None));
    }

    private static (Mock<IApplicationDbContext> Context, Guid DoctorId) BuildContext(
        Guid doctorId,
        Guid userId,
        List<Appointment> appointments)
    {
        var doctors = new List<Doctor>
        {
            new() { Id = doctorId, UserId = userId, ProfessionalLicense = "LIC-1" }
        };
        var doctorDbSet = doctors.BuildMockDbSet();
        var appointmentsDbSet = appointments.BuildMockDbSet();

        var context = new Mock<IApplicationDbContext>(MockBehavior.Strict);
        context.Setup(x => x.Set<Doctor>()).Returns(doctorDbSet.Object);
        context.Setup(x => x.Set<Appointment>()).Returns(appointmentsDbSet.Object);
        return (context, doctorId);
    }
}
