# Build stage
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY ["VirtualMed.Api/VirtualMed.Api.csproj", "VirtualMed.Api/"]
COPY ["VirtualMed.Application/VirtualMed.Application.csproj", "VirtualMed.Application/"]
COPY ["VirtualMed.Domain/VirtualMed.Domain.csproj", "VirtualMed.Domain/"]
COPY ["VirtualMed.Infrastructure/VirtualMed.Infrastructure.csproj", "VirtualMed.Infrastructure/"]

RUN dotnet restore "VirtualMed.Api/VirtualMed.Api.csproj"

COPY . .

RUN dotnet publish "VirtualMed.Api/VirtualMed.Api.csproj" -c Release -o /app/publish /p:UseAppHost=false

# Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080

COPY --from=build /app/publish .

ENTRYPOINT ["dotnet", "VirtualMed.Api.dll"]
