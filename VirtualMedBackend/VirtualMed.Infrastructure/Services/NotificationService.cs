using VirtualMed.Application.Interfaces.Services;

namespace VirtualMed.Infrastructure.Services;

public class NotificationService : INotificationService
{
    public async Task NotifyAdminAsync(string message)
    {
        // TODO: Implementar notificación (email, SMS, etc.)
        Console.WriteLine($"[NOTIFICACIÓN ADMIN]: {message}");
        await Task.CompletedTask;
    }
}
