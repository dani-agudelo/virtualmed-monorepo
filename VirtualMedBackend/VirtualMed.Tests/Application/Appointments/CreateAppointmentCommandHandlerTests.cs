using MockQueryable.Moq;
using Moq;
using VirtualMed.Application.Commands.Appointments;
using VirtualMed.Application.Common.Exceptions;
using VirtualMed.Application.Interfaces;
using VirtualMed.Domain.Entities;
using VirtualMed.Domain.Enums;

namespace VirtualMed.Tests.Application.Appointments;

public class CreateAppointmentCommandHandlerTests
{
    [Fact]
    public async Task Handle_WhenScheduledLessThan12HoursAhead_ThrowsBusinessRuleException_WithCode()
    {
        var context = new Mock<IApplicationDbContext>(MockBehavior.Strict);
        var currentUser = new Mock<ICurrentUserService>(MockBehavior.Strict);

        currentUser.SetupGet(x => x.UserId).Returns(Guid.NewGuid());
        currentUser.SetupGet(x => x.Role).Returns("Admin");

        // Handler will check conflicts via Appointment query; we provide an empty async-capable queryable.
        var appointmentsDbSet = new List<Appointment>().BuildMockDbSet();
        context.Setup(x => x.Set<Appointment>()).Returns(appointmentsDbSet.Object);

        var handler = new CreateAppointmentCommandHandler(context.Object, currentUser.Object);

        var command = new CreateAppointmentCommand(
            PatientId: Guid.NewGuid(),
            DoctorId: Guid.NewGuid(),
            ScheduledAt: DateTime.UtcNow.AddHours(1),
            DurationMinutes: 30,
            Reason: null,
            Status: AppointmentStatus.Scheduled);

        var ex = await Assert.ThrowsAsync<BusinessRuleException>(() => handler.Handle(command, CancellationToken.None));
        Assert.Equal("APPOINTMENT_MIN_ADVANCE_TIME", ex.ErrorCode);
    }

    [Fact]
    public async Task Handle_WhenOverlapsExistingNonCancelledAppointment_ThrowsBusinessRuleException_WithCode()
    {
        var context = new Mock<IApplicationDbContext>(MockBehavior.Strict);
        var currentUser = new Mock<ICurrentUserService>(MockBehavior.Strict);

        currentUser.SetupGet(x => x.UserId).Returns(Guid.NewGuid());
        currentUser.SetupGet(x => x.Role).Returns("Admin");

        var doctorId = Guid.NewGuid();

        var existing = new Appointment
        {
            Id = Guid.NewGuid(),
            DoctorId = doctorId,
            PatientId = Guid.NewGuid(),
            ScheduledAt = DateTime.UtcNow.AddHours(24),
            DurationMinutes = 60,
            Status = AppointmentStatus.Scheduled,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        var appointmentsDbSet = new List<Appointment> { existing }.BuildMockDbSet();
        context.Setup(x => x.Set<Appointment>()).Returns(appointmentsDbSet.Object);

        var handler = new CreateAppointmentCommandHandler(context.Object, currentUser.Object);

        var command = new CreateAppointmentCommand(
            PatientId: Guid.NewGuid(),
            DoctorId: doctorId,
            ScheduledAt: existing.ScheduledAt.AddMinutes(30),
            DurationMinutes: 30,
            Reason: null,
            Status: AppointmentStatus.Scheduled);

        var ex = await Assert.ThrowsAsync<BusinessRuleException>(() => handler.Handle(command, CancellationToken.None));
        Assert.Equal("DOCTOR_BUSY", ex.ErrorCode);
    }

    [Fact]
    public async Task Handle_WhenOnlyOverlapsCancelledAppointment_DoesNotThrowBusy()
    {
        var context = new Mock<IApplicationDbContext>(MockBehavior.Strict);
        var currentUser = new Mock<ICurrentUserService>(MockBehavior.Strict);

        currentUser.SetupGet(x => x.UserId).Returns(Guid.NewGuid());
        currentUser.SetupGet(x => x.Role).Returns("Admin");

        var doctorId = Guid.NewGuid();

        var existing = new Appointment
        {
            Id = Guid.NewGuid(),
            DoctorId = doctorId,
            PatientId = Guid.NewGuid(),
            ScheduledAt = DateTime.UtcNow.AddHours(24),
            DurationMinutes = 60,
            Status = AppointmentStatus.Cancelled,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        var appointmentsDbSet = new List<Appointment> { existing }.BuildMockDbSet();
        context.Setup(x => x.Set<Appointment>()).Returns(appointmentsDbSet.Object);

        context.Setup(x => x.Add(It.IsAny<Appointment>()));
        context.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);

        var handler = new CreateAppointmentCommandHandler(context.Object, currentUser.Object);

        var command = new CreateAppointmentCommand(
            PatientId: Guid.NewGuid(),
            DoctorId: doctorId,
            ScheduledAt: existing.ScheduledAt.AddHours(1),
            DurationMinutes: 30,
            Reason: null,
            Status: AppointmentStatus.Scheduled);

        var ex = await Record.ExceptionAsync(() => handler.Handle(command, CancellationToken.None));
        Assert.Null(ex);
    }
}
