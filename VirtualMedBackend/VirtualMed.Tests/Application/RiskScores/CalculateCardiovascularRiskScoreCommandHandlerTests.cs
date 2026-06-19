using MockQueryable.Moq;
using Moq;
using VirtualMed.Application.Commands.RiskScores;
using VirtualMed.Application.Common.Exceptions;
using VirtualMed.Application.Interfaces;
using VirtualMed.Application.Interfaces.Services;
using VirtualMed.Application.RiskScores;
using VirtualMed.Domain.Entities;

namespace VirtualMed.Tests.Application.RiskScores;

public class CalculateCardiovascularRiskScoreCommandHandlerTests
{
    [Fact]
    public async Task Handle_WhenPredictionServiceUnavailable_ThrowsExternalServiceException()
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

        var context = new Mock<IApplicationDbContext>(MockBehavior.Strict);
        context.Setup(x => x.Set<Patient>()).Returns(new List<Patient> { patient }.BuildMockDbSet().Object);

        var currentUser = new Mock<ICurrentUserService>(MockBehavior.Strict);
        currentUser.SetupGet(x => x.UserId).Returns(Guid.NewGuid());
        currentUser.SetupGet(x => x.Role).Returns("Admin");

        var featureAssembler = new Mock<ICardiovascularRiskFeatureAssembler>(MockBehavior.Strict);

        var riskClient = new Mock<IRiskPredictionClient>(MockBehavior.Strict);
        riskClient
            .Setup(x => x.GetHealthAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new RiskPredictionHealthStatus { Status = "unavailable", ModelVersion = "v1" });

        var sut = new CalculateCardiovascularRiskScoreCommandHandler(
            context.Object,
            currentUser.Object,
            featureAssembler.Object,
            riskClient.Object);

        var ex = await Assert.ThrowsAsync<ExternalServiceException>(() =>
            sut.Handle(new CalculateCardiovascularRiskScoreCommand(patientId, null), CancellationToken.None));

        Assert.Equal("RiskPrediction", ex.ServiceName);
    }

    [Fact]
    public async Task Handle_WhenHealthOk_PersistsRiskScoreAndReturnsDto()
    {
        var patientId = Guid.NewGuid();
        var patient = new Patient
        {
            Id = patientId,
            UserId = Guid.NewGuid(),
            Document = "789",
            DateOfBirth = DateOnly.FromDateTime(DateTime.UtcNow.AddYears(-41)),
            Gender = "female"
        };

        var context = new Mock<IApplicationDbContext>(MockBehavior.Strict);
        context.Setup(x => x.Set<Patient>()).Returns(new List<Patient> { patient }.BuildMockDbSet().Object);

        RiskScore? added = null;
        context.Setup(x => x.Add(It.IsAny<RiskScore>()))
            .Callback<object>(entity => added = (RiskScore)entity);
        context.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);

        var currentUser = new Mock<ICurrentUserService>(MockBehavior.Strict);
        currentUser.SetupGet(x => x.UserId).Returns(Guid.NewGuid());
        currentUser.SetupGet(x => x.Role).Returns("Admin");

        var apiRequest = new CardiovascularRiskApiRequest
        {
            Age = 41,
            Sex = 0,
            Bmi = 26.3,
            SystolicBp = 130,
            DiastolicBp = 84,
            Smoker = 0,
            PhysicalActivityLevel = 1,
            FamilyHistoryCvd = 1,
            CholesterolTotal = 2,
            GlucoseMgDl = null
        };

        var featureAssembler = new Mock<ICardiovascularRiskFeatureAssembler>(MockBehavior.Strict);
        featureAssembler
            .Setup(x => x.AssembleAsync(
                patientId,
                It.IsAny<CardiovascularRiskOverridesDto?>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync((apiRequest, "{\"payload\":{}}"));

        var riskClient = new Mock<IRiskPredictionClient>(MockBehavior.Strict);
        riskClient
            .Setup(x => x.GetHealthAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new RiskPredictionHealthStatus { Status = "ok", ModelVersion = "v1" });
        riskClient
            .Setup(x => x.PredictCardiovascularAsync(It.IsAny<CardiovascularRiskApiRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new RiskPredictionApiResult
            {
                Score = 73,
                RiskLevel = "high",
                ModelVersion = "v1",
                DisclaimerVersion = "v1"
            });

        var sut = new CalculateCardiovascularRiskScoreCommandHandler(
            context.Object,
            currentUser.Object,
            featureAssembler.Object,
            riskClient.Object);

        var result = await sut.Handle(
            new CalculateCardiovascularRiskScoreCommand(patientId, null),
            CancellationToken.None);

        Assert.NotNull(added);
        Assert.Equal(patientId, added!.PatientId);
        Assert.Equal(73, added.Score);
        Assert.Equal("high", result.RiskLevel);
        Assert.Equal("v1", result.ModelVersion);
    }
}
