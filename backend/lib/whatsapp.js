// WhatsApp deep-link helpers.
// Tunisia phone normalization + pre-formatted message templates by reminder type.
// Returns a wa.me URL the coach can click to open a chat with the member.

const COUNTRY_CODE = '216'; // Tunisia default

// Normalize any Tunisian-ish phone input to E.164 without '+' (wa.me expects digits only).
// Accepts:  21612345678, +216 12 345 678, 12 345 678, 12345678
function normalizePhone(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, '');
  if (!digits) return null;
  // Strip leading 00 (international call prefix)
  let d = digits;
  if (d.startsWith('00216')) d = d.slice(2); // '00216...' → '216...'
  // Add country code if missing (8-digit TN local numbers)
  if (d.length === 8) d = COUNTRY_CODE + d;
  // Drop a leading 0 if user entered 0xx xxx xxx
  if (d.startsWith('0') && d.length === 9) d = COUNTRY_CODE + d.slice(1);
  return d;
}

// Build a wa.me link + the message body, depending on reminder type.
function buildLink(member, type = 'reminder', ctx = {}) {
  const phone = normalizePhone(member && member.phone);
  if (!phone) return { url: null, message: null, phone: null };

  const first = (member.name || '').split(' ')[0] || 'there';
  let message;
  switch (type) {
    case 'checkin':
      message =
        `Salut ${first} 👋 On ne t'a pas vu aujourd'hui à la salle. ` +
        `Pense à checker ton passage sur IRONLOG pour garder ton streak 🔥`;
      break;
    case 'expiring': {
      const days = ctx.daysLeft || 7;
      message =
        `Salut ${first}, ton abonnement expire dans ${days} jour${days > 1 ? 's' : ''} ⏳ ` +
        `Pense à renouveler avant la date pour ne pas perdre l'accès.`;
      break;
    }
    case 'renewal':
      message =
        `Salut ${first}, ton abonnement a expiré 🚫 ` +
        `On te garde ta place — viens renouveler quand tu peux.`;
      break;
    case 'review':
      message =
        `Salut ${first}, comment s'est passée ta semaine ? ` +
        `Si tu as 30s, dis-moi comment tu te sens sur ton programme 💪`;
      break;
    default:
      message = `Salut ${first}, ton coach sur IRONLOG.`;
  }

  return {
    url: `https://wa.me/${phone}?text=${encodeURIComponent(message)}`,
    message,
    phone,
  };
}

module.exports = { normalizePhone, buildLink };
