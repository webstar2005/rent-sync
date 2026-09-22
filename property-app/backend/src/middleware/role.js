export function requireRole(...allowed) {
  return (req, res, next) => {
    const role = req.user?.role;
    if (!role || !allowed.includes(role)) {
      return res.status(403).json({ message: `Forbidden — requires ${allowed.join('/')} role (you are ${role || 'unknown'})` });
    }
    next();
  };
}

// owner=full; when manager/staff roles are added, gate financial features with requireRole('landlord','manager')
export const requireOwnerOrAdmin = requireRole('landlord', 'admin');
