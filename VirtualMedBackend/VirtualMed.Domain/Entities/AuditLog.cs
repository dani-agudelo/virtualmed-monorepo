using System;

namespace VirtualMed.Domain.Entities;

public class AuditLog
{
    public Guid Id { get; set; }

    public DateTime OccurredAt { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public string TableName { get; set; } = null!;
    public string Operation { get; set; } = null!; // "I" / "U" / "D"
    public string RowPk { get; set; } = null!;

    public string? OldData { get; set; }
    public string? NewData { get; set; }

    public string DbUser { get; set; } = null!;
    public string? AppUserId { get; set; }
}

