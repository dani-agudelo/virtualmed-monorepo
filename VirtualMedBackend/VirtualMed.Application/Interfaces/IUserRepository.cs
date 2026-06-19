using System;
using System.Collections.Generic;
using System.Text;
using VirtualMed.Domain.Entities;

namespace VirtualMed.Application.Interfaces
{
    public interface IUserRepository
    {
        Task<bool> EmailExistsAsync(string email);
        Task AddAsync(User user);
        Task<User?> GetByIdAsync(Guid id);
    }
}