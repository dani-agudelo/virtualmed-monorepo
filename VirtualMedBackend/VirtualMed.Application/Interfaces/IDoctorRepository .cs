using System;
using System.Collections.Generic;
using System.Text;
using VirtualMed.Domain.Entities;

namespace VirtualMed.Application.Interfaces
{
    public interface IDoctorRepository
    {
        Task AddAsync(Doctor doctor);
        Task<Doctor?> GetByIdAsync(Guid id);
    }
}