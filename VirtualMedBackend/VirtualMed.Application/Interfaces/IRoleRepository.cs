using System;
using System.Collections.Generic;
using System.Text;
using VirtualMed.Domain.Entities;

namespace VirtualMed.Application.Interfaces
{
    public interface IRoleRepository
    {
        Task<Role?> GetByNameAsync(string name);
    }
}