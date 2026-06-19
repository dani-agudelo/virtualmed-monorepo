using Microsoft.EntityFrameworkCore;
using VirtualMed.Domain.Entities;
using VirtualMed.Infrastructure.Persistence;

namespace VirtualMed.Infrastructure.Persistence;

public class RolePermissionSeeder
{
    private readonly ApplicationDbContext _context;

    public RolePermissionSeeder(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task SeedAsync(CancellationToken cancellationToken = default)
    {
        await EnsurePermissionsAsync(cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);

        var permissionByKey = await LoadPermissionDictionaryAsync(cancellationToken);
        await EnsureStandardRolesAndSyncPermissionsAsync(permissionByKey, cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);
    }

    private async Task EnsurePermissionsAsync(CancellationToken cancellationToken)
    {
        var allExisting = await _context.Permissions.ToListAsync(cancellationToken);
        var existingByName = allExisting
            .GroupBy(p => p.Name, StringComparer.Ordinal)
            .ToDictionary(g => g.Key, g => g.OrderBy(x => x.Id).First(), StringComparer.Ordinal);

        foreach (var spec in PermissionCatalog.All)
        {
            if (existingByName.TryGetValue(spec.Name, out var existing))
            {
                if (existing.Description != spec.Description
                    || existing.Resource != spec.Resource
                    || existing.Action != spec.Action)
                {
                    existing.Description = spec.Description;
                    existing.Resource = spec.Resource;
                    existing.Action = spec.Action;
                }

                continue;
            }

            _context.Permissions.Add(new Permission
            {
                Id = Guid.NewGuid(),
                Name = spec.Name,
                Resource = spec.Resource,
                Action = spec.Action,
                Description = spec.Description
            });
        }
    }

    private async Task<Dictionary<string, Permission>> LoadPermissionDictionaryAsync(CancellationToken cancellationToken)
    {
        var list = await _context.Permissions.ToListAsync(cancellationToken);
        return list
            .GroupBy(p => PermissionKey(p.Resource, p.Action), StringComparer.Ordinal)
            .ToDictionary(g => g.Key, g => g.OrderBy(x => x.Id).First(), StringComparer.Ordinal);
    }

    private static string PermissionKey(string resource, string action) => $"{resource}:{action}";

    private async Task EnsureStandardRolesAndSyncPermissionsAsync(
        Dictionary<string, Permission> permissionByKey,
        CancellationToken cancellationToken)
    {
        var roles = await _context.Roles
            .Include(r => r.Permissions)
            .ToListAsync(cancellationToken);

        var userCountByRole = await _context.Users
            .AsNoTracking()
            .GroupBy(u => u.RoleId)
            .Select(g => new { g.Key, Cnt = g.Count() })
            .ToDictionaryAsync(x => x.Key, x => x.Cnt, cancellationToken);

        static bool MatchesStandardName(string dbName, string canonicalName) =>
            string.Equals(dbName.Trim(), canonicalName, StringComparison.OrdinalIgnoreCase);

        foreach (var roleName in StandardRoleNames.All)
        {
            var matching = roles.Where(r => MatchesStandardName(r.Name, roleName)).ToList();

            Role role;
            if (matching.Count > 1)
            {
                var keeper = matching
                    .OrderByDescending(r => userCountByRole.GetValueOrDefault(r.Id))
                    .ThenBy(r => r.Id)
                    .First();

                keeper.Name = roleName;

                foreach (var dup in matching.Where(r => r.Id != keeper.Id))
                {
                    var affectedUsers = await _context.Users
                        .Where(u => u.RoleId == dup.Id)
                        .ToListAsync(cancellationToken);
                    foreach (var u in affectedUsers)
                        u.RoleId = keeper.Id;

                    _context.Roles.Remove(dup);
                    roles.Remove(dup);
                }

                role = keeper;
            }
            else if (matching.Count == 1)
            {
                role = matching[0];
                if (!string.Equals(role.Name, roleName, StringComparison.Ordinal))
                    role.Name = roleName;
            }
            else
            {
                role = new Role { Id = Guid.NewGuid(), Name = roleName };
                _context.Roles.Add(role);
                roles.Add(role);
            }

            SyncPermissionsForRole(role, roleName, permissionByKey);
        }
    }

    private static void SyncPermissionsForRole(
        Role role,
        string roleName,
        Dictionary<string, Permission> permissionByKey)
    {
        var expectedKeys = GetPermissionKeysForRole(roleName);
        var expected = new List<Permission>();
        foreach (var key in expectedKeys)
        {
            if (permissionByKey.TryGetValue(key, out var p))
                expected.Add(p);
        }

        var toRemove = role.Permissions
            .Where(current => expected.All(e => e.Id != current.Id))
            .ToList();

        foreach (var p in toRemove)
            role.Permissions.Remove(p);

        foreach (var p in expected)
        {
            if (role.Permissions.All(c => c.Id != p.Id))
                role.Permissions.Add(p);
        }
    }

    private static List<string> GetPermissionKeysForRole(string roleName) =>
        roleName switch
        {
            "Patient" =>
            [
                PermissionKey("Auth", "2FA:Manage"),
                PermissionKey("Patient", "ReadOwn"),
                PermissionKey("Patient", "UpdateOwn"),
                PermissionKey("Appointment", "Read"),
                PermissionKey("ClinicalEncounter", "Read"),
                PermissionKey("Prescription", "Read"),
                PermissionKey("VideoSession", "Read"),
                PermissionKey("VideoSession", "Start"),
                PermissionKey("VideoSession", "End"),
                PermissionKey("VideoSession", "Refresh"),
                PermissionKey("VideoChat", "Join"),
                PermissionKey("VideoChat", "Send"),
                PermissionKey("VideoChat", "Read"),
                PermissionKey("VitalSign", "Read"),
                PermissionKey("VitalSign", "Create"),
                PermissionKey("VitalSign", "BulkCreate"),
                PermissionKey("AlertThreshold", "Read"),
                PermissionKey("AlertThreshold", "Create"),
                PermissionKey("AlertThreshold", "Update"),
                PermissionKey("AlertThreshold", "Delete"),
                PermissionKey("Alert", "Read"),
                PermissionKey("Alert", "Update"),
                PermissionKey("RiskScore", "Read"),
                PermissionKey("RiskScore", "Create")
            ],
            "Doctor" =>
            [
                PermissionKey("Auth", "2FA:Manage"),
                PermissionKey("Patient", "Read"),
                PermissionKey("Patient", "Create"),
                PermissionKey("Appointment", "Read"),
                PermissionKey("Appointment", "Create"),
                PermissionKey("Appointment", "Update"),
                PermissionKey("ClinicalEncounter", "Read"),
                PermissionKey("ClinicalEncounter", "Create"),
                PermissionKey("ClinicalEncounter", "Update"),
                PermissionKey("Prescription", "Read"),
                PermissionKey("Prescription", "Create"),
                PermissionKey("VideoSession", "Create"),
                PermissionKey("VideoSession", "Read"),
                PermissionKey("VideoSession", "Start"),
                PermissionKey("VideoSession", "End"),
                PermissionKey("VideoSession", "Refresh"),
                PermissionKey("VideoChat", "Join"),
                PermissionKey("VideoChat", "Send"),
                PermissionKey("VideoChat", "Read"),
                PermissionKey("VitalSign", "Read"),
                PermissionKey("VitalSign", "Create"),
                PermissionKey("Alert", "Read"),
                PermissionKey("RiskScore", "Read"),
                PermissionKey("RiskScore", "Create")
            ],
            "Specialist" =>
            [
                PermissionKey("Auth", "2FA:Manage"),
                PermissionKey("Patient", "Read"),
                PermissionKey("Appointment", "Read"),
                PermissionKey("Appointment", "Create"),
                PermissionKey("Appointment", "Update"),
                PermissionKey("ClinicalEncounter", "Read"),
                PermissionKey("ClinicalEncounter", "Create"),
                PermissionKey("ClinicalEncounter", "Update"),
                PermissionKey("Prescription", "Read"),
                PermissionKey("Prescription", "Create"),
                PermissionKey("VideoSession", "Create"),
                PermissionKey("VideoSession", "Read"),
                PermissionKey("VideoSession", "Start"),
                PermissionKey("VideoSession", "End"),
                PermissionKey("VideoSession", "Refresh"),
                PermissionKey("VideoChat", "Join"),
                PermissionKey("VideoChat", "Send"),
                PermissionKey("VideoChat", "Read"),
                PermissionKey("VitalSign", "Read"),
                PermissionKey("RiskScore", "Read")
            ],
            "Admin" =>
            [
                PermissionKey("Auth", "2FA:Manage"),
                PermissionKey("Patient", "Read"),
                PermissionKey("Patient", "Create"),
                PermissionKey("Appointment", "Read"),
                PermissionKey("Appointment", "Create"),
                PermissionKey("Appointment", "Update"),
                PermissionKey("ClinicalEncounter", "Read"),
                PermissionKey("ClinicalEncounter", "Update"),
                PermissionKey("Prescription", "Read"),
                PermissionKey("Prescription", "Create"),
                PermissionKey("VideoSession", "Create"),
                PermissionKey("VideoSession", "Read"),
                PermissionKey("VideoSession", "Start"),
                PermissionKey("VideoSession", "End"),
                PermissionKey("VideoSession", "Refresh"),
                PermissionKey("VideoChat", "Join"),
                PermissionKey("VideoChat", "Send"),
                PermissionKey("VideoChat", "Read"),
                PermissionKey("VitalSign", "Read"),
                PermissionKey("VitalSign", "Create"),
                PermissionKey("VitalSign", "BulkCreate"),
                PermissionKey("AlertThreshold", "Read"),
                PermissionKey("AlertThreshold", "Create"),
                PermissionKey("AlertThreshold", "Update"),
                PermissionKey("AlertThreshold", "Delete"),
                PermissionKey("Alert", "Read"),
                PermissionKey("Alert", "Update"),
                PermissionKey("RiskScore", "Read"),
                PermissionKey("RiskScore", "Create"),
                PermissionKey("Role", "Read"),
                PermissionKey("Role", "Create"),
                PermissionKey("Role", "Update"),
                PermissionKey("User", "Read"),
                PermissionKey("User", "ManageRoles"),
                PermissionKey("Doctor", "Approve"),
                PermissionKey("AuditLog", "Read"),
                PermissionKey("AuditLog", "Export")
            ],
            "FamilyMember" =>
            [
                PermissionKey("Auth", "2FA:Manage"),
                PermissionKey("Patient", "ReadOwn"),
                PermissionKey("Appointment", "Read"),
                PermissionKey("VitalSign", "Read"),
                PermissionKey("Alert", "Read"),
                PermissionKey("RiskScore", "Read")
            ],
            _ => [PermissionKey("Auth", "2FA:Manage")]
        };

    private static class StandardRoleNames
    {
        public static readonly string[] All =
        [
            "Patient",
            "Doctor",
            "Specialist",
            "Admin",
            "FamilyMember"
        ];
    }

    private static class PermissionCatalog
    {
        public static readonly PermissionSpec[] All =
        [
            new("Auth:2FA:Manage", "Auth", "2FA:Manage", "Habilitar/deshabilitar 2FA"),
            new("Patient:ReadOwn", "Patient", "ReadOwn", "Ver propio perfil de paciente"),
            new("Patient:UpdateOwn", "Patient", "UpdateOwn", "Actualizar propio perfil"),
            new("Patient:Read", "Patient", "Read", "Ver pacientes (médico/admin)"),
            new("Patient:Create", "Patient", "Create", "Registrar pacientes"),
            new("Appointment:Read", "Appointment", "Read", "Ver citas"),
            new("Appointment:Create", "Appointment", "Create", "Crear citas"),
            new("Appointment:Update", "Appointment", "Update", "Actualizar citas"),
            new("ClinicalEncounter:Read", "ClinicalEncounter", "Read", "Ver encuentros clínicos"),
            new("ClinicalEncounter:Create", "ClinicalEncounter", "Create", "Crear encuentros"),
            new("ClinicalEncounter:Update", "ClinicalEncounter", "Update", "Actualizar encuentros (admin: completo; médico: dentro de 24 h, sin bloquear)"),
            new("AuditLog:Read", "AuditLog", "Read", "Ver registros de auditoría"),
            new("AuditLog:Export", "AuditLog", "Export", "Exportar registros de auditoría"),
            new("Prescription:Read", "Prescription", "Read", "Ver recetas"),
            new("Prescription:Create", "Prescription", "Create", "Crear recetas"),
            new("VideoSession:Create", "VideoSession", "Create", "Crear sesiones de videoconsulta"),
            new("VideoSession:Read", "VideoSession", "Read", "Ver sesiones de videoconsulta"),
            new("VideoSession:Start", "VideoSession", "Start", "Iniciar sesiones de videoconsulta"),
            new("VideoSession:End", "VideoSession", "End", "Finalizar sesiones de videoconsulta"),
            new("VideoSession:Refresh", "VideoSession", "Refresh", "Refrescar token de sesión de videoconsulta"),
            new("VideoChat:Join", "VideoChat", "Join", "Unirse al chat de videoconsulta"),
            new("VideoChat:Send", "VideoChat", "Send", "Enviar mensajes en chat de videoconsulta"),
            new("VideoChat:Read", "VideoChat", "Read", "Consultar historial de chat de videoconsulta"),
            new("VitalSign:Read", "VitalSign", "Read", "Ver lecturas de signos vitales"),
            new("VitalSign:Create", "VitalSign", "Create", "Registrar signos vitales (manual)"),
            new("VitalSign:BulkCreate", "VitalSign", "BulkCreate", "Importar lote simulado de signos vitales"),
            new("AlertThreshold:Read", "AlertThreshold", "Read", "Ver umbrales de alerta"),
            new("AlertThreshold:Create", "AlertThreshold", "Create", "Crear umbrales de alerta"),
            new("AlertThreshold:Update", "AlertThreshold", "Update", "Actualizar umbrales de alerta"),
            new("AlertThreshold:Delete", "AlertThreshold", "Delete", "Eliminar umbrales de alerta"),
            new("Alert:Read", "Alert", "Read", "Ver alertas de salud"),
            new("Alert:Update", "Alert", "Update", "Actualizar alertas (marcar leída)"),
            new("RiskScore:Read", "RiskScore", "Read", "Ver historial de riesgo cardiovascular"),
            new("RiskScore:Create", "RiskScore", "Create", "Calcular riesgo cardiovascular"),
            new("Role:Read", "Role", "Read", "Ver roles"),
            new("Role:Create", "Role", "Create", "Crear roles"),
            new("Role:Update", "Role", "Update", "Actualizar roles"),
            new("User:Read", "User", "Read", "Ver usuarios"),
            new("User:ManageRoles", "User", "ManageRoles", "Asignar roles a usuarios"),
            new("Doctor:Approve", "Doctor", "Approve", "Aprobar médicos")
        ];
    }

    private readonly record struct PermissionSpec(
        string Name,
        string Resource,
        string Action,
        string Description);
}
