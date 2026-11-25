function toSafeUser(user) {
  return {
    id:        user._id ? String(user._id) : user.id,
    email:     user.email,
    name:      user.name || null,
    avatarUrl: user.avatarUrl || null,
    role:      user.role,
    createdAt: user.createdAt,
  };
}

function stripHtml(html) {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

module.exports = { toSafeUser, stripHtml, normalizeEmail };
