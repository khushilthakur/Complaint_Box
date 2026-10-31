const db = require('../db');

exports.getNotifications = (req, res) => {
  const user = req.user;
  if (!user) {
    return res.json({ notifications: [] });
  }

  const list = db.find('notifications', n => n.userId === user.id || (user.role === 'admin' && n.role === 'admin'))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const unreadCount = list.filter(n => !n.isRead).length;

  return res.json({
    notifications: list,
    unreadCount
  });
};

exports.markAsRead = (req, res) => {
  const { id } = req.params;
  const updated = db.update('notifications', id, { isRead: true });
  return res.json({ success: true, notification: updated });
};

exports.markAllAsRead = (req, res) => {
  const user = req.user;
  if (!user) return res.json({ success: true });

  const notifications = db.get('notifications');
  notifications.forEach(n => {
    if (n.userId === user.id || (user.role === 'admin' && n.role === 'admin')) {
      n.isRead = true;
    }
  });

  return res.json({ success: true, message: 'All notifications marked as read' });
};
