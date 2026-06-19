namespace VirtualMed.Domain.Entities
{
    public class Doctor
    {
        public Guid Id { get; set; }
        public Guid UserId { get; set; }
        public User User { get; set; } = null!;

        public string ProfessionalLicense { get; set; } = null!;
        public bool Verified { get; set; }
    }
}
