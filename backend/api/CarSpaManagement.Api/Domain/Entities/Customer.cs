using CarSpaManagement.Api.Domain.Common;
using System.ComponentModel.DataAnnotations;

namespace CarSpaManagement.Api.Domain.Entities;

public class Customer : BaseEntity
{
 [MaxLength(100)]
 public string Name { get; set; } = string.Empty;

 [MaxLength(20)]
 public string PhoneNumber { get; set; } = string.Empty;

 [MaxLength(100)]
 public string? Email { get; set; }

 [MaxLength(500)]
 public string? Address { get; set; }

 /// <summary>The customer agreed to receive automatic WhatsApp updates (invoice and payment messages).</summary>
 public bool WhatsAppConsent { get; set; }

 /// <summary>When the consent flag was last changed (either way).</summary>
 public DateTime? WhatsAppConsentUpdatedAtUtc { get; set; }

 /// <summary>The user who last changed the consent flag.</summary>
 public Guid? WhatsAppConsentUpdatedByUserId { get; set; }

 public List<Vehicle> Vehicles { get; set; } = new();
 public List<JobCard> JobCards { get; set; } = new();
}
