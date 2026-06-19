using VirtualMed.Application.Common.Exceptions;
using VirtualMed.Application.VitalSigns;
using VirtualMed.Domain.Enums;

namespace VirtualMed.Tests.Application.VitalSigns;

public class VitalSignRangeRulesTests
{
    [Theory]
    [InlineData(VitalSignType.HeartRate, 72)]
    [InlineData(VitalSignType.BloodPressureSystolic, 120)]
    public void ValidateValue_WhenInRange_DoesNotThrow(VitalSignType type, decimal value)
    {
        var ex = Record.Exception(() => VitalSignRangeRules.ValidateValue(type, value));
        Assert.Null(ex);
    }

    [Fact]
    public void ValidateValue_WhenOutOfRange_ThrowsBusinessRuleException()
    {
        var ex = Assert.Throws<BusinessRuleException>(() =>
            VitalSignRangeRules.ValidateValue(VitalSignType.HeartRate, 300));

        Assert.Equal("VITAL_OUT_OF_RANGE", ex.ErrorCode);
    }
}
