using VirtualMed.Domain.Entities;

namespace VirtualMed.Application.Interfaces
{
    public interface  IPatientRepository
    {
        Task<Patient?> GetByIdAsync(Guid id);
        Task<bool> DocumentNumberExistsAsync(string documentNumber);
        Task AddAsync(Patient patient);
    }
}