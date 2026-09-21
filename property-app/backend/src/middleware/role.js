export function requireRole(...allowed) {
  return (req, res, next) => {
    const role = req.user?.role;
    if (!role || !allowed.includes(role)) {
      return res.status(403).json({ message: `Forbidden — requires ${allowed.join('/')} role (you are ${role || 'unknown'})` });
    }
    next();
  };
}

// Convenience wrappers per PLAN.md 11.3 placeholder boundaries:
// owner=full, manager=no financial reports, staff=maintenance-only
export const requireOwnerOrAdmin = requireRole('landlord', 'admin');
export const requireManagerUp = requireRole('landlord', 'manager', 'admin');
export const requireStaffUp = requireRole('landlord', 'manager', 'admin'); // staff would be separate if tenants get login; for now treat as landlord/manager/admin
