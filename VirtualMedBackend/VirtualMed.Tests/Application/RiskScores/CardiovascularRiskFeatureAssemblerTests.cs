using MockQueryable.Moq;
using Moq;
using VirtualMed.Application.Common.Exceptions;
using VirtualMed.Application.Interfaces;
using VirtualMed.Application.RiskScores;
using VirtualMed.Domain.Entities;
using VirtualMed.Domain.Enums;

namespace VirtualMed.Tests.Application.RiskScores;

public class CardiovascularRiskFeatureAssemblerTests
{
    [Fact]
    public async Task AssembleAsync_WhenVitalsAndOverridesPresent_ReturnsMappedRequest()
    {
        var patientId = Guid.NewGuid();
        var patient = new Patient
        {
            Id = patientId,
            UserId = Guid.NewGuid(),
            Document = "123",
            DateOfBirth = DateOnly.FromDateTime(DateTime.UtcNow.AddYears(-40)),
            Gender = "male"
        };

        var vitals = new List<VitalSignReading>
        {
            new()
            {
                Id = Guid.NewGuid(),
                PatientId = patientId,
                VitalSignType = VitalSignType.BloodPressureSystolic,
                Value = 132,
                Unit = "mmHg",
                ReadingAt = DateTime.UtcNow.AddMinutes(-10),
                Source = VitalReadingSource.Manual,
                CreatedAt = DateTime.UtcNow
            },
            new()
            {
                Id = Guid.NewGuid(),
                PatientId = patientId,
                VitalSignType = VitalSignType.BloodPressureDiastolic,
                Value = 84,
                Unit = "mmHg",
                ReadingAt = DateTime.UtcNow.AddMinutes(-10),
                Source = VitalReadingSource.Manual,
                CreatedAt = DateTime.UtcNow
            },
            new()
            {
                Id = Guid.NewGuid(),
                PatientId = patientId,
                VitalSignType = VitalSignType.Weight,
                Value = 70,
                Unit = "kg",
                ReadingAt = DateTime.UtcNow.AddMinutes(-15),
                Source = VitalReadingSource.Manual,
                CreatedAt = DateTime.UtcNow
            }
        };

        var context = new Mock<IApplicationDbContext>(MockBehavior.Strict);
        context.Setup(x => x.Set<Patient>()).Returns(new List<Patient> { patient }.BuildMockDbSet().Object);
        context.Setup(x => x.Set<VitalSignReading>()).Returns(vitals.BuildMockDbSet().Object);

        var sut = new CardiovascularRiskFeatureAssembler(context.Object);

        var overrides = new CardiovascularRiskOverridesDto(
            Smoker: 0,
            PhysicalActivityLevel: 1,
            SystolicBp: null,
            DiastolicBp: null,
            Bmi: null,
            FamilyHistoryCvd: 1,
            CholesterolTotal: 2,
            GlucoseMgDl: null);

        var (request, snapshot) = await sut.AssembleAsync(patientId, overrides, CancellationToken.None);

        Assert.Equal(1, request.Sex);
        Assert.Equal(132, request.SystolicBp);
        Assert.Equal(84, request.DiastolicBp);
        Assert.Equal(24.2, request.Bmi); // 70 / 1.70^2
        Assert.Equal(0, request.Smoker);
        Assert.Equal(1, request.PhysicalActivityLevel);
        Assert.Contains("vitalSignReading", snapshot);
    }

    [Fact]
    public async Task AssembleAsync_WhenSmokerMissing_ThrowsBusinessRuleException()
    {
        var patientId = Guid.NewGuid();
        var patient = new Patient
        {
            Id = patientId,
            UserId = Guid.NewGuid(),
            Document = "456",
            DateOfBirth = DateOnly.FromDateTime(DateTime.UtcNow.AddYears(-42)),
            Gender = "female"
        };

        var vitals = new List<VitalSignReading>
        {
            new()
            {
                Id = Guid.NewGuid(),
                PatientId = patientId,
                VitalSignType = VitalSignType.BloodPressureSystolic,
                Value = 120,
                Unit = "mmHg",
                ReadingAt = DateTime.UtcNow.AddMinutes(-10),
                Source = VitalReadingSource.Manual,
                CreatedAt = DateTime.UtcNow
            },
            new()
            {
                Id = Guid.NewGuid(),
                PatientId = patientId,
                VitalSignType = VitalSignType.BloodPressureDiastolic,
                Value = 80,
                Unit = "mmHg",
                ReadingAt = DateTime.UtcNow.AddMinutes(-10),
                Source = VitalReadingSource.Manual,
                CreatedAt = DateTime.UtcNow
            },
            new()
            {
                Id = Guid.NewGuid(),
                PatientId = patientId,
                VitalSignType = VitalSignType.Weight,
                Value = 72,
                Unit = "kg",
                ReadingAt = DateTime.UtcNow.AddMinutes(-15),
                Source = VitalReadingSource.Manual,
                CreatedAt = DateTime.UtcNow
            }
        };

        var context = new Mock<IApplicationDbContext>(MockBehavior.Strict);
        context.Setup(x => x.Set<Patient>()).Returns(new List<Patient> { patient }.BuildMockDbSet().Object);
        context.Setup(x => x.Set<VitalSignReading>()).Returns(vitals.BuildMockDbSet().Object);

        var sut = new CardiovascularRiskFeatureAssembler(context.Object);

        var overrides = new CardiovascularRiskOverridesDto(
            Smoker: null,
            PhysicalActivityLevel: 1,
            SystolicBp: null,
            DiastolicBp: null,
            Bmi: null,
            FamilyHistoryCvd: null,
            CholesterolTotal: null,
            GlucoseMgDl: null);

        var ex = await Assert.ThrowsAsync<BusinessRuleException>(() =>
            sut.AssembleAsync(patientId, overrides, CancellationToken.None));

        Assert.Equal("RISK_FEATURES_INCOMPLETE", ex.ErrorCode);
    }
}
