using VirtualMed.Domain.Entities;

namespace VirtualMed.Application.Interfaces;

public interface IApplicationDbContext
{
    IQueryable<T> Set<T>() where T : class;
    void Add<T>(T entity) where T : class;
    void Update<T>(T entity) where T : class;
    void Remove<T>(T entity) where T : class;
    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
