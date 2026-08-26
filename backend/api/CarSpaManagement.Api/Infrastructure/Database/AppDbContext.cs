using CarSpaManagement.Api.Domain.Common;
using CarSpaManagement.Api.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace CarSpaManagement.Api.Infrastructure.Database;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
 public DbSet<Customer> Customers => Set<Customer>();
 public DbSet<Vehicle> Vehicles => Set<Vehicle>();
 public DbSet<Service> Services => Set<Service>();
 public DbSet<JobCard> JobCards => Set<JobCard>();
 public DbSet<JobCardService> JobCardServices => Set<JobCardService>();
 public DbSet<Staff> Staff => Set<Staff>();
 public DbSet<StaffAdvance> StaffAdvances => Set<StaffAdvance>();
 public DbSet<Showroom> Showrooms => Set<Showroom>();
 public DbSet<ShowroomStaffAssignment> ShowroomStaffAssignments => Set<ShowroomStaffAssignment>();
 public DbSet<ShowroomDailyAttendance> ShowroomDailyAttendances => Set<ShowroomDailyAttendance>();
 public DbSet<ShowroomDailyBill> ShowroomDailyBills => Set<ShowroomDailyBill>();
 public DbSet<ShowroomPayment> ShowroomPayments => Set<ShowroomPayment>();
 public DbSet<Invoice> Invoices => Set<Invoice>();
 public DbSet<InvoiceItem> InvoiceItems => Set<InvoiceItem>();
 public DbSet<Payment> Payments => Set<Payment>();
 public DbSet<User> Users => Set<User>();
 public DbSet<Permission> Permissions => Set<Permission>();
 public DbSet<UserPermission> UserPermissions => Set<UserPermission>();
 public DbSet<BusinessProfile> BusinessProfiles => Set<BusinessProfile>();
 public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
 public DbSet<InvoicePublicLink> InvoicePublicLinks => Set<InvoicePublicLink>();
 public DbSet<WhatsAppConfiguration> WhatsAppConfigurations => Set<WhatsAppConfiguration>();
 public DbSet<WhatsAppMessage> WhatsAppMessages => Set<WhatsAppMessage>();

 protected override void OnModelCreating(ModelBuilder modelBuilder)
 {
  modelBuilder.Entity<ShowroomStaffAssignment>()
   .HasIndex(s => new { s.ShowroomId, s.StaffId, s.Date });

  modelBuilder.Entity<ShowroomDailyBill>()
   .HasIndex(b => new { b.ShowroomId, b.Date });
 // Apply all IEntityTypeConfiguration implementations from this assembly
 modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);

 // Global query filter for soft delete
 foreach (var entityType in modelBuilder.Model.GetEntityTypes()
 .Where(e => typeof(BaseEntity).IsAssignableFrom(e.ClrType)))
 {
 var method = typeof(AppDbContext).GetMethod(nameof(ApplySoftDeleteFilter),
 System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance)
 ?.MakeGenericMethod(entityType.ClrType);

 if (method != null)
 {
 method.Invoke(this, [modelBuilder]);
 }
 }
 }

 private void ApplySoftDeleteFilter<T>(ModelBuilder builder) where T : BaseEntity
 {
 builder.Entity<T>().HasQueryFilter(e => !e.IsDeleted);
 }

 public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
 {
 foreach (var entry in ChangeTracker.Entries<BaseEntity>())
 {
 switch (entry.State)
 {
 case EntityState.Added:
 entry.Entity.CreatedAt = DateTime.UtcNow;
 break;
 case EntityState.Modified:
 entry.Entity.UpdatedAt = DateTime.UtcNow;
 break;
 }
 }

 return base.SaveChangesAsync(cancellationToken);
 }
}
