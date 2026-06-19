using System;
using System.Collections.Generic;
using System.Text;

namespace VirtualMed.Application.Interfaces.Services
{
    public interface INotificationService
    {
        Task NotifyAdminAsync(string message);
    }
}
