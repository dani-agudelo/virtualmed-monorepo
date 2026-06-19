using System;
using System.Collections.Generic;
using System.Text;

namespace VirtualMed.Application.Interfaces.Services
{
    public interface IMinioService
    {
        Task UploadAsync(string bucket, string objectName, Stream data, CancellationToken cancellationToken);
    }
}
