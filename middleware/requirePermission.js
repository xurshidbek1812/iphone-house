export const requirePermission = (...requiredPermissions) => {
  return (req, res, next) => {
    const userRole = String(req.user?.role || '').toLowerCase();
    const userPermissions = Array.isArray(req.user?.permissions)
      ? req.user.permissions
      : [];

    if (userRole === 'director') {
      return next();
    }

    const hasPermission = requiredPermissions.some((permission) =>
      userPermissions.includes(permission)
    );

    if (!hasPermission) {
      return res.status(403).json({
        error: "Sizda bu amalni bajarish huquqi yo'q!"
      });
    }

    next();
  };
};